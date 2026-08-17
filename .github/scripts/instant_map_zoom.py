from pathlib import Path

controller = Path('src/components/MapClusterController.tsx')
text = controller.read_text()

old = "function groupMarkersByDistance(map: L.Map, markers: L.Marker[]) {\n  const zoom = map.getZoom();"
new = "function groupMarkersByDistance(map: L.Map, markers: L.Marker[], zoom = map.getZoom()) {"
if old not in text:
    raise SystemExit('groupMarkersByDistance esperado não encontrado')
text = text.replace(old, new, 1)

start = text.index('    const refreshClusters = () => {')
end = text.index('    const onLayerChange = (event: L.LeafletEvent) => {', start)
replacement = '''    let pendingZoom = map.getZoom();

    const renderClusters = (zoom: number) => {
      clearClusters();
      const sourceMarkers = getClusterSourceMarkers(map);
      if (sourceMarkers.length < 2) return;

      const groups = groupMarkersByDistance(map, sourceMarkers, zoom);

      for (const group of groups) {
        if (group.length < 2) continue;
        const latLngs = group.map(marker => marker.getLatLng());
        const bounds = L.latLngBounds(latLngs);
        const center = bounds.getCenter();
        group.forEach(hideMarker);

        const marker = L.marker(center, {
          icon: clusterIcon(group.length),
          zIndexOffset: 900,
          keyboard: true,
          title: `${group.length} itens nesta área`,
        });
        (marker as any).__nmbClusterMarker = true;
        marker.on('click', () => {
          const first = latLngs[0];
          const samePoint = latLngs.every(point => Math.abs(point.lat - first.lat) < 1e-8 && Math.abs(point.lng - first.lng) < 1e-8);
          if (samePoint) {
            map.setView(center, Math.min(20, Math.ceil(zoom) + 2), { animate: false });
          } else {
            map.fitBounds(bounds, { padding: [72, 72], maxZoom: Math.min(20, Math.ceil(zoom) + 3), animate: false });
          }
        });
        marker.addTo(map);
        clusterMarkers.current.push(marker);
      }
    };

    const refreshClusters = (zoom = map.getZoom(), immediate = false) => {
      pendingZoom = zoom;
      if (clusterFrame.current != null) cancelAnimationFrame(clusterFrame.current);

      if (immediate) {
        clusterFrame.current = null;
        renderClusters(pendingZoom);
        return;
      }

      clusterFrame.current = requestAnimationFrame(() => {
        clusterFrame.current = null;
        renderClusters(pendingZoom);
      });
    };

    const onZoom = () => refreshClusters(map.getZoom());
    const onZoomAnim = (event: any) => refreshClusters(Number(event.zoom ?? map.getZoom()));

'''
text = text[:start] + replacement + text[end:]

old_registration = "    map.on('zoomend resize', refreshClusters);\n    map.on('layeradd layerremove', onLayerChange);\n    refreshClusters();"
new_registration = "    map.on('zoom zoomend resize', onZoom);\n    map.on('zoomanim', onZoomAnim);\n    map.on('layeradd layerremove', onLayerChange);\n    refreshClusters(map.getZoom(), true);"
if old_registration not in text:
    raise SystemExit('registro antigo de clusters não encontrado')
text = text.replace(old_registration, new_registration, 1)

old_cleanup = "      map.off('zoomend resize', refreshClusters);\n      map.off('layeradd layerremove', onLayerChange);"
new_cleanup = "      map.off('zoom zoomend resize', onZoom);\n      map.off('zoomanim', onZoomAnim);\n      map.off('layeradd layerremove', onLayerChange);"
if old_cleanup not in text:
    raise SystemExit('cleanup antigo de clusters não encontrado')
text = text.replace(old_cleanup, new_cleanup, 1)

old_heat = '''    const onZoomStart = () => {
      // Evita esticar um frame antigo durante a animação de zoom.
      canvas.style.opacity = '0';
    };
    const onZoomEnd = () => drawHeat();
    const onMoveEnd = () => drawHeat();
    const onResize = () => drawHeat();
'''
new_heat = '''    const onZoom = () => drawHeat();
    const onMoveEnd = () => drawHeat();
    const onResize = () => drawHeat();
'''
if old_heat not in text:
    raise SystemExit('handlers antigos do heatmap não encontrados')
text = text.replace(old_heat, new_heat, 1)

old_heat_registration = "    map.on('zoomstart', onZoomStart);\n    map.on('zoomend', onZoomEnd);\n    map.on('moveend', onMoveEnd);"
new_heat_registration = "    map.on('zoom zoomend', onZoom);\n    map.on('moveend', onMoveEnd);"
if old_heat_registration not in text:
    raise SystemExit('registro antigo do heatmap não encontrado')
text = text.replace(old_heat_registration, new_heat_registration, 1)

old_heat_cleanup = "      map.off('zoomstart', onZoomStart);\n      map.off('zoomend', onZoomEnd);\n      map.off('moveend', onMoveEnd);"
new_heat_cleanup = "      map.off('zoom zoomend', onZoom);\n      map.off('moveend', onMoveEnd);"
if old_heat_cleanup not in text:
    raise SystemExit('cleanup antigo do heatmap não encontrado')
text = text.replace(old_heat_cleanup, new_heat_cleanup, 1)
controller.write_text(text)

mapa = Path('src/pages/Mapa.tsx')
text = mapa.read_text()
old_map = 'className="z-10" zoomAnimation markerZoomAnimation={false}>'
new_map = 'className="z-10" zoomAnimation={false} markerZoomAnimation={false} zoomSnap={1} wheelDebounceTime={16}>'
if old_map not in text:
    raise SystemExit('MapContainer esperado não encontrado')
text = text.replace(old_map, new_map, 1)
mapa.write_text(text)

Path('.github/workflows/instant-map-zoom.yml').unlink(missing_ok=True)
Path('.github/scripts/instant_map_zoom.py').unlink(missing_ok=True)
