# MOB-12 — Conta do produtor e alternância de modo

Atualização: 26/11/2026. Implementação preparada; revisão e supervisão física Android pendentes.

## Continuidade e decisões

O responsável confirmou o merge do PR #9/MOB-10 (`daa68b5`) e pediu continuidade com fidelidade aos detalhes do Figma. A MOB-11 segue com pendências de SMTP/link HTTPS e contratos de exclusão/histórico; esta entrega implementa a próxima task de telas, MOB-12, sem marcar aquelas dependências como resolvidas.

Após consultar a referência, o responsável aprovou explicitamente:

- Manter os cartões de horários, repasses/conta bancária e histórico do produtor com aviso de indisponibilidade ao tocar, pois não há API para essas funcionalidades.
- Usar a imagem padrão de horta do Figma, com o nome real retornado para a conta.
- Manter “Editar Perfil” com aviso de indisponibilidade. Nenhuma alteração fictícia de nome/e-mail foi implementada.

## Figma e layout

Skill: `figma:figma-design-to-code`. [Conta do produtor, nó 129:399](https://www.figma.com/design/3t53HvlVWuJpmDmpJDC8rU/HORT?node-id=129-399), consultado com código detalhado e screenshot. React Native/StyleSheet com os componentes e fontes existentes, sem Tailwind ou nova dependência.

- Canvas de referência de 393 dp, fundo branco, cabeçalho HORT e voltar circular reutilizados. Imagem padrão em 58×40 com raio 100; nome central em Poppins Bold 15,531 e link Poppins Medium 8,79. O nome real pode mudar a quebra de linhas; não é limitado ao nome fictício do protótipo.
- Seções “Gerenciar Loja” e “Finanças”; rótulos e ordem dos cinco cartões preservados. Cartões de 294 dp, raio 11,782, fundo `#D9E5D9`, padding 21/14 e ícones originais em seus slots. Em telas estreitas ou fonte ampliada, o conteúdo pode crescer e rolar em vez de cortar texto.
- Geometria de referência: perfil começa em y=74; primeira seção em y=219; cartões da loja em y≈246/316/386, seção financeira em y≈463 e seus cartões em y≈504/574, com o nome em duas linhas e fonte padrão. Insets nativos ficam fora desse sistema de medidas. A pequena ilustração de cebola de 4×4 em x=368/y=156 foi preservada.
- Barra inferior verde com os quatro ícones do Figma, indicador ativo `#64A249`, raio 16 e espaçamentos do protótipo. Os nomes acessíveis continuam Resumo, Produtos, Planos e Conta, conforme a navegação do plano; o ícone de avião não implementa entregas/chat. Área inferior respeita os gestos do Android.
- Ações adicionais de dados/endereço, modo e logout ficam após o bloco do protótipo, acessíveis por rolagem. Nenhum redesenho das outras telas do produtor foi realizado; somente sua barra compartilhada foi alinhada aos ícones da referência.

Assets novos locais em `assets/producer-account/`: imagem de horta, ícones de prédio/relógio/dinheiro/histórico, pequena cebola e SVGs de produtos/planos. O ícone de produtos do cartão corresponde exatamente ao `assets/auth/produce-basket.png` existente (checksum conferido); reutilizado sem duplicação. Cabeçalho, voltar e ícones de início/conta também reutilizam os arquivos existentes correspondentes ao design.

Os dois SVGs novos mantêm as dimensões de raiz 28×22,2077 e 24,15×22,0023. PNGs originais não foram editados. Arquivos não vazios, slots/call sites e dimensões efetivas foram conferidos; oito novos assets constam no bundle Android, sem URLs temporários de Figma em runtime. A conferência visual no aparelho permanece no roteiro, sem alegar comparação de screenshots nativas ainda não executada.

## Ações e dados reais

“Perfil da Horta” abre a Conta compartilhada com nome/e-mail consultados e acesso a endereços. “Meus produtos” abre a rota existente de Produtos, cuja gestão completa continua na MOB-16. Os outros cartões e “Editar Perfil” abrem os avisos aprovados, sem operações financeiras ou edição simulada. A imagem é identificada como padrão, não como foto enviada pela conta.

Conta do cliente, Conta compartilhada e Conta do produtor atualizam a sessão a partir de `/auth/me/` ao receber foco. Se a consulta falhar, o produtor conserva o nome da última consulta e oferece nova tentativa. Nenhum campo pessoal é editável sem endpoint.

## Alternância e isolamento

A sessão em memória passa a incluir `mode`, sempre derivado de perfis reais. No login/retomada, cliente é o padrão quando disponível; conta apenas produtora entra em produtor; conta sem perfil vai para Conta. O modo não é salvo junto aos tokens: reabrir uma conta com os dois perfis retorna ao padrão cliente.

O seletor aparece somente quando a sessão consultada possui cliente e produtor. Antes de alternar, consulta `/me/` pelo transporte autenticado, incluindo o refresh coordenado se necessário. Só altera o modo após a resposta. Se a permissão tiver sido removida, atualiza os perfis, escolhe somente um modo permitido e informa a indisponibilidade. Falha de rede conserva sessão/modo e permite tentar novamente. Não existe endpoint de adesão ao segundo perfil e nenhum perfil é criado pelo seletor.

Guardas da raiz exigem simultaneamente perfil e modo ativo. Ao trocar, o histórico da área anterior é removido pelo Expo Router, desmontando suas telas e seus estados. Um link da área inativa não ativa esse modo ou concede permissão. A rota compartilhada também pode trocar de modo e redireciona para a área correspondente.

Consultas concorrentes da conta usam revisão e geração de sessão: resposta antiga não desfaz a seleção recente, não restaura logout e não substitui a conta seguinte. AbortSignal é respeitado também antes de aplicar o resultado. Tokens, rascunhos e dados não são duplicados em um segundo armazenamento; não há cache global privado nesta etapa. Logout/limpeza segura da MOB-05 e o descarte dos dados de telas continuam ativos.

## Verificações

- 83 testes aprovados; sete novos de modo/perfis, incluindo retomada, dois perfis, permissão ausente/removida, rede, resposta tardia após logout/troca de conta, ordem de respostas e refresh.
- Integração com Django real isolado, SQLite e contas fictícias em memória: `/me/` com dois perfis, cliente → produtor com os mesmos tokens, consulta privada real, preservação do modo ao atualizar, remoção do perfil produtor com retorno ao cliente e 403 real, nova permissão consultada, logout e isolamento da conta seguinte. Nenhuma conta/banco real foi alterado; servidor isolado encerrado.
- Lint, TypeScript, Prettier, contrato sincronizado e exportação Android/Hermes aprovados.
- `tsconfig.json` local e plano original não versionado permanecem fora dos commits; `.env.local` não foi alterado.

## Supervisão Android

Não houve mudança nativa. Usar o APK da MOB-05 e o JavaScript desta branch:

```bash
npm run start:dev -- --clear
```

1. Entrar como produtor e abrir Conta. Comparar cabeçalho, foto padrão, nome real, tipografia, ícones, cores, cartões e barra inferior com o frame indicado. Conferir também tela estreita/fonte ampliada e rolagem.
2. Abrir “Perfil da Horta” e conferir nome/e-mail/endereço reais. “Meus produtos” deve abrir sua rota existente. Conferir o aviso individual de horários, repasses, histórico e editar perfil.
3. Na Conta, rolar após os cartões para dados/endereço, logout e seletor de modo. Conta de perfil único não deve oferecer a troca.
4. Com conta que já possua os dois perfis no backend, trocar para cliente e retornar pelo seletor. Voltar não deve reabrir a área anterior. O app não cria o segundo perfil; a conta precisa já tê-lo.
5. Sem rede, tentar alternar e conferir que o modo anterior é preservado. Reabrir conta com dois perfis deve selecionar cliente, conforme a política em memória documentada.
6. Sair, entrar com outra conta e conferir nome/endereço/modo corretos. Não registrar os testes físicos como aprovados antes da supervisão do responsável.

Sem validação iOS ou publicação em loja. A próxima task de implementação é a camada de catálogo (MOB-13), antes das telas de lista/detalhe MOB-14. As pendências de backend anteriores continuam separadamente registradas.

Fontes: [rotas protegidas do Expo Router](https://docs.expo.dev/router/advanced/protected/) e [SDK 58](https://docs.expo.dev/versions/v58.0.0/).
