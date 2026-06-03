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
  const { reports, posts, updatePostStatus, deletePost, commentsByPost, deleteComment, fetchData, loading, archive, ignoreReport } = useData();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'pending' | 'history' | 'stats'>('pending');
  const [searchTerm, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
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
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [reports, searchTerm, activeTab]);

  const handleIgnore = async (reportId: string) => {
    try {
      if (typeof ignoreReport === 'function') {
        await ignoreReport(reportId);
      }
      toast('Denúncia ignorada com sucesso.');
      setSelectedReport(null);
    } catch (err) {
      toast('Erro ao ignorar denúncia.', 'error');
    }
  };

  const handleResolve = async (reportId: string, postId?: string, commentId?: string) => {
    try {
      if (postId) {
        await updatePostStatus(postId, 'resolved');
        toast('Relato marcado como resolvido.');
      }
      // Aqui poderíamos ter uma lógica de fechar a denúncia
      setSelectedReport(null);
    } catch (err) {
      toast('Erro ao resolver denúncia.', 'error');
    }
  };

  const handleDeleteContent = async (reportId: string, postId?: string, commentId?: string) => {
    if (!window.confirm('Tem certeza que deseja EXCLUIR este conteúdo? Esta ação é irreversível.')) return;

    try {
      if (commentId) {
        await deleteComment(commentId);
        toast('Comentário excluído pelo administrador.');
      } else if (postId) {
        await deletePost(postId);
        toast('Relato excluído pelo administrador.');
      }
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
            <Shield className="w-7 h-7 text-emerald-600" />
            Painel do Administrador
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gestão de denúncias e estatísticas</p>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="secondary" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Sincronizar Dados
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total de Relatos', value: stats.totalPosts, icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10' },
          { label: 'Relatos Pendentes', value: stats.pendingPosts, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10' },
          { label: 'Total Denúncias', value: stats.totalReports, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-500/10' },
          { label: 'Denúncias Ativas', value: stats.pendingReports, icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
        ].map((s, i) => (
          <Card key={i} className="!p-4 border-none shadow-sm">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", s.bg)}>
                <s.icon className={cn("w-5 h-5", s.color)} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
                <p className="text-xl font-black text-slate-900 dark:text-white leading-tight">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('pending')}
          className={cn(
            "px-4 py-2 text-sm font-bold transition-all border-b-2 -mb-[2px]",
            activeTab === 'pending' ? "border-emerald-600 text-emerald-600" : "border-transparent text-slate-400 hover:text-slate-600"
          )}
        >
          Denúncias Pendentes
          {stats.pendingReports > 0 && <span className="ml-2 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px]">{stats.pendingReports}</span>}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            "px-4 py-2 text-sm font-bold transition-all border-b-2 -mb-[2px]",
            activeTab === 'history' ? "border-emerald-600 text-emerald-600" : "border-transparent text-slate-400 hover:text-slate-600"
          )}
        >
          Histórico (Arquivados)
        </button>
      </div>

      <div className="space-y-4">
        {filteredReports.length === 0 ? (
          <div className="py-20 text-center">
             <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-slate-300" />
             </div>
             <h3 className="text-lg font-bold text-slate-900 dark:text-white">Tudo limpo por aqui!</h3>
             <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma denúncia encontrada no momento.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredReports.map(report => (
              <Card key={report.id} className="!p-4 hover:ring-emerald-500/20 transition-all cursor-pointer group" onClick={() => setSelectedReport(report)}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "p-2 rounded-xl shrink-0 mt-1",
                      report.status === 'pending' ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-400"
                    )}>
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{report.postId ? 'Relato' : 'Comentário'} Denunciado</span>
                        <span className="text-[10px] text-slate-400">•</span>
                        <span className="text-[10px] text-slate-400">{timeAgo(report.createdAt)}</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug group-hover:text-emerald-600 transition-colors">
                        {report.reason}
                      </h3>
                      {report.status !== 'pending' && (
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          {report.status === 'ignored' ? 'IGNORADA' : 'RESOLVIDA'}
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-600 transition-all" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Report Detail Modal */}
      <Modal open={!!selectedReport} onClose={() => setSelectedReport(null)} title="Detalhes da Denúncia">
        {selectedReport && (
          <div className="space-y-6">
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Motivo da Denúncia</span>
                <span className="text-[10px] text-slate-400">{timeAgo(selectedReport.createdAt)}</span>
              </div>
              <p className="text-sm font-semibold text-red-600 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg border border-red-100 dark:border-red-500/20">
                {selectedReport.reason}
              </p>
            </div>

            {/* Snapshots do conteúdo original (mesmo se excluído) */}
            <div className="space-y-3">
               <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                 <Archive className="w-3.5 h-3.5" />
                 Conteúdo Denunciado (Snapshot)
               </h4>
               <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl">
                 {selectedReport.postId ? (
                   <div className="space-y-2">
                     <p className="text-xs font-bold text-slate-400">Título do Relato:</p>
                     <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedReport.postTitle || 'Título indisponível'}</p>
                     <p className="text-xs font-bold text-slate-400 mt-3">Descrição:</p>
                     <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-line">{selectedReport.postDescription || 'Descrição indisponível'}</p>
                   </div>
                 ) : (
                   <div className="space-y-2">
                     <p className="text-xs font-bold text-slate-400">Texto do Comentário:</p>
                     <p className="text-sm text-slate-700 dark:text-slate-300 italic">"{selectedReport.commentContent || 'Comentário indisponível'}"</p>
                   </div>
                 )}
               </div>
            </div>

            {selectedReport.status === 'pending' && (
              <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button className="flex-1 min-w-[120px]" onClick={() => handleResolve(selectedReport.id, selectedReport.postId)}>
                  <CheckCircle2 className="w-4 h-4" /> Marcar Resolvido
                </Button>
                <Button variant="secondary" className="flex-1 min-w-[120px]" onClick={() => handleIgnore(selectedReport.id)}>
                  <Eye className="w-4 h-4" /> Ignorar
                </Button>
                <Button className="flex-1 min-w-[120px] bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDeleteContent(selectedReport.id, selectedReport.postId, selectedReport.commentId)}>
                  <Trash2 className="w-4 h-4" /> Excluir Conteúdo
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
