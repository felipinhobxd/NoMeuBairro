from pathlib import Path

controller = Path('src/components/MapClusterController.tsx')
text = controller.read_text()

old_cluster = '''    let pendingZoom = map.getZoom();

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

    const onLayerChange = (event: L.LeafletEvent) => {
      if (event.layer && ((event.layer as any).__nmbClusterMarker || (event.layer as any).__nmbHeatLayer)) return;
      refreshClusters();
    };

    map.on('zoom zoomend resize', onZoom);
    map.on('zoomanim', onZoomAnim);
    map.on('layeradd layerremove', onLayerChange);
    refreshClusters(map.getZoom(), true);

    return () => {
      if (clusterFrame.current != null) cancelAnimationFrame(clusterFrame.current);
      map.off('zoom zoomend resize', onZoom);
      map.off('zoomanim', onZoomAnim);
      map.off('layeradd layerremove', onLayerChange);
      clearClusters();
    };
'''

new_cluster = '''    const renderClusters = (zoom: number) => {
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
            map.setView(center, Math.min(20, Math.ceil(zoom) + 2), { animate: true });
          } else {
            map.fitBounds(bounds, { padding: [72, 72], maxZoom: Math.min(20, Math.ceil(zoom) + 3), animate: true });
          }
        });
        marker.addTo(map);
        clusterMarkers.current.push(marker);
      }
    };

    const refreshClusters = (immediate = false) => {
      if (clusterFrame.current != null) cancelAnimationFrame(clusterFrame.current);

      if (immediate) {
        clusterFrame.current = null;
        renderClusters(map.getZoom());
        return;
      }

      clusterFrame.current = requestAnimationFrame(() => {
        clusterFrame.current = null;
        renderClusters(map.getZoom());
      });
    };

    // Durante a animação o próprio markerPane do Leaflet interpola a posição e a escala.
    // No primeiro frame após o zoom terminar, recalculamos as contagens sem espera extra.
    const onZoomEnd = () => refreshClusters(true);
    const onResize = () => refreshClusters();
    const onLayerChange = (event: L.LeafletEvent) => {
      if (event.layer && ((event.layer as any).__nmbClusterMarker || (event.layer as any).__nmbHeatLayer)) return;
      refreshClusters();
    };

    map.on('zoomend', onZoomEnd);
    map.on('resize', onResize);
    map.on('layeradd layerremove', onLayerChange);
    refreshClusters(true);

    return () => {
      if (clusterFrame.current != null) cancelAnimationFrame(clusterFrame.current);
      map.off('zoomend', onZoomEnd);
      map.off('resize', onResize);
      map.off('layeradd layerremove', onLayerChange);
      clearClusters();
    };
'''

if old_cluster not in text:
    raise SystemExit('Bloco atual de clusters não encontrado')
text = text.replace(old_cluster, new_cluster, 1)

old_state = '''    let heatFrame: number | null = null;
    let densityBuffer = new Float32Array(0);
    let imageData: ImageData | null = null;
'''
new_state = '''    let heatFrame: number | null = null;
    let densityBuffer = new Float32Array(0);
    let imageData: ImageData | null = null;
    let renderedZoom = map.getZoom();
    let canvasOriginLatLng: L.LatLng | null = null;
'''
if old_state not in text:
    raise SystemExit('Estado do heatmap não encontrado')
text = text.replace(old_state, new_state, 1)

old_position = '''        const viewportTopLeft = map.containerPointToLayerPoint([0, 0]);
        const canvasTopLeft = viewportTopLeft.subtract([padding, padding]);
        L.DomUtil.setPosition(canvas, canvasTopLeft);
'''
new_position = '''        const viewportTopLeft = map.containerPointToLayerPoint([0, 0]);
        const canvasTopLeft = viewportTopLeft.subtract([padding, padding]);
        L.DomUtil.setPosition(canvas, canvasTopLeft);
        renderedZoom = map.getZoom();
        canvasOriginLatLng = map.layerPointToLatLng(canvasTopLeft);
'''
if old_position not in text:
    raise SystemExit('Posicionamento do canvas não encontrado')
