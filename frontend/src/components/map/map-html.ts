// Leaflet page rendered inside a WebView (native) or an iframe (web).
// Tiles: OpenStreetMap France (street names, bus/tram stops, parks, landmarks; no API key). Marker colors are
// fixed per category and identical in light/dark themes.

export const MAP_HTML = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,500,1,0" />
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #ECE8E1; font-family: -apple-system, system-ui, sans-serif; }
  .ms { font-family: 'Material Symbols Rounded'; font-size: 18px; line-height: 1; color: #fff; font-variation-settings: 'FILL' 1; }
  .pin { width: 36px; height: 36px; border-radius: 18px; display: flex; align-items: center; justify-content: center;
         border: 2.5px solid #fff; box-shadow: 0 3px 10px rgba(0,0,0,.35); transition: transform .18s ease; }
  .pin.sel { transform: scale(1.25); }
  .pin .deal { position: absolute; top: -6px; right: -8px; background: #fff; color: #E27443; font-size: 9px; font-weight: 800;
               border-radius: 8px; padding: 1px 4px; box-shadow: 0 1px 4px rgba(0,0,0,.3); }
  .stop { width: 22px; height: 22px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
          border: 2px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,.3); }
  .stop .ms { font-size: 13px; }
  .me { width: 18px; height: 18px; border-radius: 9px; background: #2F80ED; border: 3px solid #fff; box-shadow: 0 0 0 8px rgba(47,128,237,.25); }
  .leaflet-popup-content-wrapper { border-radius: 18px; padding: 0; overflow: hidden; background: #1C1C1C; color: #F2F2F2; }
  .leaflet-popup-content { margin: 0; width: 240px !important; }
  .leaflet-popup-tip { background: #1C1C1C; }
  .leaflet-container a.leaflet-popup-close-button { color: #fff; top: 8px; right: 8px; background: rgba(0,0,0,.45); border-radius: 12px; width: 24px; height: 24px; line-height: 22px; font-size: 18px; }
  .pp img { width: 100%; height: 120px; object-fit: cover; display: block; }
  .pp .b { padding: 12px 14px 14px; }
  .pp .c { font-size: 10px; letter-spacing: .6px; text-transform: uppercase; color: #8E8E93; font-weight: 600; }
  .pp .n { font-size: 16px; font-weight: 700; margin: 2px 0 6px; letter-spacing: -.2px; }
  .pp .a { font-size: 12px; color: #B0B0B5; margin: -2px 0 8px; }
  .pp .r { display: flex; gap: 8px; align-items: center; font-size: 12px; color: #E0E0E0; }
  .pp .d { background: #432616; color: #F4B376; font-weight: 700; padding: 2px 7px; border-radius: 6px; }
  .pp button { margin-top: 12px; width: 100%; height: 40px; border: 0; border-radius: 20px; background: #E27443; color: #fff; font-weight: 700; font-size: 14px; }
  .sp { font-size: 13px; padding: 10px 14px; }
  .sp .n { font-weight: 700; }
  .sp .l { color: #8E8E93; font-size: 12px; margin-top: 2px; }
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var CAT = {
    resto:    { c: '#E27443', i: 'restaurant',     l: 'Restaurant' },
    fastfood: { c: '#F2A900', i: 'lunch_dining',   l: 'Fast-food' },
    fleuriste:{ c: '#EC4899', i: 'local_florist',  l: 'Fleuriste' },
    bar:      { c: '#9D174D', i: 'local_bar',      l: 'Bar' },
    club:     { c: '#3D5AFE', i: 'nightlife',      l: 'Boîte de nuit' },
    loisirs:  { c: '#20A464', i: 'sports_tennis',  l: 'Loisirs & Sport' },
    culture:  { c: '#7C5CFC', i: 'museum',         l: 'Culture' },
    commerce: { c: '#0E9AB5', i: 'storefront',     l: 'Commerce' }
  };
  var STOP = { tram: { c: '#0B6E4F', i: 'tram' }, bus: { c: '#2563EB', i: 'directions_bus' }, velo: { c: '#15803D', i: 'pedal_bike' } };
  function send(m) {
    var s = JSON.stringify(m);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
    else if (window.parent && window.parent !== window) window.parent.postMessage({ __citypulse: true, data: s }, '*');
  }
  var TOURS = [47.3936, 0.6875];
  var map = L.map('map', { zoomControl: false, scrollWheelZoom: true, doubleClickZoom: true, touchZoom: true,
    dragging: true, tap: true, inertia: true, zoomSnap: 0.5, wheelPxPerZoomLevel: 90 }).setView(TOURS, 15);
  L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
    maxZoom: 20, maxNativeZoom: 19, subdomains: 'abc', attribution: '&copy; OpenStreetMap France &copy; contributeurs OSM'
  }).addTo(map);
  var places = L.layerGroup().addTo(map);
  var stops = L.layerGroup();
  var me = null, markers = {}, selected = null;

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function pinIcon(p, sel) {
    var cat = CAT[p.category] || CAT.commerce;
    var html = '<div class="pin' + (sel ? ' sel' : '') + '" style="background:' + cat.c + ';position:relative"><span class="ms">' + cat.i + '</span>' +
      (p.best_discount > 0 ? '<span class="deal">-' + p.best_discount + '%</span>' : '') + '</div>';
    return L.divIcon({ html: html, className: '', iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -18] });
  }
  function popup(p) {
    var cat = CAT[p.category] || CAT.commerce;
    var root = el('div', 'pp');
    var img = el('img'); img.src = p.images[0]; root.appendChild(img);
    var b = el('div', 'b'); root.appendChild(b);
    b.appendChild(el('div', 'c', cat.l + (p.is_open ? ' · Ouvert' : ' · Fermé')));
    b.appendChild(el('div', 'n', p.name));
    b.appendChild(el('div', 'a', p.address));
    var r = el('div', 'r'); b.appendChild(r);
    r.appendChild(el('span', null, '★ ' + p.rating.toFixed(1) + ' (' + p.reviews_count + ')'));
    if (p.best_discount > 0) r.appendChild(el('span', 'd', '-' + p.best_discount + '%'));
    var btn = el('button', null, 'Voir la fiche');
    btn.onclick = function () { send({ type: 'open', id: p.id }); };
    b.appendChild(btn);
    return root;
  }
  function setPlaces(list) {
    places.clearLayers(); markers = {};
    list.forEach(function (p) {
      var m = L.marker([p.lat, p.lng], { icon: pinIcon(p, false), riseOnHover: true });
      m.bindPopup(popup(p), { closeButton: true, autoPanPadding: [24, 90] });
      m.on('popupopen', function () { m.setIcon(pinIcon(p, true)); m.setZIndexOffset(1000); send({ type: 'select', id: p.id }); });
      m.on('popupclose', function () { m.setIcon(pinIcon(p, false)); m.setZIndexOffset(0); });
      m.addTo(places); markers[p.id] = m;
    });
  }
  function setStops(list) {
    stops.clearLayers();
    list.forEach(function (s) {
      var t = STOP[s.type] || STOP.bus;
      var ic = L.divIcon({ html: '<div class="stop" style="background:' + t.c + '"><span class="ms">' + t.i + '</span></div>', className: '', iconSize: [22, 22], iconAnchor: [11, 11] });
      var root = el('div', 'sp'); root.appendChild(el('div', 'n', s.name)); root.appendChild(el('div', 'l', s.lines.join(' · ')));
      L.marker([s.lat, s.lng], { icon: ic }).bindPopup(root).addTo(stops);
    });
    toggleStops();
  }
  function toggleStops() { if (map.getZoom() >= 14.5) { if (!map.hasLayer(stops)) stops.addTo(map); } else if (map.hasLayer(stops)) map.removeLayer(stops); }
  map.on('zoomend', toggleStops);
  window.__cmd = function (c) {
    if (typeof c === 'string') c = JSON.parse(c);
    if (c.type === 'places') setPlaces(c.data);
    else if (c.type === 'stops') setStops(c.data);
    else if (c.type === 'zoomIn') map.zoomIn();
    else if (c.type === 'zoomOut') map.zoomOut();
    else if (c.type === 'center') map.flyTo(TOURS, 15, { duration: 0.6 });
    else if (c.type === 'locate') {
      var ll = [c.lat, c.lng];
      if (!me) me = L.marker(ll, { icon: L.divIcon({ html: '<div class="me"></div>', className: '', iconSize: [18, 18], iconAnchor: [9, 9] }), interactive: false }).addTo(map);
      else me.setLatLng(ll);
      map.flyTo(ll, 16, { duration: 0.7 });
    }
  };
  window.addEventListener('message', function (e) { if (e.data && e.data.__cmd) window.__cmd(e.data.__cmd); });
  send({ type: 'ready' });
</script>
</body></html>`;

export type MapCommand =
  | { type: "places"; data: unknown[] }
  | { type: "stops"; data: unknown[] }
  | { type: "zoomIn" }
  | { type: "zoomOut" }
  | { type: "center" }
  | { type: "locate"; lat: number; lng: number };
