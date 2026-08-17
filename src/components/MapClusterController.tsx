import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

const HEAT_PANE = 'nmb-density-heat';
const HEAT_CANVAS_CLASS = 'nmb-heat-canvas';

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

function clusterColor(count: number) {
  if (count >= 8) return '#dc2626';
  if (count >= 5) return '#f97316';
  if (count >= 3) return '#eab308';
  return '#22c55e';
}

function clusterIcon(count: number) {
  const color = clusterColor(count);
  const size = count >= 100 ? 62 : count >= 10 ? 58 : 54;
  return L.divIcon({
    className: 'nmb-leaflet-cluster',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div class="nmb-density-count" title="${count} itens nesta área — clique para aproximar" style="--nmb-density-color:${color};width:${size}px;height:${size}px"><span>${count}</span></div>`,
  });
}

function heatRadiusForZoom(zoom: number) {
  if (zoom <= 11) return 31;
  if (zoom <= 13) return 30;
  if (zoom <= 15) return 28;
  if (zoom <= 17) return 26;
  return 24;
}

type RGB = [number, number, number];
const HEAT_STOPS: Array<[number, RGB]> = [
  [0, [34, 197, 94]],
  [0.34, [234, 179, 8]],
  [0.64, [249, 115, 22]],
  [1, [220, 38, 38]],
];

function heatColor(value: number): RGB {
  const normalized = Math.max(0, Math.min(1, value));
  for (let index = 1; index < HEAT_STOPS.length; index += 1) {
    const [endAt, endColor] = HEAT_STOPS[index];
    const [startAt, startColor] = HEAT_STOPS[index - 1];
    if (normalized > endAt) continue;
    const span = Math.max(0.0001, endAt - startAt);
    const progress = (normalized - startAt) / span;
    return [
      Math.round(startColor[0] + (endColor[0] - startColor[0]) * progress),
      Math.round(startColor[1] + (endColor[1] - startColor[1]) * progress),
      Math.round(startColor[2] + (endColor[2] - startColor[2]) * progress),
    ];
  }
  return HEAT_STOPS[HEAT_STOPS.length - 1][1];
}

function getSourceMarkers(map: L.Map) {
  const sourceMarkers: L.Marker[] = [];
  map.eachLayer((layer) => {
    if (!(layer instanceof L.Marker)) return;
    if ((layer as any).__nmbClusterMarker) return;
    const zIndex = Number(layer.options.zIndexOffset || 0);
    // Localização do usuário e itens em foco permanecem individuais.
    if (zIndex >= 1000) return;
    sourceMarkers.push(layer);
  });
  return sourceMarkers;
}

function removeHeatCanvases(pane: HTMLElement | undefined) {
  if (!pane) return;
  pane.querySelectorAll<HTMLCanvasElement>(`.${HEAT_CANVAS_CLASS}`).forEach((canvas) => canvas.remove());
}

export default function MapClusterController({ heatEnabled = true }: Props) {
  const map = useMap();
  const clusterMarkers = useRef<L.Marker[]>([]);
  const hiddenMarkers = useRef<L.Marker[]>([]);
  const clusterFrame = useRef<number | null>(null);

  // Agrupamento numérico: independente da camada de calor.
  useEffect(() => {
    const restoreHiddenMarkers = () => {
      for (const marker of hiddenMarkers.current) {
        marker.setOpacity(1);
        const element = marker.getElement();
        if (element) element.style.pointerEvents = '';
      }
      hiddenMarkers.current = [];
    };

    const clearClusters = () => {
      for (const marker of clusterMarkers.current) {
        if (map.hasLayer(marker)) map.removeLayer(marker);
      }
      clusterMarkers.current = [];
      restoreHiddenMarkers();
    };

    const hideMarker = (marker: L.Marker) => {
      marker.setOpacity(0);
      const element = marker.getElement();
      if (element) element.style.pointerEvents = 'none';
      hiddenMarkers.current.push(marker);
    };

    const refreshClusters = () => {
      if (clusterFrame.current != null) cancelAnimationFrame(clusterFrame.current);
      clusterFrame.current = requestAnimationFrame(() => {
        clearClusters();
        const sourceMarkers = getSourceMarkers(map);
        if (sourceMarkers.length < 2) return;

        const zoom = map.getZoom();
        const cellSize = gridSizeForZoom(zoom);
        const groups = new Map<string, L.Marker[]>();

        for (const marker of sourceMarkers) {
          const worldPoint = map.project(marker.getLatLng(), zoom);
          const key = `${Math.floor(worldPoint.x / cellSize)}:${Math.floor(worldPoint.y / cellSize)}`;
          const group = groups.get(key) || [];
          group.push(marker);
          groups.set(key, group);
        }

        for (const group of groups.values()) {
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
      if (event.layer && (event.layer as any).__nmbClusterMarker) return;
      refreshClusters();
    };

    map.on('zoomend resize', refreshClusters);
    map.on('layeradd layerremove', onLayerChange);
    refreshClusters();

    return () => {
      if (clusterFrame.current != null) cancelAnimationFrame(clusterFrame.current);
      map.off('zoomend resize', refreshClusters);
      map.off('layeradd layerremove', onLayerChange);
      clearClusters();
    };
  }, [map]);

  // Heatmap: quando desligado, não existe canvas nem listeners de desenho.
  useEffect(() => {
    let pane = map.getPane(HEAT_PANE);
    if (!pane) pane = map.createPane(HEAT_PANE);
    pane.style.zIndex = '340';
    pane.style.pointerEvents = 'none';

    // Remove qualquer canvas deixado por uma montagem anterior/StrictMode.
    removeHeatCanvases(pane);
    if (!heatEnabled) return;

    const canvas = L.DomUtil.create('canvas', HEAT_CANVAS_CLASS, pane) as HTMLCanvasElement;
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    canvas.style.opacity = '1';

    let heatFrame: number | null = null;

    const drawHeat = () => {
      if (!canvas.isConnected) return;
      if (heatFrame != null) cancelAnimationFrame(heatFrame);
      heatFrame = requestAnimationFrame(() => {
        if (!canvas.isConnected) return;

        const size = map.getSize();
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.35);
        const width = Math.max(1, Math.round(size.x * pixelRatio));
        const height = Math.max(1, Math.round(size.y * pixelRatio));

        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
        canvas.style.width = `${size.x}px`;
        canvas.style.height = `${size.y}px`;

        const topLeft = map.containerPointToLayerPoint([0, 0]);
        L.DomUtil.setPosition(canvas, topLeft);

        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.clearRect(0, 0, size.x, size.y);

        const sourceMarkers = getSourceMarkers(map);
        if (sourceMarkers.length === 0) return;

        const zoom = map.getZoom();
        const radius = heatRadiusForZoom(zoom);
        const paddedBounds = map.getBounds().pad(0.18);

        for (const marker of sourceMarkers) {
          const latLng = marker.getLatLng();
          if (!paddedBounds.contains(latLng)) continue;
          const point = map.latLngToContainerPoint(latLng);
          const gradient = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
          gradient.addColorStop(0, 'rgba(0,0,0,0.24)');
          gradient.addColorStop(0.28, 'rgba(0,0,0,0.18)');
          gradient.addColorStop(0.58, 'rgba(0,0,0,0.09)');
          gradient.addColorStop(0.82, 'rgba(0,0,0,0.025)');
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          context.fillStyle = gradient;
          context.fillRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
        }

        context.setTransform(1, 0, 0, 1, 0, 0);
        const image = context.getImageData(0, 0, width, height);
        const pixels = image.data;
        for (let offset = 0; offset < pixels.length; offset += 4) {
          const alpha = pixels[offset + 3] / 255;
          if (alpha < 0.018) {
            pixels[offset + 3] = 0;
            continue;
          }
          const density = Math.max(0, Math.min(1, (alpha - 0.08) / 0.68));
          const [red, green, blue] = heatColor(density);
          pixels[offset] = red;
          pixels[offset + 1] = green;
          pixels[offset + 2] = blue;
          pixels[offset + 3] = Math.round(255 * Math.min(0.58, 0.08 + alpha * 0.66));
        }
        context.putImageData(image, 0, 0);
      });
    };

    const onLayerChange = (event: L.LeafletEvent) => {
      if (event.layer && (event.layer as any).__nmbClusterMarker) return;
      drawHeat();
    };

    map.on('move zoomend resize', drawHeat);
    map.on('layeradd layerremove', onLayerChange);
    drawHeat();

    return () => {
      if (heatFrame != null) cancelAnimationFrame(heatFrame);
      map.off('move zoomend resize', drawHeat);
      map.off('layeradd layerremove', onLayerChange);
      canvas.remove();
      // Garante que nenhum canvas antigo sobreviva a uma troca rápida de estado/rota.
      removeHeatCanvases(pane);
    };
  }, [map, heatEnabled]);

  return null;
}
