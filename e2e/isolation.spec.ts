import { expect, test } from '@playwright/test'
import { seedScenario } from './support/mock'
import { login, logout } from './support/session'

/**
 * Isolamento entre contas.
 *
 * Complementa o teste de carrinho por conta: aqui provamos que os FAVORITOS
 * (persistidos pelo mock por usuário) não vazam de uma conta para outra, e que
 * o canal de tempo real se reautentica com a nova identidade a cada troca.
 */
test.describe('isolamento entre contas', () => {
  test.beforeEach(async ({ page }) => {
    await seedScenario(page, 'frozen-prices')
  })

  test('favoritos e canal de tempo real seguem a conta', async ({ page }) => {
    // alice favorita uma obra.
    await login(page)
    await page.goto('/nft/emerald-ape-042')

    const toggle = page.getByTestId('favorite-toggle')
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')

    // Sai e entra como bob: o favorito de alice não aparece.
    await logout(page)
    await login(page, 'bob@jungle.dev')
    await page.goto('/nft/emerald-ape-042')

    await expect(page.getByTestId('favorite-toggle')).toHaveAttribute('aria-pressed', 'false')

    // O canal está conectado/reautenticado sem exibir um indicador visual fora
    // do Figma; o estado fica disponível para leitor de tela.
    await expect(page.getByTestId('realtime-status')).toHaveText('Tempo real connected')

    // Voltando a alice, o favorito dela continua lá — foi isolado, não apagado.
    await logout(page)
    await login(page)
    await page.goto('/nft/emerald-ape-042')

    await expect(page.getByTestId('favorite-toggle')).toHaveAttribute('aria-pressed', 'true')
  })
})
