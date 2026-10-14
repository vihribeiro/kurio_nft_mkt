import { expect, test } from '@playwright/test'
import { addToCart, expectAuthenticated, login, logout, submitLogin } from './support/session'

/**
 * Sessão: login, cadastro, guarda de rota, refresh de link direto e logout.
 *
 * O login é diálogo no desktop e página no celular — o mesmo formulário, então
 * as mesmas asserções valem nos dois projetos.
 */
test.describe('sessão', () => {
  test('as credenciais de demonstração entram', async ({ page }) => {
    await login(page)

    await expectAuthenticated(page)
  })

  test('os campos têm rótulo acessível', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByLabel('E-mail')).toBeVisible()
    await expect(page.getByLabel('Senha', { exact: true })).toBeVisible()
  })

  test('respeita o ?redirect depois de entrar', async ({ page }) => {
    await page.goto('/login?redirect=%2Fwallets')
    await submitLogin(page)

    await expect(page).toHaveURL(/\/wallets$/)
    await expect(page.getByRole('heading', { name: 'Carteiras' })).toBeVisible()
  })

  test('link direto protegido sobrevive ao refresh', async ({ page }) => {
    await login(page)

    await page.goto('/wallets')
    await page.reload()

    await expect(page.getByRole('heading', { name: 'Carteiras' })).toBeVisible()
  })

  test('rota protegida sem sessão manda para o login', async ({ page }) => {
    await page.goto('/profile')

    await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile/)
  })

  test('credenciais inválidas mostram erro e não entram', async ({ page }) => {
    await page.goto('/login')

    await page.locator('input[type="email"]').fill('alice@jungle.dev')
    await page.locator('input[type="password"]').fill('senha-errada')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('criar conta entra com o perfil novo', async ({ page }) => {
    await page.goto('/login')

    await page.getByRole('tab', { name: 'Criar conta' }).click()
    await page.getByLabel('Nome de usuário').fill('Nova Colecionadora')
    await page.getByLabel('E-mail').fill('nova@jungle.dev')
    await page.getByLabel('Senha', { exact: true }).fill('segredo123')
    await page.getByLabel('Confirmar senha').fill('segredo123')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Criar conta' }).click()

    await expectAuthenticated(page)
    await page.goto('/profile')
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Nova Colecionadora')

    await logout(page)
    await page.goto('/login')
    await submitLogin(page, 'nova@jungle.dev', 'segredo123')
    await expectAuthenticated(page)
  })

  test('sair limpa a sessão', async ({ page }) => {
    await login(page)

    await logout(page)

    // Sem sessão, uma rota privada volta ao login.
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile/)
  })

  test('o carrinho é isolado por conta', async ({ page }) => {
    await login(page)
    await addToCart(page, 'emerald-ape-042')
    await expect(page.getByTestId('cart-subtotal')).toBeVisible()

    await logout(page)
    await login(page, 'bob@jungle.dev')

    await page.goto('/cart')
    await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
  })
})
