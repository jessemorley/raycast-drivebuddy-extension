# DriveBuddy Search for Raycast

Search files and folders across all your indexed drives, even when they're disconnected.

## Description

This Raycast extension integrates with [DriveBuddy](https://drivebuddy.app) to let you search for files and folders on external drives, even when they're not connected to your Mac. Perfect for finding files on hard drives that are offline or stored away.

## Features

- **Offline Search**: Search drives even when disconnected
- **Fast Results**: Searches pre-built indexes for instant results
- **Fuzzy Matching**: Intelligent search using Levenshtein distance algorithm
  - Finds files even with typos or partial matches
  - Prioritizes exact matches and substring matches
  - Filters out weak matches (score threshold: 60/100)
- **Smart Sorting**: Results ranked by match quality score
- **Drive Status**: See which drives are currently connected (color-coded indicators)
- **Multiple Actions**: Copy paths, open in Finder, view drive info
- **Clean UI**: Filename as title, directory path as subtitle, drive name right-aligned

## Requirements

- macOS
- [Raycast](https://raycast.com)
- [DriveBuddy](https://drivebuddy.app) installed and configured
- At least one drive indexed by DriveBuddy

## Installation

### Option 1: Import from Source (Recommended for Development)

1. Clone this repository or copy the extension folder
2. Open Terminal and navigate to the extension directory:
   ```bash
   cd drivebuddy-raycast
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Import into Raycast:
   ```bash
   npm run dev
   ```
5. The extension will appear in Raycast automatically

### Option 2: Manual Installation

1. Copy the entire `drivebuddy-raycast` folder to:
   ```
   ~/.config/raycast/extensions/
   ```
2. Install dependencies:
   ```bash
   cd ~/.config/raycast/extensions/drivebuddy-raycast
   npm install
   ```
3. Restart Raycast or run the "Reload Extensions" command

## Usage

1. Open Raycast (⌘ Space)
2. Type "Search Drives" or start typing your search query
3. Results will show files and folders from all indexed drives
4. Use the following actions:
   - **⌘ C**: Copy full path
   - **⌘ ⇧ C**: Copy relative path
   - **⌘ ⌥ C**: Copy filename only
   - **⌘ O**: Open in Finder (if drive is connected)
   - **⌘ R**: Reveal in Finder (if drive is connected)
   - **⌘ I**: Show drive information

## How It Works

DriveBuddy creates search indexes for your external drives and stores them in:
```
~/Library/Application Support/DriveBuddy/SearchIndexes/
```

This extension reads those JSON indexes to provide fast, offline search capabilities. The indexes are updated by DriveBuddy whenever you connect and scan a drive.

### Fuzzy Matching Algorithm

The extension uses the **Levenshtein distance** algorithm (via `fastest-levenshtein` library) to calculate match scores:

1. **Perfect Match** (100 points): Exact filename match
2. **Substring Match** (90-100 points): Query is contained in filename
   - Score weighted by query/filename length ratio
   - Example: "test" in "test.txt" scores higher than "test" in "my_test_document.txt"
3. **Fuzzy Match** (0-90 points): Based on edit distance
   - Calculates minimum character changes needed
   - Normalized by string length
   - Only results scoring above 60 are shown

**Examples:**
- `test` → `test.txt`: 95 ✓
- `test` → `testing`: 95.7 ✓
- `test` → `latest`: 96.7 ✓
- `test` → `trash`: 40 ✗ (filtered out)

Results are sorted by match score (highest first), then by drive name and path alphabetically.

## Preferences

- **Show Drive Status**: Display connection status for each drive
- **Max Results**: Limit the number of search results (default: 100)

## Data Format

The extension reads DriveBuddy's search index files which contain:
- File and folder names (lowercase for case-insensitive search)
- Relative paths from the drive root
- Index generation timestamp

Drive metadata is read from:
```
~/Library/Preferences/UE5.DriveBuddy.plist
```

## Troubleshooting

### No drives showing up
- Make sure DriveBuddy is installed
- Connect an external drive and scan it in DriveBuddy
- Check that indexes exist in `~/Library/Application Support/DriveBuddy/SearchIndexes/`

### Search not working
- Try re-indexing your drives in DriveBuddy
- Check the Raycast logs for errors
- Ensure DriveBuddy permissions are properly configured

### Drive appears offline but is connected
- The extension checks for drives in `/Volumes/[DriveName]`
- If your drive is mounted elsewhere, it may show as offline
- Try ejecting and reconnecting the drive

## Development

### Building
```bash
npm run build
```

### Linting
```bash
npm run lint
```

### Fix Linting Issues
```bash
npm run fix-lint
```

## Credits

- Built for use with [DriveBuddy](https://drivebuddy.app)
- Created using the [Raycast API](https://developers.raycast.com)

## License

MIT
