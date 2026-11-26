# MOB-09 — Recuperação e redefinição de senha

Atualização: 26/11/2026. Implementação mobile preparada. Envio real por e-mail, link HTTPS com página de apoio e supervisão física Android pendentes.

## Continuidade do plano

O responsável confirmou o merge do PR #7 (MOB-05), integrado na main em `e6f4b72`, e autorizou a continuidade. Os cadastros de cliente/produtor das MOB-06/MOB-08 foram antecipados e integrados em entregas anteriores. Isso não encerra as pendências de backend da MOB-07 (limites de login/cadastro e cache compartilhado) nem de homologação HTTPS da MOB-03.

Esta entrega implementa a próxima jornada pública de telas, MOB-09, uma task por vez. A próxima jornada visual é Conta e endereços, MOB-10, após revisão e supervisão desta entrega. Não foi atribuído aceite físico a cenários que o responsável ainda não relatou.

## Telas e comportamento

- Login: ação “Esqueci minha senha”.
- `/recuperar-senha`: e-mail validado, carregamento, erros por campo, falha de rede, 429 e confirmação neutra após 202. Não revela se a conta existe e não afirma recebimento de e-mail.
- `/reset-password?uid=…&token=…`: nova senha e confirmação, mostrar/ocultar, teclado, validação local e erros reais do servidor. Credenciais ausentes, repetidas, malformadas ou acima dos limites não liberam o formulário.
- Token rejeitado ou expirado: saída clara para solicitar outro link. Senha fraca pode ser corrigida sem descartar o link.
- Confirmação 204: limpa a sessão local e mostra o login com aviso de sucesso e revogação das sessões anteriores. Sem login automático ou tentativa de renovar tokens já revogados. Se a limpeza segura falhar, a recuperação global bloqueia o acesso até concluí-la.
- POSTs não são repetidos automaticamente. Após resultado incerto na troca, a tela orienta tentar entrar com a nova senha antes de repetir.
- Um envio por vez; requisições canceladas ao desmontar. Trocar os parâmetros do link reinicia o formulário, sem conservar a senha anterior.

O inventário do Figma em `MOB-02_DESIGN_INVENTORY.md` não apresenta frame específico de recuperação. As duas telas compõem o layout de login redesenhado e aprovado pelo responsável, com `PublicScreen`, `Input`, `Button`, `BackButton`, Poppins, logo local e tokens existentes. Nenhum novo asset ou dependência nativa foi adicionado.

## API e links

Usa o contrato versionado: POST `auth/password-reset/` com `email` → 202 sem corpo; POST `auth/password-reset/confirm/` com `uid`, `token`, `password`, `password_confirm` → 204 sem corpo. Transporte público sem Bearer/refresh. Tipos dos payloads derivados do OpenAPI.

O backend atual gera os parâmetros e envia o link conforme `PASSWORD_RESET_URL`. Seu padrão é `http://localhost:3000/reset-password`, que não aponta para o aparelho. O app mantém o caminho `/reset-password` e o esquema `hort` já registrado no APK da MOB-05. Expo Router recebe os parâmetros sem um listener paralelo. As rotas de recuperação ficam fora da guarda de visitante para também aceitar o link quando houver sessão ativa.

Senha e dados do link não são persistidos em armazenamento nem registrados em logs do app. A URL contém o token necessário à recuperação; não compartilhar links reais em commits, PRs ou capturas de tela.

## Teste local no Android

O responsável informou que o e-mail ainda não está configurado. Nenhuma configuração do backend, banco real ou `.env.local` foi alterada nesta entrega. Para testar sem SMTP, reinicie a API de desenvolvimento a partir da pasta do backend:

```bash
PASSWORD_RESET_URL='hort://reset-password' \
EMAIL_BACKEND='django.core.mail.backends.console.EmailBackend' \
venv/bin/python manage.py runserver 0.0.0.0:8000
```

O backend continua precisando dos hosts/rede já usados pelo celular. Use uma conta de teste: a confirmação altera de verdade a senha e revoga suas sessões. Com esse backend de console, o link aparece no terminal da API, sem enviar mensagem para a caixa de entrada.

No frontend:

```bash
npm run start:dev -- --clear
```

Use o APK da MOB-05 já instalado; não precisa de nova build nativa, pois o esquema e os módulos permanecem os mesmos. Deixe o Metro acessível para carregar o JavaScript desta branch. A validação solicitada é somente Android.

1. No login, tocar em “Esqueci minha senha”, informar o e-mail e conferir a confirmação neutra.
2. Abrir no Android o link `hort://reset-password?uid=…&token=…` exibido pelo backend. Clicar em um link pode ser necessário; colar o esquema na barra de endereço de alguns navegadores inicia uma busca. Também é possível abrir por `adb shell am start -W -a android.intent.action.VIEW -d 'LINK_REAL' com.hort.mobile` com o aparelho conectado.
3. Repetir a abertura com o app em execução e após fechá-lo completamente. Não registrar esses casos como aprovados antes da supervisão no aparelho.
4. Conferir senha curta, confirmação diferente e senha rejeitada pelo Django; salvar uma senha válida, voltar ao login e entrar com ela.
5. Reabrir o link já utilizado: a confirmação deve rejeitá-lo e oferecer outro link. `/reset-password` sem parâmetros deve mostrar a recuperação de link.
6. Conferir teclado, fonte ampliada, Voltar, mostrar/ocultar e falha de conexão. Os endpoints compartilham o limite atual de cinco chamadas por hora por IP; 429 não dispara repetição automática.

Expo Go usa um link diferente: `exp://IP_DO_COMPUTADOR:8081/--/reset-password?uid=…&token=…`, com `npm run start:go -- --clear`. Para esse teste, `PASSWORD_RESET_URL` deve ser a parte anterior a `?` desse endereço. O esquema `hort://` pertence ao APK instalado, não ao Expo Go.

## Verificações e limites de aceite

- 66 testes aprovados no total: sete de recuperação e quatro novos cenários de limpeza/isolamento da sessão, além dos 55 anteriores.
- Integração dos clientes HTTP/recuperação e SessionManager com Django real isolado, SQLite em memória e e-mails em memória: 202 indistinguível para e-mail ausente, link `hort` gerado pelo serviço real, token expirado, senha fraca, confirmação 204, uso único, revogação de access/refresh anteriores, limpeza local, rejeição da senha antiga, novo login e 429. O servidor foi encerrado após o teste; nenhuma conta real foi alterada.
- Lint, TypeScript, Prettier dos arquivos da entrega, contrato sincronizado e exportação Android/Hermes.
- Alterações locais preexistentes em `tsconfig.json` e plano não versionado preservadas fora dos commits.

O recebimento na caixa de entrada depende de SMTP. Domínio HTTPS, Android App Links e página web de apoio para quem não tem o app instalado continuam na MOB-11 e na homologação; não foi publicado domínio ou configurado serviço de e-mail. A rota está preparada para o caminho de recuperação, mas o fluxo completo de e-mail com app aberto/fechado só poderá receber aceite após essa configuração e supervisão Android. Não há validação iOS, envio à Play Store ou nova build EAS nesta task.

Referências técnicas: [links para o app](https://docs.expo.dev/linking/into-your-app/), [parâmetros no Expo Router](https://docs.expo.dev/router/reference/url-parameters/) e [rotas protegidas](https://docs.expo.dev/router/advanced/protected/).
