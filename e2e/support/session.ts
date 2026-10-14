import { expect, type Page } from '@playwright/test'

/** Credenciais fictícias dos fixtures do mock. */
export const DEMO_EMAIL = 'alice@jungle.dev'
export const DEMO_PASSWORD = 'password'

/** Chave do token de sessão (`src/shared/auth/token-storage.ts`). */
const TOKEN_KEY = 'kurio.session.token'

async function sessionToken(page: Page): Promise<string | null> {
  return page.evaluate((key) => window.localStorage.getItem(key), TOKEN_KEY)
}

/**
 * Preenche e envia o formulário de login NA PÁGINA ATUAL.
 *
 * Separado do `login()` porque o fluxo de compra chega ao login já com um
 * `?redirect=` na URL — navegar de novo para `/login` perderia o destino.
 *
 * A confirmação é o TOKEN no `localStorage`, e não um botão do cabeçalho: no
 * celular não há cabeçalho (o Figma mobile não o desenha), então esse sinal
 * precisa valer nos dois viewports.
 */
export async function submitLogin(
  page: Page,
  email = DEMO_EMAIL,
  password = DEMO_PASSWORD,
): Promise<void> {
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect.poll(() => sessionToken(page)).not.toBeNull()
}

/** Confirma que há sessão ativa (independente de viewport). */
export async function expectAuthenticated(page: Page): Promise<void> {
  await expect.poll(() => sessionToken(page)).not.toBeNull()
}

/** Vai para o login e entra com as credenciais de demonstração. */
export async function login(
  page: Page,
  email = DEMO_EMAIL,
  password = DEMO_PASSWORD,
): Promise<void> {
  await page.goto('/login')
  await submitLogin(page, email, password)
}

/**
 * Sai da conta e espera a UI confirmar o logout.
 *
 * No desktop o "Sair" está no cabeçalho; no celular, no perfil (a barra
 * inferior leva até lá). Esperar o token sumir evita que a navegação seguinte
 * aborte o `DELETE /session` em voo e a identidade antiga sobreviva.
 */
export async function logout(page: Page): Promise<void> {
  let button = page.locator('[data-testid="logout"]:visible').first()

  if ((await button.count()) === 0) {
    await page.goto('/profile')
    button = page.locator('[data-testid="logout"]:visible').first()
  }

  await button.click()
  await expect.poll(() => sessionToken(page)).toBeNull()
}

/** Adiciona um NFT ao carrinho a partir da tela de detalhe. */
export async function addToCart(page: Page, nftId: string): Promise<void> {
  await page.goto(`/nft/${nftId}`)
  await page.getByRole('button', { name: 'COMPRAR' }).click()
  await expect(page).toHaveURL(/\/cart$/)
}
