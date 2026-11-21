// Exemplos sintéticos de contrato. Não importar no app ou enviar a uma API real.
import type { components, paths } from '../../src/shared/api/generated/schema';
type Schemas = components['schemas'];
export const customer = {
  id: 101,
  nome: 'Cliente de exemplo',
  email: 'cliente@example.test',
  perfis: ['cliente'],
} satisfies Schemas['Usuario'];
export const producer = {
  id: 102,
  nome: 'Produtor de exemplo',
  email: 'produtor@example.test',
  perfis: ['produtor'],
} satisfies Schemas['Usuario'];
export const dualProfile = {
  ...customer,
  id: 103,
  perfis: ['cliente', 'produtor'],
} satisfies Schemas['Usuario'];
export const address = {
  rua: 'Rua de Exemplo, 100',
  bairro: 'Centro',
  cidade: 'Teresina',
  estado: 'PI',
} satisfies Schemas['EnderecoInput'];
export const loginInput = {
  email: customer.email,
  password: 'ExampleOnly!42',
} satisfies Schemas['Login'];
export const customerRegistration = {
  nome: customer.nome,
  email: customer.email,
  cpf: '52998224725',
  password: loginInput.password,
  password_confirm: loginInput.password,
  endereco: address,
} satisfies Schemas['CadastroClienteInput'];
export const producerRegistration = {
  nome: producer.nome,
  email: producer.email,
  cnpj: '11222333000181',
  password: loginInput.password,
  password_confirm: loginInput.password,
  endereco: address,
} satisfies Schemas['CadastroProdutorInput'];
export const loginResponse = {
  access: 'fixture-access-not-a-jwt',
  refresh: 'fixture-refresh-not-a-jwt',
  usuario: customer,
} satisfies Schemas['LoginResponse'];
export const lettuce = {
  id: 201,
  produtor: 7,
  name: 'Alface de exemplo',
  description: '',
  category: 'hortalica',
  price: '2.50',
  stock: 30,
  unit: 'unidade',
  is_active: true,
  created_at: '2026-11-19T12:00:00Z',
  updated_at: '2026-11-19T12:00:00Z',
} satisfies Schemas['Product'];
export const tomatoes = {
  ...lettuce,
  id: 202,
  name: 'Tomate de exemplo',
  category: 'legume',
  price: '5.00',
  unit: 'kg',
} satisfies Schemas['Product'];
export const offer = {
  id: 301,
  produtor: 7,
  nome: 'Plano de exemplo',
  categoria: 'Mista',
  periodicidade_semanal: 2,
  valor: '17.50',
  cestas: [
    {
      id: 401,
      nome: 'Cesta A',
      itens: [{ id: 501, hortalica: lettuce, quantidade: '3.000' }],
    },
    {
      id: 402,
      nome: 'Cesta B',
      itens: [{ id: 502, hortalica: tomatoes, quantidade: '2.000' }],
    },
  ],
} satisfies Schemas['PlanoCatalogo'];
export const catalogPage1 = {
  count: 2,
  next: 'https://api.example.test/api/v1/catalogo-planos/?page=2',
  previous: null,
  results: [offer],
} satisfies Schemas['PaginatedPlanoCatalogoList'];
export const catalogPage2 = {
  count: 2,
  next: null,
  previous: 'https://api.example.test/api/v1/catalogo-planos/?page=1',
  results: [{ ...offer, id: 302, nome: 'Outro plano de exemplo' }],
} satisfies Schemas['PaginatedPlanoCatalogoList'];
export const emptyCatalog = {
  count: 0,
  next: null,
  previous: null,
  results: [],
} satisfies Schemas['PaginatedPlanoCatalogoList'];
export const subscribeInput = {
  plano: offer.id,
  programacoes: [
    { cesta: 401, dia_semana: 1 },
    { cesta: 402, dia_semana: 4 },
  ],
} satisfies Schemas['ContratarAssinaturaInput'];
export const subscription = {
  id: 601,
  cliente: 9,
  plano: offer.id,
  data_assinatura: '2026-11-19T12:00:00Z',
  data_renovacao: '2026-12-19',
  status: 'ativa',
  data_cancelamento: null,
  valor_contratado: offer.valor,
  programacoes: subscribeInput.programacoes.map((entry, index) => ({
    ...entry,
    id: 701 + index,
    assinatura: 601,
    ordem: index + 1,
  })),
} satisfies Schemas['Assinatura'];
export const cancelledSubscription = {
  ...subscription,
  status: 'cancelada',
  data_cancelamento: '2026-11-20T12:00:00Z',
} satisfies Schemas['Assinatura'];
export const health = {
  status: 'ok',
} satisfies paths['/api/v1/health/']['get']['responses'][200]['content']['application/json'];
// O envelope é implementado em common/exceptions.py, mas ainda falta no OpenAPI.
export const validationError = {
  error: {
    code: 'validation_error',
    message: 'Dados inválidos.',
    details: { email: ['E-mail inválido.'] },
  },
};
export const conflictError = {
  error: {
    code: 'idempotency_conflict',
    message: 'Chave já utilizada com outros dados.',
    details: null,
  },
};

type Assert<T extends true> = T;
export type ContractAssertions = [
  Assert<Schemas['PlanoCatalogo']['valor'] extends string ? true : false>,
  Assert<
    Schemas['Assinatura']['valor_contratado'] extends string ? true : false
  >,
  Assert<Schemas['Product']['price'] extends string ? true : false>,
  Assert<Schemas['ItemCatalogo']['quantidade'] extends string ? true : false>,
  Assert<
    'password_confirm' extends keyof Schemas['CadastroClienteInput']
      ? true
      : false
  >,
];
