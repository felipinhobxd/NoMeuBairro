import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

const HEAT_PANE = 'nmb-density-heat';

type Props = {
  heatEnabled?: boolean;
};

function gridSizeForZoom(zoom: number) {
  if (zoom <= 12) return 96;
  if (zoom <= 14) return 80;
  if (zoom <= 16) return 66;
  if (zoom <= 18) return 54;
  return 44;
}

function densityStrength(count: number, maxCount: number) {
  if (count <= 1) return 0;
  const relative = maxCount > 1 ? (count - 1) / (maxCount - 1) : 0;
  const absolute = Math.min(1, (count - 1) / 7);
  return Math.min(1, relative * 0.55 + absolute * 0.45);
}

function densityColor(strength: number) {
  const hue = Math.round(118 - strength * 118);
  const saturation = Math.round(74 + strength * 12);
  const lightness = Math.round(46 + (1 - strength) * 4);
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function clusterIcon(count: number, color: string) {
  const size = count >= 100 ? 62 : count >= 10 ? 58 : 54;
  return L.divIcon({
    className: 'nmb-leaflet-cluster',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div title="${count} itens nesta área — clique para aproximar" style="width:${size}px;height:${size}px;border-radius:999px;background:${color};color:#fff;border:4px solid rgba(255,255,255,.96);box-shadow:0 9px 26px rgba(15,23,42,.32),0 0 0 7px color-mix(in srgb, ${color} 24%, transparent);display:flex;align-items:center;justify-content:center;font:900 15px/1 system-ui,sans-serif;user-select:none"><span style="font-size:15px;margin-right:4px">📍</span>${count}</div>`,
  });
}

export default function MapClusterController({ heatEnabled = true }: Props) {
  const map = useMap();
  const clusterMarkers = useRef<L.Marker[]>([]);
  const heatLayers = useRef<L.Circle[]>([]);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    let pane = map.getPane(HEAT_PANE);
    if (!pane) pane = map.createPane(HEAT_PANE);
    pane.style.zIndex = '360';
    pane.style.pointerEvents = 'none';

    const clearGeneratedLayers = () => {
      for (const marker of clusterMarkers.current) {
        if (map.hasLayer(marker)) map.removeLayer(marker);
      }
      for (const circle of heatLayers.current) {
        if (map.hasLayer(circle)) map.removeLayer(circle);
      }
      clusterMarkers.current = [];
      heatLayers.current = [];
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

    const radiusMetersFromPixels = (center: L.LatLng, pixels: number) => {
      const point = map.latLngToLayerPoint(center);
      const edge = map.layerPointToLatLng(L.point(point.x + pixels, point.y));
      return Math.max(35, map.distance(center, edge));
    };

    const refresh = () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        clearGeneratedLayers();

        const sourceMarkers: L.Marker[] = [];
        map.eachLayer((layer) => {
          if (!(layer instanceof L.Marker)) return;
          if ((layer as any).__nmbClusterMarker) return;
          const zIndex = Number(layer.options.zIndexOffset || 0);
          // Usuário e item em foco ficam sempre individuais e legíveis.
          if (zIndex >= 1000) {
            restoreMarker(layer);
            return;
          }
          restoreMarker(layer);
          sourceMarkers.push(layer);
        });

        if (sourceMarkers.length === 0) return;

        const cellSize = gridSizeForZoom(map.getZoom());
        const groups = new Map<string, L.Marker[]>();
        for (const marker of sourceMarkers) {
          const point = map.latLngToContainerPoint(marker.getLatLng());
          const key = `${Math.floor(point.x / cellSize)}:${Math.floor(point.y / cellSize)}`;
          const group = groups.get(key) || [];
          group.push(marker);
          groups.set(key, group);
        }

        const grouped = Array.from(groups.values());
        const maxCount = Math.max(1, ...grouped.map(group => group.length));

        for (const group of grouped) {
          const count = group.length;
          const latLngs = group.map(marker => marker.getLatLng());
          const bounds = L.latLngBounds(latLngs);
          const center = bounds.getCenter();
          const strength = densityStrength(count, maxCount);
          const color = densityColor(strength);

          if (heatEnabled) {
            const corePixels = 44 + strength * 34;
            const coreRadius = radiusMetersFromPixels(center, corePixels);
            const outer = L.circle(center, {
              pane: HEAT_PANE,
              radius: coreRadius * 1.48,
              stroke: false,
              fill: true,
              fillColor: color,
              fillOpacity: 0.09 + strength * 0.10,
              interactive: false,
            });
            const core = L.circle(center, {
              pane: HEAT_PANE,
              radius: coreRadius,
              stroke: false,
              fill: true,
              fillColor: color,
              fillOpacity: 0.19 + strength * 0.23,
              interactive: false,
            });
            (outer as any).__nmbHeatLayer = true;
            (core as any).__nmbHeatLayer = true;
            outer.addTo(map);
            core.addTo(map);
            heatLayers.current.push(outer, core);
          }

          if (count < 2) continue;

          group.forEach(hideMarker);
          const marker = L.marker(center, { icon: clusterIcon(count, color), zIndexOffset: 900 });
          (marker as any).__nmbClusterMarker = true;
          marker.on('click', () => {
            const first = latLngs[0];
            const samePoint = latLngs.every(point => Math.abs(point.lat - first.lat) < 1e-8 && Math.abs(point.lng - first.lng) < 1e-8);
            if (samePoint) {
              map.setView(center, Math.min(20, map.getZoom() + 2), { animate: true });
            } else {
              map.fitBounds(bounds, { padding: [80, 80], maxZoom: Math.min(20, map.getZoom() + 3), animate: true });
            }
          });
          marker.addTo(map);
          clusterMarkers.current.push(marker);
        }
      });
    };

    const schedule = (event?: L.LeafletEvent) => {
      const generated = event?.layer && ((event.layer as any).__nmbClusterMarker || (event.layer as any).__nmbHeatLayer);
      if (generated) return;
      refresh();
    };

    map.on('zoomend moveend layeradd layerremove', schedule);
    refresh();

    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
      map.off('zoomend moveend layeradd layerremove', schedule);
      clearGeneratedLayers();
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker && !(layer as any).__nmbClusterMarker) restoreMarker(layer);
      });
    };
  }, [map, heatEnabled]);

  return null;
}
