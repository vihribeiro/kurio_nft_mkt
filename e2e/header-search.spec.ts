import { expect, test } from '@playwright/test'
import { seedScenario } from './support/mock'

test('a lupa abre a busca global com resultados conforme digita', async ({ page, isMobile }) => {
  test.skip(isMobile, 'no mobile a busca já fica no topo da tela inicial')

  await seedScenario(page, 'frozen-prices')
  await page.goto('/nft/emerald-ape-042')
  await page.getByRole('button', { name: 'Buscar NFTs' }).click()

  const dialog = page.getByRole('dialog', { name: 'Buscar NFTs' })
  const search = dialog.getByRole('searchbox', { name: 'Buscar NFTs' })

  await expect(dialog).toBeVisible()
  const bounds = await dialog.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.y).toBeGreaterThanOrEqual(68)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1440)
  const trigger = await page.getByTestId('desktop-search-anchor').boundingBox()
  const caret = await dialog.getByTestId('desktop-search-caret').boundingBox()
  expect(trigger).not.toBeNull()
  expect(caret).not.toBeNull()
  expect(Math.abs(trigger!.x + trigger!.width / 2 - (caret!.x + caret!.width / 2))).toBeLessThan(3)
  await expect(search).toBeFocused()
  await search.fill('Crimson')

  const result = dialog.getByRole('link', { name: 'Crimson Ape #118 2.45 ETH' })
  await expect(result).toBeVisible()
  await result.click()

  await expect(page).toHaveURL(/\/nft\/crimson-ape-118$/)
  await expect(dialog).toBeHidden()
})
