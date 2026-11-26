# MOB-10 — Conta e endereços

Atualização: 26/11/2026. Implementação preparada para revisão e supervisão física Android.

## Escopo e continuidade

PR #8 integrado pelo responsável em `9645f80`. A prioridade de Conta e endereços foi confirmada nesta conversa. Esta entrega segue uma task por vez: MOB-10. O merge não foi tratado como confirmação individual dos testes de e-mail/aparelho ainda pendentes na MOB-09.

- Cliente: abas Catálogo e Conta. A nova Conta consulta `/auth/me/` ao receber foco; nome, e-mail e perfis são reais e somente leitura. O Catálogo conserva a entrada provisória anterior até MOB-13/MOB-14; não apresenta ofertas inventadas.
- `/conta`: mesma tela compartilhada, protegida por sessão. A entrada anterior do cliente oferece acesso a ela.
- Produtor: a aba Conta existente ganha acesso aos endereços compartilhados. A reformulação integral de Conta do produtor/alternância de modo continua na MOB-12.
- Endereços: lista paginada, criação, consulta/edição e exclusão com confirmação. Campos: rua e número juntos em `rua`, bairro, cidade e UF. Sem CEP ou campos separados sem contrato.
- Não há indicação de endereço principal ou endereço de entrega vinculado. O app informa a ausência de vínculo com assinaturas e entregas.

Pendências de HTTPS (MOB-03), proteção de abuso/cache compartilhado (MOB-07) e SMTP/link HTTPS de recuperação (MOB-11) continuam abertas. Sem exclusão de conta antecipada ou publicação em loja.

## Referência visual e assets

