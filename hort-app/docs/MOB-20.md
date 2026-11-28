# MOB-20 — Gestão de planos, cestas e composição

Implementação: 27/11/2026, após a MOB-19/PR #17 integrada em `045d190`. Branch mobile `feat/mob-20-producer-plans`. Complemento de backend: [PR #19](https://github.com/vicentejuniordev/hort-backend/pull/19), revisão `08c89ee21c1a7b1588403c390fad68a7bb939922`.

## Fluxo entregue

A aba Planos deixa de ser uma seção de apresentação e passa a ter uma pilha Expo Router em `src/app/(produtor)/planos/`. Telas, consultas, validações e comandos ficam fora das rotas, em `features/plans/`.

- Lista dos planos privados do produtor, publicados e rascunhos, com busca, paginação, valor atual e acesso à gestão.
- Criação explícita em rascunho; edição de nome, categoria e periodicidade semanal. Não envia preço, descrição ou produtor no formulário.
- Detalhe com total calculado pelo servidor, lista paginada de cestas, publicação/desativação e exclusão com confirmação. Histórico protegido e composição inválida recebem orientações específicas do domínio.
- Criação e alteração do nome de cestas; detalhe com produtos já salvos e ações de composição. O vínculo da cesta com seu plano não é editável.
- Seleção de produtos privados em modal com lista virtualizada, busca e paginação. Produtos já vinculados à cesta são omitidos e também verificados antes de salvar; o servidor resolve mudanças concorrentes. Produto inativo é identificado, sem inventar uma proibição que o contrato não possui.
- Inclusão via POST em `itens-cesta/`, edição de quantidade via PATCH do item e remoção via DELETE com confirmação. Editar não reenvia nem troca vínculos de cesta/produto. Excluir cesta preserva as proteções de programação existentes no backend.

A composição é persistida por etapas: salvar o plano, cadastrar a cesta e gravar cada item. A interface identifica os itens já salvos; não apresenta o conjunto como uma transação única nem informa sucesso de etapas que não responderam. As rotas verificam se a cesta pertence ao plano e se o item pertence à cesta, inclusive em links diretos com IDs trocados.

Quantidades aceitam vírgula ou ponto, de `0.001` a `9999999.999`, com até três casas decimais. São normalizadas como strings, com verificação inteira por BigInt, sem float. Produtos por unidade exigem quantidade inteira. A periodicidade é um inteiro positivo seguro, sem restringi-la artificialmente ao número de cestas ou multiplicar o total do plano.

## Valor calculado e contrato

A consulta privada anterior de planos não retornava o valor. O complemento de backend acrescenta `valor` somente para leitura em `PlanoSerializer`, inclusive em rascunhos. Usa a mesma soma Decimal e arredondamento HALF_UP do catálogo; o total não depende da página de cestas carregada no app. Prefetch de cestas e itens/produtos mantém quatro consultas na listagem mesmo com vários planos. Escrita de valor continua rejeitada; nenhuma migration ou dependência nova.

Snapshot, tipos e origem/checksum foram atualizados dessa revisão. O app recusa respostas antigas sem valor calculado e orienta atualizar o serviço, sem inventar zero. Integrar primeiro o PR backend e reiniciar o serviço correspondente antes da supervisão mobile. Não foram atualizados o checkout, servidor ou banco de desenvolvimento em uso.

## Consultas, comandos e estados

As chaves TanStack incluem geração de sessão, usuário, modo e recurso, além da busca/ID. Listas deduplicam por ID e constroem a próxima página localmente, sem seguir URLs `next`. Foco e modo Produtor controlam as consultas; o adaptador também verifica autenticação/perfil/modo em cada chamada. Detalhes de planos/cestas/itens são atualizados ao retomar o foco; produtos usam cache curto para evitar nova consulta a cada remontagem de linha virtualizada.

Comandos impedem envio concorrente na mesma instância, usam AbortSignal e verificam o dono da sessão após a resposta. Perder o foco cancela a operação local; cancelamento não desfaz uma gravação do servidor. As leituras privadas são canceladas/invalidadas antes e marcadas para atualização depois, inclusive após resultado incerto. Falha de atualização posterior não transforma uma gravação confirmada em erro de comando. Respostas tardias de outra conta/modo/geração não confirmam sucesso nem repovoam o cache anterior.

Não há repetição automática de escritas arbitrárias. Timeout, rede, resposta incompatível ou erro 5xx bloqueiam novo envio naquela tela e orientam consultar os dados atuais. Não foi acrescentado um mecanismo de refresh: permanece a renovação centralizada da sessão. Erros de campo, autorização, ausência do recurso, publicação, histórico protegido e paginação recebem estados próprios. Falha de outra página mantém as anteriores.

