import { expect, test } from '@playwright/test'
import { seedScenario } from './support/mock'
import { login } from './support/session'

/**
 * Carteiras ponta a ponta.
 *
 * Fixtures da `alice`: uma principal ("Carteira principal") e uma secundária
 * ("Ledger Nano"). O endereço precisa ter o formato EVM (`0x` + 40 hex).
 */
const VALID_ADDRESS = '0x1111111111111111111111111111111111111111'

test.describe('carteiras', () => {
  test.beforeEach(async ({ page }) => {
    await seedScenario(page, 'frozen-prices')
    await login(page)
    await page.goto('/wallets')
  })

  test('conectar uma carteira nova adiciona à lista', async ({ page }) => {
    await page.getByRole('button', { name: 'Adicionar' }).click()
    await page.getByLabel('Apelido *', { exact: true }).fill('Minha Ledger')
    await page.getByLabel('Endereço *', { exact: true }).fill(VALID_ADDRESS)
    await page.getByRole('button', { name: 'Conectar carteira' }).click()

    await expect(page.getByText('Minha Ledger')).toBeVisible()
    await page.reload()
    await expect(page.getByText('Minha Ledger')).toBeVisible()
  })

  test('endereço inválido mostra erro acessível', async ({ page }) => {
    await page.getByRole('button', { name: 'Adicionar' }).click()
    await page.getByLabel('Apelido *', { exact: true }).fill('Carteira ruim')
    await page.getByLabel('Endereço *', { exact: true }).fill('nao-e-endereco')
    await page.getByRole('button', { name: 'Conectar carteira' }).click()

    await expect(page.getByTestId('wallet-error')).toHaveText('Endereço de carteira inválido.')
  })

  test('tornar principal troca a carteira de pagamento', async ({ page }) => {
    await expect(page.getByLabel('Apelido da carteira *', { exact: true })).toHaveValue(
      'Carteira principal',
    )

    await page.getByRole('button', { name: 'Tornar principal' }).click()

    await expect(page.getByText('Carteira principal atualizada.')).toBeVisible()
    await expect(page.getByLabel('Apelido da carteira *', { exact: true })).toHaveValue(
      'Ledger Nano',
    )
    await page.reload()
    await expect(page.getByLabel('Apelido da carteira *', { exact: true })).toHaveValue(
      'Ledger Nano',
    )
  })

  test('editar renomeia a carteira secundária', async ({ page }) => {
    await page.getByRole('button', { name: 'Editar Ledger Nano' }).click()
    await page.getByLabel('Novo apelido').fill('Ledger reserva')
    await page.getByRole('button', { name: 'Salvar apelido' }).click()

    await expect(page.getByText('Carteira atualizada.')).toBeVisible()
    await expect(page.getByText('Ledger reserva')).toBeVisible()
    await page.reload()
    await expect(page.getByText('Ledger reserva')).toBeVisible()
    await expect(page.getByText('Ledger Nano')).toHaveCount(0)
  })

  test('remover apaga a carteira secundária', async ({ page }) => {
    await page.getByRole('button', { name: 'Remover Ledger Nano' }).click()

    await expect(page.getByText('Carteira removida.')).toBeVisible()
    await expect(page.getByText('Ledger Nano')).toHaveCount(0)
  })
})
