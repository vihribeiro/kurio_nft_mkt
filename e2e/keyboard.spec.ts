import { expect, test, type Page } from '@playwright/test'
import { seedScenario } from './support/mock'
import { addToCart, submitLogin } from './support/session'

/**
 * Diálogo de autenticação e teclado.
 *
 * No desktop o login é um Radix Dialog: scrim, foco PRESO e ESC. No celular a
 * mesma peça vira página (sem diálogo), então este teste só roda no desktop.
 */
test.describe('acessibilidade do diálogo de login', () => {
  test.skip(({ isMobile }) => isMobile, 'no celular o login é página, não diálogo')

  const focusInsideDialog = (page: Page): Promise<boolean> =>
    page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))

  test('prende o foco e permite navegar por teclado', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('dialog')).toBeVisible()

    // O foco inicial cai DENTRO do diálogo (não no resto da página).
    await expect.poll(() => focusInsideDialog(page)).toBe(true)

    // Tab repetidamente: o foco nunca escapa do diálogo.
    for (let index = 0; index < 10; index += 1) {
      await page.keyboard.press('Tab')
      expect(await focusInsideDialog(page)).toBe(true)
    }

    // O tab chega ao envio do formulário.
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
  })

  test('ESC fecha o diálogo', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('o diálogo de cadastro mantém o foco dentro da janela', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('tab', { name: 'Criar conta' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect.poll(() => focusInsideDialog(page)).toBe(true)

    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press('Tab')
      expect(await focusInsideDialog(page)).toBe(true)
    }
  })

  test('o diálogo do recibo também mantém o foco preso', async ({ page }) => {
    test.setTimeout(20_000)
    await seedScenario(page, 'frozen-prices')
    await addToCart(page, 'emerald-ape-042')
    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await submitLogin(page)
    await page.getByRole('button', { name: 'Confirmar compra' }).click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' }),
    ).toBeVisible({
      timeout: 10_000,
    })
    await expect.poll(() => focusInsideDialog(page)).toBe(true)

    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press('Tab')
      expect(await focusInsideDialog(page)).toBe(true)
    }
  })
})
