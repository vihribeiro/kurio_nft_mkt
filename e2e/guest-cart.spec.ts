import { expect, test, type Page } from '@playwright/test'
import { seedScenario } from './support/mock'
import { submitLogin } from './support/session'

async function addTwoGuestItems(page: Page, refreshBeforeSecond = false): Promise<void> {
  await page.goto('/nft/emerald-ape-042')
  await page.getByRole('button', { name: 'COMPRAR' }).click()
  await expect(page).toHaveURL(/\/cart$/)

  if (refreshBeforeSecond) await page.reload()

  // O resumo fixo do carrinho cobre a navegação inferior no layout mobile.
  await page.goto('/')
  await page.getByRole('link', { name: /Crimson Ape #118/ }).click()
  await page.getByRole('button', { name: 'COMPRAR' }).click()
  await expect(page).toHaveURL(/\/cart$/)
  await expect(page.getByTestId('cart-item-crimson-ape-118')).toBeVisible()
}

test.describe('carrinho visitante', () => {
  test.beforeEach(async ({ page }) => {
    await seedScenario(page, 'frozen-prices')
  })

  test('adicionar uma segunda obra mantém a primeira', async ({ page }) => {
    // A notificação do primeiro add continua visível: ela não deve bloquear a
    // navegação mobile nem fazer o visitante perder o carrinho.
    await addTwoGuestItems(page)

    await expect(page.getByTestId('cart-item-emerald-ape-042')).toBeVisible()
    await expect(page.getByTestId('cart-item-crimson-ape-118')).toBeVisible()
  })

  test('adicionar outra obra depois de refresh mantém o primeiro item', async ({ page }) => {
    // Reproduz literalmente: adiciona, atualiza a página e só então adiciona
    // uma segunda obra como visitante.
    await addTwoGuestItems(page, true)

    await expect(page.getByTestId('cart-item-emerald-ape-042')).toBeVisible()
    await expect(page.getByTestId('cart-item-crimson-ape-118')).toBeVisible()
  })

  test('mantém as duas obras após refresh e as adota no login', async ({ page }) => {
    await addTwoGuestItems(page)

    await page.reload()
    await expect(page.getByTestId('cart-item-emerald-ape-042')).toBeVisible()
    await expect(page.getByTestId('cart-item-crimson-ape-118')).toBeVisible()

    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await submitLogin(page)

    await expect(page).toHaveURL(/\/checkout$/)
    await expect(page.getByText('Emerald Ape #042')).toBeVisible()
    await expect(page.getByText('Crimson Ape #118')).toBeVisible()
  })
})
