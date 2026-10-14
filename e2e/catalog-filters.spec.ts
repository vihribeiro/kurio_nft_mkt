import { expect, test } from '@playwright/test'
import { seedScenario, setScenario } from './support/mock'

test.describe('filtros do catálogo', () => {
  test.beforeEach(async ({ page }) => {
    await seedScenario(page, 'frozen-prices')
    await page.goto('/')
  })

  test('a faixa de preço é um slider acessível e persiste na URL', async ({ page }) => {
    if (test.info().project.name === 'mobile') {
      await page.getByRole('button', { name: 'Filtros' }).click()
    }

    const minSlider = page.getByRole('slider', { name: 'Preço mínimo em ETH' })
    await minSlider.focus()
    await page.keyboard.press('End')

    await expect(page).toHaveURL(/[?&]min=12\.3(?:&|$)/)
    await expect(page.getByText('Nenhum NFT encontrado com esses filtros.')).toBeVisible()

    await page.reload()
    await expect(page).toHaveURL(/[?&]min=12\.3(?:&|$)/)
    await expect(page.getByText('Nenhum NFT encontrado com esses filtros.')).toBeVisible()
  })

  test('combina filtros no REST e volta pelo histórico do navegador', async ({ page }) => {
    const catalogRequests: URL[] = []
    page.on('request', (request) => {
      if (request.url().startsWith('https://api.kurio.local/nfts?')) {
        catalogRequests.push(new URL(request.url()))
      }
    })

    await page.goto('/?colecao=kurio-apes&min=0.5&max=3&ordem=price-asc')

    const grid = page.getByTestId('catalog-grid')
    await expect(grid.locator('li')).toHaveCount(9)
    await expect.poll(() => catalogRequests.length).toBeGreaterThan(0)

    const request = catalogRequests.at(-1)
    expect(request?.searchParams.get('collectionId')).toBe('kurio-apes')
    expect(request?.searchParams.get('minPriceEth')).toBe('0.5')
    expect(request?.searchParams.get('maxPriceEth')).toBe('3')
    expect(request?.searchParams.get('sort')).toBe('price-asc')
    expect(request?.searchParams.get('page')).toBe('1')
    expect(request?.searchParams.get('pageSize')).toBe('9')

    const prices = await grid.locator('[data-testid^="nft-price-"]').allTextContents()
    const values = prices.map((text) => Number.parseFloat(text.replace(',', '.')))
    expect(values.every((value) => value >= 0.5 && value <= 3)).toBe(true)
    expect(values).toEqual([...values].sort((a, b) => a - b))

    await page.getByRole('combobox', { name: 'Ordenar por' }).selectOption('name')
    await expect(page).toHaveURL(/[?&]ordem=name(?:&|$)/)
    await page.goBack()
    await expect(page).toHaveURL(/[?&]ordem=price-asc(?:&|$)/)
    await expect(grid.locator('[data-testid^="nft-price-"]').first()).toContainText('ETH')
  })

  test('pagina resultados no servidor e restaura a página pelo histórico', async ({ page }) => {
    await page.goto('/')

    const grid = page.getByTestId('catalog-grid')
    await expect(grid.locator('li')).toHaveCount(9)
    const firstPageFirstCard = await grid.locator('li a').first().getAttribute('href')

    await page
      .getByRole('navigation', { name: 'Paginação' })
      .getByRole('button', { name: '2' })
      .click()
    await expect(page).toHaveURL(/[?&]pagina=2(?:&|$)/)
    await expect(grid.locator('li')).toHaveCount(9)
    await expect(grid.locator('li a').first()).not.toHaveAttribute('href', firstPageFirstCard ?? '')

    const secondPageFirstCard = await grid.locator('li a').first().getAttribute('href')
    await page.reload()
    await expect(page).toHaveURL(/[?&]pagina=2(?:&|$)/)
    await expect(grid.locator('li a').first()).toHaveAttribute('href', secondPageFirstCard ?? '')

    await page.goBack()
    await expect(page).not.toHaveURL(/[?&]pagina=2(?:&|$)/)
    await expect(grid.locator('li a').first()).toHaveAttribute('href', firstPageFirstCard ?? '')
  })

  test('latência variável permite respostas fora de ordem', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Emerald Ape #042')).toBeVisible()
    await expect(page.getByTestId('realtime-status')).toHaveText('Tempo real connected')
    await setScenario(page, 'variable-network')

    const search = page.getByRole('searchbox', { name: 'Buscar no catálogo' })
    await search.fill('Emerald')
    await search.fill('Crimson')

    await expect(page).toHaveURL(/[?&]q=Crimson(?:&|$)/)
    await expect(page.getByText('Crimson Ape #118').first()).toBeVisible()
    await page.waitForTimeout(1_400)
    await expect(page).toHaveURL(/[?&]q=Crimson(?:&|$)/)
    await expect(page.getByText('Crimson Ape #118').first()).toBeVisible()
    await expect(page.getByText('Emerald Ape #042')).toHaveCount(0)

    await setScenario(page, 'variable-network')
    const completionOrder = await page.evaluate(async (apiUrl) => {
      const completed: string[] = []
      const request = async (term: string): Promise<void> => {
        const response = await fetch(`${apiUrl}/nfts?q=${term}`)
        if (!response.ok) throw new Error(`Catálogo respondeu ${response.status}`)
        await response.json()
        completed.push(term)
      }

      await Promise.all([request('Emerald'), request('Crimson')])
      return completed
    }, 'https://api.kurio.local')

    expect(completionOrder).toEqual(['Crimson', 'Emerald'])
  })
})
