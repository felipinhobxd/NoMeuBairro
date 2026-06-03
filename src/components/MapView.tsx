import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MousePointer2, Lock } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { cn } from '../utils/cn';

// Fix for default marker icons in Leaflet with React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Componente interno para gerenciar a interatividade via API do Leaflet
function InteractionHandler({ enabled }: { enabled: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (enabled) {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
      if (map.tap) map.tap.enable();
      if (map.touchZoom) map.touchZoom.enable();
    } else {
      map.dragging.disable();
      map.scrollWheelZoom.disable();
      map.doubleClickZoom.disable();
      if (map.tap) map.tap.disable();
      if (map.touchZoom) map.touchZoom.disable();
    }
  }, [enabled, map]);

  return null;
}

interface MapViewProps {
  lat: number;
  lng: number;
  title?: string;
  className?: string;
}

export default function MapView({ lat, lng, title, className = "h-48 w-full rounded-xl overflow-hidden" }: MapViewProps) {
  const [isInteractive, setIsInteractive] = useState(false);

  return (
    <div className={cn("relative group", className)}>
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        scrollWheelZoom={false}
        dragging={false}
        touchZoom={false}
        doubleClickZoom={false}
        zoomControl={isInteractive}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <InteractionHandler enabled={isInteractive} />
        <Marker position={[lat, lng]}>
          {title && <Popup>{title}</Popup>}
        </Marker>
      </MapContainer>

      {/* Overlay to catch interaction */}
      {!isInteractive && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsInteractive(true);
          }}
          className="absolute inset-0 z-[400] bg-slate-900/5 hover:bg-slate-900/10 transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer"
          aria-label="Ativar mapa"
        >
          <div className="bg-white/90 dark:bg-slate-800/90 px-3 py-1.5 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2 animate-scale-in">
            <MousePointer2 className="w-4 h-4 text-emerald-600" />
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">Clique para mexer no mapa</span>
          </div>
        </button>
      )}

      {/* Release interaction indicator */}
      {isInteractive && (
        <button
          onClick={() => setIsInteractive(false)}
          className="absolute top-2 right-2 z-[1000] bg-white dark:bg-slate-800 p-2 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 hover:text-emerald-600 transition-colors flex items-center gap-1.5"
        >
          <Lock className="w-3 h-3" />
          Travar Mapa
        </button>
      )}
    </div>
  );
}