## Referências visuais e assets

Consultados contexto detalhado e renders com a skill `figma:figma-design-to-code`: [gestão, 219:460](https://www.figma.com/design/3t53HvlVWuJpmDmpJDC8rU/HORT?node-id=219-460), [Novo Plano, 287:749](https://www.figma.com/design/3t53HvlVWuJpmDmpJDC8rU/HORT?node-id=287-749), [Nova Cesta, 297:767](https://www.figma.com/design/3t53HvlVWuJpmDmpJDC8rU/HORT?node-id=297-767) e [confirmação, 364:872](https://www.figma.com/design/3t53HvlVWuJpmDmpJDC8rU/HORT?node-id=364-872).

Reutilizados cabeçalho, abas, fontes, botões, campos, diálogo e ilustração local de cesta. Os cartões usam a ilustração genérica da referência, sem associar ícones de premium/tipos inexistentes a dados da API. As hortaliças permanecem na aba Produtos da MOB-16. Os formulários mantêm folhas, seções claras, bordas e rodapé verde, com fluxo flexível, rolagem e alvos de toque de pelo menos 48 dp.

| Asset local | Origem / dimensões de raiz e exibição |
| --- | --- |
| `assets/products/form-leaves.svg` | Mesmo `69985.svg` das referências; 59 × 34, nos dois lados do cabeçalho |
| `assets/products/form-footer.svg` | Mesmo `cf1a3.svg` de Nova Cesta; 473 × 48 |
| `assets/plans/form-footer.svg` | `f0aee.svg` de Novo Plano; 482 × 55 |
| `assets/plans/add.svg` | `645c3.svg`; 14 × 14, ação de incluir produto |
| `assets/plans/remove.svg` | `86705.svg`; 17 × 17, ação de remover item |
| `assets/auth/produce-basket.png` | Mesmo `8967c.png`; 29 × 29 no cartão de plano |

Arquivos locais não vazios, dimensões e posições de uso foram conferidos. Nenhuma URL temporária é usada em runtime e nenhuma imagem de tela é usada como interface. Adaptados os campos do Figma ao contrato: categoria substitui descrição sem persistência, preço é de leitura, periodicidade é numérica e a publicação pertence ao plano. O toggle de disponibilidade da cesta não tem equivalente na API e não foi implementado. A seleção paginada e as ações de itens usam telas/modal próprios para gravar cada etapa com clareza.

## Verificação e limites

- Lint, TypeScript, 144 testes mobile, contrato/fixtures, Prettier dos arquivos publicados e diff aprovados. Treze testes novos cobrem entradas/payloads, precisão de quantidade, vínculos, contrato antigo, paginação, isolamento, envio duplo, timeout, cancelamento, falha de refresh posterior e leitura de valor no schema.
- Backend: 186 testes aprovados no PostgreSQL 18.7 descartável, sem ignorados; suíte SQLite aprovada com nove testes de bloqueio ignorados. OpenAPI validado sem avisos; nenhuma migration pendente. CI PostgreSQL do PR backend aprovado.
- Exportação Android/Hermes concluída; não é APK nem execução em aparelho.
- Jornada real no Chromium, viewport de 393 × 852, com login e API Django/JWT isolada em SQLite de `/tmp`: criar rascunho e cesta, adicionar produto fracionado, editar quantidade, carregar outra página de produtos, rejeitar fração por unidade, corrigir e adicionar, publicar, tratar exclusão protegida e desativar. Também conferido viewport 320 × 640 sem overflow horizontal.
- Integração HTTP adicional com cliente fictício: plano publicado consultado no catálogo e contratado, com valor `13.99`; exclusão do plano recusada pela proteção do histórico; desativação retirou a oferta do catálogo. Isso não é execução da interface cliente de contratação, que pertence às MOB-21/MOB-22.

O navegador de teste encaminhou chamadas exclusivamente para a API isolada, sem alterar `.env.local`. Foram inspecionadas capturas de formulário, quantidade inválida, composição e histórico protegido. Essa validação não comprova teclado, leitor de tela, áreas seguras ou ciclo de vida em Android/iOS. Esses itens permanecem para supervisão em aparelho.

Serviços e banco temporários foram encerrados após a conferência. Alteração preexistente em `tsconfig.json`, `.env.local` e plano original não versionado ficaram fora dos commits. A MOB-24 ainda prevê completar a prévia e automatizar a jornada de produtor/cliente; as ações básicas de publicação, desativação e exclusão já estão acessíveis nesta entrega. Próxima task sequencial: MOB-21, contratação com intenção/chave persistidas e recuperação de tentativa incerta.

Fontes técnicas: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Router SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/router/), [FlatList](https://reactnative.dev/docs/flatlist).
