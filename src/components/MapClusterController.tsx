import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

const HEAT_PANE = 'nmb-density-heat';
const HEAT_CANVAS_CLASS = 'nmb-heat-canvas';
const MAX_VISUAL_DENSITY = 8;
const COLOR_LUT_SIZE = 768;

export type HeatPoint = {
  id: string;
  lat: number;
  lng: number;
  /** Peso relativo. Pontos exatos normalmente usam 1 e posições aproximadas < 1. */
  weight?: number;
  approximate?: boolean;
};

type Props = {
  points?: HeatPoint[];
};

type RGB = [number, number, number];
type Kernel = {
  radius: number;
  size: number;
  values: Float32Array;
};

type ProjectedMarker = {
  marker: L.Marker;
  point: L.Point;
};

const HEAT_STOPS: Array<[number, RGB]> = [
  [0, [22, 163, 74]],
  [0.24, [101, 194, 32]],
  [0.46, [234, 179, 8]],
  [0.68, [249, 115, 22]],
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

    // Remove a cauda quase invisível do kernel para não criar névoa verde pelo mapa inteiro.
    if (density < 0.085) {
      lut[offset + 3] = 0;
      continue;
    }

    // Escala absoluta: 1 ocorrência ≈ verde, 3 ≈ amarelo, 5 ≈ laranja e 7+ ≈ vermelho.
    const normalized = clamp((density - 0.75) / 6.1, 0, 1);
    const [red, green, blue] = interpolateColor(normalized);
    const strength = Math.sqrt(clamp(density / MAX_VISUAL_DENSITY, 0, 1));

    lut[offset] = red;
    lut[offset + 1] = green;
    lut[offset + 2] = blue;
    lut[offset + 3] = Math.round(255 * clamp(0.045 + strength * 0.53, 0, 0.59));
  }
  return lut;
}

const COLOR_LUT = createColorLut();

function clusterDistanceForZoom(zoom: number) {
  if (zoom <= 11) return 76;
  if (zoom <= 12) return 70;
  if (zoom <= 13) return 64;
  if (zoom <= 14) return 58;
  if (zoom <= 15) return 52;
  if (zoom <= 16) return 46;
  if (zoom <= 17) return 40;
  if (zoom <= 18) return 34;
  return 28;
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
    // Marcadores focados e a localização do usuário permanecem individuais.
    if (Number(layer.options.zIndexOffset || 0) >= 1000) return;
    markers.push(layer);
  });
  return markers;
}

function fallbackHeatPoints(map: L.Map): HeatPoint[] {
  const points: HeatPoint[] = [];
  let index = 0;
  map.eachLayer((layer) => {
    if (!(layer instanceof L.Marker)) return;
    if ((layer as any).__nmbClusterMarker) return;
    if (Number(layer.options.zIndexOffset || 0) >= 1200) return;
    const latLng = layer.getLatLng();
    points.push({ id: `fallback-${index++}`, lat: latLng.lat, lng: latLng.lng, weight: 1 });
  });
  return points;
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
  let scale = pointCount > 7000 ? 0.25 : pointCount > 3000 ? 0.31 : pointCount > 1200 ? 0.38 : pointCount > 400 ? 0.46 : 0.56;
  const maxCells = 520_000;
  const cells = width * height * scale * scale;
  if (cells > maxCells) scale *= Math.sqrt(maxCells / cells);
  return clamp(scale, 0.22, 0.58);
}

/** Largura espacial do KDE. Diminui conforme o zoom para sair de região → quadra → rua. */
function bandwidthMetersForZoom(zoom: number) {
  if (zoom <= 10) return 5600;
  if (zoom === 11) return 3200;
  if (zoom === 12) return 1750;
  if (zoom === 13) return 950;
  if (zoom === 14) return 520;
  if (zoom === 15) return 285;
  if (zoom === 16) return 150;
  if (zoom === 17) return 82;
  if (zoom === 18) return 46;
  if (zoom === 19) return 28;
  return 20;
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
  const sigma = Math.max(1, safeRadius * 0.39);
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
  weight: number,
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
      density[gridRow + x] += kernel.values[kernelRow + kernelX] * weight;
    }
  }
}

