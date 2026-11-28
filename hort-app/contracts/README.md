# Contrato da API mobile

Baseline capturada em 19/11/2026 a partir do backend local, revisão `530f6b5e80578a22442eee849aee2623456ee547`. O arquivo `source.json` registra origem e SHA-256 do snapshot. A exportação não consulta dados de usuários nem configura homologação. A revisão atual consta em `source.json`; a MOB-23 acrescenta a documentação de erros da contratação/cancelamento, sem mudar seus payloads de sucesso. A exportação atual foi feita com PostgreSQL: os máximos de estoque/periodicidade são `2147483647`, conforme o banco de destino, em vez do limite int64 inferido anteriormente em SQLite.

- `openapi.json`: OpenAPI 3.0.3 original, sem acrescentar regras que o servidor ainda não implementou.
- `../src/shared/api/generated/schema.d.ts`: tipos derivados do snapshot; não editar manualmente.
- `../tests/fixtures/mobile-api.mts`: exemplos sintéticos de entrada/saída para desenvolvimento e testes. Não são contas ou dados cadastrados no servidor e não são importados pelo app.

## Comandos

```bash
npm run contracts:generate
npm run contracts:check
npm test
```

`contracts:check` compara o resultado do gerador com o arquivo versionado, confere o checksum do snapshot e compila as fixtures com os tipos atuais. `npm test` cobre invariantes das amostras e o utilitário de verificação da API. Os testes de invariantes não substituem validação runtime nem testes de permissões/transações do backend.

O gerador [openapi-typescript](https://openapi-ts.dev/cli) 7.13.0 declara TypeScript 5 como peer dependency. O app Expo usa TypeScript 6.0.3. Para preservar a versão do app, os comandos executam o gerador com TypeScript 5.9.3 em ambiente temporário/cache do npm, com ambas as versões fixadas. O projeto não recebe uma nova dependência. O primeiro uso requer acesso ao registry npm; os tipos versionados permitem compilar o app sem executar o gerador.

## Atualizar a baseline

Dentro do repositório do backend, exporte para arquivo temporário com banco isolado:

```bash
PYTHONDONTWRITEBYTECODE=1 DATABASE_ENGINE=django.db.backends.sqlite3 DATABASE_NAME=:memory: venv/bin/python manage.py spectacular --format openapi-json --file /tmp/hort-openapi.json --validate
```

No mobile:

```bash
npm run contracts:update -- /tmp/hort-openapi.json
npm run contracts:check
npm test
npm run lint
npm run typecheck
```

O comando de atualização aceita um arquivo JSON autocontido e só escreve o snapshot após a geração funcionar. Atualiza snapshot, tipos e checksum. Registre também a revisão real do backend em `source.json` e revise o diff antes do commit. Não atualize automaticamente durante o start do app ou em resposta a erro de rede.

Se exportar do servidor, use o endpoint `/api/schema/` com o cabeçalho `Accept: application/json`; inspecione o arquivo antes de importá-lo. A atualização é explícita para não substituir silenciosamente um contrato revisado.

## Verificar uma API em execução

```bash
npm run api:check -- --url https://API_DE_HOMOLOGACAO/api/v1/
# Somente para desenvolvimento local:
npm run api:check -- --url http://127.0.0.1:8000/api/v1/ --allow-http
```

O utilitário faz somente GET de `health/` e `/api/schema/`, exige `status: ok` e compara o schema servido com o snapshot. Não envia credenciais, não autentica, não valida conectividade do banco e não comprova que o celular acessa o servidor. Em homologação, a URL deve ser HTTPS e ser testada também pelo Android.

## Limitações observadas no schema atual

- O envelope `{error: {code, message, details}}` existe em `common/exceptions.py`. O OpenAPI descreve conflitos de publicação e, desde a MOB-23, contratação 400/409 e cancelamento 400/404. As fixtures correspondentes usam esses tipos; o envelope ainda não está documentado em todos os endpoints/status.
- Os perfis de `Usuario` são `string[]` no schema. A aplicação mantém a união cliente/produtor e sua validação em runtime; o schema ainda não enumera esses valores.
- Alguns filtros aplicados no backend não aparecem nos parâmetros OpenAPI. Consultar `plans/filters.py`, `products/filters.py` e `subscriptions/filters.py` antes de consumir filtros novos; documentá-los no backend na MOB-07.
- Alguns serializers de leitura/escrita compartilham schema. Campos `readOnly` não devem ser enviados pelo formulário; tipos derivados precisam separar a entrada real da resposta ao implementar os CRUDs. Não presumir que todo schema de resposta é payload válido.
- O limite de sete programações, dias únicos, correspondência exata com as cestas, estoque/unidade, transações e idempotência têm validações adicionais no servidor que tipos TS não expressam.
- Publicar exige de 1 a 7 cestas e total arredondado positivo desde a MOB-19; o snapshot documenta os códigos de conflito. Ver `../docs/MOB-19.md`. O valor final da contratação é calculado pelo servidor; não há contrato de cotação/aceite de preço.
