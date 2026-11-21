# MOB-04 — Base Android, EAS, CI e navegação do produtor

Atualização: 21/11/2026. Status: configuração e navegação preparadas; APK EAS e aceite em aparelho ainda pendentes de conta/login Expo.

## Contexto e escopo

Os PRs #4 e #5 foram aprovados e integrados pelo responsável. O PR #5 teve como base `chore/mob-03-api-contract` e foi integrado após o merge dessa branch na `main`; portanto seu cadastro ainda não estava na `main`. Esta branch integra aquele histórico aprovado para preservar o cadastro na próxima entrega.

A supervisão do cadastro foi confirmada pelo responsável. A validação continua somente Android, conforme decisão da conversa. As pendências de homologação HTTPS da MOB-03 permanecem: integrar o PR de contrato não provisionou o ambiente.

Esta entrega prepara a MOB-04. A persistência de sessão/refresh/logout global continua na MOB-05; CRUD de produtos na MOB-16 e gestão de planos/cestas na MOB-20. Não avançamos essas tasks com dados de demonstração.

## Navegação e Figma

Referências consultadas pela skill `figma:figma-design-to-code`: [inicial do produtor, 57:230](https://www.figma.com/design/3t53HvlVWuJpmDmpJDC8rU/HORT?node-id=57-230) e [gestão, 219:460](https://www.figma.com/design/3t53HvlVWuJpmDmpJDC8rU/HORT?node-id=219-460).

- Expo Router com abas Resumo, Produtos, Planos e Conta, conforme a navegação proposta no plano. Rótulos substituem os ícones de mensagens/entregas do protótipo, pois essas funcionalidades não fazem parte desta navegação.
- Barra verde, aba ativa verde claro, Poppins, cabeçalho HORT e cards claros com borda preservam a linguagem do design. Os três SVGs do cabeçalho foram comparados byte a byte com os assets retornados pelo Figma e são os mesmos já existentes no projeto. Dimensões nativas: 402.402×171.222, 20×21.8841 e 20×19.
- Nome, e-mail e perfis vêm da sessão real validada em `/auth/me/`. O resumo oferece atalhos navegáveis. Produtos e Planos identificam explicitamente a gestão como disponível em atualização futura; não apresentam um estado vazio fictício da API.
- Ganhos, cestas para enviar, entregas concluídas, gráfico, notificações e foto de horta não são simulados. Este é o esqueleto de navegação, não a implementação integral do dashboard do Figma.
- As rotas continuam protegidas pelo perfil atual no layout raiz. A troca para a área do cliente aparece apenas quando a conta também possui esse perfil.
- A saída mantém o comportamento local existente e informa seu alcance; não é apresentada como revogação no servidor.
- `anchor: 'resumo'` com `backBehavior="initialRoute"`, conforme Expo Router SDK 58. Área segura inferior e alvos de pelo menos 48 dp.

## Builds

`expo-dev-client` instalado por `npx expo install`, na versão compatível com SDK 58. Nenhum diretório nativo foi criado/editado.

| Perfil EAS | Resultado | Ambiente |
| --- | --- | --- |
| development | APK com ferramentas de desenvolvimento, para conectar ao Metro | development |
| preview | APK interno sem Metro | preview |
| production | AAB para futura distribuição | production |

Identificador Android preparado: `com.hort.mobile`, `versionCode: 1`; confirmar a titularidade/identificador antes de qualquer submissão à loja. Não há owner/projectId inventado no app: serão gravados ao vincular o projeto real. Versões nativas ficam locais. Nenhum envio às lojas ou atualização OTA foi configurado/disparado.

`.easignore` mantém os ignores do projeto e exclui arquivos `.env` locais do upload. Configure `EXPO_PUBLIC_API_URL` no ambiente EAS correspondente quando for gerar preview/produção; só a URL pública, sem credenciais. O hook `eas-build-post-install` impede esses dois perfis sem URL HTTPS válida. Development conecta ao Metro, que lê a URL de desenvolvimento em `.env.local` no computador; celular e API ainda precisam se alcançar na rede. `127.0.0.1` no celular aponta para o próprio celular.

Para continuar pelo Expo Go:

```bash
npm run start:go -- --clear
```

Depois de instalar o APK de desenvolvimento:

```bash
npm run start:dev -- --clear
```

## Criar a conta e vincular o projeto

1. Criar conta em [expo.dev/signup](https://expo.dev/signup).
2. No terminal em `hort-app`, executar `npx eas-cli@latest login` e `npx eas-cli@latest whoami`. Não compartilhar senha/token na conversa ou no repositório.
3. Informar o usuário/organização escolhido. Executar `npx eas-cli@latest init` para criar/vincular o projeto e conferir o `owner`/`extra.eas.projectId` real gravado na configuração. Não usar IDs de exemplo.
4. Gerar APK com `npx eas-cli@latest build --platform android --profile development`. Se houver perguntas de credenciais, responder no terminal local para usar a assinatura gerenciada pelo Expo.
5. Instalar pelo link real da build, iniciar o Metro com `npm run start:dev` e validar no Android.

Nesta execução, `npx eas-cli@latest whoami` respondeu `Not logged in`. Nenhum projeto externo, chave ou build foi criado. O responsável pediu orientação para criar a conta e recebeu os passos acima; a vinculação continua pendente.

## CI e processo de validação

Workflow na raiz: `.github/workflows/mobile-ci.yml`, em PRs, pushes na main e execução manual. Node 24, `npm ci`, lint, TypeScript, Prettier, tipos gerados/fixtures, testes e exportação do bundle Android. Actions oficiais fixadas por SHA. O CI não exige conta Expo nem acesso à API e não produz/publica APK ou executa builds pagos automaticamente.

Verificações locais realizadas: lint e typecheck; Prettier dos arquivos alterados; 27 testes; contrato sincronizado; configuração pública Expo resolvida; Expo Doctor com 20/20 verificações; bundle Android/Hermes. A alteração local preexistente de `tsconfig.json` e o plano original não versionado foram preservados. A versão de `tsconfig.json` já commitada também passou no Prettier; a alteração local não é incluída no PR.

Roteiro de supervisão Android: entrar como produtor, conferir nome e abas, abrir cada atalho, usar Voltar para retornar ao resumo, consultar Conta, conferir fonte ampliada/área dos gestos e encerrar o acesso local. Cliente sem perfil produtor deve continuar impedido de acessar essas rotas. Sem teste de execução iOS.

## Inventário de distribuição e aceite

| Item | Situação |
| --- | --- |
| Conta Expo e projeto EAS real | Aguardando criação/login do responsável |
| Chave Android | Não criada; será gerenciada no primeiro build |
| APK de desenvolvimento instalado | Pendente |
| Google Play Console/titularidade | Não informado; não necessário para o teste por APK interno |
| Apple Developer/App Store Connect | Não informado; fora da validação atual por decisão do responsável |
| API de homologação HTTPS | Pendente na MOB-03 |
| Execução Maestro/E2E nativa | Ainda não configurada; supervisão manual Android nesta entrega |
| CI remoto e revisão do PR | A verificar no PR desta entrega |

A MOB-04 não está concluída enquanto faltar a build instalável e a supervisão Android. O próximo pacote de desenvolvimento continua sendo a MOB-05 após esse aceite, considerando que o cadastro foi antecipado por solicitação do responsável.

Fontes técnicas: [configuração EAS](https://docs.expo.dev/build/eas-json/), [primeira build](https://docs.expo.dev/build/setup/), [development builds](https://docs.expo.dev/develop/development-builds/introduction/), [variáveis EAS](https://docs.expo.dev/eas/environment-variables/usage/) e [Router settings no SDK atual](https://docs.expo.dev/router/advanced/router-settings/).
