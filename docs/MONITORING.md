# Monitoramento de produção

Esta etapa monitora o NoMeuBairro existente, sem serviços pagos, contas extras ou alterações no feed/perfil. Coleta não é garantia de disponibilidade: bloqueadores, falta de conexão ou o próprio navegador podem impedir envios.

## Onde acompanhar

- No site: **Admin → Produção**, restrito por RLS a administradores/moderadores.
- Estado público e limitado: [health](https://nomeubairro.vercel.app/api/health).
- Execuções e notificações: [Production monitor](https://github.com/felipinhobxd/NoMeuBairro/actions/workflows/production-monitor.yml).

A Action agenda verificações a cada 15 minutos (`7,22,37,52 * * * *`, UTC), também executa após o sucesso do **Build check** na `main` e permite **Run workflow** manual. Lê apenas código confiável da `main`, não executa código de PR, tem concorrência única e permissões `contents: read` / `issues: write`. Usa apenas o `GITHUB_TOKEN` temporário da própria Action; não precisa de PAT nem chave privilegiada do Supabase.

O aviso é uma issue atribuída ao proprietário verificado do repositório, `felipinhobxd`. Repetições com o mesmo estado não criam novos avisos. Mudança de gravidade/condição gera atualização; recuperação fecha a issue. As notificações aparecem no GitHub; recebimento por e-mail depende das preferências da conta. Não foi configurado SMS, WhatsApp ou e-mail transacional externo.

**Limitações da agenda:** GitHub Actions pode atrasar execuções (não há SLA de 15 minutos) e desativa agendas de repositórios públicos após 60 dias sem atividade. Verifique a aba Actions se não houver execução recente. Reative a agenda pelo GitHub quando necessário. Uma falha no próprio GitHub/canal não pode ser notificada por esse mesmo canal; jobs que não conseguem publicar falham visivelmente na Action.

## O que é coletado

| Origem | Regra | Incidente |
| --- | --- | --- |
| Erro não tratado / React ErrorBoundary | Código fixo e localização no arquivo compilado | Na primeira amostra aceita |
| Módulo/script/estilo essencial | Somente arquivos do próprio site | Na primeira amostra aceita |
| Service worker | Falha de registro, não falha de foto de usuário | 3 amostras em 15 minutos |
| API HTTP | 5xx, 408 ou 429; respostas esperadas 400/401/403/404 etc. ignoradas | 5xx imediato; demais após 3 amostras em 15 minutos |
| API sem resposta | Exclui cancelamento e navegador offline | 3 amostras em 15 minutos |
| API lenta | GET > 4 s, GET de Function > 8 s, outros métodos/Storage > 12 s; servidor > 4 s | 3 amostras em 15 minutos |
| Página lenta | LCP > 2,5 s, INP > 500 ms, navegação > 4 s | 3 amostras em 15 minutos |

Os Core Web Vitals vêm do pacote padrão `web-vitals`, carregado de forma adiada, sem dados de atribuição de elementos. LCP/navegação são atribuídos à página inicial do documento; INP à rota ativa na interação. Métricas finais dependem dos eventos de ciclo de vida do navegador. O wrapper de `fetch` preserva resposta, corpo, cabeçalhos e rejeições; mede o tempo até os cabeçalhos, não o download completo de fotos. Não há substituição global de `fetch`.

As APIs próprias usam logs JSON de início/fim (rota fixa, método, status, duração, ID técnico da invocação Vercel). Falhas são enviadas em segundo plano com `waitUntil`, sem bloquear a resposta. O health **não registra incidentes sobre si mesmo**, evitando ciclos que impediriam a recuperação.

O checker testa página inicial, existência do JavaScript principal e `/api/health`. Não cria posts, não faz login e não reproduz todos os fluxos de usuários. O health lê no máximo um ID de post (sem devolvê-lo) e um agregado do monitor. Valida schema/resposta, impõe timeout de 5 s e retorna HTTP 503 quando banco/telemetria não podem ser confirmados. Uma falha precisa persistir na segunda tentativa do checker para ser notificada.

## Privacidade e volume

- Sem mensagens livres de exceções, stack completa, conteúdo de formulários, e-mail, conta, IP, foto, token ou URL com parâmetros na coleta nova.
- Rotas com IDs tornam-se `/post/:id`, `/perfil/:id` e `/empresa/:id`. CEP, filtros e arquivos de Storage são descartados dos alvos. Arquivo compilado, linha/coluna, release, tipo de tela e código fixo ajudam na investigação.
- Detalhes e resoluções são privados por RLS. A API pública só expõe `schemaVersion`, totais limitados de incidentes e sequência do teste sintético. Issues públicas contêm apenas condições genéricas do serviço, sem dados de usuários ou detalhes técnicos do evento.
- Até 20 envios/minuto por página; mesma assinatura no máximo uma vez/minuto; timeout de envio de 3 s; sem repetição automática.
- No banco: no máximo 120 amostras/minuto, 10.000/dia e 500 grupos/dia. Um bloqueio não bloqueante protege os limites contra concorrência. Amostras podem ser descartadas se ocupado, no limite ou offline: números **não** representam total de usuários/falhas.
- Eventos são agregados por dia/assinatura/tipo de tela/release. Incidentes agrupam a mesma falha entre aparelhos/releases. O painel usa **hoje (America/Sao_Paulo)**, não uma falsa janela móvel de 24h.
- Retenção diária pelo Cron: agregados 45 dias, incidentes resolvidos 180 dias, janelas técnicas 2 dias; histórico JS anterior 90 dias. Incidentes ainda abertos são preservados para revisão.
- Sem polling do monitor no feed. O painel lê no máximo 60 alertas e 120 grupos/7 dias, a cada minuto, apenas visível, com requisições simultâneas deduplicadas. A verificação agendada normal faz duas leituras pequenas do Supabase por execução, não baixa o feed.

O helper `private.log_production_event_internal` é um `SECURITY DEFINER` **intencional** de inserção/agrupamento limitado: permite coletar falhas antes do login, mas não dá ao público leitura nem alteração de registros. O teste verifica `auth.uid()` e `is_moderator()`. O helper público de health expõe somente um agregado fixo. As funções públicas são `SECURITY INVOKER` com grants explícitos; tabelas internas não têm grants para visitantes.

## Teste seguro de entrega

1. Abra **Admin → Produção → Enviar teste de alerta**.
2. O banco cria um registro `is_test`, que não aumenta contadores de incidentes reais.
3. Aguarde a próxima execução programada ou use **Run workflow** na Action.
4. Confirme a issue **[Teste] Entrega do monitoramento — sem incidente real**, atribuída ao responsável e encerrada automaticamente. Cada sequência só é entregue uma vez.
5. Marque esse teste como resolvido no painel depois de conferir a issue.

Um teste pendente/recentemente solicitado tem cooldown de 15 minutos. Ele testa banco → endpoint → checker → issue/notificação GitHub; não comprova recebimento numa caixa de e-mail. Testes de navegador em CI cobrem separadamente captura, API, cancelamento/offline, dados privados, painel e permissões com backend local simulado.

## Quando houver incidente

1. Abra a issue e a execução associada. Se o checker falhou, investigue primeiro a etapa e a última execução bem-sucedida.
2. No painel, examine código, rota genérica, alvo/arquivo, release, horários, status HTTP, dispositivo e duração. Consulte os logs da Vercel/Supabase para confirmar a causa; não cole dados privados numa issue pública.
3. Corrija/teste/publice o defeito ou reverta pelo fluxo normal de deploy. O monitor **não** modifica o site automaticamente.
4. Verifique a produção e marque apenas os incidentes realmente tratados como resolvidos. A Action fecha o aviso público quando as verificações passam e não há incidentes reais abertos. Uma nova ocorrência após resolução reabre um registro novo.

## Configuração e desenvolvimento

São reutilizadas `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (fallback legado `VITE_SUPABASE_ANON_KEY`). Nenhuma `service_role` é necessária. O servidor inclui a release se a variável padrão Vercel `VERCEL_GIT_COMMIT_SHA` estiver disponível.

A coleta do navegador só é habilitada no build de produção em `nomeubairro.vercel.app`; previews/desenvolvimento não poluem o banco. Se o domínio oficial mudar, atualize a allowlist junto com o checker. O modo `VITE_MONITORING_TEST=1` só funciona em DEV e exige backend exatamente igual à origem local + `/supabase-mock`, nunca o Supabase real.

Validação: `npm run check` e `npm run test:e2e`. Não rode o checker com token real durante testes locais; os testes unitários usam GitHub/produção simulados. Alterações de migrations devem preservar os registros existentes e os grants restritos.

Referências: [GitHub schedules](https://docs.github.com/actions/using-workflows/events-that-trigger-workflows#schedule), [Supabase Cron](https://supabase.com/docs/guides/cron), [web-vitals](https://github.com/GoogleChrome/web-vitals), [Vercel waitUntil](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#waituntil).
