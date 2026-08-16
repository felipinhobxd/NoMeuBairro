import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import type { MapPickerProps } from './MapPickerImpl';

const MapPickerImpl = lazy(() => import('./MapPickerImpl'));

export default function MapPicker(props: MapPickerProps) {
  return (
    <Suspense fallback={
      <div className="h-64 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando mapa...
      </div>
    }>
      <MapPickerImpl {...props} />
    </Suspense>
  );
}