Skill utilizada: `figma:figma-design-to-code`. Referência consultada com código detalhado e screenshot: [Conta do cliente, 128:584](https://www.figma.com/design/3t53HvlVWuJpmDmpJDC8rU/HORT?node-id=128-584).

A composição preserva cabeçalho HORT no canto superior direito, voltar circular, ilustração central de perfil, Poppins, cartões verdes claros e navegação inferior verde. O plano limita os controles às ações existentes: não foram portados favoritos, notificações, pagamentos, FAQ e edição de nome/e-mail sem endpoint. Assinaturas/agenda serão adicionadas nas respectivas tasks; a barra apresenta as duas rotas disponíveis nesta entrega.

Assets estáticos originais baixados do contexto Figma para `assets/account/`: ilustração genérica `profile-illustration.png` (512×512; exibida no círculo de 60,796 dp), `tab-home.svg` e `tab-account.svg` (22,1495×22,1495, dimensões de raiz preservadas). A ilustração é um avatar padrão, sem afirmar ser foto da conta. Ambos os SVGs são usados nos respectivos slots da navegação.

Cabeçalho e voltar reutilizam os assets locais existentes, correspondentes às referências já verificadas: `header-shape.svg` (402,402×171,222, recorte do cabeçalho), folhas (20×21,8841 e 20×19) e `arrow-circle.svg` (61×61). Call sites em `AccountHeader`/`BackButton`, `AccountScreen` e layout cliente; nenhum URL temporário do Figma em runtime. Arquivos e dimensões foram conferidos e os três novos assets constam no bundle Android. Comparação visual em aparelho, fonte ampliada e teclado permanecem na supervisão abaixo.

## Integração e estados

`features/addresses/model.ts` deriva tipos do OpenAPI e valida campos/IDs/páginas; `api.ts` conecta o serviço ao `authenticatedApi` da MOB-05. O transporte HTTP passa a aceitar PATCH/DELETE; Bearer, cancelamento por sessão e refresh coordenado permanecem centralizados. Nenhum proprietário é enviado no payload; campos extras são descartados pela validação.

A lista usa FlatList, 20 registros por página, ação de carregar mais e deduplicação por ID. O próximo número de página é construído localmente; URLs `next` do servidor não são usadas como destino de requisição autenticada. Ao voltar ao foco, a lista consulta novamente a primeira página, refletindo alterações confirmadas. Listas não são snapshots de concorrência: se outro dispositivo alterar a coleção durante paginação, atualizar a lista refaz a consulta.

Formulários usam React Hook Form/Zod, erros por campo, foco entre campos e UF normalizada em maiúsculas. A confirmação de exclusão pode ser cancelada. Sucesso só aparece depois da resposta do servidor; 404 oferece retorno à lista. 403/409/429 têm mensagens próprias. Falha inicial, vazio, carregamento, falha de próxima página e nova tentativa são distintos.

Escritas não são repetidas por erro de rede/timeout/5xx ou resposta ilegível. Se o resultado for incerto, o formulário impede reenviar e oferece consultar a lista. Somente um 401 privado passa pela renovação e repetição coordenadas já existentes. Requisições de leitura são canceladas ao perder foco; mutações são canceladas ao desmontar. Respostas de uma sessão anterior não são entregues pela camada autenticada.

Sem nova dependência ou módulo nativo. Estado de leitura restrito à instância de tela, sem cache global nem persistência dos endereços no aparelho. As guardas removem as telas privadas ao sair. A adoção da camada de cache de consultas do catálogo permanece na MOB-13; nenhum cache concorrente foi adicionado nesta task.

## Verificações

- 76 testes aprovados: nove novos de endereço e um de PATCH/DELETE com refresh compartilhado, além dos 66 anteriores.
- Integração real com Django isolado, SQLite em memória e contas fictícias de cliente/produtor: `/me/`, criação, normalização de UF, PATCH persistido, 22 endereços em duas páginas, DELETE 204 e posterior 404. Outra conta não consegue ler, alterar ou excluir endereço alheio (404); trocar de sessão conserva somente os endereços do usuário autenticado. Dados originais permaneceram intactos. Servidor isolado encerrado após o teste.
- Lint, TypeScript, Prettier dos arquivos da entrega, contrato sincronizado e exportação Android/Hermes aprovados.
- Nenhum dado do banco real ou `.env.local` alterado. `tsconfig.json` local e plano original não versionado preservados fora dos commits.

## Supervisão Android

Usar o APK de desenvolvimento da MOB-05 com a API acessível e o JavaScript desta branch:

```bash
npm run start:dev -- --clear
```

Também é possível usar `npm run start:go -- --clear` no Expo Go SDK 58. Não é necessário gerar novo APK, pois não houve alteração nativa.

1. Entrar como cliente e abrir Conta; conferir nome/e-mail, aba ativa, voltar, rolagem e área dos gestos. Não deve existir edição fictícia de dados pessoais.
2. Abrir Meus endereços e conferir o endereço criado no cadastro. Adicionar outro, voltar à lista, reabrir e editar; fechar/reabrir o app e confirmar os dados vindos da API.
3. Testar campos vazios, UF inválida, teclado, fonte ampliada e mensagens. Confirmar que rua e número são um único campo do contrato.
4. Pedir exclusão, cancelar e conferir que o endereço continua. Confirmar e conferir a remoção após atualizar a lista.
5. Sem rede, conferir erro e nova tentativa. Se um envio ficar incerto, consultar a lista antes de recriar o endereço.
6. Sair e entrar com outra conta; conferir que os endereços anteriores não aparecem. Abrir o acesso de endereços na Conta do produtor. O isolamento de IDs foi verificado também na integração real, sem depender de manipular IDs no aparelho.
7. Em coleção maior, carregar próxima página e atualizar a lista; nenhuma duplicação por ID deve aparecer. A integração isolada exercitou duas páginas; execução física permanece pendente.

Sem validação iOS, execução nativa automatizada ou aceite físico presumido. Após revisão e supervisão, retomar a próxima task do plano considerando as dependências reais de backend.

Referências técnicas: [Expo Router SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/router/), [foco das telas](https://docs.expo.dev/router/reference/focus-handling/) e [FlatList](https://reactnative.dev/docs/flatlist).
