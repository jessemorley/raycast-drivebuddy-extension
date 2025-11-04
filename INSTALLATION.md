# Installation Guide for DriveBuddy Raycast Extension

## Quick Start

Follow these steps to install the DriveBuddy Search extension in Raycast:

### Step 1: Prerequisites

1. **Install Raycast**: Download from [raycast.com](https://raycast.com) if not already installed
2. **Install DriveBuddy**: Download from the App Store or [drivebuddy.app](https://drivebuddy.app)
3. **Index Your Drives**: Connect external drives and scan them in DriveBuddy to create indexes

### Step 2: Install the Extension

There are two ways to install this extension:

#### Option A: Using Raycast (Easiest)

1. Open Raycast (`⌘ Space`)
2. Type "Import Extension" and select it
3. Navigate to this folder: `/Users/jmorley/dev/drive-buddy/drivebuddy-raycast`
4. Select the folder and import
5. Raycast will automatically install dependencies and load the extension

#### Option B: Manual Development Mode

1. Open Terminal and navigate to the extension folder:
   ```bash
   cd /Users/jmorley/dev/drive-buddy/drivebuddy-raycast
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development mode:
   ```bash
   npm run dev
   ```

4. The extension will appear in Raycast automatically

### Step 3: Test the Extension

1. Open Raycast (`⌘ Space`)
2. Type "Search Drives" or just start typing a file name
3. You should see search results from all your indexed drives

### Step 4: Verify It Works

To verify the extension has access to your DriveBuddy indexes, you can run the included test script:

```bash
cd /Users/jmorley/dev/drive-buddy/drivebuddy-raycast
node test-search.js "your-search-term"
```

This will show you:
- How many drives are indexed
- How many files are in each index
- Sample search results

## Troubleshooting

### No results appearing

**Check if DriveBuddy has created indexes:**
```bash
ls -lh ~/Library/Application\ Support/DriveBuddy/SearchIndexes/
```

You should see one or more `.json` files. If not:
1. Open DriveBuddy
2. Connect an external drive
3. Click "Scan Drive" or wait for auto-scan
4. Verify the index file appears

### Extension not showing in Raycast

1. Check that Raycast is running
2. Try restarting Raycast: Open Raycast > Quit Raycast, then relaunch
3. Run "Reload Extensions" command in Raycast
4. Verify extension is in development mode: `npm run dev`

### TypeScript Warnings

You may see TypeScript warnings when running `npx tsc --noEmit`. These are related to React 18 type definitions and do not affect functionality. The extension will work correctly in Raycast despite these warnings.

### Permission Issues

If you get permission errors accessing DriveBuddy files:
1. Check that DriveBuddy has Full Disk Access in System Settings
2. Verify the index files exist and are readable:
   ```bash
   cat ~/Library/Application\ Support/DriveBuddy/SearchIndexes/*.json | jq . | head
   ```

## Features

Once installed, you can:

- **Search across all drives**: Type any filename or folder name
- **Copy paths**: Use `⌘ C` to copy the full path
- **Open files**: Use `⌘ O` to open in Finder (if drive is connected)
- **View drive info**: Use `⌘ I` to see drive details
- **See connection status**: Green dot = connected, gray dot = offline

## Configuration

After installation, you can configure preferences in Raycast:

1. Open Raycast
2. Search for "Search Drives"
3. Press `⌘ ,` to open extension preferences
4. Configure:
   - **Show Drive Status**: Toggle connection indicators
   - **Maximum Results**: Limit number of search results (default: 100)

## Updating DriveBuddy Indexes

The extension reads indexes created by DriveBuddy. To update them:

1. Connect your external drive
2. Open DriveBuddy
3. The app will automatically rescan, or click "Rescan Drive"
4. New files will immediately be available in Raycast searches

## Uninstalling

To remove the extension:

1. Open Raycast
2. Type "Manage Extensions"
3. Find "DriveBuddy Search"
4. Click the "..." menu and select "Remove Extension"

Or manually remove the development extension:
```bash
rm -rf /Users/jmorley/dev/drive-buddy/drivebuddy-raycast
```

Then reload Raycast extensions.

## Support

For issues with:
- **The extension**: Check the README.md or test with `test-search.js`
- **DriveBuddy**: Visit [drivebuddy.app](https://drivebuddy.app)
- **Raycast**: Visit [developers.raycast.com](https://developers.raycast.com)

## Next Steps

1. Index more drives in DriveBuddy
2. Customize keyboard shortcuts in Raycast
3. Set "Search Drives" as an alias for quick access
4. Consider publishing to the Raycast Store (see README.md)
