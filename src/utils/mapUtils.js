import mapboxgl from 'mapbox-gl';

export function initMap(container, center) {
  mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
  return new mapboxgl.Map({
    container,
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [center.lng, center.lat],
    zoom: 12,
  });
}

export function plotRoute(map, stops, accent = '#E8472A') {
  // Remove existing layers/sources
  ['route-layer', 'route'].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
  });

  // Clear existing markers stored on map instance
  if (map._tpMarkers) {
    map._tpMarkers.forEach(m => m.remove());
  }
  map._tpMarkers = [];

  stops.forEach((stop, i) => {
    const el = document.createElement('div');
    el.style.cssText = `
      width:28px;height:28px;border-radius:50%;
      background:${accent};border:3px solid #fff;
      display:flex;align-items:center;justify-content:center;
      font-size:11px;font-weight:800;color:#fff;
      box-shadow:0 2px 8px rgba(0,0,0,0.25);cursor:pointer;
    `;
    el.textContent = i + 1;

    const marker = new mapboxgl.Marker(el)
      .setLngLat([stop.lng, stop.lat])
      .setPopup(
        new mapboxgl.Popup({ offset: 16, closeButton: false }).setHTML(`
          <div style="font-family:'DM Sans',sans-serif;padding:2px 4px">
            <strong style="font-size:13px">${stop.name}</strong>
            <div style="color:#666;font-size:11px;margin-top:2px">${stop.startTime || ''} · ${stop.duration_hrs}h</div>
          </div>
        `)
      )
      .addTo(map);
    map._tpMarkers.push(marker);
  });

  if (stops.length > 1) {
    const coords = stops.map(s => [s.lng, s.lat]);
    map.addSource('route', {
      type: 'geojson',
      data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }
    });
    map.addLayer({
      id: 'route-layer',
      type: 'line',
      source: 'route',
      paint: { 'line-color': accent, 'line-width': 2, 'line-dasharray': [2, 2] }
    });
  }

  if (stops.length > 0) {
    const bounds = stops.reduce(
      (b, s) => b.extend([s.lng, s.lat]),
      new mapboxgl.LngLatBounds([stops[0].lng, stops[0].lat], [stops[0].lng, stops[0].lat])
    );
    map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
  }
}