text = text.replace(old_position, new_position, 1)

old_heat_handlers = '''    const onZoom = () => drawHeat();
    const onMoveEnd = () => drawHeat();
    const onResize = () => drawHeat();
    const onLayerChange = (event: L.LeafletEvent) => {
      if (validPoints.length > 0) return;
      if (event.layer && ((event.layer as any).__nmbClusterMarker || (event.layer as any).__nmbHeatLayer)) return;
      drawHeat();
    };

    map.on('zoom zoomend', onZoom);
    map.on('moveend', onMoveEnd);
    map.on('resize', onResize);
    map.on('layeradd layerremove', onLayerChange);
    drawHeat();

    return () => {
      if (heatFrame != null) cancelAnimationFrame(heatFrame);
      map.off('zoom zoomend', onZoom);
      map.off('moveend', onMoveEnd);
      map.off('resize', onResize);
      map.off('layeradd layerremove', onLayerChange);
'''

new_heat_handlers = '''    const onZoomAnim = (event: any) => {
      if (!canvasOriginLatLng) return;
      const targetZoom = Number(event.zoom ?? map.getZoom());
      const targetCenter = event.center ? L.latLng(event.center) : map.getCenter();
      const scale = map.getZoomScale(targetZoom, renderedZoom);
      const targetPixelOrigin = map.project(targetCenter, targetZoom).subtract(map.getSize().divideBy(2));
      const targetPoint = map.project(canvasOriginLatLng, targetZoom).subtract(targetPixelOrigin);
      L.DomUtil.setTransform(canvas, targetPoint, scale);
    };
    const onZoomEnd = () => drawHeat();
    const onMoveEnd = () => drawHeat();
    const onResize = () => drawHeat();
    const onLayerChange = (event: L.LeafletEvent) => {
      if (validPoints.length > 0) return;
      if (event.layer && ((event.layer as any).__nmbClusterMarker || (event.layer as any).__nmbHeatLayer)) return;
      drawHeat();
    };

    // Durante o zoom, o bitmap atual é escalado junto com o mapa; no final ele é
    // redesenhado com o bandwidth e a resolução corretos para o novo nível.
    map.on('zoomanim', onZoomAnim);
    map.on('zoomend', onZoomEnd);
    map.on('moveend', onMoveEnd);
    map.on('resize', onResize);
    map.on('layeradd layerremove', onLayerChange);
    drawHeat();

    return () => {
      if (heatFrame != null) cancelAnimationFrame(heatFrame);
      map.off('zoomanim', onZoomAnim);
      map.off('zoomend', onZoomEnd);
      map.off('moveend', onMoveEnd);
      map.off('resize', onResize);
      map.off('layeradd layerremove', onLayerChange);
'''

if old_heat_handlers not in text:
    raise SystemExit('Handlers atuais do heatmap não encontrados')
text = text.replace(old_heat_handlers, new_heat_handlers, 1)
controller.write_text(text)

mapa = Path('src/pages/Mapa.tsx')
text = mapa.read_text()
old_map = 'className="z-10" zoomAnimation={false} markerZoomAnimation={false} zoomSnap={1} wheelDebounceTime={16}>'
new_map = 'className="z-10" zoomAnimation markerZoomAnimation zoomAnimationThreshold={6} zoomSnap={1} wheelDebounceTime={28} wheelPxPerZoomLevel={70}>'
if old_map not in text:
    raise SystemExit('MapContainer atual não encontrado')
text = text.replace(old_map, new_map, 1)
mapa.write_text(text)

Path('.github/workflows/smooth-map-zoom.yml').unlink(missing_ok=True)
Path('.github/scripts/smooth_map_zoom.py').unlink(missing_ok=True)
