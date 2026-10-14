import { expect, test } from '@playwright/test'
import { armCheckoutTimeout, fetchOrders, setScenario, seedScenario } from './support/mock'
import { addToCart, submitLogin } from './support/session'

/**
 * Falhas no pagamento.
 *
 * O cenário `checkout-error` faz o `POST /orders` responder 502. O que importa
 * é a RECUPERAÇÃO: o carrinho não pode ser destruído por uma falha, e uma
 * segunda tentativa precisa funcionar.
 */
test.describe('falhas no checkout', () => {
  test('valida dados do colecionador antes de criar pedido', async ({ page }) => {
    await seedScenario(page, 'frozen-prices')
    await addToCart(page, 'emerald-ape-042')
    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await submitLogin(page)

    await page.getByLabel('Nome de exibição *').fill('A')
    await page.getByLabel('E-mail *').fill('e-mail-inválido')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()

    await expect(page.locator('#displayName-error')).toHaveText('Informe o nome do colecionador.')
    await expect(page.locator('#email-error')).toHaveText('Informe um e-mail válido.')
    await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled()
    await expect(page).toHaveURL(/\/checkout$/)
  })

  test('pagamento recusado avisa e o carrinho sobrevive', async ({ page }) => {
    await seedScenario(page, 'checkout-error')

    await addToCart(page, 'emerald-ape-042')
    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await submitLogin(page)

    await page.getByRole('button', { name: 'Desconectar carteira' }).click()
    await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled()
    await page.getByRole('button', { name: 'Reconectar carteira' }).click()

    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByText('Não foi possível processar o pagamento.')).toBeVisible()

    // Continua no checkout, com o item no carrinho (nada foi cobrado).
    await expect(page).toHaveURL(/\/checkout$/)
    await expect(page.getByTestId('checkout-total')).toHaveText('1.191 ETH')

    // Recuperação: o caminho feliz volta a valer e a compra conclui.
    await setScenario(page, 'frozen-prices')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()

    await expect(page).toHaveURL(/\/order\/order_/)
    await expect(
      page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' }),
    ).toBeVisible()
  })

  test('timeout na criação recupera o MESMO pedido (idempotência)', async ({ page }) => {
    // Duas tentativas de checkout, uma delas estourando o timeout do cliente.
    test.setTimeout(60_000)

    await seedScenario(page, 'frozen-prices')
    await addToCart(page, 'emerald-ape-042')
    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await submitLogin(page)

    // A PRIMEIRA requisição demora mais que os 10s do Axios: o cliente desiste,
    // mas o servidor segue e cria o pedido.
    await armCheckoutTimeout(page)
    await page.getByRole('button', { name: 'Confirmar compra' }).click()

    await expect(page.getByText('A requisição demorou demais. Tente de novo.')).toBeVisible({
      timeout: 20_000,
    })
    await expect(page).toHaveURL(/\/checkout$/)

    // Segunda tentativa, MESMA chave de idempotência -> o mesmo pedido.
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page).toHaveURL(/\/order\/order_/, { timeout: 20_000 })
    await expect(page.getByTestId('order-code')).toHaveText('0xA91F3B7CE82C')

    // Deixa a primeira requisição terminar no servidor e confirma: NÃO houve
    // pedido duplicado.
    await page.waitForTimeout(3_000)
    const orders = await fetchOrders(page)
    expect(orders).toHaveLength(1)
    expect(orders[0]?.code).toBe('0xA91F3B7CE82C')
  })

  test('recusa da carteira cria estado terminal e preserva o carrinho', async ({ page }) => {
    await seedScenario(page, 'payment-declined')
    await addToCart(page, 'emerald-ape-042')
    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await submitLogin(page)
    await page.getByRole('button', { name: 'Confirmar compra' }).click()

    await expect(page).toHaveURL(/\/order\/order_/)
    await expect(page.getByRole('heading', { name: 'Pagamento não confirmado' })).toBeVisible()
    await page.goto('/cart')
    await expect(page.getByTestId('cart-item-emerald-ape-042')).toBeVisible()
    await expect(page.getByTestId('cart-total')).toHaveText('1.191 ETH')
  })

  test('desconexão da carteira bloqueia envio e permite reconectar', async ({ page }) => {
    await seedScenario(page, 'wallet-disconnected')
    await addToCart(page, 'emerald-ape-042')
    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await submitLogin(page)

    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByText('Carteira desconectada')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled()

    await page.getByRole('button', { name: 'Reconectar carteira' }).click()
    await setScenario(page, 'frozen-prices')
    await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled()
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page).toHaveURL(/\/order\/order_/)
  })
})
