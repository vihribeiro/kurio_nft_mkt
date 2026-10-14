import { expect, test } from '@playwright/test'
import { seedScenario, setListing, setPrice } from './support/mock'
import { addToCart, submitLogin } from './support/session'

/**
 * Mudança de preço DURANTE o checkout.
 *
 * A cotação exibida deixou de valer. A tela precisa avisar e BLOQUEAR a
 * confirmação até o usuário recotar — cobrar um valor que ele não viu é o pior
 * desfecho possível. Há também a defesa no servidor (409 `stale_quote`), mas o
 * cliente percebe pela assinatura de preços e evita a tentativa.
 */
test.describe('checkout com cotação desatualizada', () => {
  test('bloqueia a confirmação e libera após recotar', async ({ page }) => {
    await seedScenario(page, 'frozen-prices')
    await addToCart(page, 'emerald-ape-042')
    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await submitLogin(page)

    await expect(page.getByTestId('checkout-total')).toHaveText('1.191 ETH')

    // O mercado muda o preço da obra que está no carrinho.
    await setPrice(page, 'emerald-ape-042', '2.00')

    const alert = page.getByTestId('stale-quote-alert')
    await expect(alert).toBeVisible()
    await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled()

    // Recotar alinha a cotação com o servidor e libera o botão.
    await page.getByRole('button', { name: 'Recotar preços' }).click()
    await expect(alert).toBeHidden()
    await expect(page.getByTestId('checkout-total')).toHaveText('2.001 ETH')
    await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled()

    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page).toHaveURL(/\/order\/order_/)
    await expect(page.getByTestId('order-total')).toHaveText('2.001 ETH')
  })

  test('disponibilidade esgotada remove o item e bloqueia o checkout', async ({ page }) => {
    await seedScenario(page, 'frozen-prices')
    await addToCart(page, 'emerald-ape-042')
    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await submitLogin(page)

    await setListing(page, 'emerald-ape-042', false)

    await expect(
      page.getByText('Uma obra do carrinho não está mais disponível.', { exact: false }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled()

    await page.getByRole('button', { name: 'Atualizar carrinho' }).click()
    await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
  })
})
