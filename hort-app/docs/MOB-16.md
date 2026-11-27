# MOB-16 — Gestão de produtos do produtor

Atualização: 27/11/2026. Implementação preparada para revisão e supervisão Android.

## Escopo e continuidade

MOB-15 mobile/PR #13 integrada em `4df0ad0`. O PR #16 do backend da MOB-15 ainda estava aberto na conferência desta task; sua leitura de assinaturas não é necessária para os endpoints de produtos usados aqui. Essa integração permanece pendente para MOB-17/MOB-18.

MOB-16 substitui a entrada provisória da aba Produtos por lista, cadastro, edição e exclusão reais. Não inclui gestão de planos/cestas, reservada à MOB-20.

## Figma e decisões aprovadas

Consultados contexto detalhado e renders com a skill `figma:figma-design-to-code`: [gestão do produtor, 219:460](https://www.figma.com/design/3t53HvlVWuJpmDmpJDC8rU/HORT?node-id=219-460) e [Nova Hortaliça, 287:780](https://www.figma.com/design/3t53HvlVWuJpmDmpJDC8rU/HORT?node-id=287-780).

O responsável aprovou separar a seção de hortaliças na aba Produtos, mostrando ativos e inativos, com busca, e manter o formulário da referência com preço digitável. Também aprovou o ícone de tomate do Figma como ilustração padrão; a API não fornece imagens. Nomes, categoria, unidade, preço, estoque e disponibilidade são reais.

Cartões usam fundo `#EFF5ED`, borda `#AABCA2`, raio 8,112, largura 189 e tipografia da referência. O estado de atividade foi acrescentado; alturas podem crescer para textos reais, fontes ampliadas e alvos de interação de pelo menos 48 pontos. A lista usa duas colunas quando há espaço e uma em larguras menores/fontes ampliadas. A seção foi trazida para o topo da aba, sem criar planos fictícios acima dela.

Formulário com largura máxima 377, identificação, preço/inventário, disponibilidade, folhas no cabeçalho e elipse verde no rodapé. Mantém fundos, bordas, raios e pesos Poppins/Istok Web. Componentes crescem e rolam para acomodar teclado, mensagens de validação e fontes ampliadas. A disponibilidade usa `Switch` nativo com cores da referência: o `ToggleRight` citado pelo Code Connect não existe no projeto nem nas dependências. Seletores são interativos e acessíveis; preço é campo decimal, conforme adaptação aprovada.

`Button` recebeu a opção de estilo do texto para reproduzir a tipografia do botão de cadastro, preservando seus padrões quando a opção não é fornecida. O restante dos controles específicos só foi criado porque o campo compartilhado existente não expressa os rótulos, dimensões e raios dessa referência.

Assets baixados e usados localmente, com existência/tamanho não vazio, slots e dimensões declaradas conferidos:

| Arquivo em `assets/products/` | Asset Figma / dimensão usada                                         |
| ----------------------------- | -------------------------------------------------------------------- |
| `product-illustration.png`    | `d0497.png`, ícone ilustrativo de 15,453 × 15,453 no cartão          |
| `form-leaves.svg`             | `69985.svg`, raiz e exibição 59 × 34 nas duas laterais do título     |
| `form-footer.svg`             | `cf1a3.svg`, raiz 473 × 48, recortada pelo rodapé como na referência |
| `select-down.svg`             | `91782.svg`, raiz e exibição 11 × 11 na categoria                    |
| `unit-down.svg`               | `9d119.svg`, raiz e exibição 12,1786 × 12,1786 na unidade            |

Header, seta e ícones das abas reutilizam os assets locais existentes. Não há URL temporária do Figma em runtime. Conferência de código e geometria não equivale a comparação visual do app renderizado no Android.

## API, dados e estados

Usa exclusivamente `/api/v1/products/` e `/api/v1/products/{id}/`, com o transporte autenticado da sessão. Lista paginada de 20 itens, busca com espera de 300 ms, ordenação `name,id`, deduplicação por ID e carregamento explícito de outra página. URLs `next` externas não são seguidas; a próxima página é construída localmente.

Cadastro envia POST; edição envia PATCH; exclusão envia DELETE após confirmação. Os seis campos editáveis persistidos são `name`, `category`, `unit`, `price`, `stock` e `is_active`. O produtor é definido pelo servidor. A descrição, ausente no Figma, não é enviada: editar preserva a descrição já existente. IDs e datas não são editáveis.

Preço aceita vírgula ou ponto, até oito dígitos inteiros e dois decimais, sem separador de milhares. É normalizado como string com duas casas, sem cálculo com floats. Zero é permitido pela API de produtos; a decisão de valor positivo para publicação de planos não altera essa regra. Estoque é inteiro não negativo, com limite de precisão segura do JavaScript; valores maiores não são arredondados silenciosamente para envio. Limites adicionais do banco continuam sendo validados pelo backend.

Lista e formulário cobrem carregamento, vazio, busca sem resultado, erro, atualização, falha de outra página, validação por campo e nova tentativa. Falha de atualização identifica os dados como possivelmente desatualizados. Erros de acesso não conservam a apresentação dos dados. Respostas 401 continuam no mecanismo único de renovação da sessão.

Exclusão protegida (`hortalica_em_cesta`) mantém o produto e explica como desativá-lo na edição ou remover seus vínculos antes de excluir. O aviso oferece abrir a edição, sem desativação automática. Conflito de unidade (`quantidade_fracionada_em_cesta`) orienta ajustar a composição antes de trocar para Unidade. Não se remove o cartão antes da confirmação do DELETE.

## Escritas e cache privado

As consultas usam TanStack Query no escopo de geração/usuário/modo da sessão e são descartadas pelo provider existente ao sair/trocar modo. Escritas bloqueiam toque duplicado, não repetem automaticamente e só apresentam sucesso após a resposta confirmada. Cancelamento por saída da rota ou mudança de sessão descarta a resposta tardia; cancelar a requisição não desfaz uma gravação já recebida pelo servidor.

Antes de escrever, consultas do escopo são canceladas e marcadas como vencidas. Depois, consultas ativas são invalidadas para reconciliação, inclusive após resposta incerta. O resultado confirmado do comando não depende do sucesso dessa atualização posterior. Nenhuma resposta de escrita repopula cache de uma sessão anterior.

Timeout, falha de rede, resposta inválida ou erro de servidor durante a escrita não produzem sucesso antecipado. O formulário fica impedido de reenviar até o usuário consultar seus produtos. A lista impede novas escritas após exclusão incerta até uma consulta explícita bem-sucedida. A API de produtos não oferece idempotência de criação; conferir a lista antes de criar novamente continua necessário.

## Verificações executadas

- 114 testes mobile aprovados, incluindo 11 novos de produtos: validação/precisão, payload sem campos indevidos, URLs/IDs, paginação e deduplicação, falha de outra página, erros de domínio, toque duplicado, timeout sem repetição e respostas tardias após cancelamento/troca de escopo.
- Integração HTTP com Django/JWT real isolado e SQLite em memória: 23 produtos em duas páginas; busca; ativos/inativos; cadastro, edição e releitura dos seis campos; exclusão confirmada e protegida; conflito por quantidade fracionada; desativação; acesso a produto de outro produtor negado e cliente sem perfil de produtor recebendo 403. Servidor encerrado; dados de desenvolvimento não alterados.
- Lint, TypeScript, Prettier dos arquivos cobertos pelo script do projeto, contrato sincronizado e exportação Android/Hermes aprovados. CI do PR repete as verificações sobre o código versionado.
- `.env.local`, alteração local prévia de `tsconfig.json` e plano original não versionado preservados fora dos commits. Nenhuma dependência ou módulo nativo adicionado.

Não foram executados testes visuais, TalkBack, teclado ou navegação em aparelho físico. Esses casos ficam para a supervisão Android; não houve validação iOS.

## Supervisão Android

No APK de desenvolvimento atual:

```bash
npm run start:dev -- --clear
```

Se estiver usando Expo Go compatível com SDK 58, usar `npm run start:go -- --clear`.

1. Entrar como produtor ou alternar para o modo Produtor e abrir Produtos.
2. Conferir layout, ícone ilustrativo, busca, ativo/inativo, rolagem e paginação com mais de 20 produtos.
3. Adicionar um produto com nome, categoria, unidade, preço e estoque; voltar à lista e reabrir para confirmar persistência.
4. Editar os seis campos, incluindo disponibilidade; reabrir e conferir os valores. Verificar erros de nome vazio, preço inválido e estoque fracionado/negativo.
5. Cancelar uma confirmação de exclusão; depois excluir um produto sem vínculos e conferir sua remoção. Em produto ligado a cestas, conferir orientação e acesso à edição para desativação.
6. Verificar teclado, seletores, fonte ampliada, retorno Android, troca de aba e saída da conta. Conferir mensagens sem rede e consultar a lista antes de repetir uma escrita incerta.

Próxima task do plano: MOB-17, consultas de assinaturas/programações e cache, após integrar a evolução de backend da MOB-15. As telas correspondentes pertencem à MOB-18.

Referências técnicas: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Router](https://docs.expo.dev/versions/v58.0.0/sdk/router/), [Stack](https://docs.expo.dev/router/advanced/stack/), [Switch](https://reactnative.dev/docs/switch) e [cancelamento de consultas](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation).
