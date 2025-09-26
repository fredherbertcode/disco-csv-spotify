# Discogs to Spotify Playlist Converter

Convert your Discogs record collection CSV export into a Spotify playlist automatically.

## Features

- 📁 Upload and parse Discogs collection CSV files
- 🎵 Search for tracks on Spotify using artist and title
- 📋 Create new Spotify playlists with found tracks
- 📊 View conversion statistics and missing tracks
- 🎨 Clean, responsive web interface
- 🔐 Simple login with your existing Spotify account

## Setup Instructions

### 1. Export Your Discogs Collection

1. Log in to [Discogs.com](https://www.discogs.com)
2. Go to your Collection page
3. Click the "Export" button
4. Choose "CSV" format
5. Download the generated CSV file

### 2. Run the Application

#### Option A: Local Development
```bash
# Serve the files using a local web server
python3 -m http.server 8000
# or
npx serve .
```

Then open http://localhost:8000

#### Option B: Simple File Opening
Open `index.html` directly in your browser (note: some browsers may have CORS restrictions)

## Usage

1. **Upload CSV**: Drag and drop or select your Discogs collection CSV file
2. **Connect Spotify**: Click "Login with Spotify" to connect your account
3. **Configure Playlist**: Set playlist name, description, and privacy settings
4. **Convert**: Click "Start Conversion" to begin the process

The app will:
- Search for each track on Spotify using artist and title
- Create a new playlist in your Spotify account
- Add all found tracks to the playlist
- Show you statistics about successful matches and missing tracks

## CSV Format

The app expects Discogs CSV exports with these columns:
- `Artist` - The artist name
- `Title` - The release/album title
- `Catalog#` - Catalog number (optional)
- `Label` - Record label (optional)
- `Format` - Release format (optional)

## Troubleshooting

### Authentication Issues
- Make sure you have a valid Spotify account
- Try refreshing the page if authentication fails
- Clear your browser cache if you encounter login issues

### CSV Parsing Issues
- Ensure your CSV file is from a Discogs collection export
- Check that the file has the expected column headers
- Files with special characters may need UTF-8 encoding

### Track Matching
- The app searches using exact artist and title matches
- Some tracks may not be found due to:
  - Different spelling or formatting
  - Track not available on Spotify
  - Compilation albums vs. individual tracks

## Rate Limiting

The app includes built-in delays to respect Spotify's API rate limits. Large collections may take several minutes to process.

## Privacy

- Your Spotify credentials are never stored
- CSV data is processed locally in your browser
- No data is sent to third-party servers except Spotify's API

## License

This project is for personal use only. Spotify and Discogs are trademarks of their respective owners.