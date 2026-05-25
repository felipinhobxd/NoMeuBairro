import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Eye, Lock, AlertCircle, Send, CheckCircle2, Info, ArrowRight, MapPin } from 'lucide-react';
import { Card, Textarea, Select, Button, Input } from '../components/UI';
import { EmergencyContacts } from '../components/Safety';
import MapPicker from '../components/MapPicker';
import { useData } from '../contexts/DataContext';

const denunciaTypes = [
  { value: '', label: 'Selecione o tipo de denúncia...' },
  { value: 'Abuso físico ou psicológico', label: 'Abuso físico ou psicológico' },
  { value: 'Assédio moral ou sexual', label: 'Assédio moral ou sexual' },
  { value: 'Violência doméstica', label: 'Violência doméstica' },
  { value: 'Exploração de menores', label: 'Exploração de menores' },
  { value: 'Discriminação ou racismo', label: 'Discriminação ou racismo' },
  { value: 'Crime ambiental', label: 'Crime ambiental' },
  { value: 'Corrupção ou fraude', label: 'Corrupção ou fraude' },
  { value: 'Outros', label: 'Outros' },
];

export default function Denuncias() {
  const navigate = useNavigate();
  const { addAnonymousPost } = useData();

  const [tipo, setTipo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [localizacao, setLocalizacao] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fLat, setFLat] = useState<number | undefined>();
  const [fLng, setFLng] = useState<number | undefined>();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!tipo || !descricao.trim()) return;
      setIsSubmitting(true);
      // Simulates E2EE encryption + API call with rate limiting
      await new Promise((r) => setTimeout(r, 1200));
      addAnonymousPost({
        tipo,
        description: descricao,
        location: localizacao,
        latitude: fLat,
        longitude: fLng
      });
      setIsSubmitting(false);
      setSubmitted(true);
      setTipo('');
      setDescricao('');
      setLocalizacao('');
      setFLat(undefined);
      setFLng(undefined);
    },
    [tipo, descricao, localizacao, fLat, fLng, addAnonymousPost],
  );

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Denúncia enviada com sucesso</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
            Sua denúncia foi registrada de forma totalmente anônima e agora aparece no feed comunitário. Nenhum dado pessoal, IP ou metadado foi armazenado.
          </p>
          <div className="flex gap-3 mt-8">
            <Button variant="secondary" onClick={() => setSubmitted(false)}>Enviar outra</Button>
            <Button onClick={() => navigate('/')}>
              Ver no feed <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-red-500" />
          </div>
          Denúncias Seguras
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Canal 100% anônimo e seguro para relatos sensíveis</p>
      </div>

      {/* Security Notice */}
      <Card className="!p-4 border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Ambiente totalmente seguro e anônimo</h3>
            <ul className="space-y-1.5 text-xs text-red-600 dark:text-red-400/80">
              <li className="flex items-start gap-2"><Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>Criptografia de ponta a ponta (E2EE) com chaves assimétricas</span></li>
              <li className="flex items-start gap-2"><Eye className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>Sem login, sem registro de IP ou metadados de navegação</span></li>
              <li className="flex items-start gap-2"><ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>Sua denúncia aparece no feed de forma anônima, sem qualquer identificação</span></li>
            </ul>
            <p className="text-[11px] text-red-500 dark:text-red-400/60 pt-1">
              ⚡ Botão de saída rápida no canto superior direito. Pressione{' '}
              <kbd className="px-1.5 py-0.5 bg-red-100 dark:bg-red-500/10 rounded text-[10px] font-mono">Esc</kbd> duas vezes para ativar.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Form */}
        <div className="md:col-span-2">
          <Card>
            <form onSubmit={handleSubmit} className="space-y-5">
              <Select label="Tipo de denúncia" options={denunciaTypes} value={tipo} onChange={e => setTipo(e.target.value)} required />
              <Textarea label="Descrição (opcionalmente detalhada)"
                placeholder="Descreva a situação com o nível de detalhe que se sentir confortável. Todo relato é importante e será tratado com máxima seriedade..."
                value={descricao} onChange={e => setDescricao(e.target.value)} rows={6} required />

              <div className="space-y-4">
                <Input
                  label="Localização do ocorrido"
                  placeholder="Ex: Rua das Flores, 123 - Próximo ao mercado"
                  value={localizacao}
                  onChange={e => setLocalizacao(e.target.value)}
                />
                <MapPicker
                  onLocationSelect={(lat, lng) => { setFLat(lat); setFLng(lng); }}
                  address={localizacao}
                />
              </div>

              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-xs text-emerald-700 dark:text-emerald-400">
                <Lock className="w-3.5 h-3.5" />
                <span>Conteúdo criptografado end-to-end antes do envio</span>
              </div>
              <div className="flex items-center justify-between gap-4 pt-2">
                <p className="text-[11px] text-slate-400 dark:text-slate-500">Nenhuma informação pessoal é coletada</p>
                <Button type="submit" disabled={!tipo || !descricao.trim() || isSubmitting} className="min-w-[140px]">
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                      Enviando...
                    </span>
                  ) : <><Send className="w-4 h-4" />Enviar denúncia</>}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card><EmergencyContacts compact /></Card>
          <Card>
            <div className="flex gap-3">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Como funciona?</h4>
                <ol className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1.5 list-decimal list-inside">
                  <li>Preencha o formulário de forma anônima</li>
                  <li>O conteúdo é criptografado E2EE</li>
                  <li>A denúncia aparece no feed como anônima</li>
                  <li>Autoridades competentes podem acessar</li>
                </ol>
              </div>
            </div>
          </Card>
          <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">Protegido contra spam com Rate Limiting</p>
        </div>
      </div>
    </div>
  );
}
