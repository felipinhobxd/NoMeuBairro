import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro de renderização capturado pelo NoMeuBairro:', error, info);
  }

  private reload = () => {
    window.location.reload();
  };

  private goHome = () => {
    window.location.hash = '#/';
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-[#faf9f7] dark:bg-[#171210] flex items-center justify-center px-4 py-10">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#211a16] p-6 sm:p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 dark:bg-orange-500/10">
            <AlertTriangle className="h-7 w-7 text-orange-700 dark:text-orange-300" />
          </div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Não foi possível carregar esta área</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Seus dados não foram apagados. Recarregue a página ou volte ao Feed para continuar usando o aplicativo.
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={this.reload} className="min-h-11 rounded-xl bg-orange-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-800 inline-flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4" /> Tentar novamente
            </button>
            <button type="button" onClick={this.goHome} className="min-h-11 rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2.5 text-sm font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center justify-center gap-2">
              <Home className="h-4 w-4" /> Voltar ao Feed
            </button>
          </div>
        </section>
      </main>
    );
  }
}
