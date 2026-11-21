import { z } from 'zod';
import type { components } from '../../shared/api/generated/schema';

export type RegistrationProfile = 'cliente' | 'produtor';
export const registrationSteps = [
  ['email', 'password', 'password_confirm'],
  ['nome', 'documento'],
  ['cidade', 'estado', 'bairro', 'rua', 'numero'],
] as const;

function validDocument(value: string, profile: RegistrationProfile) {
  const digits = value.replace(/\D/g, '');
  const size = profile === 'cliente' ? 11 : 14;
  if (digits.length !== size || /^(\d)\1+$/.test(digits)) return false;
  for (let position = size - 2; position < size; position++) {
    const weights =
      profile === 'cliente'
        ? Array.from({ length: position }, (_, index) => position + 1 - index)
        : position === 12
          ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
          : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const total = weights.reduce(
      (sum, weight, index) => sum + Number(digits[index]) * weight,
      0,
    );
    const digit =
      profile === 'cliente'
        ? ((total * 10) % 11) % 10
        : total % 11 < 2
          ? 0
          : 11 - (total % 11);
    if (digit !== Number(digits[position])) return false;
  }
  return true;
}

const required = (max: number) =>
  z
    .string()
    .trim()
    .min(1, 'Preencha este campo.')
    .max(max, `Use até ${max} caracteres.`);
export function registrationSchema(profile: RegistrationProfile) {
  return z
    .object({
      email: z.string().trim().email('Informe um e-mail válido.').max(254),
      password: z.string().min(8, 'Use pelo menos 8 caracteres.'),
      password_confirm: z.string().min(1, 'Confirme sua senha.'),
      nome: required(150),
      documento: z
        .string()
        .refine(
          (value) => validDocument(value, profile),
          `Informe um ${profile === 'cliente' ? 'CPF' : 'CNPJ'} válido.`,
        ),
      cidade: required(120),
      estado: z
        .string()
        .trim()
        .regex(/^[a-zA-Z]{2}$/, 'Informe a UF com duas letras.'),
      bairro: required(120),
      rua: required(230),
      numero: required(20),
    })
    .refine((data) => data.password === data.password_confirm, {
      path: ['password_confirm'],
      message: 'As senhas não conferem.',
    });
}
export type RegistrationValues = z.infer<ReturnType<typeof registrationSchema>>;
export type RegistrationField = keyof RegistrationValues;
export const emptyRegistration: RegistrationValues = {
  email: '',
  password: '',
  password_confirm: '',
  nome: '',
  documento: '',
  cidade: '',
  estado: '',
  bairro: '',
  rua: '',
  numero: '',
};
export function registrationPayload(
  values: RegistrationValues,
  profile: RegistrationProfile,
) {
  const common = {
    nome: values.nome.trim(),
    email: values.email.trim(),
    password: values.password,
    password_confirm: values.password_confirm,
    endereco: {
      cidade: values.cidade.trim(),
      estado: values.estado.trim().toUpperCase(),
      bairro: values.bairro.trim(),
      rua: `${values.rua.trim()}, ${values.numero.trim()}`,
    },
  };
  const documento = values.documento.replace(/\D/g, '');
  return profile === 'cliente'
    ? ({
        ...common,
        cpf: documento,
      } satisfies components['schemas']['CadastroClienteInput'])
    : ({
        ...common,
        cnpj: documento,
      } satisfies components['schemas']['CadastroProdutorInput']);
}

// Endereço é aninhado no contrato; o formulário distribui os erros por etapa.
export function registrationFieldErrors(
  details: unknown,
): Partial<Record<RegistrationField, string>> {
  if (!details || typeof details !== 'object') return {};
  const result: Partial<Record<RegistrationField, string>> = {};
  function visit(value: unknown, path: string) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [key, child] of Object.entries(value))
        visit(child, path ? `${path}.${key}` : key);
      return;
    }
    const field =
      path === 'cpf' || path === 'cnpj'
        ? 'documento'
        : path.replace(/^endereco\./, '');
    if (!Object.hasOwn(emptyRegistration, field)) return;
    const message = Array.isArray(value)
      ? value.filter((item) => typeof item === 'string').join(' ')
      : typeof value === 'string'
        ? value
        : '';
    if (message) result[field as RegistrationField] = message;
  }
  visit(details, '');
  return result;
}
