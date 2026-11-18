# MOB-02 — Experiência pública e base visual

Status: implementação e verificações locais realizadas; aguardando aprovação visual e supervisão no Android. MOB-01 teve conexão e login confirmados pelo responsável em 18/11/2026, conforme registro no PR #1.

## Entrega

- Inventário de telas web/Figma, jornadas, formulários e lacunas de contrato em [MOB-02_DESIGN_INVENTORY.md](./MOB-02_DESIGN_INVENTORY.md).
- Boas-vindas, escolha de perfil e experimento de login nativos, usando as referências `27:5`, `25:3` e `310:809` do Figma.
- Tema, componentes de formulário/botão/aviso e fontes Poppins/Istok Web empacotadas no app.
- Logo, ícones e ilustrações originais em `assets/brand` e `assets/auth`, sem dependência das URLs temporárias do Figma.
- Login real já existente preservado: POST `/auth/login/`, GET `/auth/me/` e guardas por perfis.
- Validação de campos, erros de campo da API, estado de envio e nova tentativa após falha. A senha continua oculta e apenas em memória.

Os ícones sociais abrem um aviso de indisponibilidade, conforme decisão do responsável. A escolha de cliente/produtor abre um aviso de cadastro em breve e oferece o login existente. Cadastro real permanece nas MOB-06/MOB-08; nenhuma conta local ou sucesso fictício foi introduzido.

## Diferenças intencionais do Figma

- Login aceita somente e-mail, conforme a API.
- Texto da escolha de perfil fala em planos e não promete operação de entrega.
- Áreas de toque de pelo menos 48 dp e rolagem em telas menores/fonte ampliada. Botões de perfil têm altura maior que os 36 px do design.
- Mensagens de erro/carregamento e avisos acrescentados aos fluxos.
- “Verificar conexão com a API” permanece no rodapé do login somente em desenvolvimento, para a supervisão com Expo Go.

## Verificações realizadas

- `npm run lint`: aprovado.
- `npm run typecheck`: aprovado, inclusive com o `tsconfig.json` local preexistente.
- `npm test`: nove testes de transporte aprovados.
- Prettier dos arquivos do escopo: aprovado. O `npm run format:check` global aponta somente a formatação do `tsconfig.json` alterado localmente antes da task; esse arquivo foi preservado e fica fora dos commits.
- `npx expo export --platform android --output-dir /tmp/hort-mob-02-android`: bundle Hermes e assets gerados. Isso não produz APK nem comprova execução nativa.
- Preview web em viewport 393×852 comparado aos renders do Figma: fontes carregadas, imagens não vazias, callsites e geometria conferidos, sem erros de execução.
- Preview em 320×640: três telas sem overflow horizontal; conteúdo acessível por rolagem.
- Interações verificadas no navegador com respostas interceptadas apenas pela ferramenta externa de teste: avisos sociais, escolha de perfil, campos obrigatórios sem envio, 401, validação 400 por campo, falha de rede/nova tentativa, login cliente/produtor, consulta de `/auth/me/` e encerramento local. Nenhuma fixture está no app nem foi enviada à API real.

As capturas de inspeção ficaram em `/tmp/hort-mob02-{welcome,login,profiles}.png` e equivalentes com sufixo `-320`. A comparação no navegador auxilia o layout; a aprovação final é no Android. Não havia aparelho conectado por ADB. iOS permanece fora da validação por orientação do responsável.

## Supervisão no Android

Com backend e `.env.local` já configurados como na MOB-01, execute `npm ci` se necessário e `npm start -- --clear`; reabra pelo QR code no Expo Go compatível com SDK 58.

- [ ] Abertura mostra boas-vindas com logo, Poppins e cores do Figma, respeitando as barras do sistema.
- [ ] “Vamos lá!” abre a escolha de perfil; Voltar retorna à entrada.
- [ ] “Sou Cliente”/“Sou Produtor” informam cadastro em breve; “Já tenho conta” abre o login.
- [ ] “Faça Login” e “Cadastre-se” navegam corretamente.
- [ ] Google/WhatsApp/Facebook abrem o aviso de indisponibilidade; “Entendi” e Voltar do Android fecham o aviso.
- [ ] Campos vazios/e-mail inválido mostram erro; Avançar muda o foco para senha e Enviar tenta o login.
- [ ] A senha fica oculta; teclado não impede rolar até o botão de entrar.
- [ ] Conta real de cliente/produtor entra na área correspondente; erro real permite corrigir e tentar novamente.
- [ ] Botão de conexão continua acessível no rodapé do login em desenvolvimento.
- [ ] Tela estreita e fonte ampliada permitem ler, rolar e acionar todos os controles.
- [ ] Cores/componentes e diferenças intencionais aprovados pelo responsável.

## Aceite e sequência

Inventário e decisões estão documentados, e o protótipo público está navegável. A task aguarda revisão do PR e os itens de supervisão acima. Validação de teclado, barras do sistema, leitor de tela e fontes no runtime nativo não é substituída pelo preview web. As próximas tasks só começam após a supervisão; MOB-03 trata homologação/contratos/regras, MOB-04 trata EAS/builds e navegação do produtor.
