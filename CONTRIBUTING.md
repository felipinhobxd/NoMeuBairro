# Como contribuir

Obrigado por ajudar o No Meu Bairro. Mudanças devem preservar a leitura simples, a acessibilidade, o funcionamento em celular e desktop e a privacidade das pessoas da comunidade.

## Antes de começar

- Procure uma issue existente ou abra uma usando os modelos do repositório.
- Nunca coloque dados reais de usuários, tokens, senhas ou chaves privadas em issues, testes ou commits.
- Para segurança ou privacidade, siga o [SECURITY.md](SECURITY.md) e use o canal privado.

## Desenvolvimento

1. Instale as dependências com `npm install`.
2. Configure somente as chaves públicas descritas no README.
3. Faça uma mudança pequena e focada.
4. Preserve textos em português simples e controles acessíveis por teclado.
5. Se houver mudança no banco, crie uma migration idempotente em `database/` e mantenha RLS e privilégios explícitos.

## Verificações obrigatórias

```bash
npm run check
npm run test:e2e
```

Para executar o Playwright pela primeira vez, use `npx playwright install chromium`.

## Pull requests

Explique o problema, a solução, o impacto para quem usa o site e as verificações executadas. Imagens de antes/depois são úteis em mudanças visuais, mas devem estar sem dados pessoais.
