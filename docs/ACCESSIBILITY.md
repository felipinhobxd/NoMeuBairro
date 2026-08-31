# Acessibilidade: navegação e VLibras

Esta etapa altera somente a navegação global e a integração de acessibilidade do
VLibras. Não altera consultas, permissões, autenticação, publicações ou traduções.

## Navegação

- As cores do menu principal vêm das regras de navegação em `src/index.css`.
  Evite combinar o item ativo com `text-emerald-*`: o remapeamento global da marca
  usa `!important` e reduzia o contraste do texto sobre o fundo claro.
- O filtro e a inicial do perfil usam terracota escuro no tema claro e laranja
  claro no tema escuro. Os nomes acessíveis continuam presentes no modo só ícones.
- “Pular para o conteúdo” transfere o foco ao `main` sem mudar o hash da rota.
- “Mais” mantém o mesmo painel inferior, agora com modalidade nativa (`dialog`),
  foco inicial no botão de fechar, ciclo de Tab/Shift+Tab, Esc e retorno do foco.
  O painel fecha ao entrar no breakpoint desktop, evitando deixar a página inerte.
  Há fallback de abertura/teclado para navegadores sem `showModal`.

## Integração do VLibras

`src/utils/vlibrasAccessibility.ts` complementa o carregador oficial, sem copiar o
tradutor, alterar eventos de clique ou mudar consentimento, avatares e serviços.

- As imagens do acesso são decorativas (`alt=""`); o botão tem nome explícito.
- O acesso tem área de 44 × 44 px, foco contrastante e expansão também pelo teclado.
- Legendas têm nome e estado pressionado sincronizados com o ícone oficial;
  configurações têm nome acessível. Nomes fornecidos pelo próprio widget prevalecem.
- No painel “Configurações”, fechar, tema escuro, opacidade e redefinir recebem
  nomes acessíveis. Os inputs preservam estado e teclado nativos, e os eventos do
  fornecedor não são substituídos. Inputs também recebem foco visível.
- A correção observa somente a inserção dos dois hosts e seus elementos internos.
  Não consulta a API, não lê dados de usuários e não observa toda a árvore do feed.
  Reinicialização e remontagem não duplicam estilos/observadores.
- A correção não bloqueia o site quando o VLibras não estiver disponível.

O fornecedor pode atualizar o widget independentemente do site. Os seletores
documentados são `vlibras-access-wrapper`, `vlibras-button`, `vlibras-popup` e
`vlibras-app-root`; as correções dos controles se limitam aos ícones oficiais
`subtitle`, `subtitle-off` e `settings`. Não adicione rótulos genéricos a todos os
botões nem altere o código/iframe de tradução para fazer uma auditoria passar.
O painel interno é identificado por `data-slot="dialog-title"`/`dialog-content`,
seu título “Configurações” e os textos visíveis dos campos. Rótulos nativos,
`aria-labelledby`, `aria-label` e nomes fornecidos pelo widget são respeitados.

## Verificação

```sh
npm run check
npm run test:e2e
```

`tests/e2e/navigation-accessibility.spec.ts` cobre temas claro/escuro, administrador,
visitante, nome do login no celular, contraste, atalho de conteúdo, ciclo de foco,
Esc, mudança para desktop, fonte gigante e troca do menu para o seletor de fonte.
Também cobre teclado e atualização das legendas, carregamento tardio, remontagem,
idempotência e indisponibilidade do VLibras, com um contrato DOM local e sem enviar
dados ao serviço externo. A auditoria não desativa regras do Axe nos alvos testados.

As oito resoluções configuradas incluem 1920×1080, 1536×864, 1366×768, 1280×720,
1024×600, tablet, Pixel 5 e celular de 360 px. Após publicar, confira também o widget
oficial no domínio público: abrir por Enter/Espaço, localizar legendas/configurações
e fechar. Os testes com o contrato local não substituem essa conferência real.

Referências: [WCAG 2.2](https://www.w3.org/TR/WCAG22/),
[padrão de diálogo modal](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/),
[código oficial do VLibras](https://github.com/spbgovbr-vlibras/vlibras-web-browsers).
