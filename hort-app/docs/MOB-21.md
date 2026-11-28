# MOB-21 — Contratação persistida e repetição segura

Implementação: 28/11/2026, após a MOB-20/PR #18 integrada em `99c424c`. Branch `feat/mob-21-idempotent-subscription`. Próxima etapa sequencial: MOB-22, telas de escolha de dias, revisão, confirmação e cancelamento.

## Escopo e decisões preservadas

A entrega implementa o comando de contratação, sua persistência e o adaptador React para a próxima jornada. Não acrescenta telas ou botão de compra nesta task. Mantém Expo Router, organização por funcionalidade, contrato OpenAPI existente, renovação centralizada da sessão e cache privado TanStack. Não altera o backend, o cálculo do valor, o catálogo nem as programações existentes.

A API existente (`subscriptions/services.py`, revisão backend `0599526`) serializa tentativas por cliente, compara o payload e devolve a resposta original quando recebe a mesma `Idempotency-Key`. A ordem de `programacoes` participa dessa comparação e define a ordem contratada. A retomada deve usar o payload salvo, sem reconstruí-lo a partir do catálogo atual.

## Comando e persistência

`features/subscriptions/checkout.ts` fornece `SubscriptionCheckout` com quatro operações:

- `restore()`: lê a intenção da conta/API atuais, sem enviar POST.
- `prepare(payload, basketIds, newPurchase?)`: valida IDs positivos, de uma a sete cestas, correspondência exata das cestas e dias ISO distintos; copia somente plano/cesta/dia e persiste uma intenção antes de permitir envio. Mudança de dados gera outra chave. A ordem não é normalizada por classificação.
- `submit()`: usa exclusivamente a chave e o payload persistidos. Marca a intenção como incerta antes do transporte; confirma apenas com resposta compatível da API e devolve ID e valor contratado do servidor.
- `clear()`: cancela a operação local, aguarda gravações pendentes e remove o registro. Cancelar a operação local não desfaz uma contratação já gravada no servidor.

O runtime usa uma instância compartilhada, com bloqueio de operações concorrentes, UUID v4 de `expo-crypto` e SecureStore em chave separada dos tokens. O registro contém versão, API, usuário, chave, payload, fase e um recibo mínimo após confirmação. Não contém senha, documentos ou cópia dos tokens. Há uma intenção corrente por instalação; registros de outra conta/API não são retornados nem enviados. Uma nova preparação de outro proprietário substitui o registro anterior, sem revelar seu conteúdo.

As fases são `ready` (preparada), `uncertain` (resultado ainda não confirmado), `rejected` (rejeição conhecida da primeira tentativa) e `confirmed` (recibo confirmado). A confirmação é reutilizada sem outro POST; uma compra adicional idêntica exige `newPurchase=true`. Enquanto uma tentativa estiver incerta, não se permite trocar seus dados nem substituí-la por uma nova compra. É preciso retomar a mesma tentativa primeiro.

Falhas de leitura ou gravação antes do POST impedem envio. Registro corrompido não é descartado silenciosamente. Timeout, rede, cancelamento, resposta incompatível, 5xx e conflito de chave mantêm a intenção incerta. Erros conhecidos 400/403/404/409/429 da primeira tentativa podem marcar rejeição e permitir correção; uma rejeição durante replay não prova que a tentativa anterior não foi gravada, portanto conserva a incerteza. Código/status/detalhes de campo permanecem disponíveis ao chamador. Não há repetição automática por rede ou erro de domínio.

Se a API confirmar e a persistência do recibo falhar, o comando devolve o recibo real com `saved=false`; a chave/payload já salvos continuam permitindo replay seguro. A futura tela deve explicar a falha local sem induzir uma segunda contratação. Valor exibido vem de `valor_contratado`; não é recalculado a partir da oferta atual.

## Sessão, transporte e integração React

O cliente HTTP ganha a opção específica `idempotencyKey`, restrita ao POST de `assinaturas/`. A sessão preserva essa opção no único replay após 401. Não foram criados outro refresh ou suporte genérico a cabeçalhos que sobrescreva autorização.

Operações verificam usuário/API/modo/geração e cancelamento antes do transporte e depois das esperas. Mudança de escopo cancela a instância compartilhada; resposta tardia não confirma sucesso na conta seguinte. Expiração de credenciais preserva a intenção para o próximo login da mesma conta. Logout explícito e redefinição de senha removem o registro privado. Se a limpeza falhar, a sessão permanece indisponível e o bootstrap tenta novamente antes de permitir outro login.

`useSubscriptionCheckout()` expõe restauração, preparação, envio, intenção, disponibilidade, andamento e falha para a MOB-22. A leitura ao focar não realiza a contratação. O adaptador oculta dados de outro escopo, cancela leituras de assinaturas antes do comando e invalida assinaturas/programações depois, inclusive após resultado incerto. Falha de atualização não muda o resultado do POST. Consultas posteriores continuam usando o GET enriquecido; o recibo do POST não é inserido como se fosse esse contrato de leitura.

## Verificação

- Lint, TypeScript, contrato/fixtures e 167 testes mobile aprovados (23 novos: 22 de contratação e um de transporte). Os testes novos cobrem persistência antes do POST, cópia do formulário, ordem/dias/vínculos, rede, timeout após gravação, retomada, duplo envio, resposta tardia, API/conta/modo/geração, falhas e corridas do armazenamento, limpeza no logout, expiração, respostas incompatíveis, erros de domínio e preservação da chave/corpo após refresh.
- Integração HTTP com Django/JWT real, SQLite descartável em `/tmp` e dados sintéticos próprios. Primeiro processo: a API grava a contratação e o transporte perde a resposta, deixando chave/payload incertos em arquivo. Segundo processo: lê o mesmo registro e repete o comando. GET confirma exatamente uma assinatura, duas programações e valor `12.50`, com o mesmo ID retornado pelo replay. O servidor temporário foi encerrado; banco e serviço de desenvolvimento ficaram intactos.
- Exportação Android/Hermes concluída. Não é APK nem validação do SecureStore, navegação, ciclo de vida ou teclado em aparelho. Não foram executados testes de concorrência PostgreSQL nesta task.
- Prettier passa nos arquivos entregues e nos demais arquivos do comando padrão, exceto `tsconfig.json`, cuja alteração local preexistente não está formatada. Esse arquivo e o plano original não versionado foram preservados fora dos commits. A configuração TypeScript versionada também foi conferida separadamente.

A dependência `expo-crypto` foi instalada por `npx expo install`, na versão compatível com SDK 58. O development build precisa ser recompilado para incluir o novo módulo nativo antes de supervisão em Android/iOS. No navegador, o adaptador permanece somente em memória, como a sessão existente: recarregar a página não oferece a persistência nativa da intenção. A recuperação após reinício em aparelho ainda precisa ser supervisionada quando as telas da MOB-22 forem integradas.

Fontes técnicas consultadas: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [índice Expo](https://docs.expo.dev/llms.txt), [SecureStore SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/) e [Crypto SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/crypto/).
