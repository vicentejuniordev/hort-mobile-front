# MOB-22 — Escolha de dias, contratação e cancelamento

Implementação: 28/11/2026, após a MOB-21/PR #19 integrada em `2b3c2b7`. Branch `feat/mob-22-subscription-checkout`.

## Jornada entregue

“Assinar Plano” no catálogo passa a abrir a rota fina `assinaturas/contratar`, com o ID real do plano. A tela usa as consultas existentes e o comando persistido da MOB-21. Há uma etapa de escolha, uma revisão da intenção salva e uma confirmação que mostra ID e `valor_contratado` devolvidos pelo servidor, com acesso à assinatura e à agenda.

Cada cesta tem um dia ISO de 1 a 7. Dias usados por outra cesta ficam indisponíveis e identificados por texto; limpar um dia permite reorganizar a semana, inclusive em planos com sete cestas. A seleção usa IDs, preserva a ordem das cestas e apresenta composição/quantidades reais. Não altera os itens do plano nem oferece personalização de produtos. Revisar valida o conjunto e persiste a intenção, sem POST de contratação. Mudar de etapa volta a rolagem ao topo.

A revisão mostra os dias salvos, o valor atual como referência e explica que o valor final vem do servidor. O contrato atual não tem cotação/aceite de preço: uma alteração concorrente pode mudar o valor contratado. Se as cestas mudarem antes do primeiro envio, a confirmação é bloqueada e é necessário escolher novamente os dias. Falhas de consulta não permitem confirmar uma nova compra com dados antigos.

O sucesso aparece apenas após resposta compatível. Se a confirmação da API chegar mas o recibo não puder ser persistido, o texto informa essa falha local sem transformar a contratação em falha ou induzir outra compra. Uma intenção confirmada é apresentada como contratação já registrada; contratar o mesmo plano novamente exige uma ação explícita, outro diálogo e outra escolha de dias, gerando nova chave.

## Retomada e estados de erro

A lista de Assinaturas tem “Retomar contratação salva”. Sem intenção, a tela orienta escolher uma oferta no catálogo. Dias ainda não revisados permanecem apenas na tela. Intenções revisadas/incipientes e recibos confirmados usam o armazenamento da MOB-21; entrar ou voltar à tela não faz POST automaticamente.

Resultado incerto força a apresentação dos dados salvos e a ação “Retomar mesma tentativa”, sem editar o payload ou exigir que a oferta continue no catálogo. Uma intenção incerta de outro plano bloqueia a nova compra e oferece retomar a anterior. As cestas são identificadas por ID quando o catálogo não está disponível. Consulta das assinaturas continua acessível durante a recuperação.

Erros de campo de plano/programação, inclusive aninhados por cesta/dia, aparecem com rótulos. Erros de domínio preservam as mensagens da camada de comando. Links inválidos, catálogo indisponível, ausência de intenção e falha no armazenamento têm saídas próprias. Restauração espera a operação compartilhada pendente, inclusive após troca de foco; resultados são verificados novamente depois de atualizar o estado local, impedindo confirmação tardia em outra sessão/tela.

## Cancelamento

O detalhe de uma assinatura ativa apresenta a ação de cancelamento. O diálogo informa o efeito e preservação do histórico; “Voltar” fecha sem gravar. Confirmar faz somente POST em `assinaturas/{id}/cancelar/`, sem payload adicional. A camada tipada recusa ID inválido, envio simultâneo, resposta incompatível e sucesso tardio após cancelamento local/mudança de sessão. Não repete erros automaticamente.

Após confirmação, o cache do detalhe atualiza apenas status/data, conservando os campos enriquecidos do GET. Listas e agenda são invalidadas no escopo da sessão. O valor contratado e as programações permanecem como histórico; cartões da agenda consultam a situação cancelada pelo mesmo detalhe. Falha de atualização posterior não converte resposta confirmada em erro de gravação.

Resultado incerto orienta consultar a situação atual e bloqueia outro cancelamento até uma leitura nova. Se a leitura confirmar cancelamento, a tela apresenta essa situação real; se continuar ativa, uma nova confirmação pode ser solicitada. Troca de foco cancela a operação local; isso não desfaz uma escrita já concluída no servidor.

Não há cobrança, pagamento, reembolso, rastreamento ou associação de endereço neste fluxo. Esses limites são apresentados onde ajudam a entender o que a contratação/cancelamento faz.

## Referências visuais e implementação

