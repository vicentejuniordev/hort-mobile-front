# MOB-05 — Sessão persistente, renovação e logout

Atualização: 23/11/2026. Implementação preparada; supervisão física Android e revisão do PR pendentes.

## Comportamento

- Login só libera a área privada depois de receber access/refresh, consultar os perfis atuais em `auth/me/` e persistir o par completo no SecureStore.
- Abertura do app espera a leitura segura e a consulta de conta antes de escolher a navegação. Sem rede, mostra recuperação com nova tentativa e conserva as credenciais.
- Cada 401 privado participa de uma única renovação compartilhada. O par rotacionado é persistido antes de repetir cada chamada uma vez. Um 401 antigo recebido depois da rotação usa o access atual, sem renovar outra vez. Login e refresh usam transporte público e não entram no mecanismo.
- 403, 409, 429, falha de rede em consulta e timeout de escrita não renovam tokens nem repetem escritas automaticamente.
- Sair exige confirmação e informa que a API encerra todas as sessões da conta. O app apaga as credenciais e tenta o logout real; access expirado pode ser renovado uma vez para concluir a revogação. Saída offline é informada como local, sem afirmar revogação no servidor.
- Respostas da sessão anterior são canceladas/descartadas. Persistências são serializadas; uma gravação que já começou termina antes da limpeza do logout. Uma conta nova não começa login enquanto o logout anterior está em andamento.
- Não há cache de consultas ou rascunhos privados persistidos nesta etapa. Dados de conta em memória e telas privadas são descartados ao sair; requisições antigas não entregam respostas à próxima conta.

## Armazenamento e falhas

`expo-secure-store` na versão compatível com SDK 58; plugin configura exclusão do backup Android. Uma única chave `hort.auth.session.v1` guarda versão do formato, URL da API, par access/refresh e marcador de renovação pendente. Senha, nome, e-mail e perfis não são persistidos. Access fica também em memória durante o uso. O navegador conserva a sessão apenas em memória, sem localStorage; a validação solicitada continua exclusivamente Android.

A URL da API vincula as credenciais ao ambiente. Trocar a URL requer novo login, sem enviar tokens ao outro destino. JSON inválido, credenciais incompletas ou renovação interrompida também exigem novo login.

Antes do POST de refresh, o app grava um marcador pendente. Se fechar durante a rotação ou perder a resposta, não reutiliza automaticamente um refresh que o servidor pode ter consumido: solicita login. Esse caso difere de uma consulta comum sem rede, que preserva a sessão e permite nova tentativa. Se o marcador não puder ser gravado, a renovação nem é enviada. Se o par novo não puder ser salvo, o app limpa o estado incompleto.

Falhas de leitura/escrita segura não simulam sucesso. Ao limpar, se a exclusão nativa falhar, tenta sobrescrever o valor com `null`. Se ambas falharem, bloqueia a navegação e exige concluir a limpeza antes de permitir novo acesso. Não se pode afirmar que credenciais foram removidas do aparelho enquanto a gravação/exclusão nativa falha.

## Integração para as próximas tasks

- `src/shared/api/client.ts`: transporte público para login, cadastro, recuperação e health.
- `src/shared/session/runtime.ts`: `authenticatedApi<T>(path, options)` para consultas/mutações privadas; associa Bearer, cancela por sessão e coordena renovação.
- `src/shared/session/manager.ts`: regras independentes de React/Expo, verificadas com transporte e armazenamento injetados.
- `SessionProvider`: assinatura do estado pelo React, recuperação inicial e ações de login/logout/repetição.

Não usar o transporte público com tokens próprios em novos hooks privados, pois isso ignora a coordenação de sessão. O contrato atual de logout retorna 204 e revoga todas as sessões JWT; não criar uma ação que prometa logout remoto apenas do aparelho.

As telas de recuperação e o diálogo de saída usam o tema e os componentes atuais. O layout das telas de login/cadastro continua o aprovado; esta task não implementa novas telas de domínio do Figma.

## Verificação

- 54 testes no total, incluindo 27 cenários de sessão: bootstrap, rotação realista, 10 chamadas concorrentes, 401 tardio, limite de repetição, erros de rede/armazenamento, isolamento entre contas, cancelamento e respostas tardias durante logout.
- Integração do gerenciador e cliente HTTP com Django real em servidor isolado, SQLite descartável em memória e access de dois segundos: cadastro/login/bootstrap, 10 leituras expiradas com um único refresh, par rotacionado salvo, refresh antigo rejeitado, logout 204 e rejeição de tokens de outra sessão. Nenhuma alteração no banco de desenvolvimento.
- Lint, TypeScript e Prettier dos arquivos da entrega; contrato sincronizado; Expo Doctor 20/20; exportação Android/Hermes.
- `tsconfig.json` e o plano original já estavam alterado/não versionado e foram preservados fora dos commits. O CI valida o tsconfig versionado.

## APK e supervisão Android

O novo módulo nativo exige APK de desenvolvimento atualizado; o APK anterior da MOB-04 não inclui SecureStore. Expo Go SDK 58 também inclui o módulo e pode ser usado com `npm run start:go -- --clear`.

A distribuição permanece por APK interno, sem Play Store, conforme decisão do responsável. `versionCode` Android atualizado para 2. Projeto Expo existente: `@vicentedev/hort-app`, ID `24af1435-fcb8-4131-a7c0-f74efa5fd51e`.

A primeira tentativa de build remota foi bloqueada pela revisão automática por considerar não comprovada a autorização para exportar o código ao EAS e o destino. A vinculação ao projeto existente e as exclusões do pacote estão sendo verificadas antes de uma nova tentativa. Nenhum APK novo foi gerado até este registro.

Roteiro no aparelho:

1. Entrar como cliente/produtor; fechar totalmente e reabrir o app com API/Metro acessíveis. A conta deve ser recuperada após `/auth/me/`.
2. Sem conexão na abertura, conferir recuperação e nova tentativa. Ao voltar a rede, a conta deve voltar sem digitar a senha.
3. Conferir confirmação de saída e seu alcance; cancelar preserva a sessão. Confirmar online deve encerrar sessões da conta. Offline deve informar apenas saída local.
4. Fechar/reabrir após sair: a área privada não deve voltar. Entrar com outra conta deve mostrar somente os dados dela.
5. Expiração real e concorrência foram verificadas no ambiente isolado; a supervisão de armazenamento seguro/teclado/navegação continua dependente do Android físico.

Após esse aceite, o cadastro de cliente/produtor já antecipado será considerado na sequência do backlog: a próxima entrega ainda não executada é MOB-07 (contratos/limites de autenticação no backend), seguida das tarefas de conta/recuperação. A ordem será retomada pelo estado real dos critérios, sem declarar tarefas concluídas apenas pelo merge.

Fontes: [SecureStore SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/), [autenticação no Expo Router](https://docs.expo.dev/router/advanced/authentication/) e contrato versionado neste repositório.
