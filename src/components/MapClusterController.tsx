import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

const HEAT_PANE = 'nmb-density-heat';

type Props = {
  heatEnabled?: boolean;
};

function gridSizeForZoom(zoom: number) {
  if (zoom <= 11) return 112;
  if (zoom <= 12) return 104;
  if (zoom <= 13) return 94;
  if (zoom <= 14) return 84;
  if (zoom <= 15) return 74;
  if (zoom <= 16) return 64;
  if (zoom <= 17) return 54;
  if (zoom <= 18) return 46;
  return 40;
}

function densityStrength(count: number, maxCount: number) {
  if (count <= 1) return 0.06;
  const relative = maxCount > 1 ? (count - 1) / (maxCount - 1) : 0;
  const absolute = Math.min(1, (count - 1) / 8);
  return Math.min(1, 0.14 + relative * 0.53 + absolute * 0.33);
}

function densityColor(strength: number) {
  if (strength >= 0.82) return '#dc2626';
  if (strength >= 0.58) return '#f97316';
  if (strength >= 0.34) return '#eab308';
  return '#22c55e';
}

function clusterIcon(count: number, color: string) {
  const size = count >= 100 ? 62 : count >= 10 ? 58 : 54;
  return L.divIcon({
    className: 'nmb-leaflet-cluster',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div class="nmb-density-count" title="${count} itens nesta área — clique para aproximar" style="--nmb-density-color:${color};width:${size}px;height:${size}px"><span>${count}</span></div>`,
  });
}

export default function MapClusterController({ heatEnabled = true }: Props) {
  const map = useMap();
  const clusterMarkers = useRef<L.Marker[]>([]);
  const heatLayers = useRef<L.Circle[]>([]);
  const hiddenMarkers = useRef<L.Marker[]>([]);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    let pane = map.getPane(HEAT_PANE);
    if (!pane) pane = map.createPane(HEAT_PANE);
    pane.style.zIndex = '360';
    pane.style.pointerEvents = 'none';

    const restoreHiddenMarkers = () => {
      for (const marker of hiddenMarkers.current) {
        marker.setOpacity(1);
        const element = marker.getElement();
        if (element) element.style.pointerEvents = '';
      }
      hiddenMarkers.current = [];
    };

    const clearGeneratedLayers = () => {
      for (const marker of clusterMarkers.current) {
        if (map.hasLayer(marker)) map.removeLayer(marker);
      }
      for (const circle of heatLayers.current) {
        if (map.hasLayer(circle)) map.removeLayer(circle);
      }
      clusterMarkers.current = [];
      heatLayers.current = [];
      restoreHiddenMarkers();
    };

    const hideMarker = (marker: L.Marker) => {
      marker.setOpacity(0);
      const element = marker.getElement();
      if (element) element.style.pointerEvents = 'none';
      hiddenMarkers.current.push(marker);
    };

    const radiusMetersFromWorldPixels = (center: L.LatLng, pixels: number, zoom: number) => {
      const point = map.project(center, zoom);
      const edge = map.unproject(L.point(point.x + pixels, point.y), zoom);
      return Math.max(30, map.distance(center, edge));
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
          // Localização do usuário e itens em foco permanecem sempre individuais.
          if (zIndex >= 1000) return;
          sourceMarkers.push(layer);
        });

        if (sourceMarkers.length === 0) return;

        const zoom = map.getZoom();
        const cellSize = gridSizeForZoom(zoom);
        const groups = new Map<string, L.Marker[]>();

        // map.project usa coordenadas globais do mapa. Diferente de containerPoint,
        // a grade NÃO muda quando a pessoa apenas arrasta o mapa.
        for (const marker of sourceMarkers) {
          const worldPoint = map.project(marker.getLatLng(), zoom);
          const key = `${Math.floor(worldPoint.x / cellSize)}:${Math.floor(worldPoint.y / cellSize)}`;
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
            const basePixels = count <= 1 ? 31 : 38 + strength * 28;
            const coreRadius = radiusMetersFromWorldPixels(center, basePixels, zoom);
            const halo = L.circle(center, {
              pane: HEAT_PANE,
              radius: coreRadius * 1.62,
              stroke: false,
              fill: true,
              fillColor: color,
              fillOpacity: count <= 1 ? 0.055 : 0.07 + strength * 0.085,
              interactive: false,
            });
            const core = L.circle(center, {
              pane: HEAT_PANE,
              radius: coreRadius,
              stroke: false,
              fill: true,
              fillColor: color,
              fillOpacity: count <= 1 ? 0.09 : 0.16 + strength * 0.20,
              interactive: false,
            });
            (halo as any).__nmbHeatLayer = true;
            (core as any).__nmbHeatLayer = true;
            halo.addTo(map);
            core.addTo(map);
            heatLayers.current.push(halo, core);
          }

          if (count < 2) continue;

          group.forEach(hideMarker);
          const marker = L.marker(center, {
            icon: clusterIcon(count, color),
            zIndexOffset: 900,
            keyboard: true,
            title: `${count} itens nesta área`,
          });
          (marker as any).__nmbClusterMarker = true;
          marker.on('click', () => {
            const first = latLngs[0];
            const samePoint = latLngs.every(point => Math.abs(point.lat - first.lat) < 1e-8 && Math.abs(point.lng - first.lng) < 1e-8);
            if (samePoint) {
              map.setView(center, Math.min(20, zoom + 2), { animate: true });
            } else {
              map.fitBounds(bounds, { padding: [80, 80], maxZoom: Math.min(20, zoom + 3), animate: true });
            }
          });
          marker.addTo(map);
          clusterMarkers.current.push(marker);
        }
      });
    };

    const onLayerChange = (event: L.LeafletEvent) => {
      const generated = event.layer && ((event.layer as any).__nmbClusterMarker || (event.layer as any).__nmbHeatLayer);
      if (generated) return;
      refresh();
    };

    // Não recalculamos em moveend: os círculos são camadas do mapa e acompanham o pan
    // naturalmente. Isso evita flicker, saltos e grupos mudando enquanto arrasta.
    map.on('zoomend', refresh);
    map.on('layeradd layerremove', onLayerChange);
    refresh();

    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
      map.off('zoomend', refresh);
      map.off('layeradd layerremove', onLayerChange);
      clearGeneratedLayers();
    };
  }, [map, heatEnabled]);

  return null;
}
