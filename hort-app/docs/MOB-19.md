# MOB-19 — Publicação de ofertas e concorrência no PostgreSQL

Implementação: 27/11/2026, após a MOB-18/PR #16 integrada em `8bf1471`. Branch mobile `feat/mob-19-offer-publication`; backend preparado em checkout isolado `/tmp/hort-mob19-backend`, sem alterar o checkout, serviço ou banco de desenvolvimento.

## Entrega de backend

[PR #18 — regras de publicação e concorrência](https://github.com/vicentejuniordev/hort-backend/pull/18), revisão do contrato `54aaee51c2ed41f1a624d08d547c44e35447370b`.

- Novos planos são rascunhos (`is_ativo=false`). Montar cestas/itens antes de publicar com PATCH `is_ativo=true`.
- Publicação e nova contratação exigem de 1 a 7 cestas e valor total arredondado positivo. Não se exige valor positivo por cesta individual; periodicidade não multiplica o valor.
- Alterações que invalidem uma oferta ativa são revertidas com HTTP 409, códigos `publicacao_cestas_invalidas` ou `publicacao_valor_invalido`, orientando desativar antes de editar. Preço de produto compartilhado verifica todos os planos ativos afetados.
- Uma trava na linha do produtor coordena alterações de catálogo e contratação, com instâncias recarregadas após a espera. A validação de unidade/quantidade fracionada também ocorre nessa transação. Não há ensaio de carga; operações do mesmo produtor são serializadas por escolha de simplicidade para o MVP.
- Valores contratados, programações e replay idempotente permanecem preservados. Uma tentativa nova inválida não consome a chave de idempotência.

O backend também integra o complemento de filtros da MOB-17 (`cb3b996`/PR #17). Ele tinha entrado na branch da MOB-15 depois de seu merge e ainda não estava na main. O snapshot mobile já oferecia esses filtros; não foram removidos nesta atualização.

## Migrações e integração

A migração `0003` altera o padrão dos novos planos para inativo. A `0004` desativa ofertas antigas inválidas, preservando registros, assinaturas e programações. Ofertas válidas permanecem ativas. Reverter essa migração de dados não republica ofertas automaticamente.

Revisar os dados afetados e fazer backup antes da implantação; interromper escritas do código antigo durante a atualização/migração. Após análise e merge do PR backend, atualizar o serviço, executar as migrations e reiniciá-lo. Essas ações no ambiente compartilhado não foram realizadas nesta task.

## Entrega mobile e verificação

Snapshot OpenAPI, checksum/origem e tipos regenerados da revisão indicada. Documentados rascunhos e respostas 409 nos endpoints envolvidos, sem remover campos de leitura nem os filtros anteriores. Adicionado teste de contrato para esse fluxo e seus códigos. As telas existentes já consomem o envelope de erro; a gestão de planos/cestas será implementada na MOB-20 com criação em rascunho e publicação explícita.

- Backend: 184 testes aprovados em PostgreSQL 18.7 descartável, sem ignorados. Incluem idempotência/refresh concorrentes, ativação versus oitava cesta/preço zero, exclusões, unidade versus quantidade, contratação versus preço/desativação e espera observada pelo bloqueio real da linha. O cenário ampliado da migração também foi executado no PostgreSQL, verificando histórico preservado e oferta válida mantida.
- SQLite adicional: suíte com 182 testes aprovada, com oito testes de bloqueio ignorados explicitamente; os testes de publicação/contrato ampliados também foram conferidos separadamente. Essa execução não substitui o PostgreSQL.
- OpenAPI validado com `--validate --fail-on-warn`; checks de Django/migrations e diff aprovados. Novo CI backend com PostgreSQL 18 repete testes e exporta contrato.
- Mobile: lint, TypeScript, 131 testes, sincronização de contrato/fixtures e Prettier dos arquivos publicados aprovados. A formatação foi conferida com a versão de `tsconfig.json` que será publicada, preservando a edição local do usuário.

Não há tela ou módulo nativo novo, nem nova execução em aparelho nesta task. O PostgreSQL temporário foi encerrado após os testes. `.env.local`, alteração preexistente de `tsconfig.json` e plano original não versionado ficaram fora dos commits. Próxima task: MOB-20, gestão de planos, cestas e composição para o produtor.

Referências técnicas: [Django 6.1 — bloqueios](https://docs.djangoproject.com/en/6.1/ref/models/querysets/#select-for-update) e [banco de testes](https://docs.djangoproject.com/en/6.1/topics/testing/overview/#the-test-database).
