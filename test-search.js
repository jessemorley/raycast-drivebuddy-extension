#!/usr/bin/env node

// Simple test script to verify DriveBuddy index reading works
const { homedir } = require("os");
const { readFileSync, readdirSync, existsSync } = require("fs");
const { join } = require("path");

function decodeVolumeUUID(filename) {
  try {
    const base64 = filename.replace(".json", "");
    const buffer = Buffer.from(base64, "base64");
    return buffer.toString("ascii");
  } catch (error) {
    return filename.replace(".json", "");
  }
}

function loadAllIndexes() {
  const indexes = new Map();
  const indexDir = join(homedir(), "Library/Application Support/DriveBuddy/SearchIndexes");

  if (!existsSync(indexDir)) {
    console.log("❌ DriveBuddy SearchIndexes directory not found at:", indexDir);
    return indexes;
  }

  console.log("✅ Found DriveBuddy SearchIndexes directory");

  try {
    const files = readdirSync(indexDir).filter((f) => f.endsWith(".json"));
    console.log(`📁 Found ${files.length} index file(s)`);

    for (const file of files) {
      try {
        const content = readFileSync(join(indexDir, file), "utf8");
        const index = JSON.parse(content);
        const uuid = decodeVolumeUUID(file);
        indexes.set(uuid, index);
        console.log(`  - ${file} -> UUID: ${uuid}`);
        console.log(`    Entries: ${index.entries.length}, Generated: ${new Date((index.generatedAt + 978307200) * 1000).toLocaleString()}`);
      } catch (error) {
        console.error(`  ❌ Failed to load index ${file}:`, error.message);
      }
    }
  } catch (error) {
    console.error("❌ Failed to load indexes:", error.message);
  }

  return indexes;
}

function searchDrives(query, indexes) {
  const results = [];
  const lowerQuery = query.toLowerCase().trim();

  for (const [uuid, index] of indexes) {
    for (const entry of index.entries) {
      if (entry.name.includes(lowerQuery) || entry.relativePath.toLowerCase().includes(lowerQuery)) {
        results.push({
          uuid,
          name: entry.name,
          path: entry.relativePath,
        });
      }
    }
  }

  return results;
}

// Main test
console.log("=".repeat(60));
console.log("DriveBuddy Search Test");
console.log("=".repeat(60));
console.log();

const indexes = loadAllIndexes();

if (indexes.size === 0) {
  console.log("\n⚠️  No indexes loaded. Make sure:");
  console.log("  1. DriveBuddy is installed");
  console.log("  2. You have scanned at least one drive");
  console.log("  3. Indexes exist at: ~/Library/Application Support/DriveBuddy/SearchIndexes/");
  process.exit(1);
}

console.log();
console.log("=".repeat(60));
console.log("Test Search");
console.log("=".repeat(60));

// Test with a common search term
const testQuery = process.argv[2] || "mp4";
console.log(`\nSearching for: "${testQuery}"\n`);

const results = searchDrives(testQuery, indexes);
console.log(`Found ${results.length} result(s)`);

if (results.length > 0) {
  console.log("\nFirst 10 results:");
  results.slice(0, 10).forEach((result, i) => {
    console.log(`  ${i + 1}. ${result.name}`);
    console.log(`     Path: ${result.path}`);
    console.log(`     Drive: ${result.uuid.substring(0, 8)}...`);
  });
}

console.log();
console.log("=".repeat(60));
console.log("✅ Test complete!");
console.log("=".repeat(60));
