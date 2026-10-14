import { expect, test } from '@playwright/test'
import { disconnectSockets, fetchOrders, replayOrder, seedScenario } from './support/mock'
import { addToCart, submitLogin } from './support/session'

/**
 * Fluxo de compra ponta a ponta.
 *
 * Preços CONGELADOS (`frozen-prices`): o canal de tempo real continua aberto,
 * mas o servidor não emite alterações — por isso as somas abaixo são exatas.
 * Com preços vivos, qualquer asserção de total seria flaky por definição.
 *
 * Fixtures: emerald-ape-042 = 1.19 ETH. Taxa = 0,06% do subtotal, piso 0.001.
 */
test.describe('carrinho e compra', () => {
  test.beforeEach(async ({ page }) => {
    await seedScenario(page, 'frozen-prices')
  })

  test('adicionar ao carrinho soma subtotal, taxa e total', async ({ page }) => {
    await addToCart(page, 'emerald-ape-042')

    await expect(page.getByTestId('cart-price-emerald-ape-042')).toHaveText('1.19 ETH')
    await expect(page.getByTestId('cart-subtotal')).toHaveText('1.19 ETH')
    await expect(page.getByTestId('cart-fee')).toHaveText('0.001 ETH')
    await expect(page.getByTestId('cart-total')).toHaveText('1.191 ETH')
  })

  test('aumentar a quantidade multiplica a linha e o subtotal', async ({ page }) => {
    await addToCart(page, 'emerald-ape-042')

    await page.getByRole('button', { name: 'Aumentar quantidade' }).click()

    await expect(page.getByTestId('cart-subtotal')).toHaveText('2.38 ETH')
    await expect(page.getByTestId('cart-fee')).toHaveText('0.001 ETH')
    await expect(page.getByTestId('cart-total')).toHaveText('2.381 ETH')
  })

  test('remover esvazia o carrinho', async ({ page }) => {
    await addToCart(page, 'emerald-ape-042')

    await page.getByRole('button', { name: 'Remover' }).click()

    await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
  })

  test('finalizar exige login e volta para o pagamento', async ({ page }) => {
    await addToCart(page, 'emerald-ape-042')

    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()

    await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/)
    await submitLogin(page)
    await expect(page).toHaveURL(/\/checkout$/)
  })

  test('a compra confirmada vem do servidor, com código e total', async ({ page }) => {
    test.setTimeout(12_000)
    let orderRequest: Record<string, unknown> | undefined
    page.on('request', (request) => {
      if (request.url() === 'https://api.kurio.local/orders' && request.method() === 'POST') {
        orderRequest = request.postDataJSON() as Record<string, unknown>
      }
    })

    await addToCart(page, 'emerald-ape-042')
    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await submitLogin(page)

    await page.getByLabel('Nome de exibição *').fill('Alice da Floresta')
    await page.getByLabel('E-mail *').fill('alice.checkout@jungle.dev')
    await page.getByLabel('Rede', { exact: true }).selectOption('Polygon')
    await page.getByLabel('Observação do colecionador (opcional)').fill('Entrega revisada')

    await page.getByRole('button', { name: 'Confirmar compra' }).click()

    await expect(page).toHaveURL(/\/order\/order_/)
    await expect(
      page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' }),
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('order-code')).toHaveText(/^0x[0-9A-F]+$/)
    await expect(page.getByTestId('order-total')).toHaveText('1.191 ETH')
    await expect(page.getByTestId('order-collector')).toHaveText(
      'Alice da Floresta · alice.checkout@jungle.dev',
    )
    await expect(page.getByTestId('order-note')).toHaveText('Observação: Entrega revisada')
    await expect(page.getByTestId('order-network')).toHaveText('Polygon')

    expect(orderRequest).toBeDefined()
    const replay = await replayOrder(page, orderRequest!)
    expect(replay.status).toBe(200)
    expect(replay.body.id).toBe(new URL(page.url()).pathname.split('/').at(-1))

    const conflictingReplay = await replayOrder(page, { ...orderRequest!, network: 'Ethereum' })
    expect(conflictingReplay.status).toBe(409)
    expect(conflictingReplay.body.code).toBe('idempotency_conflict')

    // O servidor esvaziou o carrinho; o cache local acompanhou.
    await page.goto('/cart')
    await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
  })

  test('recupera o estado do pedido pendente após refresh', async ({ page }) => {
    test.setTimeout(15_000)
    await addToCart(page, 'emerald-ape-042')
    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await submitLogin(page)
    await page.getByRole('button', { name: 'Confirmar compra' }).click()

    await expect(page).toHaveURL(/\/order\/order_/)
    await expect(page.getByRole('heading', { name: 'Pagamento em processamento' })).toBeVisible()
    await disconnectSockets(page)
    await expect(page.getByTestId('realtime-status')).toHaveText(
      /Tempo real (disconnected|connecting)/,
    )
    await expect(page.getByTestId('realtime-status')).toHaveText('Tempo real connected', {
      timeout: 10_000,
    })
    await page.reload()

    await expect(
      page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' }),
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('order-code')).toHaveText(/^0x[0-9A-F]+$/)
    expect(await fetchOrders(page)).toHaveLength(1)
  })
})
