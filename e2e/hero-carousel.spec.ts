import { expect, test } from '@playwright/test'
import { seedScenario } from './support/mock'

test('hero mobile alterna três slides com dois NFTs cada', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'o carrossel de destaque faz parte da composição mobile do Figma')

  await seedScenario(page, 'frozen-prices')
  await page.goto('/')

  const hero = page.getByTestId('mobile-hero')
  await expect(hero.getByRole('img', { name: 'Emerald Ape #042' })).toBeVisible()
  await expect(hero.getByRole('img', { name: 'Sage Nomad #009' })).toBeVisible()

  await page.getByRole('button', { name: /Mostrar destaque 2/ }).click()
  await expect(hero.getByRole('img', { name: 'Neon Vessel #552' })).toBeVisible()
  await expect(hero.getByRole('img', { name: 'Cosmic Bloom #118' })).toBeVisible()

  await page.getByRole('button', { name: /Mostrar destaque 3/ }).click()
  await expect(hero.getByRole('img', { name: 'Golden Beat #207' })).toBeVisible()
  await expect(hero.getByRole('img', { name: 'Ivory Baron #088' })).toBeVisible()
})

test('hero avança automaticamente para o próximo slide em mobile e desktop', async ({
  page,
  isMobile,
}) => {
  await seedScenario(page, 'frozen-prices')
  await page.goto('/')

  const hero = page.getByTestId(isMobile ? 'mobile-hero' : 'desktop-hero')
  const nextSlide = page.getByRole('button', { name: /Mostrar destaque 2/ })
  await expect(nextSlide).toHaveAttribute('aria-pressed', 'true', { timeout: 7_000 })
  await expect(hero.getByRole('img', { name: 'Neon Vessel #552' })).toBeVisible()
})

test('hero desktop alterna os três destaques pelos indicadores', async ({ page, isMobile }) => {
  test.skip(isMobile, 'este teste cobre a composição desktop do hero')

  await seedScenario(page, 'frozen-prices')
  await page.goto('/')

  const hero = page.getByTestId('desktop-hero')
  await expect(hero.getByRole('img', { name: 'Emerald Ape #042' })).toBeVisible()

  await page.getByRole('button', { name: /Mostrar destaque 2/ }).click()
  await expect(hero.getByRole('img', { name: 'Neon Vessel #552' })).toBeVisible()

  await page.getByRole('button', { name: /Mostrar destaque 3/ }).click()
  await expect(hero.getByRole('img', { name: 'Golden Beat #207' })).toBeVisible()
})