Consultados contexto detalhado e renders com a skill `figma:figma-design-to-code`: [resumo de compra, 254:543](https://www.figma.com/design/3t53HvlVWuJpmDmpJDC8rU/HORT?node-id=254-543), [variante de plano, 156:482](https://www.figma.com/design/3t53HvlVWuJpmDmpJDC8rU/HORT?node-id=156-482), [edição de cesta, 308:787](https://www.figma.com/design/3t53HvlVWuJpmDmpJDC8rU/HORT?node-id=308-787) e [confirmação, 364:872](https://www.figma.com/design/3t53HvlVWuJpmDmpJDC8rU/HORT?node-id=364-872).

Não há referência específica para a escolha semanal. Foram compostos controles nativos com os cartões claros, bordas e ações verdes existentes, resumo em `#F3F9EC` e confirmação em `#D2E6D9`. A tela de carrinho/venda avulsa e suas taxas, quantidades editáveis, fotos ilustrativas de alimentos e benefícios Premium não são o contrato desta jornada. Mantida a decisão anterior de usar as ofertas verdes sem categorias de plano inventadas.

Reutilizados Poppins, Button, SubscriptionPage, feedbacks e AccountHeader. Os únicos assets da nova tela são os do cabeçalho existente: forma `402.402 × 171.222`, folhas `20 × 21.8841` / `20 × 19` e seta `61 × 61`. Arquivos locais não vazios, callsites, geometria e renders foram conferidos. Nenhuma imagem nova ou URL temporária foi incorporada. O diálogo de confirmação não contém assets. Controles têm alvos de pelo menos 48 dp, seleção de rádio/estado acessível, texto de erro anunciado e layout flexível com rolagem.

## Verificação e supervisão

- Lint, TypeScript e 179 testes mobile aprovados, incluindo 12 novos de seleção/revisão, erros de campo, cancelamento, isolamento, concorrência e resposta incompatível. Também conferida a configuração TypeScript versionada, preservando a alteração local anterior.
- Contrato/tipos/fixtures sincronizados. Prettier aprovado nos arquivos entregues e demais arquivos da checagem, exceto `tsconfig.json`, cuja alteração preexistente foi mantida fora dos commits. `git diff --check` aprovado.
- Exportação Android/Hermes concluída. Não é APK nem teste em aparelho.
- Jornada real via Chromium/Playwright e Django/JWT com SQLite descartável em `/tmp`: login, catálogo, escolha, erro por dia ausente, bloqueio de dia duplicado, revisão sem POST, retorno à seleção preservando dias, resposta perdida após gravação, saída e retomada pela lista, replay com oferta desativada, confirmação de valor `12.50`, detalhe, desistência no diálogo sem POST e cancelamento confirmado. Verificados mesma chave/payload nos dois POSTs, exatamente uma assinatura nova e preservação das duas programações após cancelar. Agenda exibe a situação como histórico cancelado.
- Também exercitada a perda da resposta de cancelamento: a consulta seguinte confirma a situação cancelada, com apenas um POST de cancelamento. Nenhum erro JavaScript na jornada. Capturas de escolha/revisão/sucesso/diálogo/histórico inspecionadas; larguras 393 e 320 sem overflow horizontal nas telas verificadas.

As chamadas do navegador foram encaminhadas somente à API temporária. `.env.local`, banco/serviço de desenvolvimento, plano original não versionado e alteração preexistente de `tsconfig.json` ficaram intactos. Não houve alteração de dependência ou contrato/backend nesta task.

Para supervisão Android: usar development build que já inclua `expo-crypto` da MOB-21; abrir oferta, selecionar/limpar dias, revisar, voltar e confirmar; conferir valor retornado; retomar após fechar/reabrir o app; repetir com rede intermitente; cancelar com confirmação e conferir lista/agenda. Verificar fonte ampliada, leitor de tela, retorno Android e suspensão. Persistência real do SecureStore, ciclo de vida Android/iOS e acessibilidade nativa continuam pendentes; no navegador, a intenção permanece somente em memória e recarregar a página a descarta.

Próxima task sequencial do plano: MOB-23, validação transacional/erros do fluxo e preparação de beta. Não iniciar distribuição pública ou entregas reais sem resolver as dependências registradas no plano.

Fontes técnicas: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Router SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/router/), [índice Expo](https://docs.expo.dev/llms.txt) e [acessibilidade React Native](https://reactnative.dev/docs/accessibility).
