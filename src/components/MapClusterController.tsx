import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

const HEAT_PANE = 'nmb-density-heat';
const HEAT_CANVAS_CLASS = 'nmb-heat-canvas';
const MAX_VISUAL_DENSITY = 8;
const COLOR_LUT_SIZE = 512;

type Props = {
  // Mantido por compatibilidade com a página atual. O calor agora é permanente.
  heatEnabled?: boolean;
};

type RGB = [number, number, number];
type Kernel = {
  radius: number;
  size: number;
  values: Float32Array;
};

const HEAT_STOPS: Array<[number, RGB]> = [
  [0, [34, 197, 94]],
  [0.28, [132, 204, 22]],
  [0.48, [234, 179, 8]],
  [0.7, [249, 115, 22]],
  [1, [220, 38, 38]],
];

const kernelCache = new Map<number, Kernel>();

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function interpolateColor(value: number): RGB {
  const normalized = clamp(value, 0, 1);
  for (let index = 1; index < HEAT_STOPS.length; index += 1) {
    const [endAt, endColor] = HEAT_STOPS[index];
    const [startAt, startColor] = HEAT_STOPS[index - 1];
    if (normalized > endAt) continue;
    const progress = (normalized - startAt) / Math.max(0.0001, endAt - startAt);
    return [
      Math.round(startColor[0] + (endColor[0] - startColor[0]) * progress),
      Math.round(startColor[1] + (endColor[1] - startColor[1]) * progress),
      Math.round(startColor[2] + (endColor[2] - startColor[2]) * progress),
    ];
  }
  return HEAT_STOPS[HEAT_STOPS.length - 1][1];
}

function createColorLut() {
  const lut = new Uint8ClampedArray(COLOR_LUT_SIZE * 4);
  for (let index = 0; index < COLOR_LUT_SIZE; index += 1) {
    const density = (index / (COLOR_LUT_SIZE - 1)) * MAX_VISUAL_DENSITY;
    const offset = index * 4;

    if (density < 0.045) {
      lut[offset + 3] = 0;
      continue;
    }

    // Escala absoluta: a cor não muda só porque a pessoa arrastou o mapa.
    // ~1 item = verde, ~3 = amarelo, ~5 = laranja e 7+ = vermelho.
    const normalized = clamp((density - 0.15) / 6.85, 0, 1);
    const [red, green, blue] = interpolateColor(normalized);
    const strength = Math.sqrt(clamp(density / MAX_VISUAL_DENSITY, 0, 1));

    lut[offset] = red;
    lut[offset + 1] = green;
    lut[offset + 2] = blue;
    lut[offset + 3] = Math.round(255 * clamp(0.055 + strength * 0.54, 0, 0.61));
  }
  return lut;
}

const COLOR_LUT = createColorLut();

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
    html: `<div class="nmb-density-count is-heat-active" title="${count} itens nesta área — clique para aproximar" style="--nmb-density-color:${color};width:${size}px;height:${size}px"><span>${count}</span></div>`,
  });
}

function getClusterSourceMarkers(map: L.Map) {
  const markers: L.Marker[] = [];
  map.eachLayer((layer) => {
    if (!(layer instanceof L.Marker)) return;
    if ((layer as any).__nmbClusterMarker) return;
    // Marcador focado e localização do usuário permanecem individuais.
    if (Number(layer.options.zIndexOffset || 0) >= 1000) return;
    markers.push(layer);
  });
  return markers;
}

function getHeatSourceMarkers(map: L.Map) {
  const markers: L.Marker[] = [];
  map.eachLayer((layer) => {
    if (!(layer instanceof L.Marker)) return;
    if ((layer as any).__nmbClusterMarker) return;
    // A localização do usuário não representa atividade comunitária.
    // Relatos/eventos focados (1000/1100) continuam contando no calor.
    if (Number(layer.options.zIndexOffset || 0) >= 1200) return;
    markers.push(layer);
  });
  return markers;
}

function removeLegacyHeatLayers(map: L.Map) {
  const legacyLayers: L.Layer[] = [];
  map.eachLayer((layer) => {
    if ((layer as any).__nmbHeatLayer) legacyLayers.push(layer);
  });
  legacyLayers.forEach((layer) => {
    if (map.hasLayer(layer)) map.removeLayer(layer);
  });
}

function removeHeatCanvases(pane: HTMLElement | undefined) {
  pane?.querySelectorAll<HTMLCanvasElement>(`.${HEAT_CANVAS_CLASS}`).forEach((canvas) => canvas.remove());
}

