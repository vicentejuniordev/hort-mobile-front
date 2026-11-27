# MOB-14 — Catálogo e composição das ofertas

Atualização: 26/11/2026. Implementação preparada para revisão e supervisão Android.

## Escopo e decisões aprovadas

Continuidade após merge da MOB-13/PR #11 (`cc52185`). Esta entrega substitui a entrada técnica do Catálogo pelas telas de lista, detalhe da oferta e composição de cada cesta. Não inclui contratação, gestão de produtos ou leitura de assinaturas.

Referências do arquivo HORT consultadas com a skill `figma:figma-design-to-code`: lista [50:377](https://www.figma.com/design/3t53HvlVWuJpmDmpJDC8rU/HORT?node-id=50-377), detalhe verde [57:377](https://www.figma.com/design/3t53HvlVWuJpmDmpJDC8rU/HORT?node-id=57-377), além da home 28:577, horta 50:24 e variante 156:465 para conferir diferenças. Foram lidos contexto detalhado e renders; a implementação usa componentes nativos, sem imagens de telas como interface.

O responsável aprovou explicitamente:

- Usar o cartão verde para todas as ofertas, sem criar categorias Básico/Essencial/Premium.
- Exibir nomes, valores, cestas e quantidades reais; não prometer entregas, benefícios de suporte ou cobrança mensal ausentes no contrato.
- Acrescentar busca e ordenação; deixar a seção de produtos avulsos para sua etapa própria.
- Manter “Assinar Plano” com aviso de indisponibilidade até a implementação da contratação.

Não há distância, avaliações, fotos de alimentos atribuídas a produtos ou identidade pública de hortas inventadas. As duas abas existentes, Catálogo e Conta, permanecem; a task não cria destinos fictícios de carrinho ou agenda.

## Interface e navegação

Lista virtualizada em duas colunas, com cartão ímpar centralizado; uma coluna em larguras menores ou fontes ampliadas. Busca com espera de 300 ms usa a MOB-13; enquanto o texto ainda não foi aplicado, os resultados anteriores deixam de ser apresentados. Ordenação oferece padrão, nome crescente/decrescente e mais recentes, conforme campos suportados pelo servidor. “Carregar mais” pagina explicitamente; atualizar por gesto consulta novamente as páginas carregadas.

`catalogo/_layout.tsx` contém a lista e detalhes como rotas transparentes sobrepostas. As rotas são:

- `/catalogo`: lista.
- `/catalogo/:id`: oferta pelo ID real.
- `/catalogo/:id/cestas/:cestaId`: composição, selecionada por ID pertencente à resposta daquela oferta, nunca por índice.

O detalhe de cesta reutiliza a apresentação verde com a extensão necessária para os dados reais. Fechar/voltar, retorno Android e âncora de navegação estão configurados; a conferência no aparelho ainda é necessária. O botão “Voltar ao plano” retorna à oferta mesmo quando a composição foi aberta por link direto. IDs malformados e cesta ausente possuem mensagem própria.

Consulta, cache privado, autenticação e descarte ao sair/trocar de modo continuam centralizados na MOB-13. Não há outro armazenamento de dados ou tokens. Contratação apenas abre o aviso aprovado, sem POST ou sucesso simulado.

## Figma e assets

Cartão base com largura de 148, altura mínima de 184, raio 10, fundo `#EBFDE3`, borda `#AABCA2` e ação `#2E7D32`. Detalhe com largura máxima de 308, altura mínima de 392, raio 20 e fundo `#DDE0DB`. Conteúdo pode crescer para nomes, valores e composição reais; o detalhe rola em telas pequenas. Alvos interativos têm pelo menos 48 pontos sem aumentar desnecessariamente o desenho interno dos botões.

Poppins mantém os pesos e tamanhos das referências. Inter SemiBold foi instalada pelo `expo install` e carregada localmente para o valor do detalhe. É uma fonte estática; não adiciona módulo nativo nem exige novo APK.

Assets locais conferidos por existência, tamanho não vazio, origem e geometria declarada nos pontos de uso:

| Asset                      | Uso / dimensão                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `auth/produce-basket.png`  | Mesmo asset `8967c.png` do Figma, ícone de 22 × 22 no cartão e detalhe                    |
| `catalog/check.svg`        | Asset `81d1a.svg` baixado do Figma, raiz e exibição de 17 × 12 nas informações do detalhe |
| Header e folhas existentes | `AccountHeader`: forma 402,402 × 171,222; folhas 20 × 21,8841 e 20 × 19                   |
| Seta circular existente    | 61 × 61, via `BackButton` no header                                                       |
| Ícones das abas existentes | 22,1495 × 22,1495, sem alteração                                                          |

Nenhuma URL temporária do Figma é usada em runtime. A verificação de dimensões e código não equivale a comparação visual do app renderizado no Android.

## Estados e verificações

Lista apresenta carregamento inicial, busca em andamento, vazio, atualização, erro inicial, falha da próxima página e aviso de dados possivelmente desatualizados. Falha de outra página mantém as anteriores e permite tentar novamente. Erros sem permissão não conservam a apresentação dos dados; o transporte e a sessão continuam responsáveis pelo tratamento de 401. Detalhe cobre carregamento, falha recuperável, oferta removida, composição vazia e cesta ausente.

Valores monetários e quantidades são formatados como strings decimais, sem cálculo com floats e sem multiplicar o valor pela periodicidade. Cestas sem composição e planos sem cestas mostram seu estado real; as regras de publicação permanecem na MOB-19.

Verificações executadas:

- 100 testes aprovados, incluindo cinco novos de apresentação: precisão monetária, unidades e frações, IDs inválidos, seleção por ID após reordenação e quantidade de cestas independente da periodicidade.
- Integração das consultas e apresentação com Django real isolado, banco SQLite em memória: 23 ofertas ativas de duas hortas, duas páginas, busca/ordenação, detalhe, valor/quantidade, cesta pelo ID, vazio e descarte ao sair/trocar modo. Servidor encerrado após a verificação; dados de desenvolvimento intactos.
- Lint, TypeScript, contrato sincronizado, Prettier dos arquivos da entrega e exportação Android/Hermes aprovados. CI do PR executa novamente as verificações sobre os arquivos versionados.
- `.env.local`, alteração local prévia de `tsconfig.json` e plano original não versionado preservados fora dos commits.

Não há dispositivo conectado ao ADB neste ambiente. Não foram executados testes visuais, TalkBack ou navegação no Android físico; não há validação iOS.

## Supervisão no Android

Usar o APK de desenvolvimento atual e iniciar:

```bash
npm run start:dev -- --clear
```

Entrar como cliente e abrir Catálogo. Conferir os cartões verdes, busca, ordenação e teclado; abrir um plano e cada cesta, comparar quantidades e unidades, voltar pelo botão e pelo retorno Android. Conferir o aviso de “Assinar Plano”. Com mais de 20 ofertas, verificar “Carregar mais”; conferir busca sem resultado e atualização sem rede. Repetir com fonte ampliada e verificar que nomes/valores continuam legíveis. Voltar à Conta, trocar modo quando disponível e sair para conferir a navegação privada.

A próxima task do plano é MOB-15, contrato de leitura enriquecida de assinaturas com plano desativado. Pendências de infraestrutura e recuperação de senha das tarefas anteriores permanecem registradas nos seus documentos.

Fontes técnicas: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Router](https://docs.expo.dev/versions/v58.0.0/sdk/router/), [rotas modais](https://docs.expo.dev/router/advanced/modals/), [Image](https://docs.expo.dev/versions/v58.0.0/sdk/image/) e [FlatList](https://reactnative.dev/docs/flatlist).
