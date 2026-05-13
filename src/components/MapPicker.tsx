import { useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Search, Loader2, MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapPickerProps {
  onLocationSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
  address?: string; // Endereço vindo do formulário
  className?: string;
}

// Bairro Vitória Régia, Curitiba
const DEFAULT_CENTER: [number, number] = [-25.535, -49.335];

// Componente para atualizar a visão do mapa
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 16);
  }, [center, map]);
  return null;
}

function LocationMarker({ position, setPosition, onSelect }: {
  position: [number, number] | null,
  setPosition: (p: [number, number]) => void,
  onSelect: (lat: number, lng: number) => void
}) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setPosition([lat, lng]);
      onSelect(lat, lng);
    },
  });

  return position === null ? null : (
    <Marker position={position} />
  );
}

export default function MapPicker({ onLocationSelect, initialLat, initialLng, address, className = "h-64 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700" }: MapPickerProps) {
  const [position, setPosition] = useState<[number, number] | null>(
    initialLat && initialLng ? [initialLat, initialLng] : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Função principal de busca (Geocoding)
  const searchAddress = useCallback(async (query: string) => {
    if (!query || query.length < 3) return;

    setLoading(true);
    setError(false);
    try {
      // Prioriza Curitiba se não estiver no texto
      const fullQuery = query.toLowerCase().includes('curitiba') ? query : `${query}, Curitiba, PR`;

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        const newPos: [number, number] = [lat, lon];
        setPosition(newPos);
        onLocationSelect(lat, lon);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error("Erro na busca:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [onLocationSelect]);

  // Botão para disparar a busca manualmente com base no que está no formulário
  const handleManualSearch = (e: React.MouseEvent) => {
    e.preventDefault();
    if (address) searchAddress(address);
  };

  const center = position || DEFAULT_CENTER;

  return (
    <div className="space-y-3">
      {address && (
        <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700/50 transition-all">
          <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Endereço atual</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 truncate font-medium">{address}</p>
          </div>
          <button
            type="button"
            onClick={handleManualSearch}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-md shadow-sm transition-all active:scale-95"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            {loading ? "Buscando..." : "Localizar no Mapa"}
          </button>
        </div>
      )}

      {error && (
        <p className="text-[11px] text-red-500 font-medium animate-fade-in">
          ⚠️ Não encontramos este endereço. Tente clicar manualmente no mapa.
        </p>
      )}

      <div className="relative group">
        <div className={className}>
          <MapContainer
            center={center}
            zoom={14}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {position && <ChangeView center={position} />}
            <LocationMarker position={position} setPosition={setPosition} onSelect={onLocationSelect} />
          </MapContainer>
        </div>

        {!position && !loading && (
          <div className="absolute inset-0 bg-slate-900/10 pointer-events-none flex items-center justify-center backdrop-blur-[1px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-lg text-xs font-bold text-slate-600 dark:text-slate-300">
              Clique no mapa para marcar o local
            </p>
          </div>
        )}
      </div>

      {position && (
        <div className="flex items-center justify-center gap-1.5 py-1 px-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-full w-fit mx-auto border border-emerald-100 dark:border-emerald-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">Localização Confirmada</span>
        </div>
      )}
    </div>
  );
}
