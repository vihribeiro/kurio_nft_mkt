import { expect, test } from '@playwright/test'
import { disconnectSockets, emitPrice, seedScenario, setListing, setPrice } from './support/mock'
import { addToCart } from './support/session'

/**
 * Robustez do tempo real.
 *
 * A UI nunca pode regredir por causa de um evento repetido ou fora de ordem.
 * A guarda é a VERSÃO do preço: um evento só entra no cache se for mais novo
 * que o que já está lá. Aqui os eventos são injetados "crus" (sem tocar no
 * estado do servidor), então o que a tela faz depende só da guarda do cliente.
 */
test.describe('tempo real — eventos recorrentes', () => {
  test('evento repetido ou fora de ordem não regride o preço', async ({ page }) => {
    await seedScenario(page, 'frozen-prices')
    await page.goto('/nft/emerald-ape-042')

    const price = page.getByTestId('nft-detail-price')
    await expect(price).toHaveText('1.19 ETH')

    // Mudança "de verdade" pelo servidor: 1.19 -> 1.25 (versão sobe).
    const snapshot = await setPrice(page, 'emerald-ape-042', '1.25')
    await expect(price).toHaveText('1.25 ETH')

    // Evento REPETIDO (mesma versão) com preço absurdo: descartado.
    await emitPrice(page, { nftId: 'emerald-ape-042', priceEth: '9.99', version: snapshot.version })
    await page.waitForTimeout(700)
    await expect(price).toHaveText('1.25 ETH')

    // Evento VELHO (versão anterior) com preço absurdo: descartado.
    await emitPrice(page, {
      nftId: 'emerald-ape-042',
      priceEth: '8.88',
      version: snapshot.version - 1,
    })
    await page.waitForTimeout(700)
    await expect(price).toHaveText('1.25 ETH')

    // Evento NOVO (versão seguinte): aplica — prova que a guarda não é "ignora tudo".
    await emitPrice(page, {
      nftId: 'emerald-ape-042',
      priceEth: '1.3',
      version: snapshot.version + 1,
    })
    await expect(price).toHaveText('1.3 ETH')
  })

  test('preço e disponibilidade reconciliam o carrinho ativo', async ({ page }) => {
    await seedScenario(page, 'frozen-prices')
    await addToCart(page, 'emerald-ape-042')

    await expect(page.getByTestId('cart-item-emerald-ape-042')).toBeVisible()
    await setPrice(page, 'emerald-ape-042', '1.55')
    await expect(page.getByTestId('cart-price-emerald-ape-042')).toHaveText('1.55 ETH')
    await expect(page.getByTestId('cart-total')).toHaveText('1.551 ETH')

    await setListing(page, 'emerald-ape-042', false)

    await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
  })

  test('reconectar reautentica e restaura as subscriptions de mercado', async ({ page }) => {
    await seedScenario(page, 'frozen-prices')
    await page.goto('/nft/emerald-ape-042')

    const connectionStatus = page.getByTestId('realtime-status')
    await expect(connectionStatus).toHaveText('Tempo real connected')
    await disconnectSockets(page)
    await expect(connectionStatus).toHaveText(/Tempo real (disconnected|connecting)/)
    await expect(connectionStatus).toHaveText('Tempo real connected', { timeout: 10_000 })

    await setPrice(page, 'emerald-ape-042', '1.31')
    await expect(page.getByTestId('nft-detail-price')).toHaveText('1.31 ETH')
  })
})
