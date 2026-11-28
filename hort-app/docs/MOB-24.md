# MOB-24 — Prévia e jornada produtor → cliente

Implementação sobre o merge da MOB-23 (`dd8cbc1`), na branch `feat/mob-24-offer-preview-e2e`. Usa o backend já integrado em `3872e9ecb12e47df8653a1ce74bb2700f30e33d6`; não exige alteração de API ou migration.

## Entrega

A gestão do plano passa a oferecer **Ver prévia da oferta**, inclusive para rascunhos. A tela mostra nome, categoria, periodicidade, disponibilidade, valor calculado pelo servidor e composição das cestas. Produtos e quantidades usam as mesmas consultas privadas e formatação do restante do app. Não há contratação ou publicação acidental pela prévia.

As cestas e os itens usam uma lista virtualizada. A tela identifica composição parcial, permite carregar as próximas páginas e recuperar falhas de consulta. O total vem do plano retornado pelo servidor, independentemente de quantas cestas foram carregadas. As consultas continuam isoladas por conta/modo e só ficam ativas com foco. A publicação e a desativação agora apresentam confirmação textual de sucesso. A exclusão protegida mantém a orientação existente para desativar a oferta e preservar assinaturas.

## Automação reproduzível

`npm run e2e:offers` prepara um banco SQLite novo em diretório temporário privado, migra, gera o manifesto sintético da MOB-23 e inicia Django e Expo em loopback. Ao terminar, encerra os serviços e remove banco/manifesto. A configuração de banco do checkout backend e `.env.local` do frontend não são usadas para o ensaio. A porta da API deve estar livre; o runner recusa um serviço existente nessa porta.

Com Node 24, dependências do frontend instaladas e um checkout do backend acima com suas dependências Python:

```bash
npx playwright install chromium
HORT_E2E_BACKEND_DIR=/caminho/para/hort-backend \
HORT_E2E_PYTHON=/caminho/para/venv/bin/python \
npm run e2e:offers
```

`HORT_E2E_PYTHON` é opcional se `python3` já tiver as dependências. `HORT_E2E_CHROMIUM` permite indicar um Chromium local; sem ele, usa o instalado pelo Playwright. As portas utilizadas são 8094 e 8214. Relatórios/capturas ficam em `test-results/`, ignorado pelo Git. Traces estão desabilitados para não registrar credenciais sintéticas digitadas no login.

Dois cenários usam as telas e respostas reais da API:

- O produtor cadastra produto, rascunho, cesta e quantidade; consulta a prévia vazia/completa e publica. Uma tentativa anterior de publicar sem cestas é recusada. Após sair e entrar como cliente, encontra e contrata a mesma oferta por `12.50`, com exatamente um POST bem-sucedido e uma programação. Voltando ao produtor, excluir retorna 409 e orienta desativação. Cancelar a confirmação não escreve; confirmar remove a oferta do catálogo. O cliente ainda encontra sua assinatura ativa com o valor preservado.
- Uma fixture adicional de 21 cestas exercita paginação e falhas de transporte na primeira/próxima página. O valor `131.25` permanece integral mesmo antes de carregar a última cesta. Cancelar a exclusão não escreve; confirmar exclui o rascunho sem histórico e a API passa a retornar 404.

A preparação do segundo cenário usa a API para criar a fixture longa; as ações sob teste usam a interface. O navegador encaminha requisições para Django em loopback para viabilizar CORS no teste web, sem simular respostas de negócio. Falhas de rede são injetadas somente no cenário de recuperação.

## CI e acesso ao backend

O workflow mobile tem um job `offer-e2e` com versões fixadas de actions e revisão fixa do backend. Como o backend é privado e o repositório frontend ainda não possui secret de acesso, esse job depende de configuração do mantenedor:

1. Criar o secret `HORT_BACKEND_READ_TOKEN`, com leitura de conteúdo somente do repositório backend.
2. Definir a variável `HORT_OFFER_E2E_ENABLED=true` no frontend.

Sem essa configuração, o job E2E fica explicitamente ignorado; os checks anteriores continuam obrigatórios e executados. Nenhuma credencial local foi copiada para o GitHub. A execução local não depende desses secrets.

## Referência visual

Consultados contexto e render do [detalhe verde, nó 57:377](https://www.figma.com/design/3t53HvlVWuJpmDmpJDC8rU/HORT?node-id=57-377), com a skill `figma:figma-design-to-code`. A prévia adapta o cartão de 308 px, fundo `#DDE0DB`, borda `#AABCA2`, cantos de 20 px e cesta de 22 px. Usa os componentes e fontes existentes, dados do contrato e composição abaixo do resumo. Não incorpora benefícios ou preço mensal fictícios do exemplo. Reutiliza `assets/auth/produce-basket.png` (`8967c.png` da referência); não há novos assets ou URLs temporárias em runtime.

## Verificação

- Lint, TypeScript, 179 testes unitários/integração existentes, contrato/fixtures e Prettier dos arquivos entregues aprovados. A formatação do `tsconfig.json` versionado foi conferida separadamente para preservar a alteração local do usuário.
- Dois testes Playwright aprovados com Django/JWT real. O checkout backend de teste tem conteúdo idêntico ao merge `3872e9e` fixado no CI.
- Capturas da prévia em 393 × 852 e 320 × 640 inspecionadas, sem overflow horizontal; também conferidos estados de proteção de exclusão, desativação e histórico preservado.
- Exportação Android/Hermes concluída. Serviços temporários encerrados e banco/manifesto removidos após o ensaio.

## Limites

O E2E é uma execução web do app Expo com Django/JWT real sobre SQLite descartável. Não substitui testes de concorrência PostgreSQL da MOB-23, nem comprova teclado, leitor de tela, áreas seguras ou ciclo de vida em Android/iOS. Exportar o bundle Android não produz APK nem distribuição interna. Esses marcos de aparelho/distribuição permanecem pendentes.

A alteração local preexistente de `tsconfig.json`, o plano original não versionado e `.env.local` ficam preservados fora dos commits. Próxima task do plano, após revisão/merge: MOB-25, na semana 7.

Fontes técnicas: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Router SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/router/), [configuração Playwright](https://playwright.dev/docs/test-configuration).
