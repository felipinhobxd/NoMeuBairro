import { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useNavigate } from 'react-router-dom';
import {
  UserCircle, LogOut, Award, Camera, Pencil,
  MessageSquare, Heart, CheckCircle2, Shield, Store, CalendarDays, Loader2,
} from 'lucide-react';
import { Card, Button, Modal, Input, ImageUpload, useToast } from '../components/UI';
import { cn } from '../utils/cn';

const allBadges = [
  { key: 'vizinho_engajado', name: 'Vizinho Engajado', desc: '10 relatos criados', emoji: '🏅' },
  { key: 'guardiao', name: 'Guardião do Bairro', desc: '25 relatos criados', emoji: '🛡️' },
  { key: 'voz_ativa', name: 'Voz Ativa', desc: '50 apoios recebidos', emoji: '📢' },
  { key: 'construtor', name: 'Construtor', desc: 'Primeiro relato resolvido', emoji: '🏗️' },
  { key: 'embaixador', name: 'Embaixador', desc: '100 interações', emoji: '⭐' },
];

export default function Profile() {
  const { user, isAuthenticated, logout, updateProfile, changePassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { posts, businesses, events } = useData();

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Edit profile form
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Change password form
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  const stats = useMemo(() => {
    if (!user) return { myPosts: 0, myBiz: 0, myEvents: 0, supportsReceived: 0, earnedBadges: [] as string[] };
    const myPosts = posts.filter(p => p.authorId === user.id);
    const myBiz = businesses.filter(b => b.createdBy === user.id);
    const myEvents = events.filter(e => e.createdBy === user.id);
    const supportsReceived = myPosts.reduce((sum, p) => sum + p.supports, 0);
    const totalComments = myPosts.reduce((sum, p) => sum + p.commentsCount, 0);

    const earned: string[] = [];
    if (myPosts.length >= 10) earned.push('vizinho_engajado');
    if (myPosts.length >= 25) earned.push('guardiao');
    if (supportsReceived >= 50) earned.push('voz_ativa');
    if (myPosts.some(p => p.status === 'resolved')) earned.push('construtor');
    if (myPosts.length + totalComments >= 100) earned.push('embaixador');

    return { myPosts: myPosts.length, myBiz: myBiz.length, myEvents: myEvents.length, supportsReceived, earnedBadges: earned };
  }, [user, posts, businesses, events]);

  const openEditProfile = () => {
    if (!user) return;
    setEditName(user.name);
    setEditAvatar(user.avatarUrl ?? '');
    setShowEditProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) return;
    setSavingProfile(true);
    const result = await updateProfile({ name: editName.trim(), avatarUrl: editAvatar });
    setSavingProfile(false);
    if (result.ok) {
      setShowEditProfile(false);
      toast('Perfil atualizado com sucesso!');
    } else {
      toast(result.error ?? 'Erro ao atualizar perfil.', 'error');
    }
  };

  const handleChangePassword = async () => {
    setPwdError('');
    if (!currentPwd || !newPwd || !confirmPwd) {
      setPwdError('Preencha todos os campos.');
      return;
    }
    if (newPwd.length < 6) {
      setPwdError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('A nova senha e a confirmação não coincidem.');
      return;
    }
    setSavingPwd(true);
    const result = await changePassword(currentPwd, newPwd);
    setSavingPwd(false);
    if (result.ok) {
      setShowChangePassword(false);
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      toast('Senha alterada com sucesso!');
    } else {
      setPwdError(result.error ?? 'Erro ao alterar senha.');
    }
  };

  const handleLogout = () => { logout(); toast('Até logo! 👋', 'info'); navigate('/'); };

  if (!isAuthenticated || !user) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6">
            <UserCircle className="w-10 h-10 text-slate-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Sua conta no bairro</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed mb-8">
            Faça login para acompanhar seus relatos, interagir com a comunidade e ganhar selos.
          </p>
          <Button onClick={() => navigate('/login')}>Entrar na minha conta</Button>
        </div>
        <Card className="mt-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">O que você pode fazer</h3>
          <ul className="space-y-3">
            {[
              { Icon: MessageSquare, label: 'Registrar problemas do bairro' },
              { Icon: Heart, label: 'Apoiar relatos de vizinhos' },
              { Icon: Award, label: 'Ganhar selos de contribuição' },
              { Icon: Shield, label: 'Contribuir para um bairro melhor' },
            ].map(({ Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                {label}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <Card>
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="relative group shrink-0">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-emerald-600/20">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </div>
            <button
              onClick={openEditProfile}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:ring-emerald-300 dark:hover:text-emerald-400 dark:hover:ring-emerald-500/30 transition-all shadow-sm"
              aria-label="Editar foto de perfil"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">{user.name}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
            <p className="text-xs text-slate-400 mt-1">
              Membro desde {new Date(user.createdAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} aria-label="Sair">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: MessageSquare, value: stats.myPosts, label: 'Relatos', iconCls: 'text-emerald-600 dark:text-emerald-400', bgCls: 'bg-emerald-50 dark:bg-emerald-500/10' },
          { icon: Heart, value: stats.supportsReceived, label: 'Apoios recebidos', iconCls: 'text-rose-500 dark:text-rose-400', bgCls: 'bg-rose-50 dark:bg-rose-500/10' },
          { icon: Store, value: stats.myBiz, label: 'Negócios', iconCls: 'text-violet-600 dark:text-violet-400', bgCls: 'bg-violet-50 dark:bg-violet-500/10' },
          { icon: CalendarDays, value: stats.myEvents, label: 'Eventos', iconCls: 'text-blue-600 dark:text-blue-400', bgCls: 'bg-blue-50 dark:bg-blue-500/10' },
        ].map(({ icon: Icon, value, label, iconCls, bgCls }) => (
          <Card key={label} className="text-center !p-4">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2', bgCls)}>
              <Icon className={cn('w-5 h-5', iconCls)} />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
            <p className="text-[11px] text-slate-500 font-medium">{label}</p>
          </Card>
        ))}
      </div>

      {/* Badges */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" /> Selos e Conquistas
          </h3>
          <span className="text-xs text-slate-400">{stats.earnedBadges.length}/{allBadges.length}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {allBadges.map(badge => {
            const earned = stats.earnedBadges.includes(badge.key);
            return (
              <div key={badge.key}
                className={cn('flex flex-col items-center gap-2 p-3 rounded-xl text-center transition-all',
                  earned ? 'bg-amber-50 dark:bg-amber-500/10 ring-1 ring-amber-200 dark:ring-amber-500/20' : 'bg-slate-50 dark:bg-slate-800 opacity-50')}>
                <span className="text-2xl">{earned ? badge.emoji : '🔒'}</span>
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">{badge.name}</p>
                  <p className="text-[10px] text-slate-500">{badge.desc}</p>
                </div>
                {earned && <CheckCircle2 className="w-4 h-4 text-amber-500" />}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Account */}
      <Card>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Conta</h3>
        <div className="space-y-1">
          <button onClick={openEditProfile}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <Pencil className="w-4 h-4" /> Editar perfil
          </button>
          <button onClick={() => { setPwdError(''); setCurrentPwd(''); setNewPwd(''); setConfirmPwd(''); setShowChangePassword(true); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <Shield className="w-4 h-4" /> Alterar senha
          </button>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <button onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
              <LogOut className="w-4 h-4" /> Sair da conta
            </button>
          </div>
        </div>
      </Card>

      {/* ─── Edit Profile Modal ─── */}
      <Modal open={showEditProfile} onClose={() => setShowEditProfile(false)} title="Editar perfil">
        <div className="space-y-5 pb-8 sm:pb-0">
          {/* Avatar preview */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center text-white text-4xl font-bold shadow-lg ring-1 ring-slate-200 dark:ring-slate-700">
              {editAvatar ? (
                <img src={editAvatar} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                editName.charAt(0).toUpperCase() || '?'
              )}
            </div>
          </div>
          <Input
            label="Nome"
            placeholder="Seu nome"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            required
          />
          <ImageUpload
            value={editAvatar}
            onChange={setEditAvatar}
            label="Foto de perfil"
          />
          <div className="flex gap-3 pt-6 mt-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky bottom-0">
            <Button type="button" variant="secondary" className="flex-1 h-11" onClick={() => setShowEditProfile(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1 h-11"
              disabled={!editName.trim() || savingProfile}
              onClick={handleSaveProfile}
            >
              {savingProfile ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
              ) : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Change Password Modal ─── */}
      <Modal open={showChangePassword} onClose={() => setShowChangePassword(false)} title="Alterar senha">
        <div className="space-y-4">
          <Input
            label="Senha atual"
            type="password"
            placeholder="••••••••"
            value={currentPwd}
            onChange={e => { setCurrentPwd(e.target.value); setPwdError(''); }}
            required
          />
          <Input
            label="Nova senha"
            type="password"
            placeholder="Mínimo 6 caracteres"
            value={newPwd}
            onChange={e => { setNewPwd(e.target.value); setPwdError(''); }}
            required
          />
          <Input
            label="Confirmar nova senha"
            type="password"
            placeholder="Repita a nova senha"
            value={confirmPwd}
            onChange={e => { setConfirmPwd(e.target.value); setPwdError(''); }}
            required
          />
          {pwdError && (
            <p className="text-xs text-red-500 dark:text-red-400 px-1">{pwdError}</p>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowChangePassword(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={!currentPwd || !newPwd || !confirmPwd || savingPwd}
              onClick={handleChangePassword}
            >
              {savingPwd ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Alterando...</>
              ) : 'Alterar senha'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
