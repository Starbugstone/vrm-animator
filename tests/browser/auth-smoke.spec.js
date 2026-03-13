import { expect, test } from '@playwright/test'

test('auth screen loads and can switch to register mode', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('VRM Animator')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByText('What happens next')).toBeVisible()

  await page.getByRole('button', { name: 'Register' }).first().click()

  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible()
  await expect(page.getByPlaceholder('Display name')).toBeVisible()
  await expect(page.locator('form').getByRole('button', { name: 'Register' })).toBeVisible()
})
