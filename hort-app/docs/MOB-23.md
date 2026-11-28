# MOB-23 — Validação transacional e preparação de beta

Complemento backend: [PR #20](https://github.com/vicentejuniordev/hort-backend/pull/20), contrato da revisão `dc943abfb8b041fabbde8e3c82a6cfd4e4c5cdee`.

28/11/2026, após merge da MOB-22/PR #20 em `c52080c`. Branch mobile `feat/mob-23-subscription-validation`; complemento backend `feat/mob-23-beta-readiness`, preparado em checkout isolado sobre `0599526`.

## Entrega

A task adiciona um verificador HTTP reproduzível usando o cliente HTTP, a sessão e `SubscriptionCheckout` reais do app. Ele usa os dados sintéticos gerados pelo novo comando backend `seed_mobile_beta`, testa o fluxo completo e grava um checkpoint privado para verificar replay após restaurar o banco. Não cria telas, muda o contrato de sucesso nem adiciona dependências.

O OpenAPI agora descreve contratação 400/409 e cancelamento 400/404; o cabeçalho de idempotência documenta que payload e ordem devem ser preservados. Snapshot, origem/checksum, tipos gerados e fixtures de erro tipadas foram sincronizados. A documentação do contrato foi atualizada para distinguir erros já descritos daqueles ainda não documentados em outros endpoints. A exportação agora usa PostgreSQL: `stock` e `periodicidade_semanal` passam a documentar o máximo real de `PositiveIntegerField` nesse banco, `2147483647`, em vez do limite int64 anunciado pela exportação anterior em SQLite. Não há alteração de coluna/migration; é alinhamento do contrato ao banco de destino.

## Cenários reproduzíveis

- Payloads sem programação, com cesta ausente, dias repetidos e dia inválido retornam 400, sem nova assinatura. Uma cesta adicionada entre a revisão e o POST também invalida o payload anterior; retirar a cesta permite continuar.
- Publicar rascunhos vazio/com oito cestas retorna 409 `publicacao_cestas_invalidas`; publicar sem valor retorna `publicacao_valor_invalido`. Oferta ativa de sete cestas é consultável.
- A revisão registra referência `12.50`. Alterar o preço do produto gera `16.00` no servidor; o comando apresenta esse valor real. Não há cotação/aceite de preço no contrato atual. Preço zero que invalidaria ofertas ativas é recusado com 409 e a alteração é revertida.
- O transporte perde a primeira resposta 201 depois do commit. Outra instância do comando restaura a mesma intenção e repete chave/payload após desativar a oferta: exatamente uma assinatura nova e valor `16.00`.
- Reordenar as programações da mesma chave retorna 409 `idempotency_conflict`. Outra chave para o plano desativado retorna `plano_inativo`. A chave confirmada continua devolvendo o recibo original.
- Outro cliente recebe 404 ao consultar/cancelar essa assinatura. Histórico ativo/cancelado de outro plano desativado permanece legível pelo proprietário.
- Cancelamento repetido preserva resposta/data/programações. Replay da contratação conserva o recibo original, enquanto GET informa a situação atual cancelada.

O backend acrescenta testes de falha na segunda programação e no registro da chave, garantindo rollback de assinatura/programações/idempotência; cancelamento com falha preserva o status ativo. Testes PostgreSQL cobrem mesma chave com dados diferentes, cancelamentos concorrentes e replay concorrente com cancelamento, além da concorrência anterior de catálogo/refresh. O seed testa falhas no banco e no manifesto, recusa banco/arquivo já preenchidos e não imprime senhas.

## Executar em ambiente isolado

Integrar primeiro o complemento backend e usar um banco dedicado, vazio e migrado. O seed não faz reset/upsert nem altera contas existentes. Ele cria produtor, dois clientes com endereços, ofertas ativas de duas/sete cestas, rascunhos inválidos e histórico ativo/cancelado de plano desativado. Senhas aleatórias e IDs ficam somente no manifesto 0600; são dados sintéticos, sem convite/cadastro de participantes reais ou provisionamento de homologação.

No backend, com `DATABASE_*` apontando exclusivamente ao banco de ensaio:

```bash
python manage.py migrate --noinput
python manage.py seed_mobile_beta --manifest /tmp/mobile-beta.json
python manage.py runserver 127.0.0.1:8213 --noreload
```

No mobile:

```bash
npm run subscriptions:check -- \
  --url http://127.0.0.1:8213/api/v1/ --allow-http \
  --manifest /tmp/mobile-beta.json --checkpoint /tmp/mobile-beta-checkpoint.json
```

O comando escreve nos dados sintéticos do manifesto. Confere nomes/IDs das contas e do plano antes das mutações. `--allow-http` aceita somente loopback; fora disso exige HTTPS. Não usa `.env.local`, tokens de outra sessão, credenciais em argumentos nem fixtures importadas pelo app. O checkpoint deve ser um arquivo novo e também recebe modo 0600. Cada execução completa parte de uma fixture nova: ela altera preço, desativa a oferta e cancela a assinatura criada. Não repetir como um health check contra dados compartilhados.

## Migração, backup e restauração

Não há migration nova na MOB-23. Foram verificados checks, migrations pendentes e plano de migração do backend. O runbook backend `docs/MOB-23.md` descreve como revisar o impacto da migração `plans.0004_unpublish_invalid_offers`, atualizar código/migrations sem escritas antigas e restaurar em outro banco novo. Reverter código não reativa ofertas nem desfaz alterações de dados automaticamente.

No ensaio, encerramos a API, exportamos o PostgreSQL 18.7 em formato custom e restauramos em outro banco vazio com `pg_restore --exit-on-error --single-transaction`. `migrate --check` aprovou o destino. Exportações completas via `dumpdata --all --indent 2` tiveram o mesmo SHA-256: `ebce023ff36cc8d481a86427dd5cad8346f42c08c789234f2a1cf0464566ac7e`.

Após iniciar a API com o banco restaurado e a mesma chave de assinatura JWT:

```bash
npm run subscriptions:check -- \
  --url http://127.0.0.1:8213/api/v1/ --allow-http \
  --manifest /tmp/mobile-beta.json --checkpoint /tmp/mobile-beta-checkpoint.json --replay
```

O replay real passou: autenticação, resposta original idêntica, valor contratado preservado, GET cancelado, duas programações e nenhuma nova assinatura. O CI backend também passa a migrar/gerar fixture, exportar/restaurar em um banco novo, conferir migrations e comparar os dados completos. Manifests, senhas e dumps não são publicados como artifacts.

## Verificação e limites

- Backend: 200 testes aprovados no PostgreSQL 18.7, sem ignorados; quatorze novos. OpenAPI validado com `--validate --fail-on-warn`; checks/migrations e diff aprovados.
- Mobile: lint, TypeScript, 179 testes e contrato/fixtures aprovados. O verificador `.mts` também passa sua checagem própria incluída em `npm run typecheck`, executada pelo CI existente. Prettier dos arquivos entregues aprovado.
- API Django/JWT real sobre PostgreSQL descartável, em loopback; nenhuma alteração no checkout, serviço ou banco de desenvolvimento. O banco restaurado ficou separado da origem durante a conferência.
- A alteração preexistente de `tsconfig.json` e o plano original não versionado foram preservados fora dos commits. A formatação completa local continua apontando somente esse `tsconfig.json`; a configuração versionada também foi conferida separadamente.

Não houve mudança de UI/Expo/React Native, nova build nativa, teste em aparelho, homologação HTTPS ou restauração em produção. O ensaio não é teste de carga e não implementa cobrança, logística ou exclusão de conta. Supervisão Android/iOS, e-mail real e dependências das demais tasks continuam pendentes. Os dados de beta foram preparados e testados apenas no ambiente descartável; não foram instalados no ambiente compartilhado.

Próxima task: MOB-24, completar prévia/desativação/exclusão e automatizar a jornada produtor → cliente. Merge do backend deve preceder a integração do verificador mobile.

Fontes: [transações Django 6.1](https://docs.djangoproject.com/en/6.1/topics/db/transactions/), [comandos Django](https://docs.djangoproject.com/en/6.1/howto/custom-management-commands/), [pg_dump 18](https://www.postgresql.org/docs/18/app-pgdump.html) e [pg_restore 18](https://www.postgresql.org/docs/18/app-pgrestore.html).
