# MOB-17 — Consultas de assinaturas e programações

Atualização: 27/11/2026. Camada preparada para revisão; telas pertencem à MOB-18.

## Continuidade e dependências

MOB-16/PR #14 integrada em `ea02850`. O PR #16 do backend da MOB-15 continuava aberto na conferência. Esta entrega foi implementada e testada com sua leitura enriquecida em um checkout isolado, sem alterar o backend de desenvolvimento.

Também foram documentados no OpenAPI os filtros já existentes no servidor. Complemento de backend na branch `feat/mob-17-subscription-filters`, baseado em `feat/mob-15-subscription-read`; revisão [`cb3b996c42fc2a6c720cbef64957d753e25a0271`](https://github.com/vicentejuniordev/hort-backend/commit/cb3b996c42fc2a6c720cbef64957d753e25a0271). Seu PR deve ser integrado depois do PR #16. O snapshot mobile e os tipos foram gerados dessa revisão, com checksum e origem registrados.

Não foram criadas telas, abas ou ações de contratação/cancelamento. A MOB-18 deverá consultar o Figma e alinhar diferenças de contrato antes da implementação visual.

## Consultas e filtros

`features/subscriptions/model.ts` deriva respostas e filtros do OpenAPI e fornece cliente de leitura, normalizadores, opções de query, chaves de cache, deduplicação e adaptação de erros.

| Consulta     | Endpoint / filtros                                                               |
| ------------ | -------------------------------------------------------------------------------- |
| Assinaturas  | `assinaturas/`: status (`ativa`/`cancelada`), plano e data de renovação prevista |
| Assinatura   | `assinaturas/{id}/`: leitura enriquecida da MOB-15                               |
| Programações | `entregas-programadas/`: assinatura, cesta e dia semanal ISO 1–7                 |
| Programação  | `entregas-programadas/{id}/`: IDs e dia/ordem reais                              |

Filtros podem ser combinados. IDs e páginas precisam ser inteiros positivos seguros; dias são inteiros de 1 a 7; datas são datas ISO válidas, sem conversão para horário local. Os normalizadores rejeitam valores inválidos antes do transporte. Ordenação aceita somente campos suportados por cada viewset, com ID como desempate; padrão por contratação decrescente nas assinaturas e por dia nas programações. Não se envia busca textual ou filtro de status de assinatura ao endpoint de programações, que não os oferece.

Paginação de 20 registros; `next` indica continuidade, mas sua URL não é seguida. A próxima página é construída localmente e página vazia encerra o carregamento. Resultados são deduplicados por ID, conservando a ordem e atualizando a representação repetida. A paginação não congela o conjunto de registros: alterações concorrentes podem exigir atualizar a consulta.

## Hooks e cache

`useSubscriptions(filters)`, `useSubscription(id)`, `useSchedules(filters)` e `useSchedule(id)` usam o transporte autenticado e o provider TanStack já existente. As opções puras exportadas pelo modelo são as usadas pelos hooks e exercitadas nos testes de consulta.

- Listas expõem linhas deduplicadas, estados da query, `failure` e `loadMore()` protegido contra chamadas simultâneas.
- Detalhes expõem `validId`; ID nulo/inválido desabilita a consulta e produz falha de identificador. A tela deve tratar essa condição antes do carregamento.
- Consultas são habilitadas apenas com sessão autenticada, modo Cliente, perfil de cliente e foco da rota. O adaptador de transporte também verifica o modo/perfil na chamada, inclusive em uma consulta manual.
- As chaves incluem geração de sessão, usuário, modo, recurso, filtros ou ID. Listas, detalhes e programações não compartilham entradas por coincidência de IDs.
- Prefixo `subscriptionKeys.all(scope)` agrupa assinaturas e programações para invalidação nas futuras mutações. Não se mistura com o catálogo ou produtos.
- O provider existente cancela consultas e limpa o cache ao mudar conta, modo, geração ou estado autenticado. Resposta tardia não repopula o cache anterior.
- Cache somente em memória, sem persistência de dados privados: 30 segundos de validade e cinco minutos de descarte quando inativo. Reconexão automática segue desativada; o provider já integra foco do aplicativo.

Nenhum mecanismo de refresh foi acrescentado. Os 401 continuam na renovação única centralizada, compartilhada entre endpoints, com no máximo uma repetição após renovar. Demais consultas não repetem automaticamente; 403, 404, 429, erro de contrato, filtros inválidos, cancelamento e indisponibilidade têm mensagens e possibilidade de nova tentativa distintas.

Falha de outra página mantém as anteriores. A MOB-18 deverá apresentar separadamente erro inicial, vazio, atualização, próxima página e dados possivelmente desatualizados; os hooks não constituem execução desses estados em uma interface.

## Semântica dos dados

A assinatura é lida diretamente pelo seu endpoint, inclusive se o plano foi desativado. Valores decimais, status, datas e IDs são preservados. `valor_contratado` não é recalculado com a composição atual. `plano_atual` identifica nomes, composição, preços e atividade atuais; não é um snapshot da contratação. Assinaturas legadas com programações vazias permanecem vazias.

Uma verificação mínima de formato rejeita resposta antiga sem `plano_atual` e respostas incompatíveis de programação/paginação antes de armazená-las no cache, orientando atualizar o serviço. Essa proteção não substitui validação completa de todo o OpenAPI em runtime.

Programações representam recorrência semanal, inclusive quando preservadas após cancelamento. Seu endpoint não fornece status de execução, nem status da assinatura. Não presumir assinatura ativa ou entrega concluída: consultar a assinatura pelo seu ID para apresentar seu estado. Cestas acrescentadas depois ao plano não ganham dias automaticamente. `data_renovacao` é previsão, sem cobrança implementada.

## Verificações

- 126 testes mobile aprovados, incluindo 12 novos de consultas: filtros/ordenação, datas e IDs inválidos, contrato antigo, plano desativado/legado, paginação, deduplicação, vazio, erro de próxima página, cache/invalidação, isolamento entre conta/modo/geração, resposta tardia e refresh compartilhado entre endpoints.
- Backend: 167 testes encontrados, execução aprovada em SQLite em memória com dois testes de concorrência PostgreSQL ignorados. Os três novos testes verificam documentação do schema, filtros combinados e parâmetros inválidos. OpenAPI exportado com `--validate --fail-on-warn` sem erros ou avisos.
- Integração HTTP com Django/JWT real isolado e opções TanStack: 23 assinaturas e 22 programações em múltiplas páginas; filtros; assinatura ativa/cancelada/legada; plano desativado com valor atual diferente do contratado; detalhes; consulta vazia; outra conta recebe 404 e lista filtrada vazia; cache removido ao trocar modo/sair. Servidor encerrado e dados de desenvolvimento intactos.
- Lint, TypeScript, Prettier e contrato/fixtures sincronizados aprovados. CI do PR repete as verificações e exporta Android.
- `.env.local`, alteração prévia de `tsconfig.json` e plano original não versionado preservados fora dos commits. Nenhuma dependência ou módulo nativo novo.

Os testes de opções/HTTP não são execução dos hooks em aparelho. Não houve teste de interface, navegação ou ciclo de vida no Android físico, nem validação iOS.

## Integração e supervisão

Integrar o PR #16 do backend, depois o complemento de filtros desta task, atualizar o checkout da API e reiniciar o serviço de desenvolvimento. O PR mobile registra o contrato dessas revisões. Enquanto a API antiga estiver em execução, a consulta enriquecida será recusada pela verificação de formato.

Não há tela nova para supervisionar nesta task. No APK atual, `npm run start:dev -- --clear` permite conferir regressões dos fluxos já entregues. As consultas serão apresentadas e supervisionadas na MOB-18, próxima task do plano, conforme Figma.

Fontes técnicas: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Router](https://docs.expo.dev/versions/v58.0.0/sdk/router/), [TanStack Query — consultas infinitas](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries) e [drf-spectacular — parâmetros de consulta](https://drf-spectacular.readthedocs.io/en/latest/customization.html).