function renderScaleFor(pointCount: number, width: number, height: number) {
  let scale = pointCount > 6000 ? 0.26 : pointCount > 2500 ? 0.32 : pointCount > 900 ? 0.4 : 0.5;
  const maxCells = 420_000;
  const cells = width * height * scale * scale;
  if (cells > maxCells) scale *= Math.sqrt(maxCells / cells);
  return clamp(scale, 0.22, 0.52);
}

function bandwidthMetersForZoom(zoom: number) {
  if (zoom <= 10) return 5200;
  if (zoom === 11) return 3000;
  if (zoom === 12) return 1650;
  if (zoom === 13) return 900;
  if (zoom === 14) return 500;
  if (zoom === 15) return 260;
  if (zoom === 16) return 135;
  if (zoom === 17) return 72;
  if (zoom === 18) return 42;
  return 28;
}

function metersPerPixel(latitude: number, zoom: number) {
  const latitudeRad = latitude * Math.PI / 180;
  return (40075016.686 * Math.max(0.2, Math.abs(Math.cos(latitudeRad)))) / (256 * 2 ** zoom);
}

function kernelForRadius(radius: number): Kernel {
  const safeRadius = Math.max(2, Math.round(radius));
  const cached = kernelCache.get(safeRadius);
  if (cached) return cached;

  const size = safeRadius * 2 + 1;
  const values = new Float32Array(size * size);
  const sigma = Math.max(1, safeRadius * 0.4);
  const denominator = 2 * sigma * sigma;

  for (let y = -safeRadius; y <= safeRadius; y += 1) {
    for (let x = -safeRadius; x <= safeRadius; x += 1) {
      const distanceSquared = x * x + y * y;
      if (distanceSquared > safeRadius * safeRadius) continue;
      values[(y + safeRadius) * size + (x + safeRadius)] = Math.exp(-distanceSquared / denominator);
    }
  }

  const kernel = { radius: safeRadius, size, values };
  kernelCache.set(safeRadius, kernel);
  return kernel;
}

function addKernel(
  density: Float32Array,
  gridWidth: number,
  gridHeight: number,
  centerX: number,
  centerY: number,
  kernel: Kernel,
) {
  const roundedX = Math.round(centerX);
  const roundedY = Math.round(centerY);
  const startX = Math.max(0, roundedX - kernel.radius);
  const endX = Math.min(gridWidth - 1, roundedX + kernel.radius);
  const startY = Math.max(0, roundedY - kernel.radius);
  const endY = Math.min(gridHeight - 1, roundedY + kernel.radius);

  for (let y = startY; y <= endY; y += 1) {
    const kernelY = y - roundedY + kernel.radius;
    const gridRow = y * gridWidth;
    const kernelRow = kernelY * kernel.size;
    for (let x = startX; x <= endX; x += 1) {
      const kernelX = x - roundedX + kernel.radius;
      density[gridRow + x] += kernel.values[kernelRow + kernelX];
    }
  }
}

