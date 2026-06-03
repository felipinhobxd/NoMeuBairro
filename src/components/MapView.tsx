import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { TouchPointer, MousePointer2 } from 'lucide-react';
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
        scrollWheelZoom={isInteractive}
        dragging={isInteractive}
        touchZoom={isInteractive}
        doubleClickZoom={isInteractive}
        zoomControl={isInteractive}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
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
          className="absolute inset-0 z-[400] bg-slate-900/5 hover:bg-slate-900/10 transition-colors flex flex-col items-center justify-center gap-2"
          aria-label="Ativar mapa"
        >
          <div className="bg-white/90 dark:bg-slate-800/90 px-3 py-1.5 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2 animate-scale-in">
            <TouchPointer className="w-4 h-4 text-emerald-600" />
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">Toque para interagir</span>
          </div>
        </button>
      )}

      {/* Release interaction indicator */}
      {isInteractive && (
        <button
          onClick={() => setIsInteractive(false)}
          className="absolute top-2 right-2 z-[1000] bg-white dark:bg-slate-800 p-2 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 hover:text-emerald-600 transition-colors"
        >
          Travar Mapa
        </button>
      )}
    </div>
  );
}
