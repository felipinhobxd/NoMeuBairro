import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  UserCircle, LogOut, Award, Camera, Pencil,
  MessageSquare, Heart, CheckCircle2, Shield, CalendarDays, Loader2, Check, RotateCcw, ZoomIn, ImageIcon,
} from 'lucide-react';
import { Card, Button, Modal, Input, useToast } from '../components/UI';
import { cn } from '../utils/cn';
import { communityBadges, EMPTY_COMMUNITY_CONTRIBUTION, getCommunityBadgeProgress, getEarnedCommunityBadges, normalizeCommunityContribution, type CommunityContributionSummary } from '../utils/communityBadges';
import { supabase } from '../utils/supabase';
import AccountDataControls from '../components/AccountDataControls';

type Point = { x: number; y: number };
type SourceImage = { src: string; width: number; height: number };
type ProfileStats = CommunityContributionSummary & { earnedBadges: string[] };

function loadImage(file: File): Promise<SourceImage> {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ src, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => { URL.revokeObjectURL(src); reject(new Error('Não foi possível abrir a imagem.')); };
    img.src = src;
  });
}

async function makeSquareCrop(source: SourceImage, zoom: number, offset: Point) {
  const output = 512;
  const canvas = document.createElement('canvas');
  canvas.width = output;
  canvas.height = output;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível.');
  const img = new Image();
  img.src = source.src;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Falha ao preparar a imagem.'));
  });
  const baseScale = Math.max(output / source.width, output / source.height);
  const scale = baseScale * zoom;
  const drawW = source.width * scale;
  const drawH = source.height * scale;
  const x = (output - drawW) / 2 + offset.x * (output / 320);
  const y = (output - drawH) / 2 + offset.y * (output / 320);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, output, output);
  ctx.drawImage(img, x, y, drawW, drawH);
  URL.revokeObjectURL(source.src);
  return canvas.toDataURL('image/jpeg', 0.8);
}

