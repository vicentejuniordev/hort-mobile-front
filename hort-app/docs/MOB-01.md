# MOB-01 — Fundação mobile

Status: implementação disponível; aguardando supervisão no Android e aceite da integração real.

## Escopo

- Expo SDK 58 com TypeScript estrito e Expo Router em `src/app`.
- Rotas finas, telas por funcionalidade e componentes compartilhados fora de `src/app`.
- Acesso técnico com e-mail/senha, consulta de `/auth/me/` e guardas por perfis retornados pela API.
- Áreas iniciais de cliente/produtor, sem catálogo ou indicadores fictícios.
- Cliente HTTP com URL por ambiente, JSON, Bearer opcional, timeout, cancelamento e envelope de erro.
- Nenhuma repetição automática de requisições; nenhum token/senha em armazenamento ou logs.

O visual é provisório até a referência do Figma. A sessão é apenas em memória, sem refresh automático. SecureStore, bootstrap, refresh e logout com revogação são MOB-05. “Encerrar teste local” limpa somente a memória do aplicativo, e informa esse limite na tela. A alternância inicial apenas abre áreas permitidas; não implementa ainda a experiência final de seleção de modo.

## Executar no Android físico

1. Use Node.js 24 LTS e execute `npm ci` dentro de `hort-app`.
2. Copie `.env.example` para `.env.local` e ajuste `EXPO_PUBLIC_API_URL` para `http://IP_DO_COMPUTADOR:8000/api/v1/`.
3. Coloque computador e celular na mesma rede Wi-Fi. `127.0.0.1`/`localhost` no celular apontam para o próprio celular.
4. No backend, disponibilize o Django na rede com `venv/bin/python manage.py runserver 0.0.0.0:8000`. A configuração de desenvolvimento de `ALLOWED_HOSTS` deve aceitar o IP do computador. Libere a porta na rede local se necessário.
5. Antes de abrir o app, acesse `http://IP_DO_COMPUTADOR:8000/api/v1/health/` pelo navegador do celular. Deve retornar `{"status":"ok"}`.
6. Execute `npm start -- --clear` e abra pelo QR code no Android com uma versão do Expo Go compatível com SDK 58, ou um development build compatível.
7. Após alterar variáveis de ambiente, reinicie o Expo. A URL é pública; nunca coloque segredos em `EXPO_PUBLIC_*`.

O Expo Go serve a esta supervisão inicial com módulos incluídos no SDK. A configuração de development builds e distribuição pertence à MOB-04. HTTP só é aceito pelo código em desenvolvimento; homologação/produção exigem HTTPS. Um futuro binário próprio também precisa da configuração nativa apropriada se usar HTTP local.

## Roteiro de supervisão

- [ ] Abrir o app no Android: login técnico sem conteúdo cortado pelas barras do sistema.
- [ ] Usar “Verificar conexão com a API”: exibir confirmação real; falha deve permitir tentar novamente.
- [ ] Tentar senha incorreta: exibir o erro real e permanecer na área pública.
- [ ] Entrar com conta cliente real: consultar `/auth/me/` e abrir a área cliente com nome real.
- [ ] Repetir com produtor; se a conta tiver ambos os perfis, abrir as duas áreas.
- [ ] Conferir que uma conta sem o perfil não acessa a área correspondente por link direto.
- [ ] Encerrar teste local e usar Voltar: não recuperar a área privada.
- [ ] Fechar/reabrir o app: solicitar login novamente (limite intencional desta task).
- [ ] Testar teclado, rolagem e fonte ampliada no formulário.
- [ ] Parar a API: apresentar falha de conexão/timeout sem sucesso antecipado; restaurar e tentar novamente.

## Verificações e limites

Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run format:check`.

O bundle pode ser verificado com `npx expo export --platform android --output-dir /tmp/hort-mob-01-android`. Exportação comprova empacotamento JavaScript/Hermes; não comprova execução no aparelho nem gera APK instalável.

Na implementação, o contrato foi conferido no backend local e no OpenAPI servido em `/api/schema/`. O health check em `127.0.0.1:8000` respondeu `ok`, mas o IP LAN `192.168.18.25:8000` recusou a conexão. É necessário expor o backend na rede antes da supervisão no celular. Login real, `/auth/me/` autenticado e execução Android aguardam a supervisão. Não foram criadas contas ou alterados dados do backend. iOS ficou fora da validação por decisão do responsável.
