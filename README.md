# GPX Mapper

A Node.js CLI tool that converts a directory of GPX files into a static website with an interactive map. Perfect for cycling clubs to publish their frequent routes.

## Features

- **Interactive Map**: Routes displayed on OpenStreetMap vector tiles using MapLibre GL JS
- **Responsive Design**: Two-pane layout on desktop (sidebar + map), dropdown selector on mobile
- **Route Details**: Shows distance (km) and elevation gain (m) for each route
- **Shareable URLs**: Link directly to specific routes
- **GPX Downloads**: Each route includes a download link to the original GPX file
- **Unique Route Colors**: Each route gets a distinct color for easy identification
- **Static Output**: Generates a standalone website that can be hosted anywhere

## Installation

```bash
npm install
```

## Usage

```bash
npx gpx-mapper <input-dir> <output-dir> [options]
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --title <title>` | Site title | "Route Map" |
| `-V, --version` | Show version number | |
| `-h, --help` | Show help | |

### Example

```bash
# Basic usage
npx gpx-mapper ./gpx ./dist

# With custom title
npx gpx-mapper ./gpx ./dist --title "EGCC Routes"
```

## Output Structure

```
dist/
├── index.html      # Main HTML page
├── app.js          # Client-side JavaScript
├── routes.json     # Route data (loaded at runtime)
└── gpx/            # Copied GPX files for download
    ├── route1.gpx
    ├── route2.gpx
    └── ...
```

## Viewing the Generated Site

The generated site must be served via HTTP (not opened directly as a file) because it fetches `routes.json` at runtime.

```bash
# Using npx serve
npx serve ./dist

# Or any other static file server
python -m http.server 8000 --directory ./dist
```

## How It Works

1. **Build Time**: The CLI parses all GPX files in the input directory, extracts route names, coordinates, distances, and elevation data
2. **Output**: Generates a static website with the route data stored in `routes.json`
3. **Runtime**: The client-side JavaScript fetches `routes.json` and renders routes on the map

## GPX File Requirements

- Standard GPX 1.1 format
- Must contain at least one `<trk>` (track) with `<trkpt>` (track points)
- Route name is extracted from `<name>` metadata (falls back to filename)
- Elevation data (`<ele>`) is optional but enables elevation gain display

## Browser Support

Works in all modern browsers that support:
- ES6+ JavaScript
- WebGL (for MapLibre GL JS)
- Fetch API

## Dependencies

### Build-time (npm)
- `commander` - CLI argument parsing
- `gpxparser` - GPX file parsing
- `he` - HTML entity decoding

### Client-side (CDN)
- MapLibre GL JS - Map rendering
- OpenFreeMap tiles - Basemap tiles (Positron style)

## License

MIT