export default function MapClusterController(_props: Props) {
  const map = useMap();
  const clusterMarkers = useRef<L.Marker[]>([]);
  const hiddenMarkers = useRef<L.Marker[]>([]);
  const clusterFrame = useRef<number | null>(null);

  // Números agrupados continuam independentes do desenho do calor.
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
        const sourceMarkers = getClusterSourceMarkers(map);
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
      if (event.layer && ((event.layer as any).__nmbClusterMarker || (event.layer as any).__nmbHeatLayer)) return;
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

  // Heatmap permanente: grid numérica de baixa resolução + kernel gaussiano.
  // O canvas fica ancorado nas coordenadas do Leaflet, então durante o arrasto ele
  // acompanha o mapa sem recalcular todos os pixels a cada frame.
  useEffect(() => {
    let pane = map.getPane(HEAT_PANE);
    if (!pane) pane = map.createPane(HEAT_PANE);
    pane.style.zIndex = '340';
    pane.style.pointerEvents = 'none';
    pane.style.display = '';

    removeLegacyHeatLayers(map);
    removeHeatCanvases(pane);

    const canvas = L.DomUtil.create('canvas', HEAT_CANVAS_CLASS, pane) as HTMLCanvasElement;
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    canvas.style.opacity = '1';
    canvas.style.imageRendering = 'auto';
    canvas.style.willChange = 'transform';

    let heatFrame: number | null = null;
    let densityBuffer = new Float32Array(0);
    let imageData: ImageData | null = null;

    const drawHeat = () => {
      if (!canvas.isConnected) return;
      if (heatFrame != null) cancelAnimationFrame(heatFrame);

      heatFrame = requestAnimationFrame(() => {
        if (!canvas.isConnected) return;

        const sourceMarkers = getHeatSourceMarkers(map);
        const size = map.getSize();
        const padding = clamp(Math.round(Math.min(size.x, size.y) * 0.34), 180, 340);
        const displayWidth = Math.max(1, size.x + padding * 2);
        const displayHeight = Math.max(1, size.y + padding * 2);
        const renderScale = renderScaleFor(sourceMarkers.length, displayWidth, displayHeight);
        const gridWidth = Math.max(1, Math.ceil(displayWidth * renderScale));
        const gridHeight = Math.max(1, Math.ceil(displayHeight * renderScale));
        const requiredCells = gridWidth * gridHeight;

        if (densityBuffer.length !== requiredCells) densityBuffer = new Float32Array(requiredCells);
        else densityBuffer.fill(0);

        if (!imageData || imageData.width !== gridWidth || imageData.height !== gridHeight) {
          imageData = new ImageData(gridWidth, gridHeight);
        } else {
          imageData.data.fill(0);
        }

        canvas.width = gridWidth;
        canvas.height = gridHeight;
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;

        const viewportTopLeft = map.containerPointToLayerPoint([0, 0]);
        const canvasOrigin = L.point(viewportTopLeft.x - padding, viewportTopLeft.y - padding);
        L.DomUtil.setPosition(canvas, canvasOrigin);

        if (sourceMarkers.length === 0) return;

        const zoom = map.getZoom();
        const center = map.getCenter();
        const bandwidthMeters = bandwidthMetersForZoom(zoom);
        const cssRadius = clamp(bandwidthMeters / metersPerPixel(center.lat, zoom), 22, 72);
        const kernel = kernelForRadius(cssRadius * renderScale);
        const northWest = map.containerPointToLatLng([-padding, -padding]);
        const southEast = map.containerPointToLatLng([size.x + padding, size.y + padding]);
        const paddedBounds = L.latLngBounds(northWest, southEast);

        for (const marker of sourceMarkers) {
          const latLng = marker.getLatLng();
          if (!paddedBounds.contains(latLng)) continue;
          const layerPoint = map.latLngToLayerPoint(latLng);
          const x = (layerPoint.x - canvasOrigin.x) * renderScale;
          const y = (layerPoint.y - canvasOrigin.y) * renderScale;
          addKernel(densityBuffer, gridWidth, gridHeight, x, y, kernel);
        }

        const pixels = imageData.data;
        for (let cell = 0; cell < requiredCells; cell += 1) {
          const density = densityBuffer[cell];
          if (density < 0.045) continue;
          const lutIndex = Math.min(
            COLOR_LUT_SIZE - 1,
            Math.round((Math.min(MAX_VISUAL_DENSITY, density) / MAX_VISUAL_DENSITY) * (COLOR_LUT_SIZE - 1)),
          );
          const sourceOffset = lutIndex * 4;
          const pixelOffset = cell * 4;
          pixels[pixelOffset] = COLOR_LUT[sourceOffset];
          pixels[pixelOffset + 1] = COLOR_LUT[sourceOffset + 1];
          pixels[pixelOffset + 2] = COLOR_LUT[sourceOffset + 2];
          pixels[pixelOffset + 3] = COLOR_LUT[sourceOffset + 3];
        }

        const context = canvas.getContext('2d', { alpha: true });
        context?.putImageData(imageData, 0, 0);
      });
    };

    const onLayerChange = (event: L.LeafletEvent) => {
      if (event.layer && ((event.layer as any).__nmbClusterMarker || (event.layer as any).__nmbHeatLayer)) return;
      drawHeat();
    };

    // moveend em vez de move: o pane do Leaflet já acompanha o arrasto.
    map.on('moveend zoomend resize', drawHeat);
    map.on('layeradd layerremove', onLayerChange);
    drawHeat();

    return () => {
      if (heatFrame != null) cancelAnimationFrame(heatFrame);
      map.off('moveend zoomend resize', drawHeat);
      map.off('layeradd layerremove', onLayerChange);
      canvas.remove();
      removeLegacyHeatLayers(map);
      removeHeatCanvases(pane);
    };
  }, [map]);

  return null;
}
