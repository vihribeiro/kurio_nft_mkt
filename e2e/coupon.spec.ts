import { expect, test } from '@playwright/test'
import { seedScenario } from './support/mock'
import { addToCart, submitLogin } from './support/session'

/**
 * Cupom ponta a ponta.
 *
 * `KURIO10` = 10% de desconto. Com `emerald-ape-042` (1.19 ETH) e a taxa de
 * 0,06% sobre o líquido (piso 0.001):
 *
 *   subtotal 1.19 → desconto 0.119 → líquido 1.071 → taxa 0.001 → total 1.072
 *
 * O desconto é cálculo do SERVIDOR; a UI apenas exibe o que a API respondeu.
 */
test.describe('cupom', () => {
  test.beforeEach(async ({ page }) => {
    await seedScenario(page, 'frozen-prices')
  })

  test('cupom válido recalcula desconto, taxa e total', async ({ page }) => {
    await addToCart(page, 'emerald-ape-042')

    await page.getByLabel('Código promocional').fill('KURIO10')
    await page.getByRole('button', { name: 'Aplicar' }).click()

    await expect(page.getByText('KURIO10')).toBeVisible()
    await expect(page.getByTestId('cart-subtotal')).toHaveText('1.19 ETH')
    await expect(page.getByTestId('cart-discount')).toHaveText('(-) 0.119 ETH')
    await expect(page.getByTestId('cart-fee')).toHaveText('0.001 ETH')
    await expect(page.getByTestId('cart-total')).toHaveText('1.072 ETH')
  })

  test('cupom inválido mostra erro acessível e mantém o total', async ({ page }) => {
    await addToCart(page, 'emerald-ape-042')

    await page.getByLabel('Código promocional').fill('NAOEXISTE')
    await page.getByRole('button', { name: 'Aplicar' }).click()

    await expect(page.getByRole('alert')).toHaveText('Cupom promocional inválido.')
    await expect(page.getByTestId('cart-total')).toHaveText('1.191 ETH')
  })

  test('remover o cupom devolve o total cheio', async ({ page }) => {
    await addToCart(page, 'emerald-ape-042')

    await page.getByLabel('Código promocional').fill('KURIO10')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByTestId('cart-total')).toHaveText('1.072 ETH')

    await page.getByRole('button', { name: 'Remover cupom' }).click()

    await expect(page.getByTestId('cart-total')).toHaveText('1.191 ETH')
    await expect(page.getByTestId('cart-discount')).toHaveText('(-) 0.00')
  })

  test('o desconto viaja do carrinho até o pedido confirmado', async ({ page }) => {
    await addToCart(page, 'emerald-ape-042')

    await page.getByLabel('Código promocional').fill('KURIO10')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByTestId('cart-total')).toHaveText('1.072 ETH')

    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await submitLogin(page)

    await page.getByRole('button', { name: 'Confirmar compra' }).click()

    await expect(page).toHaveURL(/\/order\/order_/)
    await expect(page.getByTestId('order-discount')).toHaveText('(-) 0.119 ETH')
    await expect(page.getByTestId('order-total')).toHaveText('1.072 ETH')
  })
})
