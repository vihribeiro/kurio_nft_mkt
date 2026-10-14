import { expect, test } from '@playwright/test'

/**
 * Fumaça da fatia vertical: REST -> cache -> tela, mais o tempo real e a
 * navegação. Roda contra o bundle de produção (build + preview), então também
 * prova deep link e refresh.
 */
test.describe('catálogo', () => {
  test('lista os NFTs vindos do REST', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Explorar' })).toBeVisible()
    await expect(page.getByText('Emerald Ape #042')).toBeVisible()
    await expect(page.getByText('Aurora Relic #001')).toBeVisible()
  })

  test('mostra RARO apenas nos cartões com atributo de raridade Rara', async ({ page }) => {
    await page.goto('/')

    const aurora = page.locator('article').filter({
      has: page.getByRole('link', { name: /Aurora Relic #014/ }),
    })
    const notRare = page.locator('article').filter({
      has: page.getByRole('link', { name: /Onyx Ape #007/ }),
    })

    const rareBadge = aurora.getByText('RARO', { exact: true })
    await expect(rareBadge).toBeVisible()
    await expect(notRare.getByText('RARO', { exact: true })).toHaveCount(0)

    const badgeBounds = await rareBadge.boundingBox()
    expect(badgeBounds?.width).toBe(68)
    expect(badgeBounds?.height).toBe(32)
    await expect(rareBadge).toHaveCSS('border-radius', '0px')
    await expect(rareBadge).toHaveCSS('background-color', 'rgb(210, 138, 76)')
    await expect(rareBadge).toHaveCSS('color', 'rgb(20, 13, 10)')
  })

  test('o preço muda por tempo real, sem recarregar a página', async ({ page }) => {
    await page.goto('/')

    const price = page.getByTestId('nft-price-emerald-ape-042')
    await expect(price).toBeVisible()

    const initial = (await price.textContent())?.trim() ?? ''
    expect(initial).toContain('ETH')

    // Nenhum refetch, nenhum reload: só o evento escrevendo no cache.
    await expect(price).not.toHaveText(initial, { timeout: 15_000 })
  })

  test('abre o detalhe do NFT ao clicar no cartão', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('link', { name: /Emerald Ape #042/ }).click()

    await expect(page).toHaveURL(/\/nft\/emerald-ape-042$/)
    await expect(page.getByRole('heading', { name: 'Emerald Ape #042', level: 1 })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Detalhes do NFT' })).toBeVisible()
  })

  test('mostra os links sociais compactos do frame de compartilhamento', async ({ page }) => {
    await page.goto('/nft/emerald-ape-042')

    const share = page.getByRole('navigation', { name: 'Compartilhar Emerald Ape #042' })
    await expect(
      share.getByRole('link', { name: 'Compartilhar Emerald Ape #042 no LinkedIn' }),
    ).toHaveAttribute('href', /linkedin\.com\/sharing\/share-offsite/)
    await expect(
      share.getByRole('link', { name: 'Compartilhar Emerald Ape #042 por e-mail' }),
    ).toHaveAttribute('href', /^mailto:/)
    await expect(
      share.getByRole('link', { name: 'Compartilhar Emerald Ape #042 no Twitter' }),
    ).toHaveAttribute('href', /twitter\.com\/intent\/tweet/)
    await expect(page.getByRole('button', { name: /Copiar link/ })).toHaveCount(0)
  })

  test('rota inexistente mostra a tela 404', async ({ page }) => {
    await page.goto('/rota-que-nao-existe')

    await expect(page.getByRole('heading', { name: /saiu do acervo/ })).toBeVisible()
  })

  test('refresh em link direto continua na mesma tela', async ({ page }) => {
    await page.goto('/nft/emerald-ape-042')
    await page.reload()

    await expect(page.getByRole('heading', { name: 'Emerald Ape #042', level: 1 })).toBeVisible()
  })
})
