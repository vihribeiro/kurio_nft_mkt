import { expect, test, type Page } from '@playwright/test'
import { seedScenario } from './support/mock'
import { addToCart, submitLogin } from './support/session'

/**
 * Regressão visual.
 *
 * Quatro telas do enunciado — início, detalhe, carrinho e pagamento — com
 * dados DETERMINÍSTICOS: cenário `frozen-prices` (nenhum tick de tempo real) +
 * fixtures fixas. Os baselines ficam versionados junto do código
 * (`e2e/visual.spec.ts-snapshots/`), um por projeto (desktop e mobile).
 *
 * `settle` estabiliza o que é volátil ANTES do print: imagens decodificadas
 * (inclusive as `loading="lazy"` abaixo da dobra), canal de tempo real
 * conectado e nenhum toast na tela.
 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    // Rola até o fim para disparar o lazyload e espera toda imagem terminar.
    window.scrollTo(0, document.body.scrollHeight)
    await Promise.all(
      Array.from(document.images)
        // Imagens em seções ocultas por breakpoint não iniciam o lazyload.
        .filter((image) => image.getClientRects().length > 0)
        .map((image) =>
          image.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                image.addEventListener('load', () => resolve(), { once: true })
                image.addEventListener('error', () => resolve(), { once: true })
              }),
        ),
    )
    window.scrollTo(0, 0)
  })

  // O status não é visual no Figma, mas o app o expõe para tecnologias
  // assistivas; aguardar a conexão estabiliza o canal antes da captura.
  await expect(page.getByTestId('realtime-status')).toHaveText('Tempo real connected')

  // Toast some sozinho; tirar o mouse de cima evita congelar o auto-dismiss.
  await page.mouse.move(0, 0)
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 10_000 })
}

const screenshot = { fullPage: true, animations: 'disabled', maxDiffPixelRatio: 0.01 } as const

test.describe('regressão visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await seedScenario(page, 'frozen-prices')
  })

  test('início', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Explorar' })).toBeVisible()
    await settle(page)

    await expect(page).toHaveScreenshot('inicio.png', screenshot)
  })

  test('detalhe do NFT', async ({ page }) => {
    await page.goto('/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { name: 'Emerald Ape #042', level: 1 })).toBeVisible()
    await settle(page)

    await expect(page).toHaveScreenshot('detalhe.png', screenshot)
  })

  test('carrinho', async ({ page }) => {
    await addToCart(page, 'emerald-ape-042')
    await expect(page.getByTestId('cart-total')).toHaveText('1.191 ETH')
    await settle(page)

    await expect(page).toHaveScreenshot('carrinho.png', screenshot)
  })

  test('pagamento', async ({ page }) => {
    await addToCart(page, 'emerald-ape-042')
    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await submitLogin(page)
    await expect(page.getByTestId('checkout-total')).toHaveText('1.191 ETH')
    await settle(page)

    await expect(page).toHaveScreenshot('pagamento.png', screenshot)
  })
})
