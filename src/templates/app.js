// GPX Route Mapper - Client Side Application

(async function() {
  'use strict';

  let routes;
  let map;
  let currentRouteId = null;

  // Load routes from JSON file
  async function loadRoutes() {
    const response = await fetch('routes.json');
    if (!response.ok) {
      throw new Error('Failed to load routes.json');
    }
    return response.json();
  }

  // Calculate combined bounds of all routes
  function getAllBounds() {
    let minLon = Infinity, minLat = Infinity;
    let maxLon = -Infinity, maxLat = -Infinity;
    
    for (const route of routes) {
      minLon = Math.min(minLon, route.bounds[0][0]);
      minLat = Math.min(minLat, route.bounds[0][1]);
      maxLon = Math.max(maxLon, route.bounds[1][0]);
      maxLat = Math.max(maxLat, route.bounds[1][1]);
    }
    
    return [[minLon, minLat], [maxLon, maxLat]];
  }

  // Initialize the map
  function initMap() {
    // Get initial bounds from all routes
    const initialBounds = getAllBounds();
    
    // Create the map with OpenFreeMap style (uses Protomaps PMTiles under the hood)
    map = new maplibregl.Map({
      container: 'map',
      style: 'https://tiles.openfreemap.org/styles/positron',
      bounds: initialBounds,
      fitBoundsOptions: { padding: 50 },
      dragRotate: false,
      pitchWithRotate: false
    });

    // Disable rotation on touch devices
    map.touchZoomRotate.disableRotation();

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      addRouteLayers();
      handleInitialRoute();
    });
  }

  // Add GeoJSON sources and layers for each route
  function addRouteLayers() {
    for (const route of routes) {
      // Add source
      map.addSource('route-' + route.id, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: { id: route.id, name: route.name },
          geometry: {
            type: 'LineString',
            coordinates: route.coordinates
          }
        }
      });

      // Add invisible hit area layer (wider for easier tapping)
      map.addLayer({
        id: 'route-hit-' + route.id,
        type: 'line',
        source: 'route-' + route.id,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': 'transparent',
          'line-width': 20
        }
      });

      // Add visible line layer
      map.addLayer({
        id: 'route-layer-' + route.id,
        type: 'line',
        source: 'route-' + route.id,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': route.color,
          'line-width': 4,
          'line-opacity': 0.8
        }
      });

      // Make route clickable via hit area
      map.on('click', 'route-hit-' + route.id, (e) => {
        selectRoute(route.id);
      });

      map.on('mouseenter', 'route-hit-' + route.id, () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'route-hit-' + route.id, () => {
        map.getCanvas().style.cursor = '';
      });
    }
  }

  // Populate the route list sidebar
  function populateRouteList() {
    const routeList = document.getElementById('routeList');
    const routeSelect = document.getElementById('routeSelect');
    
    // Add "All Routes" option
    const allRoutesHtml = `
      <div class="route-item all-routes-item" data-route-id="all">
        <div class="route-item-header">
          <div class="route-color"></div>
          <span class="route-name">All Routes</span>
        </div>
        <div class="route-meta">
          <span class="route-distance">${routes.length} ${routes.length === 1 ? 'route' : 'routes'}</span>
        </div>
      </div>
    `;
    
    // Add individual routes
    const routesHtml = routes.map(route => {
      const elevationText = route.elevationGain != null ? ` ↗ ${route.elevationGain} m` : '';
      return `
      <div class="route-item" data-route-id="${route.id}">
        <div class="route-item-header">
          <div class="route-color" style="background-color: ${route.color}"></div>
          <span class="route-name">${escapeHtml(route.name)}</span>
        </div>
        <div class="route-meta">
          <span class="route-distance">📍 ${route.distance} km${elevationText}</span>
          <a href="gpx/${encodeURIComponent(route.filename)}" class="download-link" download>⬇ GPX</a>
        </div>
      </div>
    `;
    }).join('');
    
    routeList.innerHTML = allRoutesHtml + routesHtml;
    
    // Add click handlers
    routeList.querySelectorAll('.route-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('download-link')) return;
        selectRoute(item.dataset.routeId);
      });
    });
    
    // Populate mobile select
    const routeWord = routes.length === 1 ? 'Route' : 'Routes';
    let optionsHtml = `<option value="all">All ${routeWord} (${routes.length})</option>`;
    optionsHtml += routes.map(route => 
      `<option value="${route.id}">${escapeHtml(route.name)}</option>`
    ).join('');
    routeSelect.innerHTML = optionsHtml;
    
    routeSelect.addEventListener('change', (e) => {
      selectRoute(e.target.value);
    });
  }

  // Select a route and update the view
  function selectRoute(routeId) {
    currentRouteId = routeId;
    
    // Update URL hash
    window.location.hash = routeId;
    
    // Update active state in sidebar
    document.querySelectorAll('.route-item').forEach(item => {
      item.classList.toggle('active', item.dataset.routeId === routeId);
    });
    
    // Update mobile select
    document.getElementById('routeSelect').value = routeId;
    
    // Update mobile route details
    updateMobileRouteDetails(routeId);
    
    // Update layer visibility and fit bounds
    if (routeId === 'all') {
      // Show all routes with transparency for overlapping visibility
      for (const route of routes) {
        map.setLayoutProperty('route-layer-' + route.id, 'visibility', 'visible');
        map.setPaintProperty('route-layer-' + route.id, 'line-opacity', 0.8);
        map.setPaintProperty('route-layer-' + route.id, 'line-width', 4);
      }
      map.fitBounds(getAllBounds(), { padding: 50 });
    } else {
      // Show only selected route
      const selectedRoute = routes.find(r => r.id === routeId);
      for (const route of routes) {
        const isSelected = route.id === routeId;
        map.setLayoutProperty('route-layer-' + route.id, 'visibility', 'visible');
        map.setPaintProperty('route-layer-' + route.id, 'line-opacity', isSelected ? 1 : 0.15);
        map.setPaintProperty('route-layer-' + route.id, 'line-width', isSelected ? 5 : 3);
      }
      if (selectedRoute) {
        map.fitBounds(selectedRoute.bounds, { padding: 50 });
      }
    }
  }

  // Update mobile route details panel
  function updateMobileRouteDetails(routeId) {
    const detailsEl = document.getElementById('mobileRouteDetails');
    
    if (routeId === 'all') {
      detailsEl.classList.remove('visible');
      detailsEl.innerHTML = '';
      return;
    }
    
    const route = routes.find(r => r.id === routeId);
    if (!route) {
      detailsEl.classList.remove('visible');
      return;
    }
    
    const elevationText = route.elevationGain != null ? ` · ↗ ${route.elevationGain} m` : '';
    detailsEl.innerHTML = `
      <span class="route-stats">📍 ${route.distance} km${elevationText}</span>
      <a href="gpx/${encodeURIComponent(route.filename)}" class="download-btn" download>⬇ Download GPX</a>
    `;
    detailsEl.classList.add('visible');
  }

  // Handle initial route from URL hash
  function handleInitialRoute() {
    const hash = window.location.hash.slice(1);
    if (hash && (hash === 'all' || routes.some(r => r.id === hash))) {
      selectRoute(hash);
    } else {
      selectRoute('all');
    }
  }

  // Handle back/forward navigation
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.slice(1);
    if (hash !== currentRouteId) {
      if (hash === 'all' || routes.some(r => r.id === hash)) {
        selectRoute(hash);
      }
    }
  });

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Initialize application
  async function init() {
    try {
      routes = await loadRoutes();
      populateRouteList();
      initMap();
    } catch (error) {
      console.error('Failed to initialize application:', error);
      document.body.innerHTML = '<div style="padding: 2rem; color: #e94560;">Failed to load routes. Please try again.</div>';
    }
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
