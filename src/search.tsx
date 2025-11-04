import React, { useState, useEffect } from "react";
import { List, Action, ActionPanel, Icon, Color, showToast, Toast, Keyboard, getPreferenceValues, open } from "@raycast/api";
import { useCachedState } from "@raycast/utils";
import {
  searchDrives,
  searchDrivesAsync,
  SearchResult,
  isDriveMounted,
  getFullPath,
  getRecentFiles,
  recordFileAccess,
} from "./drivebuddy";

interface Preferences {
  showDriveStatus: boolean;
  maxResults: string;
}

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const preferences = getPreferenceValues<Preferences>();


  useEffect(() => {
    if (!searchText.trim()) {
      // Load recent files when no search text
      setIsLoading(true);
      const recentFiles = getRecentFiles(20);
      setResults(recentFiles);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const maxResults = parseInt(preferences.maxResults || "100");
        // Use async streaming search to handle large files without memory issues
        const searchResults = await searchDrivesAsync(searchText, maxResults);
        setResults(searchResults);
      } catch (error) {
        console.error("Search error:", error);
        showToast({
          style: Toast.Style.Failure,
          title: "Search Failed",
          message: String(error),
        });
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 200); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [searchText, preferences.maxResults]);

  const getSubtitle = (result: SearchResult): string => {
    // Get the parent directory path (everything except the filename)
    const pathParts = result.entry.relativePath.split('/');
    const parentPath = pathParts.slice(0, -1).join('/');

    return parentPath || '/';
  };

  const getAccessories = (result: SearchResult) => {
    const accessories = [];

    // Add drive name
    accessories.push({
      text: result.driveName,
    });

    // Show drive status icon
    if (preferences.showDriveStatus) {
      const mounted = isDriveMounted(result.driveName);
      accessories.push({
        icon: {
          source: mounted ? Icon.CircleFilled : Icon.Circle,
          tintColor: mounted ? Color.Green : Color.SecondaryText,
        },
        tooltip: mounted ? "Drive Connected" : "Drive Offline",
      });
    }

    return accessories;
  };

  const handleRevealInFinder = async (result: SearchResult, fullPath: string) => {
    recordFileAccess(result.driveUUID, result.entry.relativePath);
    await open(fullPath, "Finder");
  };

  const handleOpenFile = async (result: SearchResult, fullPath: string) => {
    recordFileAccess(result.driveUUID, result.entry.relativePath);
    await open(fullPath);
  };

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search files and folders across all drives..."
      throttle
      searchText={searchText}
    >
      {results.length === 0 && !isLoading && !searchText ? (
        <List.EmptyView
          icon={Icon.Clock}
          title="No Recent Files"
          description="Recently accessed files will appear here. Start searching to find files!"
        />
      ) : !searchText && results.length > 0 ? (
        results.map((result, index) => {
          const fullPath = getFullPath(result.driveName, result.entry.relativePath);
          const mounted = isDriveMounted(result.driveName);

          return (
            <List.Item
              key={`recent-${result.driveUUID}-${index}`}
              title={result.entry.name}
              subtitle={getSubtitle(result)}
              accessories={getAccessories(result)}
              icon={{
                source: Icon.Clock,
                tintColor: Color.Blue,
              }}
              actions={
                <ActionPanel>
                  {mounted ? (
                    <>
                      <ActionPanel.Section title="File Actions">
                        <Action
                          title="Reveal in Finder"
                          icon={Icon.Finder}
                          onAction={() => handleRevealInFinder(result, fullPath)}
                        />
                        <Action
                          title="Open File"
                          icon={Icon.Document}
                          shortcut={Keyboard.Shortcut.Common.Open}
                          onAction={() => handleOpenFile(result, fullPath)}
                        />
                      </ActionPanel.Section>
                      <ActionPanel.Section title="Copy">
                        <Action.CopyToClipboard
                          title="Copy Full Path"
                          content={fullPath}
                          shortcut={Keyboard.Shortcut.Common.Copy}
                        />
                        <Action.CopyToClipboard
                          title="Copy Relative Path"
                          content={result.entry.relativePath}
                          shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                        />
                        <Action.CopyToClipboard
                          title="Copy Filename"
                          content={result.entry.name}
                          shortcut={{ modifiers: ["cmd", "opt"], key: "c" }}
                        />
                      </ActionPanel.Section>
                    </>
                  ) : (
                    <ActionPanel.Section title="Copy">
                      <Action.CopyToClipboard
                        title="Copy Full Path"
                        content={fullPath}
                        shortcut={Keyboard.Shortcut.Common.Copy}
                      />
                      <Action.CopyToClipboard
                        title="Copy Relative Path"
                        content={result.entry.relativePath}
                        shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                      />
                      <Action.CopyToClipboard
                        title="Copy Filename"
                        content={result.entry.name}
                        shortcut={{ modifiers: ["cmd", "opt"], key: "c" }}
                      />
                    </ActionPanel.Section>
                  )}

                  <ActionPanel.Section title="Info">
                    <Action
                      title={mounted ? "Drive Connected" : "Drive Offline"}
                      icon={mounted ? Icon.CircleFilled : Icon.Circle}
                      onAction={() =>
                        showToast({
                          style: mounted ? Toast.Style.Success : Toast.Style.Animated,
                          title: mounted
                            ? `${result.driveName} is connected`
                            : `${result.driveName} is offline`,
                          message: mounted ? `Available at /Volumes/${result.driveName}` : "Connect the drive to access files",
                        })
                      }
                    />
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          );
        })
      ) : results.length === 0 && !isLoading ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="No Results Found"
          description={`No files or folders matching "${searchText}"`}
        />
      ) : (
        results.map((result, index) => {
          const fullPath = getFullPath(result.driveName, result.entry.relativePath);
          const mounted = isDriveMounted(result.driveName);

          return (
            <List.Item
              key={`${result.driveUUID}-${index}`}
              title={result.entry.name}
              subtitle={getSubtitle(result)}
              accessories={getAccessories(result)}
              icon={{
                source: Icon.Document,
                tintColor: Color.Blue,
              }}
              actions={
                <ActionPanel>
                  {mounted ? (
                    <>
                      <ActionPanel.Section title="File Actions">
                        <Action
                          title="Reveal in Finder"
                          icon={Icon.Finder}
                          onAction={() => handleRevealInFinder(result, fullPath)}
                        />
                        <Action
                          title="Open File"
                          icon={Icon.Document}
                          shortcut={Keyboard.Shortcut.Common.Open}
                          onAction={() => handleOpenFile(result, fullPath)}
                        />
                      </ActionPanel.Section>
                      <ActionPanel.Section title="Copy">
                        <Action.CopyToClipboard
                          title="Copy Full Path"
                          content={fullPath}
                          shortcut={Keyboard.Shortcut.Common.Copy}
                        />
                        <Action.CopyToClipboard
                          title="Copy Relative Path"
                          content={result.entry.relativePath}
                          shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                        />
                        <Action.CopyToClipboard
                          title="Copy Filename"
                          content={result.entry.name}
                          shortcut={{ modifiers: ["cmd", "opt"], key: "c" }}
                        />
                      </ActionPanel.Section>
                    </>
                  ) : (
                    <ActionPanel.Section title="Copy">
                      <Action.CopyToClipboard
                        title="Copy Full Path"
                        content={fullPath}
                        shortcut={Keyboard.Shortcut.Common.Copy}
                      />
                      <Action.CopyToClipboard
                        title="Copy Relative Path"
                        content={result.entry.relativePath}
                        shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                      />
                      <Action.CopyToClipboard
                        title="Copy Filename"
                        content={result.entry.name}
                        shortcut={{ modifiers: ["cmd", "opt"], key: "c" }}
                      />
                    </ActionPanel.Section>
                  )}

                  <ActionPanel.Section title="Info">
                    <Action
                      title={mounted ? "Drive Connected" : "Drive Offline"}
                      icon={mounted ? Icon.CircleFilled : Icon.Circle}
                      onAction={() =>
                        showToast({
                          style: mounted ? Toast.Style.Success : Toast.Style.Animated,
                          title: mounted
                            ? `${result.driveName} is connected`
                            : `${result.driveName} is offline`,
                          message: mounted ? `Available at /Volumes/${result.driveName}` : "Connect the drive to access files",
                        })
                      }
                    />
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          );
        })
      )}
    </List>
  );
}
