import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Card, Button, Modal, useToast } from '../components/UI';
import {
  ShieldCheck, AlertOctagon, Trash2, CheckCircle,
  XCircle, Filter, Search, User, Clock, MessageSquare, FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { timeAgo } from '../components/UI';

export default function AdminPanel() {
  const { user } = useAuth();
  const { getAllReports, updateReportStatus, deletePost, deleteComment } = useData();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  const isAdmin = user?.id === '01524e31-9ada-4e1f-a3fc-bad691113e05' || user?.id === '8b1e03ce-59e5-4f48-9756-eb4e0ee91217';

  const loadReports = useCallback(async () => {
    setLoading(true);
    const data = await getAllReports();
    setReports(data);
    setLoading(false);
  }, [getAllReports]);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    loadReports();
  }, [isAdmin, navigate, loadReports]);

  const handleAction = async (report: any, action: 'delete' | 'ignore') => {
    try {
      if (action === 'delete') {
        if (report.post_id) {
          await deletePost(report.post_id);
          toast('Postagem excluída permanentemente.');
        } else if (report.comment_id) {
          await deleteComment(report.comment_id);
          toast('Comentário excluído permanentemente.');
        }
        await updateReportStatus(report.id, 'resolved');
      } else {
        await updateReportStatus(report.id, 'ignored');
        toast('Denúncia ignorada.');
      }
      loadReports();
    } catch (error) {
      toast('Erro ao processar ação.', 'error');
    }
  };

  const filteredReports = reports.filter(r => {
    if (filter === 'pending') {
      return r.status === 'pending';
    } else {
      // No histórico, mostramos tudo que JÁ FOI moderado (resolvido ou ignorado)
      return r.status === 'resolved' || r.status === 'ignored';
    }
  });

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
            Painel do Administrador
          </h1>
          <p className="text-sm text-slate-500 mt-1">Gerenciamento e moderação de conteúdo do bairro</p>
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === 'pending' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-500'}`}
          >
            Pendentes
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === 'all' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-500'}`}
          >
            Histórico
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">Carregando denúncias...</div>
      ) : filteredReports.length === 0 ? (
        <Card className="py-20 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4 opacity-20" />
          <p className="text-slate-500 font-medium">Tudo limpo! Nenhuma denúncia encontrada.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => (
            <Card key={report.id} className={`border-l-4 ${report.status === 'pending' ? 'border-l-amber-500' : report.status === 'resolved' ? 'border-l-emerald-500' : 'border-l-slate-300'}`}>
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-lg ${report.post_id ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'} shrink-0`}>
                  {report.post_id ? <FileText className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Denúncia de {report.post_id ? 'Postagem' : 'Comentário'}
                    </span>
                    <span className="text-[10px] text-slate-300">•</span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {timeAgo(report.created_at)}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
                    Motivo: <span className="font-normal text-slate-600 dark:text-slate-400">"{report.reason}"</span>
                  </h3>

                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700 mb-4">
                    <p className="text-xs text-slate-500 uppercase font-bold mb-2 flex items-center gap-1.5">
                      Conteúdo {report.status === 'pending' ? 'Denunciado' : 'Arquivado'}:
                    </p>

                    <div className="flex gap-3">
                      {(report.post?.image_url || report.archived_image_url) && (
                        <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-slate-200 dark:border-slate-600 bg-white">
                          <img src={report.post?.image_url || report.archived_image_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 dark:text-slate-300 italic font-medium leading-tight">
                          {report.post?.title || report.archived_title || (report.post_id ? "Postagem Apagada" : "Comentário")}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {report.post?.description || report.archived_description || report.comment?.content || "Conteúdo removido permanentemente."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-4 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3 h-3" /> Denunciado por: <strong>{report.reporter?.name || 'Anônimo'}</strong>
                      </span>
                    </div>

                    {report.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAction(report, 'ignore')}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Ignorar
                        </button>
                        <button
                          onClick={() => handleAction(report, 'delete')}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Excluir Conteúdo
                        </button>
                      </div>
                    )}

                    {report.status !== 'pending' && (
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${report.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {report.status === 'resolved' ? 'Resolvido' : 'Ignorado'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
