import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

const CLUSTER_PIXEL_SIZE = 64;

function clusterIcon(count: number) {
  const size = count >= 100 ? 58 : count >= 10 ? 54 : 50;
  return L.divIcon({
    className: 'nmb-leaflet-cluster',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div title="${count} itens próximos — clique para aproximar" style="width:${size}px;height:${size}px;border-radius:18px;background:#ea580c;color:#fff;border:4px solid rgba(255,255,255,.96);box-shadow:0 8px 22px rgba(15,23,42,.28);display:flex;align-items:center;justify-content:center;font:900 14px/1 system-ui,sans-serif;user-select:none"><span style="font-size:16px;margin-right:3px">📍</span>${count}</div>`,
  });
}

export default function MapClusterController() {
  const map = useMap();
  const clusterMarkers = useRef<L.Marker[]>([]);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const clearClusters = () => {
      for (const marker of clusterMarkers.current) {
        if (map.hasLayer(marker)) map.removeLayer(marker);
      }
      clusterMarkers.current = [];
    };

    const restoreMarker = (marker: L.Marker) => {
      marker.setOpacity(1);
      const element = marker.getElement();
      if (element) element.style.pointerEvents = '';
    };

    const hideMarker = (marker: L.Marker) => {
      marker.setOpacity(0);
      const element = marker.getElement();
      if (element) element.style.pointerEvents = 'none';
    };

    const refresh = () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        clearClusters();
        const sourceMarkers: L.Marker[] = [];
        map.eachLayer((layer) => {
          if (!(layer instanceof L.Marker)) return;
          if ((layer as any).__nmbClusterMarker) return;
          const zIndex = Number(layer.options.zIndexOffset || 0);
          // Usuário e relato em foco continuam individuais.
          if (zIndex >= 1000) {
            restoreMarker(layer);
            return;
          }
          restoreMarker(layer);
          sourceMarkers.push(layer);
        });

        if (map.getZoom() >= 17 || sourceMarkers.length < 2) return;

        const groups = new Map<string, L.Marker[]>();
        for (const marker of sourceMarkers) {
          const point = map.latLngToContainerPoint(marker.getLatLng());
          const key = `${Math.floor(point.x / CLUSTER_PIXEL_SIZE)}:${Math.floor(point.y / CLUSTER_PIXEL_SIZE)}`;
          const group = groups.get(key) || [];
          group.push(marker);
          groups.set(key, group);
        }

        for (const group of groups.values()) {
          if (group.length < 2) continue;
          const latLngs = group.map(marker => marker.getLatLng());
          const center = L.latLngBounds(latLngs).getCenter();
          group.forEach(hideMarker);
          const marker = L.marker(center, { icon: clusterIcon(group.length), zIndexOffset: 900 });
          (marker as any).__nmbClusterMarker = true;
          marker.on('click', () => {
            map.fitBounds(L.latLngBounds(latLngs), { padding: [70, 70], maxZoom: Math.min(18, map.getZoom() + 3), animate: true });
          });
          marker.addTo(map);
          clusterMarkers.current.push(marker);
        }
      });
    };

    const schedule = (event?: L.LeafletEvent) => {
      if (event?.layer && (event.layer as any).__nmbClusterMarker) return;
      refresh();
    };

    map.on('zoomend moveend layeradd layerremove', schedule);
    refresh();
    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
      map.off('zoomend moveend layeradd layerremove', schedule);
      clearClusters();
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker && !(layer as any).__nmbClusterMarker) restoreMarker(layer);
      });
    };
  }, [map]);

  return null;
}
