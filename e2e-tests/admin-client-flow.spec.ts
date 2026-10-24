import { test, expect } from '@playwright/test';

test('admin user can navigate to clients page and open new client modal', async ({ page }) => {
  // Start from home page
  await page.goto('/');

  // Click on the demo admin button (HeroSection button)
  // The HeroSection button likely has text like 'Acessar Painel Admin' or similar.
  // Let's find a button with text containing 'Admin' or 'Painel Admin'
  const adminDemoButton = page.getByRole('button', { name: /Admin/i });
  // If not found, fallback to getByText
  await expect(adminDemoButton).toBeVisible({ timeout: 5000 });
  await adminDemoButton.click();

  // After clicking, we should be redirected to /admin and see admin dashboard title
  await expect(page).toHaveURL(/\/admin$/, { timeout: 5000 });
  const adminTitle = page.getByRole('heading', { name: /Painel Executivo do Administrador/i });
  await expect(adminTitle).toBeVisible({ timeout: 5000 });

  // Open sidebar (if on mobile? but we are desktop). The sidebar is visible by default on lg.
  // Click on the nav item 'Makers & Assinantes'
  const makersLink = page.getByRole('link', { name: /Makers & Assinantes/i });
  await expect(makersLink).toBeVisible({ timeout: 5000 });
  await makersLink.click();

  // Wait for navigation to /admin/clientes
  await expect(page).toHaveURL(/\/admin\/clientes$/, { timeout: 5000 });
  const clientsTitle = page.getByRole('heading', { name: /Gestão de Clientes & Assinantes/i });
  await expect(clientsTitle).toBeVisible({ timeout: 5000 });

  // Click button to open new client modal (likely in AdminClientsTable)
  const newClientButton = page.getByRole('button', { name: /Novo/i });
  // Might be inside the table; let's just click button with text 'Novo' or '+'
  await expect(newClientButton).toBeVisible({ timeout: 5000 });
  await newClientButton.click();

  // Expect modal to appear with heading containing 'Novo' or 'Cliente'
  const modalTitle = page.getByRole('heading', { name: /Novo/i });
  await expect(modalTitle).toBeVisible({ timeout: 5000 });
});