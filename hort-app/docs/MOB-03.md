# MOB-03 — Contrato, ambiente e regras do MVP

Atualização: 19/11/2026. Status: base de contrato e fixtures preparada; task ainda depende de homologação HTTPS, dados no ambiente e aceite das regras no backend.

## Contexto retomado

- PR #1: fundação em Expo SDK 58/TypeScript, cliente HTTP e login técnico. O responsável confirmou conexão e login no Android.
- PR #2: boas-vindas, escolha de perfil, componentes e inventário de telas. Integrado.
- PR #3: login redesenhado após supervisão visual. Integrado à main em `561a0c2`; o pedido de avançar foi recebido nesta conversa. Não marcar individualmente testes nativos não relatados.
- Manter uma task por vez, commits com escopo claro, PR revisável e validação Android pelo responsável. iOS segue fora da validação por decisão anterior.
- Preservados o plano original ainda não versionado e a alteração local preexistente de `tsconfig.json`.

## Decisões confirmadas pelo responsável

| Tema | Decisão | Situação |
| --- | --- | --- |
| Ambiente | Existe apenas desenvolvimento; ainda não há API de homologação HTTPS | Pendente provisionar e informar URL |
| Publicação de ofertas | Publicar somente planos com 1 a 7 cestas e valor positivo | Decisão aprovada; aplicação no backend ainda pendente |
| Social | Ícones visíveis com aviso de indisponibilidade | Preservado |
| Design de login | Nova composição clara solicitada pelo responsável | PR #3 integrado |

O total é calculado pelo backend pela soma dos produtos × quantidades, arredondada para duas casas decimais. `periodicidade_semanal` continua com o comportamento atual: não multiplica o valor e não define a quantidade de cestas. Os tipos e as amostras preservam esse contrato; não foi criada uma regra financeira no app.

Endereços continuam pertencendo à conta e não estão associados à assinatura. A programação representa recorrência semanal; nenhuma operação de entrega, status executado ou cobrança é prometida. Essas evoluções exigem contrato e processo próprios, conforme o plano.

## Entrega no repositório mobile

- Snapshot original `contracts/openapi.json`, 26 rotas e 40 schemas, gerado e validado diretamente do backend local.
- Origem e checksum em `contracts/source.json`; backend `530f6b5e80578a22442eee849aee2623456ee547`.
- Tipos gerados em `src/shared/api/generated/schema.d.ts`, sem dependência runtime.
- Login, conta e health check utilizam os tipos derivados; guardas/validação runtime permanecem.
- Comandos para atualizar, gerar e detectar divergências no contrato, além de tipar as fixtures.
- Fixtures sintéticas de cliente, produtor, dois perfis, cadastros, produtos, catálogo paginado/vazio, contratação, assinatura ativa/cancelada e erros. Valores decimais preservados como strings, sem contas locais ou fixtures em jornadas reais.
- `api:check` para verificar health e igualdade do schema de um servidor quando ele estiver disponível.

Instruções de reprodução e limitações em [contracts/README.md](../contracts/README.md).

## Aplicação da regra de publicação no backend

O código atual permite criar ofertas ativas sem cestas, com valor zero ou mais de sete cestas. A contratação de um plano com mais de sete cestas falha. Registrar a decisão não altera esse comportamento.

A implementação backend prevista para MOB-19 precisa contemplar:

1. Criar/editar rascunhos antes de publicar: impedir a criação inicial de plano ativo vazio sem impedir sua montagem posterior.
2. Publicar/ativar apenas se houver de 1 a 7 cestas e valor total positivo, com resposta de erro de domínio documentada.
3. Definir e aplicar o comportamento quando uma alteração em cesta/item/produto invalidar uma oferta já ativa, incluindo concorrência. Recomendação para revisão: recusar a alteração e orientar desativar a oferta antes de editá-la.
4. Validar também no comando de contratação para não aceitar ofertas que ficaram inválidas.
5. Atualizar OpenAPI e testar vazio, zero, sete, oito cestas e mudanças concorrentes no PostgreSQL.

Não houve alteração no backend nesta task. A regra aprovada não pode ser apresentada como aplicada até essa entrega. A decisão não acrescenta exigência de valor positivo por cesta individual: o critério confirmado é o total do plano.

## Homologação e dados de demonstração

O health check local em `127.0.0.1:8000` recusou conexão nesta retomada. Para prosseguir sem depender do servidor em execução, o contrato foi exportado do código com SQLite em memória e validado pelo drf-spectacular. Essa exportação não comprova disponibilidade da API, acesso ao banco ou alcance pelo aparelho.

Ainda falta definir a hospedagem e disponibilizar a URL HTTPS. Não foram criados serviços externos, domínio, contas de teste ou registros no banco existente. As amostras deste PR são fixtures de contrato e não um seed de homologação.

Ao disponibilizar o ambiente:

- Aplicar migrations e criar dados fictícios isolados de produção: cliente, produtor, perfis, produtos, plano com cestas e itens. Credenciais devem ser entregues por canal apropriado, sem commitá-las.
- Confirmar a revisão de backend servida e alinhar o OpenAPI com o snapshot por atualização revisada.
- Executar `npm run api:check -- --url https://HOST/api/v1/`.
- Configurar apenas a URL pública em `EXPO_PUBLIC_API_URL` e validar health/login e `/auth/me/` no Android.

## Verificação realizada e aceite

Lint, typecheck, compilação das fixtures, verificação dos tipos gerados e 20 testes (9 de transporte + 11 de contrato/utilitário) aprovados. Também foi confirmada a detecção de tipos desatualizados e a recusa de uma importação inválida sem alterar o snapshot. O bundle Android/Hermes foi gerado; ele não substitui execução no aparelho. Os testes do verificador usam respostas controladas; não comprovam a disponibilidade de um servidor real. Não foram rodados testes de concorrência do PostgreSQL nem criada build EAS, que pertencem às tasks correspondentes.

- [x] Contrato original exportado, validado e versionado.
- [x] Tipos derivados e fixtures verificáveis disponíveis.
- [x] Regra comercial de publicação decidida pelo responsável.
- [x] Limites de valor, periodicidade, endereço e recursos do MVP documentados.
- [ ] API de homologação HTTPS acessível pelo Android.
- [ ] Dados fictícios disponíveis no ambiente de homologação.
- [ ] Teste real de acesso e leitura autenticada no novo ambiente.
- [ ] Revisão do PR e aceite do responsável.

A MOB-03 não está encerrada. A infraestrutura e a implementação backend pendentes não devem ser simuladas no frontend. O pacote preparado permite revisar a integração e continuar assim que o ambiente estiver definido, mantendo a próxima task aguardando o aceite.
