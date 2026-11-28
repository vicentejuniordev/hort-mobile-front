# MOB-18 — Assinaturas, detalhe e agenda semanal

Implementação: 27/11/2026, após a MOB-17/PR #15, integrada em `d3af795`. Branch `feat/mob-18-subscription-screens` criada sobre a `main` atualizada. Interface implementada; supervisão em aparelho pendente.

## Escopo e navegação

A área Cliente agora tem as abas Catálogo, Assinaturas, Agenda e Conta. As rotas finas em `src/app/(cliente)/assinaturas/` abrem lista e detalhe; `agenda.tsx` abre a programação semanal. As telas e componentes ficam em `features/subscriptions/`, consumindo as consultas privadas da MOB-17 e as proteções de sessão existentes.

- Assinaturas: filtros Todas/Ativas/Canceladas, valor contratado, dias recorrentes, previsão de renovação para ativas, plano desativado e acesso ao detalhe pelo ID real.
- Detalhe: status e datas, valor contratado preservado, programação ordenada por dia/ordem/ID e composição atual do plano. Cestas sem programação e assinaturas legadas vazias são apresentadas explicitamente. Cesta ausente da composição atual continua identificada pelo ID na programação.
- Agenda: todos os dias ou um dia ISO de 1 a 7, paginação e acesso ao detalhe. O endpoint de programações não informa status: cada cartão consulta a assinatura correspondente, compartilhando o cache de detalhes entre cartões. Falha nessa consulta não presume assinatura ativa e apresenta situação não confirmada. Canceladas têm indicação textual de histórico.

Listas usam `FlatList`, IDs estáveis, atualização por gesto e carregamento explícito de páginas. Filtros reiniciam a posição da lista. Os estados distinguem carregamento inicial, vazio, falha inicial, atualização e falha de outra página. Falhas recuperáveis conservam dados com aviso de possível desatualização/incompletude; erros de acesso, contrato ou identificador ocultam a representação anterior. Uma falha ao carregar mais permite repetir a página pendente sem apagar as anteriores.

Atualizar a agenda invalida o prefixo privado de assinaturas/programações da sessão para também consultar novamente a situação dos cartões visíveis. As demais regras de isolamento, foco, cancelamento e renovação centralizada continuam nas camadas existentes. Não há cache privado persistente nem nova dependência.

## Referência visual e adaptações de domínio

Consultados código detalhado e render do frame [Minhas Cestas, 122:200](https://www.figma.com/design/3t53HvlVWuJpmDmpJDC8rU/HORT?node-id=122-200), usando a skill `figma:figma-design-to-code`. Reutilizados cabeçalho, folhas, seta, ícones de Catálogo/Conta, fontes e ilustração de cesta já locais. O ícone da aba Assinaturas foi baixado do asset `f6a88.svg` para `assets/subscriptions/tab-basket.svg`, com dimensões de raiz/exibição de 23,65 × 20. A ilustração dos cartões usa o mesmo `8967c.png` da referência, já em `assets/auth/produce-basket.png`, a 32 × 32. Nenhuma URL temporária é usada em runtime.

Mantidos cartões claros com borda, sombra, títulos e ações verdes. O fluxo flexível permite nomes extensos e fontes ampliadas; controles têm alvos de pelo menos 48 dp. A barra acomoda quatro abas com rótulos e usa um glifo de grade para a nova Agenda. Foram conferidos arquivos locais, dimensões e locais de uso dos assets; isso não substitui comparação visual renderizada.

Adaptações ao contrato e ao escopo do plano:

- A unidade consultada é a assinatura, que pode conter várias cestas. Nomes vêm de `plano_atual` e não são apresentados como snapshots históricos.
- O preço principal é `valor_contratado`. Preços e composição atuais são rotulados separadamente no detalhe.
- Dias representam recorrência, sem inventar datas de entrega, execução, rastreamento ou vínculo com endereço. Renovação é apenas previsão, sem cobrança automática.
- Personalização, exclusão de cesta e edição não são ações dessa consulta. Contratação e cancelamento permanecem nas próximas etapas previstas no plano.
- Datas são apresentadas como o dia informado pela API, sem deslocamento por conversão ao fuso do aparelho.

## Verificações e limites

- Lint e TypeScript aprovados.
- 130 testes aprovados: 126 existentes e quatro novos de apresentação, cobrindo datas em três fusos, dias ISO/ordenação sem mutar resposta, histórico cancelado/legado e identificação de cesta ausente do plano atual.
- Contrato e tipos gerados sincronizados; checagem TypeScript das fixtures aprovada.
- Prettier dos arquivos alterados e `git diff --check` aprovados.
- Exportação Android concluída em `/tmp/hort-mob18-android`, incluindo as novas rotas e assets. Exportação não é build de APK nem execução em aparelho.

Não houve validação visual ou de interação em Android/iOS, nem integração HTTP nova com a API em execução. A documentação da MOB-17 registra dependências de backend para a leitura enriquecida e seus filtros; esta task não integra PRs nem altera o serviço. Caso a API ainda retorne o contrato antigo, a interface apresenta a mensagem de atualização do serviço já definida na MOB-17.

Para supervisão: entrar no modo Cliente; abrir Assinaturas; alternar status; abrir um detalhe; conferir valor contratado diferente do valor atual, plano desativado e ausência de programação; abrir Agenda e alternar dias; conferir canceladas como histórico; atualizar por gesto e carregar páginas; exercitar rede indisponível e recuperação; sair/trocar modo e verificar limpeza dos dados. Repetir em tela pequena, fonte ampliada e leitor de tela, incluindo retorno ao app após suspensão.

Alterações preexistentes em `tsconfig.json`, `.env.local` e no plano original não versionado foram preservadas. A próxima etapa sequencial é a MOB-19, conforme o plano de implementação.

Referências técnicas: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Router SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/router/), [abas](https://docs.expo.dev/router/advanced/tabs/), [FlatList](https://reactnative.dev/docs/flatlist).
