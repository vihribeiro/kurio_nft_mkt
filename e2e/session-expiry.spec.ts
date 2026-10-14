import { expect, test } from '@playwright/test'
import { expireSession, seedScenario } from './support/mock'
import { addToCart, login, submitLogin } from './support/session'

/**
 * Expiração de sessão em pleno uso.
 *
 * O token morre (o E2E o revoga no mock) enquanto o app está logado. A próxima
 * requisição autenticada leva 401; o interceptor limpa o token E avisa o React,
 * o porteiro das rotas privadas manda ao login guardando o destino, e o login
 * devolve o usuário exatamente para onde ele estava — inclusive o checkout, com
 * o carrinho intacto.
 */
test.describe('expiração de sessão', () => {
  test.beforeEach(async ({ page }) => {
    await seedScenario(page, 'frozen-prices')
  })

  test('expira ao navegar e retoma o destino após entrar de novo', async ({ page }) => {
    await login(page)
    await page.goto('/profile')
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()

    await expireSession(page)

    // Navegação por SPA (sem recarregar): a tela de carteiras dispara GET
    // /wallets, que leva 401 e derruba a identidade. O link vive no menu
    // lateral da conta ("Minha conta"), presente nos dois tamanhos de tela.
    await page
      .getByRole('navigation', { name: 'Minha conta' })
      .getByRole('link', { name: 'Carteiras' })
      .click()

    await expect(page).toHaveURL(/\/login\?redirect=%2Fwallets/)
    await submitLogin(page)

    await expect(page).toHaveURL(/\/wallets$/)
    await expect(page.getByRole('heading', { name: 'Carteiras' })).toBeVisible()
  })

  test('expira durante o checkout e retoma o carrinho', async ({ page }) => {
    await addToCart(page, 'emerald-ape-042')
    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await submitLogin(page)
    await expect(page).toHaveURL(/\/checkout$/)

    // Espera a tela assentar (carrinho E carteiras): se expirarmos enquanto a
    // busca de carteiras ainda está no ar, ela leva 401 e o redirect acontece
    // antes do clique — o teste mediria a corrida, não o comportamento.
    await expect(page.getByTestId('checkout-total')).toHaveText('1.191 ETH')
    await expect(page.locator('input[name="wallet"]').first()).toBeVisible()

    await expireSession(page)

    await page.getByRole('button', { name: 'Confirmar compra' }).click()

    // POST /orders leva 401 -> login com o destino guardado.
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/)
    await submitLogin(page)

    // Contexto retomado: o item continua no carrinho e a compra conclui.
    await expect(page).toHaveURL(/\/checkout$/)
    await expect(page.getByTestId('checkout-total')).toHaveText('1.191 ETH')

    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page).toHaveURL(/\/order\/order_/)
    await expect(page.getByTestId('order-code')).toHaveText(/^0x[0-9A-F]+$/)
  })
})
