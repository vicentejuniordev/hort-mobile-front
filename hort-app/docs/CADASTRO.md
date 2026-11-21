# Cadastro no aplicativo

Entrega solicitada antes de continuar o backlog, em 21/11/2026. Implementa cadastro de cliente e produtor com CNPJ. Não encerra as pendências de homologação da MOB-03 nem as entregas futuras de sessão persistente.

## Jornada e apresentação

Login → Cadastre-se → escolha de perfil → cadastro em três etapas:

1. E-mail, senha e confirmação.
2. Nome e CPF para cliente; nome da empresa/horta e CNPJ para produtor.
3. Cidade, UF, bairro, rua e número (aceita S/N).

Após o servidor confirmar a criação, o app mostra sucesso e oferece retorno ao login. O cadastro não cria uma sessão nem presume tokens no retorno. Os dados permanecem em memória durante as etapas; senha e formulário são limpos no sucesso e não são gravados em armazenamento local. Voltar pelo botão da tela ou pelo Android retorna à etapa anterior preservando os dados.

Conforme solicitação do responsável, a composição usa o login atual: logo existente, fundo claro, Poppins, títulos verde escuro, campos com borda e foco, botão verde e conteúdo rolável com tratamento de teclado. Não replica os blocos verde/roxo/laranja do Figma. As imagens locais de logo e voltar são reutilizadas nas mesmas dimensões do login (160×68 e 41×40).

Referências consultadas pela skill `figma:figma-design-to-code`:

- [Cadastro de acesso — 310:870](https://www.figma.com/design/3t53HvlVWuJpmDmpJDC8rU/HORT?node-id=310-870).
- [Perfil do produtor — 315:1092](https://www.figma.com/design/3t53HvlVWuJpmDmpJDC8rU/HORT?node-id=315-1092).
- [Localização — 315:1125](https://www.figma.com/design/3t53HvlVWuJpmDmpJDC8rU/HORT?node-id=315-1125).

## Integração e diferenças de contrato

POST `auth/register/cliente/` ou `auth/register/produtor/`, com os tipos do OpenAPI versionado. O backend exige nome, documento, endereço, e-mail, `password` e `password_confirm`.

- E-mail substitui “e-mail ou telefone”: autenticação e cadastro atuais não recebem telefone.
- CPF do responsável do produtor e horta familiar por CPF dependem de evolução do backend; não são coletados sem suporte de persistência.
- UF é obrigatória no contrato, apesar de ausente na referência visual de endereço.
- Número é composto no campo `endereco.rua` como `Rua, número`; o backend não possui número separado. Os limites do formulário mantêm a composição abaixo de 255 caracteres.
- Não há aceite fictício de termos sem documento/URL aprovado.
- Cliente valida CPF; produtor valida CNPJ, incluindo dígitos verificadores. A API conserva a decisão final sobre unicidade, força da senha e regras de domínio.
- React Hook Form e Zod controlam etapas/validação. Erros de documento e endereço são associados aos campos e levam à etapa correspondente. Envio fica bloqueado durante a requisição; não há repetição automática. Timeout/falha de rede orienta tentar login antes de reenviar um cadastro de resultado incerto.

## Verificação

- Lint, TypeScript e Prettier dos arquivos da entrega.
- Suíte de HTTP/contrato/cadastro: 25 testes, incluindo CPF/CNPJ, confirmação na primeira etapa, normalização, preservação da senha e erros aninhados.
- Integração com Django local em SQLite descartável em memória: cliente e produtor com 201, tentativa duplicada com 400/erro de campo, login e consulta de perfil com 200. Nenhum dado foi inserido no banco de desenvolvimento.
- Exportação Android/Hermes com Expo SDK 58. Sem dependências nativas adicionais.

Aceite no Android físico via Expo Go ainda depende da supervisão do responsável. Não houve validação de execução em iOS. Roteiro:

1. No login, tocar em Cadastre-se e selecionar Cliente.
2. Conferir os campos, mostrar/ocultar senha, confirmação diferente, CPF inválido e campos vazios.
3. Avançar e voltar nas etapas, inclusive pelo botão do Android; conferir preservação dos dados, rolagem e teclado.
4. Criar uma conta de teste com documento válido, conferir sucesso e fazer login.
5. Repetir para Produtor com CNPJ. Conferir e-mail/documento já cadastrado e retorno à etapa com erro.
6. Conferir tela pequena/fonte ampliada e indisponibilidade da API, sem sucesso antecipado.

Este PR parte da branch do contrato da MOB-03, pois utiliza seus tipos gerados. Deve ser integrado após o PR de contrato, ou ter sua base atualizada quando ele for integrado.
