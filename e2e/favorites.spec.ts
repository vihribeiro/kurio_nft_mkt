import { expect, test } from '@playwright/test'
import { seedScenario } from './support/mock'
import { login } from './support/session'

/**
 * Favoritos ponta a ponta.
 *
 * O mock espelha os favoritos no `localStorage` (chave por usuário), então a
 * persistência após refresh é de verdade: recarregar a página relê o estado sem
 * depender de sessão de rede. A falha controlada (`favorites-error`) devolve 500
 * com atraso para o teste conseguir observar o estado otimista e depois a
 * reversão.
 *
 * Os locators usam `data-testid` porque o rótulo do botão MUDA com o estado
 * ("Favoritar" ↔ "Favoritado"): casar por texto deixaria de encontrá-lo depois
 * do toggle.
 */
test.describe('favoritos', () => {
  test('favoritar no detalhe persiste após refresh', async ({ page }) => {
    await seedScenario(page, 'frozen-prices')
    await login(page)
    await page.goto('/nft/emerald-ape-042')

    const toggle = page.getByTestId('favorite-toggle')
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expect(toggle).toHaveText(/Favoritar$/)

    await toggle.click()

    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(toggle).toHaveText(/Favoritado$/)

    await page.reload()

    await expect(page.getByTestId('favorite-toggle')).toHaveAttribute('aria-pressed', 'true')
  })

  test('desfavoritar remove e também persiste', async ({ page }) => {
    await seedScenario(page, 'frozen-prices')
    await login(page)
    await page.goto('/nft/emerald-ape-042')

    const toggle = page.getByTestId('favorite-toggle')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')

    await page.reload()

    await expect(page.getByTestId('favorite-toggle')).toHaveAttribute('aria-pressed', 'false')
  })

  test('visitante é levado ao login com volta para o NFT', async ({ page }) => {
    await page.goto('/nft/emerald-ape-042')

    await page.getByTestId('favorite-toggle').click()

    await expect(page).toHaveURL(/\/login\?redirect=%2Fnft%2Femerald-ape-042/)
  })

  test('favoritar no card do catálogo reflete no estado', async ({ page }) => {
    await seedScenario(page, 'frozen-prices')
    await login(page)
    await page.goto('/')

    const icon = page.getByTestId('favorite-toggle-emerald-ape-042').first()
    await expect(icon).toHaveAttribute('aria-pressed', 'false')

    await icon.click()

    await expect(icon).toHaveAttribute('aria-pressed', 'true')
  })

  test('falha na mutation reverte o estado otimista', async ({ page }) => {
    await seedScenario(page, 'favorites-error')
    await login(page)
    await page.goto('/nft/emerald-ape-042')

    const toggle = page.getByTestId('favorite-toggle')
    await toggle.click()

    // O update otimista marca o favorito NA HORA…
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')

    // …e a falha do servidor devolve o estado anterior.
    await expect(toggle).toHaveAttribute('aria-pressed', 'false', { timeout: 5000 })
    await expect(page.getByText('Não foi possível salvar o favorito.')).toBeVisible()
  })
})
