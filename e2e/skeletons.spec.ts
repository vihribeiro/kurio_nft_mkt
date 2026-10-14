import { expect, test } from '@playwright/test'
import { seedScenario, setScenario } from './support/mock'

/**
 * Esqueletos de carregamento (shimmer).
 *
 * O cenário `slow-network` atrasa toda resposta em ~1,2s, o que dá uma janela
 * confortável para observar o esqueleto antes do conteúdo. Isso prova, de
 * verdade, que existe um estado de carregamento — e não só que a tela "aparece
 * rápido demais para ver".
 */
test.describe('esqueletos de carregamento', () => {
  test.beforeEach(async ({ page }) => {
    await seedScenario(page, 'slow-network')
  })

  test('o catálogo mostra o shimmer e depois os NFTs', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByTestId('catalog-skeleton')).toBeVisible()
    await expect(page.getByText('Emerald Ape #042')).toBeVisible()
    await expect(page.getByTestId('catalog-skeleton')).toBeHidden()
  })

  test('o detalhe mostra o shimmer e depois o NFT', async ({ page }) => {
    await page.goto('/nft/emerald-ape-042')

    await expect(page.getByTestId('nft-detail-skeleton')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Emerald Ape #042', level: 1 })).toBeVisible()
    await expect(page.getByTestId('nft-detail-skeleton')).toBeHidden()
  })

  test('o resumo do carrinho mostra o shimmer e depois os totais', async ({ page }) => {
    await page.goto('/cart')

    await expect(page.getByTestId('cart-summary-skeleton')).toBeVisible()
    await expect(page.getByTestId('cart-total')).toBeVisible()
    await expect(page.getByTestId('cart-summary-skeleton')).toBeHidden()
  })

  test('falha de conexão mostra retry e recupera quando a rede volta', async ({ page }) => {
    await seedScenario(page, 'network-offline')
    await page.goto('/')

    await expect(
      page.getByRole('alert').getByRole('button', { name: 'Tentar de novo' }),
    ).toBeVisible()
    await setScenario(page, 'frozen-prices')
    await page.getByRole('button', { name: 'Tentar de novo' }).click()

    await expect(page.getByText('Emerald Ape #042')).toBeVisible()
  })
})
