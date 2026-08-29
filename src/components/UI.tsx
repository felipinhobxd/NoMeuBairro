import { type ComponentType, type SVGProps, useState, useEffect, useRef, createContext, useContext, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../utils/cn';
import { formatImageBytes, optimizePostImageFile } from '../utils/imageOptimization';
import { X, Upload, Link, ImageIcon, Loader2 } from 'lucide-react';

// ═══════════════════════════════════════════════════════════
// TOAST NOTIFICATION SYSTEM
// ═══════════════════════════════════════════════════════════
interface Toast { id: string; message: string; type: 'success' | 'error' | 'info'; }
interface ToastContextType { toast: (message: string, type?: Toast['type']) => void; }
const ToastContext = createContext<ToastContextType>({ toast: () => {} });
export const useToast = () => useContext(ToastContext);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timerRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const removeToast = useCallback((id: string) => { setToasts(prev => prev.filter(t => t.id !== id)); const timer = timerRefs.current.get(id); if (timer) { clearTimeout(timer); timerRefs.current.delete(id); } }, []);
  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => { const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6); setToasts(prev => [...prev.slice(-4), { id, message, type }]); const timer = setTimeout(() => removeToast(id), 3500); timerRefs.current.set(id, timer); }, [removeToast]);
  useEffect(() => { const map = timerRefs.current; return () => { map.forEach(t => clearTimeout(t)); map.clear(); }; }, []);
  const icons: Record<Toast['type'], string> = { success: '✅', error: '❌', info: 'ℹ️' };
  const colors: Record<Toast['type'], string> = { success: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/20', error: 'bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300 ring-red-200 dark:ring-red-500/20', info: 'bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 ring-blue-200 dark:ring-blue-500/20' };
  return <ToastContext.Provider value={{ toast: addToast }}>{children}<div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none" aria-live="polite">{toasts.map(t => <div key={t.id} className={cn('pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-xl ring-1 shadow-lg animate-toast-in text-sm font-medium max-w-xs', colors[t.type])}><span className="text-base shrink-0">{icons[t.type]}</span><span className="flex-1">{t.message}</span><button onClick={() => removeToast(t.id)} className="shrink-0 p-0.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors"><X className="w-3.5 h-3.5" /></button></div>)}</div></ToastContext.Provider>;
}
interface EmptyStateProps { icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>; title: string; description: string; action?: { label: string; onClick: () => void }; }
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) { return <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-fade-in" role="status"><div className="w-20 h-20 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-6 ring-1 ring-emerald-100 dark:ring-emerald-500/20"><Icon className="w-10 h-10 text-emerald-500 dark:text-emerald-400" /></div><h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{title}</h3><p className="text-sm text-slate-500 dark:text-slate-400 max-w-md leading-relaxed mb-8">{description}</p>{action && <button onClick={action.onClick} className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm shadow-emerald-600/20 hover:shadow-emerald-600/30 active:scale-[0.98]">{action.label}</button>}</div>; }
const statusConfig: Record<string, { label: string; cls: string }> = { pending: { label: 'Aberto', cls: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20' }, in_progress: { label: 'Em andamento', cls: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20' }, resolved: { label: 'Resolvido', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20' } };
export function StatusBadge({ status }: { status: string }) { const c = statusConfig[status] ?? statusConfig.pending; return <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ring-1 ring-inset', c.cls)}>{c.label}</span>; }
interface CatDef { label: string; emoji: string }
export const postCategories: Record<string, CatDef> = { buraco: { label: 'Buraco na via', emoji: '🕳️' }, iluminacao: { label: 'Iluminação', emoji: '💡' }, fios: { label: 'Fios / Energia', emoji: '⚡' }, saneamento: { label: 'Água / Esgoto', emoji: '💧' }, limpeza: { label: 'Limpeza', emoji: '🧹' }, transporte: { label: 'Transporte', emoji: '🚌' }, seguranca: { label: 'Segurança', emoji: '🛡️' }, outros: { label: 'Outros', emoji: '📌' } };
const categoryBadgeStyles: Record<string, string> = {
  buraco: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25',
  iluminacao: 'bg-yellow-50 text-yellow-800 ring-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:ring-yellow-500/25',
  fios: 'bg-orange-50 text-orange-800 ring-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/25',
  saneamento: 'bg-cyan-50 text-cyan-800 ring-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:ring-cyan-500/25',
  limpeza: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25',
  transporte: 'bg-blue-50 text-blue-800 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/25',
  seguranca: 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/25',
  outros: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
};
export function CategoryBadge({ category }: { category: string }) {
  const d = postCategories[category] ?? postCategories.outros;
  const style = categoryBadgeStyles[category] ?? categoryBadgeStyles.outros;
  return <span aria-label={`Categoria: ${d.label}`} className={cn('inline-flex min-h-7 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-extrabold ring-1 ring-inset', style)}><span className="text-[10px] font-black uppercase tracking-wide opacity-70">Categoria:</span><span role="img" aria-hidden="true">{d.emoji}</span><span>{d.label}</span></span>;
}
export function Card({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn('rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 p-5 transition-all duration-200 card-hover', className)} {...props}>{children}</div>; }
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg' }
const btnVar: Record<BtnVariant, string> = { primary: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 hover:shadow-emerald-600/30', secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300', ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 dark:hover:bg-slate-800 dark:text-slate-400', danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-600/20' };
const btnSize: Record<string, string> = { sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5', md: 'px-4 py-2 text-sm rounded-xl gap-2', lg: 'px-6 py-3 text-base rounded-xl gap-2' };
export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) { return <button className={cn('inline-flex items-center justify-center font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none', btnVar[variant], btnSize[size], className)} {...props}>{children}</button>; }
const fieldCls = 'w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600';
export function Input({ label, error, className, id, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) { const fid = id ?? label?.toLowerCase().replace(/\s+/g, '-'); return <div className="space-y-1.5">{label && <label htmlFor={fid} className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>}<input id={fid} className={cn(fieldCls, error && '!border-red-300 dark:!border-red-500', className)} {...props} />{error && <p className="text-xs text-red-500">{error}</p>}</div>; }
export function Textarea({ label, error, className, id, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) { const fid = id ?? label?.toLowerCase().replace(/\s+/g, '-'); return <div className="space-y-1.5">{label && <label htmlFor={fid} className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>}<textarea id={fid} className={cn(fieldCls, 'resize-y min-h-[100px]', error && '!border-red-300 dark:!border-red-500', className)} {...props} />{error && <p className="text-xs text-red-500">{error}</p>}</div>; }
export function Select({ label, options, className, id, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; options: { value: string; label: string }[] }) { const fid = id ?? label?.toLowerCase().replace(/\s+/g, '-'); return <div className="space-y-1.5">{label && <label htmlFor={fid} className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>}<select id={fid} className={cn(fieldCls, 'appearance-none', className)} {...props}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>; }
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      panelRef.current?.focus();
    } else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-0 sm:p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label={title}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div ref={panelRef} tabIndex={-1} className="relative w-full sm:max-w-lg h-full sm:h-auto sm:max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl ring-1 ring-slate-200 dark:ring-slate-800 animate-slide-up">
        <div className="flex-none bg-white dark:bg-slate-900 px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-2 -mr-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" aria-label="Fechar"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 pb-24 sm:pb-6 no-scrollbar">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
export function ImageUpload({ value, onChange, label = 'Imagem (opcional)' }: { value: string; onChange: (v: string) => void; label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [urlDraft, setUrlDraft] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processingError, setProcessingError] = useState('');
  const [optimizationInfo, setOptimizationInfo] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const processFile = async (file: File) => {
    setProcessing(true);
    setProcessingError('');
    try {
      const optimized = await optimizePostImageFile(file);
      onChange(optimized.dataUrl);
      setOptimizationInfo(`${formatImageBytes(optimized.originalBytes)} → ${formatImageBytes(optimized.blob.size)} · ${optimized.width}×${optimized.height} · ${optimized.extension.toUpperCase()}`);
    } catch (error) {
      setProcessingError(error instanceof Error ? error.message : 'Não foi possível otimizar a foto.');
    } finally {
      setProcessing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const clear = () => {
    onChange('');
    setUrlDraft('');
    setProcessingError('');
    setOptimizationInfo('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const useUrl = () => {
    if (!urlDraft.trim()) return;
    setOptimizationInfo('');
    setProcessingError('');
    onChange(urlDraft.trim());
  };

  if (value) return <div className="space-y-1.5">{label && <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>}<div className="relative rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 animate-scale-in"><img src={value} alt="Pré-visualização" className="w-full max-h-52 object-contain" /><button type="button" onClick={clear} className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors backdrop-blur-sm" aria-label="Remover foto"><X className="w-4 h-4" /></button></div>{optimizationInfo && <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">✓ Foto otimizada automaticamente: {optimizationInfo}. A miniatura será criada no envio.</p>}</div>;

  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
        {([['upload', Upload, 'Arquivo'], ['url', Link, 'URL']] as const).map(([m, Icon, optionLabel]) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => { setMode(m); setProcessingError(''); }}
            className={cn('flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all', mode === m ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400')}
          >
            <Icon className="w-3.5 h-3.5" />{optionLabel}
          </button>
        ))}
      </div>

      {mode === 'upload' ? (
        <div
          role="button"
          tabIndex={processing ? -1 : 0}
          aria-label="Selecionar foto para otimizar"
          aria-busy={processing}
          onDrop={event => { event.preventDefault(); setDragOver(false); const file = event.dataTransfer.files?.[0]; if (file) void processFile(file); }}
          onDragOver={event => { event.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onKeyDown={event => { if (!processing && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); inputRef.current?.click(); } }}
          onClick={() => !processing && inputRef.current?.click()}
          className={cn('relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500', dragOver ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-500/5' : 'border-slate-300 dark:border-slate-600 hover:border-emerald-400 dark:hover:border-emerald-500/50', processing && 'pointer-events-none opacity-60')}
        >
          {processing ? (
            <div className="flex flex-col items-center gap-2"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /><p className="text-sm text-slate-500">Otimizando foto...</p></div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3"><ImageIcon className="w-6 h-6 text-slate-400" /></div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Clique para selecionar</p>
              <p className="text-xs text-slate-400 mt-1">ou arraste uma imagem aqui</p>
              <p className="text-[11px] text-slate-400 mt-2">JPG, PNG, WebP ou HEIC compatível — até 10 MB</p>
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">Conversão e redução automáticas antes do envio</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
            onClick={event => event.stopPropagation()}
            onChange={event => { const file = event.target.files?.[0]; if (file) void processFile(file); }}
            className="hidden"
            tabIndex={-1}
          />
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex gap-2">
            <input type="url" value={urlDraft} onChange={event => setUrlDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); useUrl(); } }} placeholder="https://exemplo.com/foto.jpg" className={cn(fieldCls, 'flex-1')} aria-label="URL da foto" />
            <button type="button" onClick={useUrl} disabled={!urlDraft.trim()} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors shrink-0">OK</button>
          </div>
          <p className="text-[11px] text-slate-400">Links externos são preservados e não recebem compressão automática.</p>
        </div>
      )}
      {processingError && <p className="text-xs font-semibold text-red-600 dark:text-red-400" role="alert">{processingError}</p>}
    </div>
  );
}
export function timeAgo(dateStr: string): string { const sec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000); if (sec < 60) return 'agora'; const min = Math.floor(sec / 60); if (min < 60) return `${min}min`; const hr = Math.floor(min / 60); if (hr < 24) return `${hr}h`; const d = Math.floor(hr / 24); if (d < 30) return `${d}d`; return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }); }
export function ImageViewer({ src, open, onClose }: { src: string; open: boolean; onClose: () => void }) { useEffect(() => { if (open) document.body.style.overflow = 'hidden'; else document.body.style.overflow = ''; return () => { document.body.style.overflow = ''; }; }, [open]); useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [open, onClose]); if (!open) return null; return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 animate-fade-in p-4 sm:p-8" onClick={onClose} role="dialog" aria-modal="true"><button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-[110]" aria-label="Fechar imagem"><X className="w-6 h-6" /></button><div className="relative w-full h-full flex items-center justify-center animate-scale-in" onClick={e => e.stopPropagation()}><img src={src} alt="Zoom" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl select-none" /></div></div>; }
