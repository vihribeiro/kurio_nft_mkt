import { expect, test } from '@playwright/test'
import { seedScenario } from './support/mock'
import { DEMO_EMAIL, login, logout, submitLogin } from './support/session'

/**
 * Perfil ponta a ponta.
 *
 * Duas regras guiam os testes:
 *
 *  1. Perfil e senha persistem no storage do mock entre refreshes;
 *  2. A senha do fixture é `password` e o servidor confere o hash: uma troca só
 *     passa se a senha atual estiver certa.
 */
test.describe('perfil', () => {
  test.beforeEach(async ({ page }) => {
    await seedScenario(page, 'frozen-prices')
    await login(page)
    await page.goto('/profile')
  })

  test('salvar nome de exibição persiste dentro da sessão', async ({ page }) => {
    await page.getByLabel('Nome de exibição').fill('Alice Jungle')
    await page.getByRole('button', { name: 'Salvar' }).click()

    await expect(page.getByText('Perfil atualizado.')).toBeVisible()

    // No celular o toast fica sobre a barra de navegação inferior, e o hover do
    // Playwright pausa o auto-fechamento do Sonner. Esperar ele sair (com o
    // mouse longe) evita um clique preso embaixo do toast.
    await page.mouse.move(5, 5)
    await expect(page.getByText('Perfil atualizado.')).toBeHidden()

    // Navegação SPA (link do menu + histórico, não o breadcrumb — que
    // recarrega): o mock vive em memória, então voltar deve mostrar o valor
    // salvo sem reiniciar o estado. Funciona nos dois tamanhos: "Início" existe
    // no cabeçalho (desktop) e na barra inferior (celular).
    await page
      .getByRole('navigation', { name: /^Principal/ })
      .getByRole('link', { name: 'Início' })
      .click()
    await expect(page).toHaveURL(/\/$/)
    await page.goBack()

    await expect(page).toHaveURL(/\/profile$/)
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Alice Jungle')
    await page.reload()
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Alice Jungle')
  })

  test('nome de usuário já usado mostra erro acessível', async ({ page }) => {
    await page.getByLabel('Nome de usuário').fill('bob.okafor')
    await page.getByRole('button', { name: 'Salvar' }).click()

    await expect(page.getByTestId('profile-error')).toHaveText(
      'Este nome de usuário já está em uso.',
    )
  })

  test('senha atual incorreta é recusada', async ({ page }) => {
    await page.getByLabel('Senha atual', { exact: true }).fill('senha-errada')
    await page.getByLabel('Nova senha', { exact: true }).fill('novasenha123')
    await page.getByLabel('Confirmar nova senha', { exact: true }).fill('novasenha123')
    await page.getByRole('button', { name: 'Alterar senha' }).click()

    await expect(page.getByTestId('password-error')).toHaveText('A senha atual está incorreta.')
  })

  test('confirmação divergente é barrada antes de enviar', async ({ page }) => {
    await page.getByLabel('Senha atual', { exact: true }).fill('password')
    await page.getByLabel('Nova senha', { exact: true }).fill('novasenha123')
    await page.getByLabel('Confirmar nova senha', { exact: true }).fill('outra-coisa-123')
    await page.getByRole('button', { name: 'Alterar senha' }).click()

    await expect(page.getByTestId('password-error')).toHaveText('As senhas não coincidem.')
  })

  test('trocar a senha com sucesso limpa o formulário', async ({ page }) => {
    await page.getByLabel('Senha atual', { exact: true }).fill('password')
    await page.getByLabel('Nova senha', { exact: true }).fill('novasenha123')
    await page.getByLabel('Confirmar nova senha', { exact: true }).fill('novasenha123')
    await page.getByRole('button', { name: 'Alterar senha' }).click()

    await expect(page.getByText('Senha alterada.')).toBeVisible()
    await expect(page.getByLabel('Nova senha', { exact: true })).toHaveValue('')
    await page.reload()
    await logout(page)
    await page.goto('/login')
    await submitLogin(page, DEMO_EMAIL, 'novasenha123')
  })

  test('escolher e remover avatar', async ({ page }) => {
    // Espera o formulário carregar ANTES de olhar o avatar: `toHaveCount(0)`
    // resolve assim que a contagem é 0, então olhar cedo demais não provaria
    // nada (corrida). O fixture da alice já vem com avatar — o fallback de
    // iniciais só aparece quando o usuário remove.
    await expect(page.getByLabel('Nome de exibição')).toBeVisible()
    await expect(page.getByRole('img', { name: /Avatar de/ })).toHaveAttribute('src', /alice/)

    await page.getByRole('button', { name: 'Alterar', exact: true }).click()
    await page.getByRole('button', { name: 'Avatar 2' }).click()
    await page.getByRole('button', { name: 'Salvar' }).click()

    await expect(page.getByText('Perfil atualizado.')).toBeVisible()
    await expect(page.getByRole('img', { name: /Avatar de/ })).toHaveAttribute('src', /avatar-2/)
    await page.reload()
    await expect(page.getByRole('img', { name: /Avatar de/ })).toHaveAttribute('src', /avatar-2/)

    await page.getByRole('button', { name: 'Remover' }).click()
    await page.getByRole('button', { name: 'Salvar' }).click()

    // Sem avatar, o perfil cai no fallback de iniciais — nenhuma <img>.
    await expect(page.getByRole('img', { name: /Avatar de/ })).toHaveCount(0)
  })
})
