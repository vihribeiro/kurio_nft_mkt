import { expect, test, type Page } from '@playwright/test'
import { seedScenario } from './support/mock'
import { login } from './support/session'

/**
 * Guarda de layout: nenhuma rolagem horizontal.
 *
 * O enunciado exige telas em 390px. Um elemento largo demais faz o Chrome de
 * celular reduzir o zoom ("shrink to fit"), o que distorce a tela inteira e,
 * como consequência, quebra cliques por coordenada. Medimos a diferença entre
 * a largura do conteúdo e a largura do viewport — precisa ser ~0.
 *
 * Toleramos 1px para arredondamentos de subpixel.
 */
async function overflowAt(page: Page): Promise<number> {
  // O service worker do MSW assume a página na primeira navegação e pode
  // recarregá-la; por isso medimos depois do conteúdo montar e com retry.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.locator('main').waitFor({ state: 'visible' })
      return await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
    } catch {
      await page.waitForTimeout(300)
    }
  }
  throw new Error('não foi possível medir a largura (navegação instável)')
}

async function expectNoHorizontalScroll(page: Page, route: string): Promise<void> {
  await page.goto(route)
  const overflow = await overflowAt(page)
  expect(overflow, `rolagem horizontal em ${route}`).toBeLessThanOrEqual(1)
}

test.describe('layout responsivo', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('as páginas públicas cabem em 390px', async ({ page }) => {
    await seedScenario(page, 'frozen-prices')

    for (const route of ['/', '/login', '/cart']) {
      await expectNoHorizontalScroll(page, route)
    }
  })

  test('as páginas de conta cabem em 390px', async ({ page }) => {
    await seedScenario(page, 'frozen-prices')
    await login(page)

    for (const route of ['/profile', '/wallets']) {
      await expectNoHorizontalScroll(page, route)
    }
  })

  test('o layout também cabe no breakpoint tablet de 768px', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await seedScenario(page, 'frozen-prices')
    await expectNoHorizontalScroll(page, '/')
  })

  test('Mercado mantém o traço ativo de 4px após seleção', async ({ page, isMobile }) => {
    test.skip(isMobile, 'a navegação editorial existe apenas no cabeçalho desktop')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    const navigation = page.getByRole('navigation', { name: 'Principal' })
    const marketLink = navigation.getByRole('link', { name: 'Mercado' })
    await marketLink.click()

    await expect(page).toHaveURL(/#catalogo$/)
    await expect(marketLink).toHaveAttribute('aria-current', 'page')
    await expect(navigation.getByRole('link', { name: 'Início' })).not.toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect
      .poll(() => marketLink.evaluate((element) => getComputedStyle(element, '::after').height))
      .toBe('4px')
  })

  test('botão Entrar segue as medidas e o ícone do elemento Login do Figma', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'o botão de entrar aparece no cabeçalho desktop')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    const login = page.getByRole('link', { name: 'Entrar' })
    await expect(login).toHaveAttribute('href', '/login')
    const icon = login.locator('svg')
    await expect(icon).toBeVisible()
    await expect(icon).toHaveAttribute('viewBox', '1230 32 18 18')
    await expect(icon.locator('path')).toHaveCount(3)
    await expect(icon).toHaveCSS('color', 'rgb(20, 13, 10)')
    const iconBounds = await icon.boundingBox()
    expect(iconBounds?.width).toBe(18)
    expect(iconBounds?.height).toBe(18)

    const bounds = await login.boundingBox()
    expect(bounds?.width).toBe(100)
    expect(bounds?.height).toBe(35)
    await expect(login).toHaveCSS('border-radius', '6px')
    await expect(login).toHaveCSS('background-color', 'rgb(210, 138, 76)')
    await expect(login).toHaveCSS('font-size', '12px')

    await login.click()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('destaques e newsletter seguem os frames 100/101 do footer', async ({ page }) => {
    if (test.info().project.name === 'desktop') {
      await page.setViewportSize({ width: 1440, height: 900 })
    }
    await page.goto('/')

    const strip = page.getByRole('region', { name: 'Diferenciais e próximos lançamentos' })
    await expect(strip.getByText('Segurança da carteira')).toBeVisible()
    await expect(strip.getByText('Criadores em destaque')).toBeVisible()
    await expect(strip.getByText('Alertas de lançamentos')).toBeVisible()
    await expect(
      strip.getByRole('heading', { name: 'Antecipe-se ao próximo lançamento' }),
    ).toBeVisible()
    await expect(strip.locator('article span[aria-hidden="true"]')).toHaveCount(3)

    if (test.info().project.name === 'desktop') {
      const stripBox = await strip.boundingBox()
      expect(stripBox?.width).toBe(1200)
      expect(stripBox?.height).toBe(250)
    }

    const email = strip.getByLabel('Seu e-mail')
    const submit = strip.getByRole('button', { name: 'Enviar' })
    await email.scrollIntoViewIfNeeded()
    const [emailBox, submitBox] = await Promise.all([email.boundingBox(), submit.boundingBox()])
    expect(emailBox).not.toBeNull()
    expect(submitBox).not.toBeNull()
    expect(submitBox!.y).toBe(emailBox!.y)
    expect(submitBox!.height).toBe(emailBox!.height)
    expect(Math.abs(emailBox!.x + emailBox!.width - submitBox!.x)).toBeLessThanOrEqual(1)
  })
})
