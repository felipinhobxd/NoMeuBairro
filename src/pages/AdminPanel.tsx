import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import {
  Shield, Users, AlertTriangle, CheckCircle2, XCircle, Trash2,
  Eye, Filter, Search, ChevronRight, MessageSquare, BarChart3, Clock,
  ArrowUpRight, AlertCircle, History, RefreshCw, Undo, Archive
} from 'lucide-react';
import { Card, Button, StatusBadge, timeAgo, useToast, Modal, Select, Textarea } from '../components/UI';
import { cn } from '../utils/cn';

export default function AdminPanel() {
  const { user } = useAuth();
  const { reports, posts, updatePostStatus, deletePost, commentsByPost, deleteComment, fetchData, loading, updateReportStatus } = useData();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'pending' | 'history' | 'stats'>('pending');
  const [searchTerm, setSearchQuery] = useState('');
  const [selectedReport, setSelectedReport] = useState<any>(null);

  // Redireciona se não for admin (ID específico trancado)
  const ADMIN_ID = '9c90d435-bfe2-4936-98d1-2c6c1160db4b';

  useEffect(() => {
    if (!user || user.id !== ADMIN_ID) {
      navigate('/');
    }
  }, [user, navigate]);

  const stats = useMemo(() => {
    const totalPosts = posts.length;
    const pendingPosts = posts.filter(p => p.status === 'pending').length;
    const resolvedPosts = posts.filter(p => p.status === 'resolved').length;
    const totalReports = (reports || []).length;
    const pendingReports = (reports || []).filter(r => r.status === 'pending').length;

    return { totalPosts, pendingPosts, resolvedPosts, totalReports, pendingReports };
  }, [posts, reports]);

  const filteredReports = useMemo(() => {
    return (reports || []).filter(r => {
      const matchesSearch = r.reason.toLowerCase().includes(searchTerm.toLowerCase());
      const isHistory = activeTab === 'history';
      const isStatusMatch = isHistory ? r.status !== 'pending' : r.status === 'pending';
      return matchesSearch && isStatusMatch;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [reports, searchTerm, activeTab]);

  const handleModeration = async (reportId: string, status: 'resolved' | 'ignored') => {
    try {
      await updateReportStatus(reportId, status);
      await fetchData(); // Força atualização das estatísticas
      toast(status === 'resolved' ? 'Conteúdo moderado com sucesso.' : 'Denúncia ignorada.');
      setSelectedReport(null);
    } catch (err) {
      toast('Erro ao processar moderação.', 'error');
    }
  };

  const handleDeleteContent = async (reportId: string, postId?: string, commentId?: string) => {
    if (!window.confirm('Tem certeza que deseja EXCLUIR este conteúdo? Esta ação é irreversível.')) return;

    try {
      if (commentId) {
        await deleteComment(commentId);
      } else if (postId) {
        await deletePost(postId);
      }
      await updateReportStatus(reportId, 'resolved');
      await fetchData(); // Força atualização das estatísticas
      toast('Conteúdo excluído e denúncia resolvida.');
      setSelectedReport(null);
    } catch (err) {
      toast('Erro ao excluir conteúdo.', 'error');
    }
  };

  if (!user || user.id !== ADMIN_ID) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-600" /> Painel Administrativo
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Moderação de conteúdo e estatísticas do bairro</p>
        </div>
        <Button variant="secondary" onClick={() => fetchData()} disabled={loading}>
          <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} /> Atualizar Dados
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        <button onClick={() => setActiveTab('pending')} className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all", activeTab === 'pending' ? "bg-white dark:bg-slate-700 text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
          Pendentes {stats.pendingReports > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{stats.pendingReports}</span>}
        </button>
        <button onClick={() => setActiveTab('history')} className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all", activeTab === 'history' ? "bg-white dark:bg-slate-700 text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
          Histórico
        </button>
        <button onClick={() => setActiveTab('stats')} className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all", activeTab === 'stats' ? "bg-white dark:bg-slate-700 text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
          Estatísticas
        </button>
      </div>

      {activeTab === 'stats' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="!p-4 border-l-4 border-blue-500">
            <p className="text-xs font-bold text-slate-500 uppercase">Total de Posts</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.totalPosts}</p>
          </Card>
          <Card className="!p-4 border-l-4 border-amber-500">
            <p className="text-xs font-bold text-slate-500 uppercase">Pendentes</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.pendingPosts}</p>
          </Card>
          <Card className="!p-4 border-l-4 border-emerald-50">
            <p className="text-xs font-bold text-slate-500 uppercase">Resolvidos</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.resolvedPosts}</p>
          </Card>
          <Card className="!p-4 border-l-4 border-red-500">
            <p className="text-xs font-bold text-slate-500 uppercase">Denúncias</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.totalReports}</p>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Filtrar denúncias..." value={searchTerm} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-colors" />
          </div>

          {filteredReports.length === 0 ? (
            <Card className="py-20 text-center">
              <Shield className="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">Nenhuma denúncia encontrada.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredReports.map(r => (
                <Card key={r.id} className={cn("animate-card-enter cursor-pointer hover:ring-2 hover:ring-emerald-500/50 transition-all", r.status === 'pending' ? "border-l-4 border-red-500" : "opacity-75")} onClick={() => setSelectedReport(r)}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("px-2 py-0.5 rounded text-[10px] font-black uppercase", r.post_id ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700")}>
                          {r.post_id ? 'Relato' : 'Comentário'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">{timeAgo(r.created_at)}</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">Motivo: {r.reason}</h3>
                      <p className="text-xs text-slate-500 mt-1">Denunciado por: <span className="font-bold">{r.reporter?.name || 'Anônimo'}</span></p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de Detalhes da Denúncia */}
      <Modal open={!!selectedReport} onClose={() => setSelectedReport(null)} title="Detalhes da Moderação">
        {selectedReport && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Conteúdo Denunciado</p>
              {selectedReport.post ? (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedReport.post.title}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3">{selectedReport.post.description}</p>
                </div>
              ) : (
                <p className="text-xs text-slate-600 dark:text-slate-400 italic">"{selectedReport.comment?.content}"</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Motivo da Denúncia</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 bg-red-50 dark:bg-red-500/5 p-3 rounded-lg border border-red-100 dark:border-red-500/20">{selectedReport.reason}</p>
            </div>

            {selectedReport.status === 'pending' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                <Button variant="secondary" className="!text-[11px]" onClick={() => handleModeration(selectedReport.id, 'ignored')}>Ignorar</Button>
                <Button variant="danger" className="!text-[11px]" onClick={() => handleDeleteContent(selectedReport.id, selectedReport.post_id, selectedReport.comment_id)}>Excluir Conteúdo</Button>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold text-center">
                Denúncia já processada como: {selectedReport.status === 'resolved' ? 'RESOLVIDA' : 'IGNORADA'}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
