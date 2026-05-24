import { useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { Card, postCategories } from '../components/UI';
import {
  BarChart3, PieChart, Activity, CheckCircle2,
  Clock, AlertCircle, TrendingUp, Users
} from 'lucide-react';
import { cn } from '../utils/cn';

export default function Estatisticas() {
  const { posts } = useData();

  const stats = useMemo(() => {
    const total = posts.length;
    if (total === 0) return null;

    const byStatus = {
      pending: posts.filter(p => p.status === 'pending').length,
      in_progress: posts.filter(p => p.status === 'in_progress').length,
      resolved: posts.filter(p => p.status === 'resolved').length,
    };

    const byCategory: Record<string, number> = {};
    posts.forEach(p => {
      byCategory[p.category] = (byCategory[p.category] || 0) + 1;
    });

    const resolutionRate = ((byStatus.resolved / total) * 100).toFixed(1);

    // Encontrar categoria mais comum
    let mostCommonCat = { name: '', count: 0 };
    Object.entries(byCategory).forEach(([name, count]) => {
      if (count > mostCommonCat.count) mostCommonCat = { name, count };
    });

    return {
      total,
      byStatus,
      byCategory: Object.entries(byCategory).sort((a, b) => b[1] - a[1]),
      resolutionRate,
      mostCommonCat
    };
  }, [posts]);

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Activity className="w-16 h-16 text-slate-200 mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Sem dados suficientes</h2>
        <p className="text-slate-500 max-w-xs mt-2">Aguardando os primeiros relatos para gerar as estatísticas do bairro.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
          </div>
          Estatísticas do Bairro
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Transparência e dados sobre a manutenção do Vitória Régia</p>
      </div>

      {/* Resumo Rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total de Relatos', value: stats.total, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10' },
          { label: 'Resolvidos', value: stats.byStatus.resolved, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
          { label: 'Taxa de Solução', value: `${stats.resolutionRate}%`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-500/10' },
          { label: 'Em Aberto', value: stats.byStatus.pending + stats.byStatus.in_progress, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10' },
        ].map((item, i) => (
          <Card key={i} className="!p-4 flex flex-col items-center text-center">
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center mb-2", item.bg)}>
              <item.icon className={cn("w-5 h-5", item.color)} />
            </div>
            <span className="text-2xl font-black text-slate-900 dark:text-white">{item.value}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">{item.label}</span>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Gráfico de Categorias */}
        <Card className="flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-emerald-500" /> Distribuição por Categoria
            </h3>
          </div>
          <div className="space-y-4 flex-1">
            {stats.byCategory.map(([cat, count]) => {
              const percentage = ((count / stats.total) * 100).toFixed(0);
              const categoryInfo = postCategories[cat as keyof typeof postCategories] || { label: cat, emoji: '❓' };
              return (
                <div key={cat} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-700 dark:text-slate-300">{categoryInfo.emoji} {categoryInfo.label}</span>
                    <span className="text-slate-400">{count} ({percentage}%)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-1000 ease-out"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Status e Eficiência */}
        <Card>
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
            <Clock className="w-4 h-4 text-emerald-500" /> Status dos Problemas
          </h3>
          <div className="relative h-48 flex items-center justify-center">
            {/* Visualização de Status em Barras Verticais */}
            <div className="flex items-end gap-6 h-full w-full px-4">
              {[
                { label: 'Pendente', count: stats.byStatus.pending, color: 'bg-slate-300 dark:bg-slate-700' },
                { label: 'Em Curso', count: stats.byStatus.in_progress, color: 'bg-blue-500' },
                { label: 'Resolvido', count: stats.byStatus.resolved, color: 'bg-emerald-500' },
              ].map((s, i) => {
                const h = stats.total > 0 ? (s.count / stats.total) * 100 : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <span className="text-xs font-bold text-slate-900 dark:text-white opacity-0 group-hover:opacity-100 transition-opacity">{s.count}</span>
                    <div
                      className={cn("w-full rounded-t-lg transition-all duration-1000 ease-out min-h-[4px]", s.color)}
                      style={{ height: `${Math.max(h, 5)}%` }}
                    />
                    <span className="text-[10px] font-bold text-slate-400 uppercase text-center leading-tight">{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Insight da Comunidade</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  O problema mais recorrente é <span className="font-bold text-emerald-600 dark:text-emerald-400">"{postCategories[stats.mostCommonCat.name as keyof typeof postCategories]?.label}"</span>.
                  Continue relatando e apoiando para que as autoridades priorizem o Vitória Régia!
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Rodapé de Dados */}
      <div className="text-center py-4">
        <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">
          Dados atualizados em tempo real via Supabase ⚡
        </p>
      </div>
    </div>
  );
}
