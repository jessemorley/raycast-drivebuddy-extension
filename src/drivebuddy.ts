import { homedir } from "os";
import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { join } from "path";
import { execFileSync } from "child_process";

export interface SearchEntry {
  name: string;
  relativePath: string;
}

export interface SearchIndex {
  generatedAt: number;
  entries: SearchEntry[];
}

export interface DriveInfo {
  volumeUUID: string;
  name: string;
  path: string;
  totalSize?: number;
  availableSize?: number;
  summary?: string;
  lastSeen?: number;
}

export interface SearchResult {
  entry: SearchEntry;
  driveUUID: string;
  driveName: string;
  indexFile: string;
}

/**
 * Decodes a Base64-encoded volume UUID from a filename
 * Example: NkI3NUVEMjItMDMzMi0zQTVDLTgyNTItMTU2ODFGQjAxRTRB.json -> 6B75ED22-0332-3A5C-8252-15681FB01E4A
 */
export function decodeVolumeUUID(filename: string): string {
  try {
    const base64 = filename.replace(".json", "");
    const buffer = Buffer.from(base64, "base64");
    return buffer.toString("ascii");
  } catch (error) {
    return filename.replace(".json", "");
  }
}

/**
 * Encodes a volume UUID to Base64 for filename lookup
 */
export function encodeVolumeUUID(uuid: string): string {
  return Buffer.from(uuid, "ascii").toString("base64");
}

/**
 * Converts Apple CFAbsoluteTime to JavaScript Date
 * CFAbsoluteTime is seconds since 2001-01-01 00:00:00 UTC
 */
export function cfAbsoluteTimeToDate(cfTime: number): Date {
  const EPOCH_OFFSET = 978307200; // Seconds between 1970 and 2001
  return new Date((cfTime + EPOCH_OFFSET) * 1000);
}

/**
 * Loads drive information from DriveBuddy preferences
 */
export function loadDriveInfo(): Map<string, DriveInfo> {
  const driveMap = new Map<string, DriveInfo>();

  try {
    const prefsPath = join(homedir(), "Library/Preferences/UE5.DriveBuddy.plist");

    if (!existsSync(prefsPath)) {
      return driveMap;
    }

    // Convert binary plist to XML using plutil (native macOS tool)
    const xmlOutput = execFileSync("plutil", ["-convert", "xml1", "-o", "-", prefsPath], {
      encoding: "utf8",
    });

    // Parse DriveLogByKey from XML (contains the actual drive metadata)
    const driveLogMatch = xmlOutput.match(/<key>DriveLogByKey<\/key>\s*<data>\s*([^<]+)\s*<\/data>/);
    if (driveLogMatch) {
      const base64Data = driveLogMatch[1].replace(/\s/g, "");
      const driveLogJson = Buffer.from(base64Data, "base64").toString("utf8");
      const driveLog = JSON.parse(driveLogJson);

      Object.entries(driveLog).forEach(([uuid, data]: [string, any]) => {
        if (data.lastKnown) {
          driveMap.set(uuid, {
            volumeUUID: uuid,
            name: data.lastKnown.name,
            path: data.lastKnown.path,
            totalSize: data.lastKnown.totalSize,
            availableSize: data.lastKnown.availableSize,
            summary: data.lastKnown.summary,
            lastSeen: data.lastSeen,
          });
        }
      });
    }
  } catch (error) {
    console.error("Failed to load drive info:", error);
  }

  return driveMap;
}

/**
 * Simplified streaming search - reads file in small chunks, processes incrementally
 * Much more memory efficient than full JSON.parse()
 */
async function streamSearchIndexFile(
  filePath: string,
  query: string,
  maxResults: number,
  currentResults: SearchResult[],
  driveUUID: string,
  driveName: string,
  indexFile: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const readline = require("readline");
    const fs = require("fs");

    const stream = fs.createReadStream(filePath, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    let currentEntry = "";
    let braceCount = 0;
    let inEntries = false;

    rl.on("line", (line: string) => {
      // Stop if we have enough results
      if (currentResults.length >= maxResults) {
        rl.close();
        stream.destroy();
        return;
      }

      // Check if we've found the entries array
      if (!inEntries && line.includes('"entries"')) {
        inEntries = true;
        // Extract everything after "entries": [
        const match = line.match(/"entries"\s*:\s*\[(.*)$/);
        if (match) {
          line = match[1];
        }
      }

      if (!inEntries) return;

      // Track braces to find complete entry objects
      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === "{") {
          if (braceCount === 0) currentEntry = "";
          braceCount++;
        }

        if (braceCount > 0) {
          currentEntry += char;
        }

        if (char === "}") {
          braceCount--;

          if (braceCount === 0 && currentEntry.length > 2) {
            // Complete entry found - parse and search
            try {
              const entry = JSON.parse(currentEntry) as SearchEntry;

              if (entry.name && entry.relativePath) {
                // Search filename only, not parent folder paths
                if (entry.name.includes(query)) {
                  currentResults.push({
                    entry,
                    driveUUID,
                    driveName,
                    indexFile,
                  });

                  if (currentResults.length >= maxResults) {
                    rl.close();
                    stream.destroy();
                    return;
                  }
                }
              }
            } catch (e) {
              // Skip malformed entries
            }

            currentEntry = "";
          }
        }
      }
    });

    rl.on("close", resolve);
    rl.on("error", reject);
    stream.on("error", reject);
  });
}

