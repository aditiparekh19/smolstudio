import { test, expect } from '@playwright/test';

test('homepage renders the SmolStudio storefront', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/SmolStudio/);
  await expect(page.getByRole('heading', { name: /Little clothes/i })).toBeVisible();
});
