#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import gpxParser from 'gpxparser';
import he from 'he';
import { Command } from 'commander';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color palette for routes - distinct, accessible colors
const ROUTE_COLORS = [
  '#e6194b', // red
  '#3cb44b', // green
  '#4363d8', // blue
  '#f58231', // orange
  '#911eb4', // purple
  '#46f0f0', // cyan
  '#f032e6', // magenta
  '#bcf60c', // lime
  '#fabebe', // pink
  '#008080', // teal
  '#e6beff', // lavender
  '#9a6324', // brown
  '#fffac8', // beige
  '#800000', // maroon
  '#aaffc3', // mint
  '#808000', // olive
  '#ffd8b1', // apricot
  '#000075', // navy
];

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate total distance of a route from track points
 */
function calculateRouteDistance(points) {
  let distance = 0;
  for (let i = 1; i < points.length; i++) {
    distance += haversineDistance(
      points[i - 1].lat, points[i - 1].lon,
      points[i].lat, points[i].lon
    );
  }
  return distance;
}

/**
 * Calculate total elevation gain from track points
 * Only counts positive elevation changes (climbing)
 */
function calculateElevationGain(points) {
  let gain = 0;
  let hasElevation = false;
  
  for (let i = 1; i < points.length; i++) {
    const prevEle = points[i - 1].ele;
    const currEle = points[i].ele;
    
    // Check if elevation data exists
    if (prevEle != null && currEle != null) {
      hasElevation = true;
      const diff = currEle - prevEle;
      if (diff > 0) {
        gain += diff;
      }
    }
  }
  
  // Return null if no elevation data was found
  return hasElevation ? gain : null;
}

/**
 * Parse a GPX file and extract route data
 */
function parseGpxFile(filePath, filename) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const gpx = new gpxParser();
  gpx.parse(content);
  
  // Get route name from metadata or fall back to filename
  let name = gpx.metadata?.name || gpx.tracks?.[0]?.name;
  if (!name) {
    // Remove extension and clean up filename
    name = path.basename(filename, '.gpx');
  }
  
  // Decode any HTML entities in the name
  name = he.decode(name);
  
  // Extract track points
  const points = [];
  if (gpx.tracks && gpx.tracks.length > 0) {
    for (const track of gpx.tracks) {
      for (const segment of track.points) {
        points.push({
          lat: segment.lat,
          lon: segment.lon,
          ele: segment.ele
        });
      }
    }
  }
  
  // Calculate distance
  const distance = calculateRouteDistance(points);
  
  // Calculate elevation gain
  const elevationGain = calculateElevationGain(points);
  
  // Calculate bounds
  let minLat = Infinity, maxLat = -Infinity;
  let minLon = Infinity, maxLon = -Infinity;
  
  for (const point of points) {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLon = Math.min(minLon, point.lon);
    maxLon = Math.max(maxLon, point.lon);
  }
  
  // Convert to GeoJSON coordinates [lon, lat]
  const coordinates = points.map(p => [p.lon, p.lat]);
  
  return {
    name,
    filename,
    distance: Math.round(distance * 10) / 10, // Round to 1 decimal
    elevationGain: elevationGain != null ? Math.round(elevationGain) : null, // Round to nearest meter
    bounds: [[minLon, minLat], [maxLon, maxLat]],
    coordinates
  };
}

/**
 * Create a URL-safe slug from a route name
 */
function createSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate the HTML file from template
 */
function generateHtml(title) {
  const templatePath = path.join(__dirname, 'templates', 'index.html');
  let html = fs.readFileSync(templatePath, 'utf-8');
  
  const escapedTitle = title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/\{\{TITLE\}\}/g, escapedTitle);
  
  return html;
}

/**
 * Generate the routes JSON data
 */
function generateRoutesJson(routes) {
  return JSON.stringify(routes.map((r, i) => ({
    id: createSlug(r.name),
    name: r.name,
    filename: r.filename,
    distance: r.distance,
    elevationGain: r.elevationGain,
    bounds: r.bounds,
    coordinates: r.coordinates,
    color: ROUTE_COLORS[i % ROUTE_COLORS.length]
  })), null, 2);
}

/**
 * Generate the JavaScript file from template
 */
function generateJs() {
  const templatePath = path.join(__dirname, 'templates', 'app.js');
  return fs.readFileSync(templatePath, 'utf-8');
}

/**
 * Main function
 */
async function main() {
  const program = new Command();
  
  program
    .name('gpx-mapper')
    .description('Convert a directory of GPX files into a static website with an interactive map')
    .version('1.0.0')
    .argument('<input-dir>', 'Directory containing GPX files')
    .argument('<output-dir>', 'Output directory for the generated website')
    .option('-t, --title <title>', 'Site title', 'Route Map')
    .parse();
  
  const [inputArg, outputArg] = program.args;
  const { title } = program.opts();
  
  const inputDir = path.resolve(inputArg);
  const outputDir = path.resolve(outputArg);
  
  // Validate input directory
  if (!fs.existsSync(inputDir)) {
    console.error(`Error: Input directory "${inputDir}" does not exist`);
    process.exit(1);
  }
  
  // Find GPX files
  const files = fs.readdirSync(inputDir).filter(f => f.toLowerCase().endsWith('.gpx'));
  
  if (files.length === 0) {
    console.error(`Error: No GPX files found in "${inputDir}"`);
    process.exit(1);
  }
  
  console.log(`Found ${files.length} GPX file(s)`);
  
  // Parse all GPX files
  const routes = [];
  for (const file of files) {
    console.log(`  Parsing: ${file}`);
    try {
      const route = parseGpxFile(path.join(inputDir, file), file);
      routes.push(route);
      console.log(`    → ${route.name} (${route.distance} km)`);
    } catch (err) {
      console.error(`    Error parsing ${file}: ${err.message}`);
    }
  }
  
  if (routes.length === 0) {
    console.error('Error: No valid routes were parsed');
    process.exit(1);
  }
  
  // Sort routes alphabetically by name
  routes.sort((a, b) => a.name.localeCompare(b.name));
  
  // Create output directory
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(path.join(outputDir, 'gpx'), { recursive: true });
  
  // Copy GPX files to output
  console.log('\nCopying GPX files...');
  for (const file of files) {
    fs.copyFileSync(
      path.join(inputDir, file),
      path.join(outputDir, 'gpx', file)
    );
  }
  
  // Generate HTML
  console.log('Generating index.html...');
  const html = generateHtml(title);
  fs.writeFileSync(path.join(outputDir, 'index.html'), html);
  
  // Generate routes JSON
  console.log('Generating routes.json...');
  const routesJson = generateRoutesJson(routes);
  fs.writeFileSync(path.join(outputDir, 'routes.json'), routesJson);
  
  // Generate JavaScript
  console.log('Generating app.js...');
  const js = generateJs();
  fs.writeFileSync(path.join(outputDir, 'app.js'), js);
  
  console.log(`\n✓ Site generated successfully in "${outputDir}"`);
  console.log(`  ${routes.length} route(s) included`);
  console.log('\nTo view the site, serve the output directory with a web server:');
  console.log(`  npx serve ${outputDir}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

