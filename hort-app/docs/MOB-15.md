# MOB-15 — Leitura de assinatura com plano desativado

Atualização: 27/11/2026. Implementação preparada para revisão.

## Continuidade e escopo

MOB-14/PR #12 integrada em `62a84bb`. Esta task é a evolução de backend e contrato prevista no plano, anterior às consultas da MOB-17 e às telas da MOB-18. Não modifica layouts do app.

Backend desenvolvido em checkout isolado `/tmp/hort-mob15-backend`, branch `feat/mob-15-subscription-read`, preservando o checkout de desenvolvimento e seu plano não versionado. Revisão implementada: [`0baf1abe912c321f1f506bf85c6e69ec6ba8dafb`](https://github.com/vicentejuniordev/hort-backend/commit/0baf1abe912c321f1f506bf85c6e69ec6ba8dafb).

## Contrato de leitura

`GET /api/v1/assinaturas/` e `GET /api/v1/assinaturas/{id}/` preservam os campos existentes e acrescentam `plano_atual`:

- `id`, `produtor` (ID), nome, categoria, periodicidade e `is_ativo` atuais.
- `valor` atual calculado pelo mesmo serializer do catálogo.
- `cestas`, com IDs, nomes e itens/produtos/quantidades atuais.

A assinatura é consultada pelo seu proprietário, sem depender do catálogo ativo. Plano desativado continua legível na assinatura e continua indisponível para nova contratação pelo catálogo. Produto desativado permanece na composição atual quando o vínculo existe.

Todo conteúdo de `plano_atual` é atual; não representa o catálogo na data da contratação. O schema documenta essa diferença. `valor_contratado`, datas, status e `programacoes` permanecem próprios da assinatura. O valor atual pode divergir do contratado. Uma cesta adicionada ao plano posteriormente não cria programação na assinatura; seus dias continuam associados aos IDs originalmente programados. Assinatura legada sem programações conserva `[]`.

O enriquecimento é exclusivo dos GETs. Contratação, resposta de repetição idempotente e cancelamento conservam `Assinatura`; não se acrescentam dados mutáveis à resposta de contratação armazenada. Após um comando, consultar o GET para obter a leitura atual.

Tipos gerados:

- `AssinaturaLeitura` / `PaginatedAssinaturaLeituraList`: respostas de consulta.
- `PlanoAtualAssinatura`: representação atual com `is_ativo` obrigatório e composição.
- `Assinatura`: respostas de comandos preservadas.

`contracts/openapi.json`, `contracts/source.json` e `schema.d.ts` foram gerados a partir do backend, com revisão e checksum registrados. Nenhuma alteração manual no arquivo de tipos gerados.

## Isolamento e consultas

O selector mantém filtro pelo cliente autenticado e carrega plano/cliente por join, programações/cestas/itens por prefetch e produto no join dos itens. Não há filtro de atividade aplicado à leitura da assinatura. Acesso alheio retorna 404; conta sem perfil de cliente recebe 403; sem autenticação recebe 401. Não são acrescentados dados pessoais do produtor.

O teste de desempenho verifica 4 consultas de dados no detalhe e 5 na listagem paginada antes e depois de aumentar para dezenas de itens, várias cestas e duas assinaturas de planos diferentes. O custo em consultas não cresce por item; o tamanho da resposta e o custo de serialização crescem com a composição. A contagem usa autenticação forçada no teste; autenticação JWT e consulta de perfil podem acrescentar consultas em requisições reais.

## Fixtures e verificações

`tests/fixtures/mobile-api.mts` acrescenta exemplos tipados de consulta com plano ativo, plano desativado com preço/nome atuais diferentes, assinatura cancelada, assinatura legada e paginação. As fixtures são sintéticas e continuam fora do app em execução.

Verificações executadas:

- Backend: 164 testes encontrados, execução aprovada com dois testes de concorrência ignorados por exigirem PostgreSQL. Os seis novos testes exercitam os endpoints e a composição real no banco isolado em memória; não alteram dados de desenvolvimento.
- Schema OpenAPI exportado com `--validate --fail-on-warn`, sem erros ou avisos.
- Mobile: 103 testes aprovados, incluindo três novos de contrato, distinção entre valor atual/contratado e preservação das respostas de comando.
- Lint, TypeScript, Prettier dos arquivos versionados da entrega, geração sincronizada e checagem tipada das fixtures aprovados. A CI Android do PR repete as verificações e exporta o bundle.
- `.env.local`, alteração prévia de `tsconfig.json` e plano original não versionado preservados fora dos commits.

Esta task não altera transações ou bloqueios; não comprova os cenários de concorrência PostgreSQL ignorados. Não há migration, dependência ou módulo nativo novo. Não foram executados testes de interface no celular ou iOS.

## Integração e próxima task

Integrar o PR do backend e atualizar/reiniciar a API de desenvolvimento para disponibilizar `plano_atual`. O PR mobile registra o contrato desse backend. O catálogo Android existente permanece disponível para supervisão; as novas respostas serão consumidas na MOB-17 e apresentadas na MOB-18. Não há tela nova a validar nesta task.

A próxima task é MOB-16, CRUD de produtos do produtor. A implementação visual deverá consultar novamente os frames correspondentes do Figma e alinhar diferenças de contrato antes de mudar o layout.

Fontes técnicas: [Django 6.1 — QuerySet e prefetch](https://docs.djangoproject.com/en/6.1/ref/models/querysets/), [DRF — relações aninhadas](https://www.django-rest-framework.org/api-guide/relations/#nested-relationships) e [drf-spectacular — introspecção e customização](https://drf-spectacular.readthedocs.io/en/latest/customization.html).
