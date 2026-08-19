import { useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Search, Loader2, MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { normalizeAddressForGeocoding } from '../utils/address';
import { resolveCuritibaLocation } from '../utils/locationResolver';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

export interface MapPickerProps {
  onLocationSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
  address?: string;
  className?: string;
}

const DEFAULT_CENTER: [number, number] = [-25.4297, -49.2711];

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, 16); }, [center, map]);
  return null;
}

function LocationMarker({ position, setPosition, onSelect }: {
  position: [number, number] | null;
  setPosition: (p: [number, number]) => void;
  onSelect: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setPosition([lat, lng]);
      onSelect(lat, lng);
    },
  });
  return position === null ? null : <Marker position={position} />;
}

export default function MapPickerImpl({ onLocationSelect, initialLat, initialLng, address, className = 'h-64 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 z-0' }: MapPickerProps) {
  const [position, setPosition] = useState<[number, number] | null>(
    initialLat != null && initialLng != null ? [initialLat, initialLng] : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (initialLat != null && initialLng != null && Number.isFinite(initialLat) && Number.isFinite(initialLng)) {
      setPosition([initialLat, initialLng]);
    } else {
      setPosition(null);
    }
  }, [initialLat, initialLng]);

  useEffect(() => { setError(false); }, [address]);

  const searchAddress = useCallback(async (query: string) => {
    if (!query || query.length < 3) return;
    setLoading(true);
    setError(false);
    try {
      const normalizedAddress = normalizeAddressForGeocoding(query);
      const resolved = await resolveCuritibaLocation({ location: normalizedAddress });
      if (resolved.latitude != null && resolved.longitude != null) {
        const lat = Number(resolved.latitude);
        const lon = Number(resolved.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('Coordenadas inválidas');
        const newPos: [number, number] = [lat, lon];
        setPosition(newPos);
        onLocationSelect(lat, lon);
      } else setError(true);
    } catch (err) {
      console.error('Erro na busca:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [onLocationSelect]);

  const handleManualSearch = (e: React.MouseEvent) => {
    e.preventDefault();
    if (address) void searchAddress(address);
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
          <button type="button" onClick={handleManualSearch} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-md shadow-sm transition-all active:scale-95">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            {loading ? 'Buscando...' : 'Localizar no mapa'}
          </button>
        </div>
      )}

      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-semibold animate-fade-in">⚠️ Não encontramos este endereço automaticamente. Confira a rua e o bairro ou marque o ponto diretamente no mapa.</p>}

      <div className="relative group">
        <div className={className}>
          <MapContainer center={center} zoom={14} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {position && <ChangeView center={position} />}
            <LocationMarker position={position} setPosition={setPosition} onSelect={onLocationSelect} />
          </MapContainer>
        </div>
        {!position && !loading && (
          <div className="absolute inset-0 bg-slate-900/10 pointer-events-none flex items-center justify-center backdrop-blur-[1px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-lg text-xs font-bold text-slate-600 dark:text-slate-300">Clique no mapa para marcar o local</p>
          </div>
        )}
      </div>

      {position && (
        <div className="flex items-center justify-center gap-1.5 py-1 px-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-full w-fit mx-auto border border-emerald-100 dark:border-emerald-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">Localização confirmada</span>
        </div>
      )}
    </div>
  );
}