/**
 * Searches across all indexed drives with streaming (async, no memory limit)
 */
export async function searchDrivesAsync(query: string, maxResults: number = 100): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase().trim();

  if (!lowerQuery) {
    return results;
  }

  const indexDir = join(homedir(), "Library/Application Support/DriveBuddy/SearchIndexes");

  if (!existsSync(indexDir)) {
    return results;
  }

  const driveInfo = loadDriveInfo();

  try {
    const files = readdirSync(indexDir).filter((f) => f.endsWith(".json"));

    // Process smallest index files first for faster initial results
    const fileStats = files.map((f) => {
      try {
        const stats = statSync(join(indexDir, f));
        return { file: f, size: stats.size };
      } catch {
        return { file: f, size: 0 };
      }
    });
    fileStats.sort((a, b) => a.size - b.size);

    // Process each drive's index file with streaming
    for (const { file } of fileStats) {
      if (results.length >= maxResults) {
        break;
      }

      const uuid = decodeVolumeUUID(file);
      const drive = driveInfo.get(uuid);
      const driveName = drive?.name || `Unknown Drive`;

      try {
        await streamSearchIndexFile(
          join(indexDir, file),
          lowerQuery,
          maxResults,
          results,
          uuid,
          driveName,
          file
        );
      } catch (error) {
        console.error(`Failed to stream search index ${file}:`, error);
      }
    }
  } catch (error) {
    console.error("Failed to search drives:", error);
  }

  // Sort results: prioritize matches in filename over path
  results.sort((a, b) => {
    const aNameMatch = a.entry.name.includes(lowerQuery);
    const bNameMatch = b.entry.name.includes(lowerQuery);

    if (aNameMatch && !bNameMatch) return -1;
    if (!aNameMatch && bNameMatch) return 1;

    // Secondary sort by drive name, then by path
    if (a.driveName !== b.driveName) {
      return a.driveName.localeCompare(b.driveName);
    }

    return a.entry.relativePath.localeCompare(b.entry.relativePath);
  });

  return results.slice(0, maxResults);
}

/**
 * Searches across all indexed drives (synchronous fallback, with size limit)
 */
export function searchDrives(query: string, maxResults: number = 100): SearchResult[] {
  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase().trim();

  if (!lowerQuery) {
    return results;
  }

  const indexDir = join(homedir(), "Library/Application Support/DriveBuddy/SearchIndexes");

  if (!existsSync(indexDir)) {
    return results;
  }

  const driveInfo = loadDriveInfo();

  try {
    const files = readdirSync(indexDir).filter((f) => f.endsWith(".json"));

    // Process smallest index files first to avoid loading huge files
    const fileStats = files.map((f) => {
      try {
        const stats = statSync(join(indexDir, f));
        return { file: f, size: stats.size };
      } catch {
        return { file: f, size: 0 };
      }
    });
    fileStats.sort((a, b) => a.size - b.size);

    // Process each drive's index file separately to avoid loading all at once
    // Note: This synchronous version is now a fallback only - use searchDrivesAsync for large files
    for (const { file, size } of fileStats) {
      // Stop early if we have enough results
      if (results.length >= maxResults) {
        break;
      }

      try {
        const content = readFileSync(join(indexDir, file), "utf8");
        const index = JSON.parse(content) as SearchIndex;
        const uuid = decodeVolumeUUID(file);
        const drive = driveInfo.get(uuid);
        const driveName = drive?.name || `Unknown Drive`;

        // Search through entries with early exit
        for (const entry of index.entries) {
          if (entry.name.includes(lowerQuery) || entry.relativePath.toLowerCase().includes(lowerQuery)) {
            results.push({
              entry,
              driveUUID: uuid,
              driveName,
              indexFile: file,
            });

            // Early exit as soon as we have enough results
            if (results.length >= maxResults) {
              break;
            }
          }
        }
      } catch (error) {
        console.error(`Failed to search index ${file}:`, error);
      }
    }
  } catch (error) {
    console.error("Failed to search drives:", error);
  }

  // Sort results: prioritize matches in filename over path
  results.sort((a, b) => {
    const aNameMatch = a.entry.name.includes(lowerQuery);
    const bNameMatch = b.entry.name.includes(lowerQuery);

    if (aNameMatch && !bNameMatch) return -1;
    if (!aNameMatch && bNameMatch) return 1;

    // Secondary sort by drive name, then by path
    if (a.driveName !== b.driveName) {
      return a.driveName.localeCompare(b.driveName);
    }

    return a.entry.relativePath.localeCompare(b.entry.relativePath);
  });

  // Return only the requested number of results
  return results.slice(0, maxResults);
}

/**
 * Checks if a drive is currently mounted
 */
export function isDriveMounted(driveName: string): boolean {
  try {
    const volumesPath = `/Volumes/${driveName}`;
    return existsSync(volumesPath);
  } catch {
    return false;
  }
}

/**
 * Gets the full path for a file on a drive
 */
export function getFullPath(driveName: string, relativePath: string): string {
  return `/Volumes/${driveName}/${relativePath}`;
}