function AvatarCropper({ value, onChange, onEditingChange }: { value: string; onChange: (value: string) => void; onEditingChange?: (editing: boolean) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<SourceImage | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [startOffset, setStartOffset] = useState<Point>({ x: 0, y: 0 });
  const [processing, setProcessing] = useState(false);

  const chooseFile = async (file: File) => {
    if (!file.type.startsWith('image/') || file.size > 15 * 1024 * 1024) return;
    try {
      const next = await loadImage(file);
      setSource(next);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      onEditingChange?.(true);
    } catch {
      onEditingChange?.(false);
    }
  };

  const saveCrop = async () => {
    if (!source) return;
    setProcessing(true);
    try {
      const cropped = await makeSquareCrop(source, zoom, offset);
      onChange(cropped);
      setSource(null);
      onEditingChange?.(false);
    } finally {
      setProcessing(false);
    }
  };

  const cancelCrop = () => {
    if (source) URL.revokeObjectURL(source.src);
    setSource(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    onEditingChange?.(false);
  };

  const resetCrop = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };
  const startDrag = (x: number, y: number) => { setDragging(true); setDragStart({ x, y }); setStartOffset(offset); };
  const moveDrag = (x: number, y: number) => {
    if (!dragging || !dragStart) return;
    setOffset({ x: startOffset.x + (x - dragStart.x), y: startOffset.y + (y - dragStart.y) });
  };
  const endDrag = () => { setDragging(false); setDragStart(null); };

  if (source) {
    const previewScale = Math.max(320 / source.width, 320 / source.height) * zoom;
    return (
      <div className="space-y-4">
        <div
          className="relative mx-auto w-full max-w-[320px] aspect-square rounded-2xl overflow-hidden bg-slate-950 touch-none select-none ring-1 ring-slate-200 dark:ring-slate-700"
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); startDrag(e.clientX, e.clientY); }}
          onPointerMove={(e) => moveDrag(e.clientX, e.clientY)}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <img
            src={source.src}
            alt="Recorte da foto de perfil"
            draggable={false}
            decoding="async"
            className="absolute left-1/2 top-1/2 max-w-none pointer-events-none select-none"
            style={{
              width: `${source.width}px`,
              height: `${source.height}px`,
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${previewScale})`,
            }}
          />
          <div className="absolute inset-0 pointer-events-none bg-black/20" />
          <div className="absolute inset-6 rounded-full ring-2 ring-white shadow-[0_0_0_9999px_rgba(0,0,0,0.38)] pointer-events-none" />
          <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm whitespace-nowrap">Arraste a foto para escolher o enquadramento</div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><ZoomIn className="w-4 h-4" /> Zoom</div>
          <input aria-label="Zoom da foto" type="range" min="1" max="3" step="0.01" value={zoom} onChange={e => setZoom(Number(e.target.value))} className="w-full accent-emerald-600" />
        </div>

        <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-sm font-semibold text-orange-900 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-200">Para salvar esta nova foto, primeiro toque em <strong>Usar foto</strong>.</div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button type="button" variant="secondary" className="sm:flex-1 h-11" onClick={resetCrop}><RotateCcw className="w-4 h-4" /> Recentrar</Button>
          <Button type="button" variant="secondary" className="sm:flex-1 h-11" onClick={cancelCrop}>Cancelar</Button>
          <Button type="button" className="sm:flex-1 h-11" onClick={saveCrop} disabled={processing}><Check className="w-4 h-4" /> {processing ? 'Preparando...' : 'Usar foto'}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {value ? (
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 ring-2 ring-slate-200 dark:ring-slate-700 shrink-0"><img src={value} alt="Foto de perfil" className="w-full h-full object-cover" decoding="async" /></div>
          <div><p className="text-sm font-semibold text-slate-800 dark:text-white">Foto pronta para salvar</p><button type="button" onClick={() => inputRef.current?.click()} className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">Trocar e recortar novamente</button></div>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} className="w-full border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-5 hover:border-emerald-400 dark:hover:border-emerald-500/50 transition-colors text-center">
          <ImageIcon className="w-8 h-8 mx-auto mb-2 text-slate-400" /><span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Escolher foto</span><span className="block text-xs text-slate-400 mt-1">Você poderá escolher exatamente qual parte aparecerá no perfil.</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/heic,image/heif" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void chooseFile(f); e.currentTarget.value = ''; }} />
    </div>
  );
}

export default function Profile() {
  const { user, isAuthenticated, logout, updateProfile, changePassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [stats, setStats] = useState<ProfileStats>({ ...EMPTY_COMMUNITY_CONTRIBUTION, earnedBadges: [] });
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [avatarCropPending, setAvatarCropPending] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setStats({ ...EMPTY_COMMUNITY_CONTRIBUTION, earnedBadges: [] });
      return () => { active = false; };
    }

    void supabase.rpc('get_community_contribution_summary', { p_user_id: user.id }).then(({ data, error }) => {
      if (!active || error || !data) return;
      const summary = normalizeCommunityContribution(data);
      setStats({ ...summary, earnedBadges: getEarnedCommunityBadges(summary) });
    });

    return () => { active = false; };
  }, [user?.id]);

  const openEditProfile = () => {
    if (!user) return;
    setEditName(user.name);
    setEditAvatar(user.avatarUrl ?? '');
    setAvatarChanged(false);
    setAvatarCropPending(false);
    setShowEditProfile(true);
  };

  const closeEditProfile = () => { setAvatarCropPending(false); setShowEditProfile(false); };

  const handleSaveProfile = async () => {
    if (!editName.trim()) return;
    if (avatarCropPending) { toast('Finalize o recorte tocando em “Usar foto” antes de salvar.', 'error'); return; }
    setSavingProfile(true);
    const result = await updateProfile({ name: editName.trim(), ...(avatarChanged ? { avatarUrl: editAvatar } : {}) });
    setSavingProfile(false);
    if (result.ok) {
      setAvatarChanged(false);
      setShowEditProfile(false);
      toast(avatarChanged ? 'Foto e perfil atualizados com sucesso!' : 'Perfil atualizado com sucesso!');
    } else toast(result.error ?? 'Erro ao atualizar perfil.', 'error');
  };

  const handleChangePassword = async () => {
    setPwdError('');
    if (!currentPwd || !newPwd || !confirmPwd) { setPwdError('Preencha todos os campos.'); return; }
    if (newPwd.length < 6) { setPwdError('A nova senha deve ter pelo menos 6 caracteres.'); return; }
    if (newPwd !== confirmPwd) { setPwdError('A nova senha e a confirmação não coincidem.'); return; }
    setSavingPwd(true);
    const result = await changePassword(currentPwd, newPwd);
    setSavingPwd(false);
    if (result.ok) { setShowChangePassword(false); setCurrentPwd(''); setNewPwd(''); setConfirmPwd(''); toast('Senha alterada com sucesso!'); }
    else setPwdError(result.error ?? 'Erro ao alterar senha.');
  };

  const handleLogout = () => { logout(); toast('Até logo! 👋', 'info'); navigate('/'); };

  if (!isAuthenticated || !user) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6"><UserCircle className="w-10 h-10 text-slate-400" /></div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Sua conta no bairro</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed mb-8">Faça login para acompanhar seus relatos, interagir com a comunidade e ganhar selos.</p>
          <Button onClick={() => navigate('/login')}>Entrar na minha conta</Button>
        </div>
        <Card className="mt-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">O que você pode fazer</h3>
          <ul className="space-y-3">
            {[{ Icon: MessageSquare, label: 'Registrar problemas do bairro' }, { Icon: Heart, label: 'Apoiar relatos de vizinhos' }, { Icon: Award, label: 'Ganhar selos de contribuição' }, { Icon: Shield, label: 'Contribuir para um bairro melhor' }].map(({ Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400"><div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0"><Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /></div>{label}</li>
            ))}
          </ul>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <Card>
        <div className="flex items-start gap-4">
          <div className="relative group shrink-0">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-emerald-600/20">
              {user.avatarUrl ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" decoding="async" /> : user.name.charAt(0).toUpperCase()}
            </div>
            <button onClick={openEditProfile} className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:ring-emerald-300 dark:hover:text-emerald-400 dark:hover:ring-emerald-500/30 transition-all shadow-sm" aria-label="Editar foto de perfil"><Camera className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 min-w-0"><h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">{user.name}</h2><p className="text-sm text-slate-500 dark:text-slate-400 truncate">{user.email}</p><p className="text-xs text-slate-400 mt-1">Membro desde {new Date(user.createdAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p></div>
          <Button variant="ghost" size="sm" onClick={handleLogout} aria-label="Sair"><LogOut className="w-4 h-4" /></Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[{ icon: MessageSquare, value: stats.postsCount, label: 'Relatos', iconCls: 'text-emerald-600 dark:text-emerald-400', bgCls: 'bg-emerald-50 dark:bg-emerald-500/10' }, { icon: CheckCircle2, value: stats.resolvedCount, label: 'Resolvidos', iconCls: 'text-teal-600 dark:text-teal-400', bgCls: 'bg-teal-50 dark:bg-teal-500/10' }, { icon: Heart, value: stats.supportsGiven, label: 'Apoios dados', iconCls: 'text-rose-500 dark:text-rose-400', bgCls: 'bg-rose-50 dark:bg-rose-500/10' }, { icon: CalendarDays, value: stats.eventsAttended, label: 'Participações', iconCls: 'text-blue-600 dark:text-blue-400', bgCls: 'bg-blue-50 dark:bg-blue-500/10' }].map(({ icon: Icon, value, label, iconCls, bgCls }) => (
          <Card key={label} className="text-center !p-4"><div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2', bgCls)}><Icon className={cn('w-5 h-5', iconCls)} /></div><p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p><p className="text-[11px] text-slate-500 font-medium">{label}</p></Card>
        ))}
      </div>

      <Card>
        <div className="flex items-start justify-between gap-3 mb-4"><div><h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2"><Award className="w-4 h-4 text-amber-500" /> Selos de contribuição</h3><p className="text-[11px] text-slate-500 mt-1">Reconhecimentos por ações comunitárias — sem ranking entre moradores.</p></div><span className="text-xs text-slate-400 shrink-0">{stats.earnedBadges.length}/{communityBadges.length}</span></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {communityBadges.map(badge => { const earned = stats.earnedBadges.includes(badge.key); const progress = getCommunityBadgeProgress(badge, stats); return <div key={badge.key} className={cn('flex flex-col items-center gap-2 p-3 rounded-xl text-center transition-all', earned ? 'bg-amber-50 dark:bg-amber-500/10 ring-1 ring-amber-200 dark:ring-amber-500/20' : 'bg-slate-50 dark:bg-slate-800/70 ring-1 ring-slate-100 dark:ring-slate-700')}><span className={cn('text-2xl', !earned && 'grayscale opacity-45')}>{badge.emoji}</span><div><p className="text-xs font-semibold text-slate-900 dark:text-white">{badge.name}</p><p className="text-[10px] text-slate-500 min-h-7">{badge.desc}</p></div>{earned ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400"><CheckCircle2 className="w-3.5 h-3.5" /> Conquistado</span> : <div className="w-full"><div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.round(progress.ratio * 100)}%` }} /></div><p className="mt-1 text-[9px] font-bold text-slate-400">Progresso {progress.text}</p></div>}</div>; })}
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Conta</h3>
        <div className="space-y-1">
          <button onClick={openEditProfile} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><Pencil className="w-4 h-4" /> Editar perfil</button>
          <button onClick={() => { setPwdError(''); setCurrentPwd(''); setNewPwd(''); setConfirmPwd(''); setShowChangePassword(true); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><Shield className="w-4 h-4" /> Alterar senha</button>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800"><button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"><LogOut className="w-4 h-4" /> Sair da conta</button></div>
        </div>
      </Card>

      <AccountDataControls />

      <Modal open={showEditProfile} onClose={closeEditProfile} title="Editar perfil">
        <div className="space-y-5 pb-8 sm:pb-0">
          <div className="flex flex-col items-center gap-3"><div className="w-24 h-24 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center text-white text-4xl font-bold shadow-lg ring-1 ring-slate-200 dark:ring-slate-700">{editAvatar ? <img src={editAvatar} alt="Preview" className="w-full h-full object-cover" decoding="async" /> : editName.charAt(0).toUpperCase() || '?'}</div></div>
          <Input label="Nome" placeholder="Seu nome" value={editName} onChange={e => setEditName(e.target.value)} required />
          <AvatarCropper value={editAvatar} onEditingChange={setAvatarCropPending} onChange={(value) => { setEditAvatar(value); setAvatarChanged(true); }} />
          <div className="flex flex-col sm:flex-row gap-3 pt-6 mt-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky bottom-0">
            <Button type="button" variant="secondary" className="flex-1 h-11" onClick={closeEditProfile}>Cancelar</Button>
            <Button className="flex-1 h-11" disabled={!editName.trim() || savingProfile || avatarCropPending} onClick={handleSaveProfile}>{savingProfile ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : avatarCropPending ? 'Finalize o recorte acima' : 'Salvar'}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showChangePassword} onClose={() => setShowChangePassword(false)} title="Alterar senha">
        <div className="space-y-4">
          <Input label="Senha atual" type="password" placeholder="••••••••" value={currentPwd} onChange={e => { setCurrentPwd(e.target.value); setPwdError(''); }} required />
          <Input label="Nova senha" type="password" placeholder="Mínimo 6 caracteres" value={newPwd} onChange={e => { setNewPwd(e.target.value); setPwdError(''); }} required />
          <Input label="Confirmar nova senha" type="password" placeholder="Repita a nova senha" value={confirmPwd} onChange={e => { setConfirmPwd(e.target.value); setPwdError(''); }} required />
          {pwdError && <p className="text-xs text-red-500 dark:text-red-400 px-1">{pwdError}</p>}
          <div className="flex flex-col sm:flex-row gap-3 pt-2"><Button type="button" variant="secondary" className="flex-1" onClick={() => setShowChangePassword(false)}>Cancelar</Button><Button className="flex-1" disabled={!currentPwd || !newPwd || !confirmPwd || savingPwd} onClick={handleChangePassword}>{savingPwd ? <><Loader2 className="w-4 h-4 animate-spin" /> Alterando...</> : 'Alterar senha'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
