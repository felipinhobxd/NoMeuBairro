# Segurança

## Versão mantida

A versão mantida é a publicada a partir da branch `main`. Correções de segurança são aplicadas nessa linha e entram no deploy de produção após as verificações automatizadas.

## Como relatar uma vulnerabilidade

Não abra uma issue pública para vulnerabilidades, exposição de dados, credenciais, informações de contas ou formas de contornar as proteções do site.

Use o [canal privado de segurança do GitHub](https://github.com/felipinhobxd/NoMeuBairro/security/advisories/new). Inclua, quando possível:

- área afetada e impacto observado;
- passos mínimos para reproduzir;
- navegador e dispositivo utilizados;
- evidências sem dados pessoais de terceiros;
- uma sugestão de correção, caso já tenha identificado a causa.

Nunca envie senhas, tokens, cookies de sessão, chaves privadas do Supabase ou documentos pessoais reais. Remova ou substitua esses valores antes de anexar logs ou imagens.

## Solicitações sobre dados pessoais

Pessoas com acesso à conta devem usar **Perfil → Controles dos seus dados** para baixar uma cópia em JSON ou solicitar exclusão. Se não for possível acessar a conta, use o canal privado acima e informe apenas o mínimo necessário para localizar a solicitação com segurança.

## Escopo

O canal cobre o frontend, APIs da Vercel, banco/Auth/Storage do Supabase, PWA, processos administrativos e workflows deste repositório. Serviços externos devem ser reportados também ao responsável pelo respectivo serviço quando a falha não estiver no código do No Meu Bairro.
