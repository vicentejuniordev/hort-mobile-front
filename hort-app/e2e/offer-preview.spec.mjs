import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { connectAPI } from './support.mjs';

test('prévia paginada recupera falhas e permite excluir rascunho sem histórico', async ({
  page,
  request,
}) => {
  const fixture = JSON.parse(
    await readFile(process.env.HORT_E2E_MANIFEST, 'utf8'),
  );
  const response = await request.post(
    'http://127.0.0.1:8214/api/v1/auth/login/',
    { data: fixture.accounts.producer },
  );
  expect(response.ok()).toBe(true);
  const auth = await response.json();
  const headers = { Authorization: `Bearer ${auth.access}` };
  const api = async (path, data) => {
    const response = await request.post(
      `http://127.0.0.1:8214/api/v1/${path}`,
      { headers, data },
    );
    expect(response.status()).toBe(201);
    return response.json();
  };
  // API setup creates a draft beyond one page. All preview/retry/delete actions
  // below use the application UI and real API responses.
  const plan = await api('planos/', {
    nome: 'Prévia paginada MOB-24',
    categoria: 'Cenário sintético',
    periodicidade_semanal: 1,
    is_ativo: false,
  });
  for (let index = 1; index <= 21; index++) {
    const basket = await api('cestas/', {
      plano: plan.id,
      nome: `Cesta paginada ${index}`,
    });
    await api('itens-cesta/', {
      cesta: basket.id,
      hortalica: fixture.productId,
      quantidade: '1.000',
    });
  }
  const writes = [];
  await connectAPI(page, writes);
  await page.goto('/login');
  await page
    .getByPlaceholder('seu@email.com')
    .fill(fixture.accounts.producer.email);
  await page
    .getByPlaceholder('Digite sua senha')
    .fill(fixture.accounts.producer.password);
  const button = (name) => page.getByRole('button', { name, exact: true });
  const text = (name) =>
    page.getByText(name, { exact: true }).filter({ visible: true });
  await button('Entrar').click();
  await page.getByTestId('producer-planos-tab').click();
  await page
    .getByRole('textbox', { name: 'Buscar planos do produtor', exact: true })
    .fill(plan.nome);
  await button(`Gerenciar ${plan.nome}`).click();
  await expect(text('Cestas (21)')).toBeVisible();
  // Fail the first composition read on preview, then let the real GET recover.
  await page.route('**/api/v1/cestas/?**', async (route) => {
    await page.unroute('**/api/v1/cestas/?**');
    await route.abort('failed');
  });
  await button('Ver prévia da oferta').click();
  await button('Tentar novamente').click();
  await expect(text('21 cestas no plano')).toBeVisible();
  // The total comes from the server across all pages, never from loaded rows.
  await expect(text('R$ 131,25')).toBeVisible();
  await expect(
    text(
      'A prévia está parcial. Carregue as demais cestas para conferir toda a composição.',
    ),
  ).toBeVisible();
  await page.route('**/api/v1/cestas/?**', async (route) => {
    await page.unroute('**/api/v1/cestas/?**');
    await route.abort('failed');
  });
  await button('Carregar mais cestas').click();
  await button('Tentar novamente').click();
  await expect(text('Cesta paginada 21')).toBeVisible();
  await expect(button('Carregar mais cestas')).toHaveCount(0);
  await button('Voltar à gestão do plano').click();
  await button('Excluir plano').click();
  await button('Cancelar').click();
  expect(writes.filter((write) => write.method === 'DELETE')).toHaveLength(0);
  await button('Excluir plano').click();
  await button('Confirmar').click();
  await expect(button('Novo Plano')).toBeVisible();
  expect(
    writes.filter((write) => write.method === 'DELETE' && write.status === 204),
  ).toHaveLength(1);
  expect(
    (
      await request.get(`http://127.0.0.1:8214/api/v1/planos/${plan.id}/`, {
        headers,
      })
    ).status(),
  ).toBe(404);
});