function groupMarkersByDistance(map: L.Map, markers: L.Marker[], zoom = map.getZoom()) {
  const threshold = clusterDistanceForZoom(zoom);
  const thresholdSquared = threshold * threshold;
  const cellSize = threshold;
  const projected: ProjectedMarker[] = markers.map(marker => ({ marker, point: map.project(marker.getLatLng(), zoom) }));
  const parent = projected.map((_, index) => index);
  const buckets = new Map<string, number[]>();

  const find = (value: number): number => {
    let root = value;
    while (parent[root] !== root) root = parent[root];
    while (parent[value] !== value) {
      const next = parent[value];
      parent[value] = root;
      value = next;
    }
    return root;
  };

  const union = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };

  projected.forEach((entry, index) => {
    const cellX = Math.floor(entry.point.x / cellSize);
    const cellY = Math.floor(entry.point.y / cellSize);

    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const neighbors = buckets.get(`${cellX + dx}:${cellY + dy}`) || [];
        for (const otherIndex of neighbors) {
          const other = projected[otherIndex].point;
          const deltaX = entry.point.x - other.x;
          const deltaY = entry.point.y - other.y;
          if (deltaX * deltaX + deltaY * deltaY <= thresholdSquared) union(index, otherIndex);
        }
      }
    }

    const key = `${cellX}:${cellY}`;
    const bucket = buckets.get(key) || [];
    bucket.push(index);
    buckets.set(key, bucket);
  });

  const groups = new Map<number, L.Marker[]>();
  projected.forEach((entry, index) => {
    const root = find(index);
    const group = groups.get(root) || [];
    group.push(entry.marker);
    groups.set(root, group);
  });

  return [...groups.values()];
}

export default function MapClusterController({ points = [] }: Props) {
  const map = useMap();
  const clusterMarkers = useRef<L.Marker[]>([]);
  const hiddenMarkers = useRef<L.Marker[]>([]);
  const clusterFrame = useRef<number | null>(null);

  const validPoints = useMemo(
    () => points.filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng)),
    [points],
  );

  // Agrupamento numérico por distância real, sem bordas artificiais de grade.
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

    let pendingZoom = map.getZoom();

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
  }, [map]);

  // KDE permanente. Quando a página fornece pontos, o calor usa os dados diretamente;
  // o fallback por marcadores só existe para compatibilidade durante deploys antigos.
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
    canvas.style.willChange = 'transform, opacity';

    let heatFrame: number | null = null;
    let densityBuffer = new Float32Array(0);
    let imageData: ImageData | null = null;

    const drawHeat = () => {
      if (!canvas.isConnected) return;
      if (heatFrame != null) cancelAnimationFrame(heatFrame);

      heatFrame = requestAnimationFrame(() => {
        if (!canvas.isConnected) return;

        const heatPoints = validPoints.length > 0 ? validPoints : fallbackHeatPoints(map);
        const size = map.getSize();
        const padding = clamp(Math.round(Math.min(size.x, size.y) * 0.30), 150, 300);
        const displayWidth = Math.max(1, size.x + padding * 2);
        const displayHeight = Math.max(1, size.y + padding * 2);
        const renderScale = renderScaleFor(heatPoints.length, displayWidth, displayHeight);
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
        const canvasTopLeft = viewportTopLeft.subtract([padding, padding]);
        L.DomUtil.setPosition(canvas, canvasTopLeft);

        if (heatPoints.length === 0) {
          canvas.style.opacity = '1';
          return;
        }

        const zoom = map.getZoom();
        const centerLatitude = map.getCenter().lat;
        const bandwidthMeters = bandwidthMetersForZoom(zoom);
        const bandwidthScreenPixels = bandwidthMeters / Math.max(0.01, metersPerPixel(centerLatitude, zoom));
        const radiusGrid = clamp(bandwidthScreenPixels * renderScale, 3, 72);
        const kernel = kernelForRadius(radiusGrid);
        const paddedBounds = map.getBounds().pad(0.45);

        for (const pointData of heatPoints) {
          const latLng = L.latLng(pointData.lat, pointData.lng);
          if (!paddedBounds.contains(latLng)) continue;
          const containerPoint = map.latLngToContainerPoint(latLng);
          const gridX = (containerPoint.x + padding) * renderScale;
          const gridY = (containerPoint.y + padding) * renderScale;
          const inferredWeight = pointData.approximate ? 0.58 : 1;
          const weight = clamp(pointData.weight ?? inferredWeight, 0.15, 2.5);
          addKernel(densityBuffer, gridWidth, gridHeight, gridX, gridY, kernel, weight);
        }

        const pixels = imageData.data;
        for (let cell = 0; cell < requiredCells; cell += 1) {
          const density = densityBuffer[cell];
          if (density < 0.085) continue;
          const lutIndex = Math.round(clamp(density / MAX_VISUAL_DENSITY, 0, 1) * (COLOR_LUT_SIZE - 1));
          const lutOffset = lutIndex * 4;
          const pixelOffset = cell * 4;
          pixels[pixelOffset] = COLOR_LUT[lutOffset];
          pixels[pixelOffset + 1] = COLOR_LUT[lutOffset + 1];
          pixels[pixelOffset + 2] = COLOR_LUT[lutOffset + 2];
          pixels[pixelOffset + 3] = COLOR_LUT[lutOffset + 3];
        }

        const context = canvas.getContext('2d', { alpha: true });
        if (!context) return;
        context.clearRect(0, 0, gridWidth, gridHeight);
        context.putImageData(imageData, 0, 0);
        canvas.style.opacity = '1';
      });
    };

    const onZoom = () => drawHeat();
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
      canvas.remove();
      removeLegacyHeatLayers(map);
      removeHeatCanvases(pane);
    };
  }, [map, validPoints]);

  return null;
}
