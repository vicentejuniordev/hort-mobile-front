import { connectAPI } from './support.mjs';
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test('produtor publica, cliente contrata e exclusão protegida orienta desativação', async ({
  page,
}, testInfo) => {
  const fixture = JSON.parse(
    await readFile(process.env.HORT_E2E_MANIFEST, 'utf8'),
  );
  expect(fixture.kind).toBe('hort-mobile-beta-v1');
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const writes = [];
  await connectAPI(page, writes);
  const visibleText = (value, options) =>
    page.getByText(value, options).filter({ visible: true }).last();
  const button = (name) => page.getByRole('button', { name, exact: true });
  async function login(role) {
    await page
      .getByPlaceholder('seu@email.com')
      .fill(fixture.accounts[role].email);
    await page
      .getByPlaceholder('Digite sua senha')
      .fill(fixture.accounts[role].password);
    await button('Entrar').click();
  }
  async function logout() {
    const producerTab = page.getByTestId('producer-perfil-tab');
    if (await producerTab.count()) await producerTab.click();
    else await visibleText('Conta', { exact: true }).last().click();
    await button('Sair da conta').click();
    await button('Sair da conta').last().click();
    await button('Entendi').click();
    await page.getByRole('link', { name: 'Faça Login', exact: true }).click();
    await expect(button('Entrar')).toBeVisible();
  }
  async function screenshot(name) {
    await expect(button('Confirmar')).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath(`${name}.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto('/login');
  await login('producer');
  await page.getByTestId('producer-produtos-tab').click();
  await button('Adicionar produto').click();
  await page
    .getByRole('textbox', { name: 'Nome da Hortaliça', exact: true })
    .fill('Couve da jornada MOB-24');
  await button('Categoria: Selecione a categoria').click();
  await page.getByRole('radio', { name: 'Hortaliça', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Preço de Venda (R$)', exact: true })
    .fill('6,25');
  await page
    .getByRole('textbox', { name: 'Estoque Atual', exact: true })
    .fill('20');
  await button('Cadastrar Hortaliça').click();
  await expect(
    visibleText('Produto cadastrado.', { exact: true }),
  ).toBeVisible();
  await button('Ver meus produtos').click();
  await page.getByTestId('producer-planos-tab').click();
  await button('Novo Plano').click();
  const name = 'Oferta da jornada MOB-24';
  await page
    .getByRole('textbox', { name: 'Nome do Plano', exact: true })
    .fill(name);
  await page
    .getByRole('textbox', { name: 'Categoria', exact: true })
    .fill('Hortaliças locais');
  await page
    .getByRole('textbox', { name: 'Periodicidade semanal', exact: true })
    .fill('1');
  await button('Cadastrar Rascunho').click();
  await button('Ver prévia da oferta').click();
  await expect(
    visibleText(/Rascunho: esta oferta ainda não aparece/),
  ).toBeVisible();
  await expect(
    visibleText('Este plano ainda não possui cestas.', { exact: true }),
  ).toBeVisible();
  await button('Voltar à gestão do plano').click();
  await button('Publicar plano').click();
  await button('Confirmar').click();
  await expect(
    visibleText(/Para publicar, o plano precisa de 1 a 7 cestas/),
  ).toBeVisible();
  await button('Nova Cesta').click();
  await page
    .getByRole('textbox', { name: 'Nome da Cesta', exact: true })
    .fill('Cesta da jornada');
  await button('Cadastrar Cesta').click();
  await button('Adicionar produto à cesta').click();
  await button('Escolha o produto').click();
  await button('Selecionar Couve da jornada MOB-24').click();
  await page
    .getByRole('textbox', { name: 'Quantidade (Kg)', exact: true })
    .fill('2');
  await button('Adicionar à Cesta').click();
  await expect(button('Editar quantidade')).toBeVisible();
  const created = writes.find(
    (w) => w.path === '/api/v1/planos/' && w.status === 201,
  ).body;
  // Navigate back through the screen's own header, rather than reloading the app.
  await button('Voltar').last().click();
  await button('Ver prévia da oferta').click();
  await expect(
    visibleText('Couve da jornada MOB-24', { exact: true }),
  ).toBeVisible();
  await expect(visibleText('2 kg', { exact: true })).toBeVisible();
  await expect(visibleText('R$ 12,50', { exact: true })).toBeVisible();
  await screenshot('preview-393');
  await page.setViewportSize({ width: 320, height: 640 });
  await screenshot('preview-320');
  await page.setViewportSize({ width: 393, height: 852 });
  await button('Voltar à gestão do plano').click();
  await button('Publicar plano').click();
  await button('Confirmar').click();
  await expect(
    visibleText('Oferta publicada no catálogo.', { exact: true }),
  ).toBeVisible();
  await logout();
  await login('customer');
  await page
    .getByRole('textbox', { name: 'Buscar planos', exact: true })
    .fill(name);
  await button(`Ver plano ${name}, 1 cesta, R$ 12,50`).click();
  await expect(visibleText('R$ 12,50', { exact: true })).toBeVisible();
  await button('Assinar Plano').click();
  await page
    .getByRole('radio', {
      name: 'Cesta da jornada: Segunda-feira',
      exact: true,
    })
    .click();
  await button('Revisar contratação').click();
  await button('Confirmar contratação').click();
  await expect(
    visibleText('Contratação confirmada', { exact: true }),
  ).toBeVisible();
  await screenshot('receipt');
  const purchases = writes.filter(
    (w) => w.path === '/api/v1/assinaturas/' && w.status === 201,
  );
  expect(purchases).toHaveLength(1);
  const receipt = purchases[0].body;
  expect(receipt.plano).toBe(created.id);
  expect(receipt.valor_contratado).toBe('12.50');
  expect(receipt.programacoes).toHaveLength(1);
  await logout();
  await login('producer');
  await page.getByTestId('producer-planos-tab').click();
  await page
    .getByRole('textbox', { name: 'Buscar planos do produtor', exact: true })
    .fill(name);
  await button(`Gerenciar ${name}`).click();
  await button('Excluir plano').click();
  await button('Confirmar').click();
  await expect(
    visibleText(
      'Este plano possui assinaturas. Desative a oferta para preservar o histórico.',
      { exact: true },
    ),
  ).toBeVisible();
  await screenshot('protected-deletion');
  await button('Desativar oferta').click();
  await button('Cancelar').click();
  expect(
    writes.filter((w) => w.method === 'PATCH' && w.input?.is_ativo === false),
  ).toHaveLength(0);
  await button('Desativar oferta').click();
  await button('Confirmar').click();
  await expect(
    visibleText(
      'Oferta desativada. O histórico de assinaturas foi preservado.',
      { exact: true },
    ),
  ).toBeVisible();
  await screenshot('deactivated');
  await logout();
  await login('customer');
  await page
    .getByRole('textbox', { name: 'Buscar planos', exact: true })
    .fill(name);
  await expect(
    visibleText('Nenhum plano encontrado para essa busca.', { exact: true }),
  ).toBeVisible();
  await visibleText('Assinaturas', { exact: true }).last().click();
  await button(`Ver assinatura #${receipt.id}`).click();
  await expect(visibleText(name, { exact: true })).toBeVisible();
  await expect(visibleText('R$ 12,50', { exact: true })).toBeVisible();
  await screenshot('preserved-history');
  expect(
    writes.find(
      (w) =>
        w.method === 'DELETE' && w.path === `/api/v1/planos/${created.id}/`,
    ).status,
  ).toBe(409);
  expect(errors).toEqual([]);
});
