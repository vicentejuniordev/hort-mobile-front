# MOB-13 — Consultas tipadas do catálogo

Atualização: 26/11/2026. Camada preparada para revisão; telas de lista/detalhe seguem na MOB-14.

## Continuidade e escopo

O responsável aprovou a entrega anterior e autorizou continuidade. PR #10/MOB-12 integrado na main em `987ae33`. Nenhum caso individual de supervisão não relatado foi marcado como executado.

Esta task prepara hooks, paginação, busca, ordenação, erros e cache do catálogo. Não altera layouts ou assets e não antecipa a MOB-14; a entrada provisória de Catálogo continua até a implementação visual. As telas seguintes deverão seguir os detalhes do Figma e alinhar previamente diferenças de API com o responsável. Pendências de infraestrutura/contratos das MOB-03/MOB-07/MOB-11 permanecem abertas.

## API e parâmetros

`features/catalog/model.ts` fornece tipos derivados do OpenAPI, cliente de catálogo, normalização de filtros, opções compartilhadas de query, deduplicação e adaptação de erros. Usa exclusivamente `/catalogo-planos/` e seu detalhe; não usa `/planos/` para compra, mesmo em conta com dois perfis.

Parâmetros preparados: `search`, `ordering`, `page` e `page_size=20`. Busca é normalizada e codificada por URLSearchParams. Ordenações suportadas pela API são ID, nome, categoria e periodicidade, em ambas as direções; ID desempata as demais para paginação estável. Valor/preço não é um campo de ordenação oferecido pelo servidor.

O código do backend também aceita filtros específicos `nome`, `categoria` e `periodicidade_semanal`, mas eles não estão documentados no OpenAPI versionado. Não foram expostos nesta entrega; antes de adicioná-los à UX, atualizar o contrato com seus parâmetros e validações. Busca textual e ordenação são os filtros preparados agora, sem parâmetros inventados para distância, avaliações ou horta pública.

O próximo número de página é construído localmente. `next` indica continuidade, mas sua URL não é seguida por uma requisição autenticada; página vazia encerra o carregamento. Resultados são deduplicados por ID, preservando a ordem de aparição e atualizando o item repetido. A paginação por páginas não cria snapshot: alterações concorrentes no catálogo exigem atualizar a lista.

Detalhe usa ID inteiro positivo real. `valor`, preço e quantidade permanecem strings decimais; não há cálculo financeiro com floats, imagens de produto inventadas ou conversão dos IDs das cestas em posições da lista.

## Hooks e cache

`@tanstack/react-query` 5.108.4 instalado por `npx expo install`, conforme AGENTS.md. Dependência JavaScript sem módulo nativo; APK existente continua suficiente.

- `useCatalog(filters)`: busca com espera de 300 ms, páginas, `offers` deduplicadas, `failure`, `searchPending`, estados nativos da query e `loadMore()` protegido contra carregamentos simultâneos.
- `useCatalogOffer(id)`: detalhe tipado e erro adaptado, habilitado somente para ID válido e sessão autenticada.
- Opções de consulta exportadas no módulo puro são as mesmas usadas pelos hooks; os testes exercitam essas opções com TanStack real.
- Cada chave inclui geração de sessão, usuário, modo e filtros ou ID. Lista e detalhe têm chaves distintas. Não há placeholder de uma busca anterior em outra busca.
- `PrivateQueryProvider` mantém o cliente estável, sem remontar a navegação. Assinatura direta da sessão cancela consultas pendentes e limpa os caches antes da próxima renderização quando geração/usuário/modo mudam ou a sessão deixa de estar autenticada. Mesmo usuário após novo login recebe geração diferente; rotação de tokens não muda o escopo.
- Atualizar nome/perfis sem mudar usuário/modo/geração conserva o cache. Logout, erro definitivo de sessão, redefinição de senha e troca de modo removem os dados privados. Resposta tardia após limpeza não repopula o cache.
- Cache somente em memória, `staleTime` de 30 segundos e descarte após cinco minutos sem observadores; sem persistência em AsyncStorage/SecureStore. Tokens e senha não entram nas chaves ou nos dados de query.

Foco do app é integrado pelo AppState; hooks respeitam foco da rota via Expo Router. Consultas inativas não mantêm assinatura ativa. Não foi adicionado módulo de conectividade: no nativo, retorno da rede não é detectado automaticamente; usar nova tentativa ou reabrir/focar uma consulta vencida. `refetchOnReconnect` fica desativado para não prometer esse comportamento sem integração. Revisão mais ampla de ciclo de vida/conectividade continua na MOB-29.

## Erros e repetição

TanStack não repete erros automaticamente. O transporte autenticado mantém a renovação única da MOB-05, compartilhada entre 401 concorrentes, e uma única repetição após renovar. Não há segundo mecanismo de refresh nos hooks.

Erro adaptado diferencia autenticação, acesso negado, oferta indisponível, limite de consultas, cancelamento e indisponibilidade. 403 não renova; 429 orienta aguardar; 404 de detalhe orienta atualizar catálogo. HTML de infraestrutura e rede são tratados pelo cliente HTTP. Erro ao buscar outra página conserva as páginas anteriores e permite nova tentativa explícita. A MOB-14 deverá apresentar distintamente erro inicial, erro de próxima página, vazio, atualização e dados possivelmente desatualizados.

## Verificações

- 95 testes aprovados no total; 12 novos de catálogo/cache. Cobrem URL/ordenação, IDs inválidos, paginação real das opções, deduplicação, decimais, vazio, chaves por filtro/sessão, cache, 401/403/404/429/HTML sem repetição, limpeza e resposta tardia, refresh centralizado, falha da próxima página e nova tentativa.
- Integração com Django real isolado, SQLite em memória e ofertas completas fictícias de duas hortas: 23 ofertas ativas em duas páginas, plano inativo excluído, busca com 11 resultados, ordenação decrescente, detalhe com IDs reais de cesta/produto e decimais, busca vazia e limpeza ao trocar modo/sair. Nenhuma alteração em dados reais; servidor isolado encerrado.
- Lint, TypeScript, Prettier, contrato sincronizado e exportação Android/Hermes aprovados.
- `.env.local` intacto; `tsconfig.json` local e plano original não versionado preservados fora dos commits.

## Supervisão Android e próxima task

```bash
npm run start:dev -- --clear
```

Usar o APK atual da MOB-05. Nesta task não há catálogo visual novo: conferir abertura, login, Conta, troca de modo quando disponível e logout para verificar a integração do provider. Não considerar os testes das opções como execução de hooks/telas no aparelho; lista, busca visível, rolagem/paginação e detalhe serão supervisionados após MOB-14. Não foi adicionada tela de diagnóstico fictícia para demonstrar a camada.

Sem validação iOS ou publicação em loja. A próxima task é MOB-14, lista e detalhe de oferta conforme Figma, consumindo os hooks desta entrega.

Fontes: [TanStack Query no React Native](https://tanstack.com/query/latest/docs/framework/react/react-native), [consultas infinitas](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries) e contrato versionado do projeto.
