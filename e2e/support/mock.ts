import type { Page } from '@playwright/test'

/**
 * Ajuda de teste para o mock.
 *
 * O mock roda DENTRO da página (MSW), então o cenário vive em memória e é
 * relido no boot a partir do `localStorage` — mesma chave de
 * `src/mocks/scenarios.ts`. Semeá-la com `addInitScript` fixa o cenário ANTES
 * do app carregar, sem depender de tempo nem de chamada de rede.
 */
const SCENARIO_STORAGE_KEY = 'kurio:mock-scenario'

/** Mesmo prefixo da API fictícia (`VITE_API_URL`). */
const API_URL = 'https://api.kurio.local'

/**
 * Fixa o cenário do mock para TODA a vida da página.
 *
 * `frozen-prices` mantém o canal de tempo real aberto, mas para de mexer nos
 * preços — é o que torna somas de carrinho e totais de pedido asserções exatas.
 */
export async function seedScenario(page: Page, scenario: string): Promise<void> {
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
    SCENARIO_STORAGE_KEY,
    scenario,
  ] as const)
}

/** Troca o cenário em tempo de execução (dentro do worker do MSW). */
export async function setScenario(page: Page, scenario: string): Promise<void> {
  await page.evaluate(
    async ([api, name]) => {
      await fetch(`${api}/__mock__/scenario`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      })
    },
    [API_URL, scenario] as const,
  )
}

/** Mesma chave de `src/shared/auth/token-storage.ts`. */
const TOKEN_STORAGE_KEY = 'kurio.session.token'

async function postMock<T>(page: Page, path: string, body: unknown): Promise<T> {
  return page.evaluate(
    async ([api, endpoint, payload]) => {
      const response = await fetch(`${api}${endpoint}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      return response.json() as Promise<never>
    },
    [API_URL, path, body] as const,
  ) as Promise<T>
}

/**
 * Expira o token que está no navegador (simula fim de sessão).
 *
 * O token é lido do `localStorage` e revogado pelo mock — inclusive um token
 * que o mock ainda não tinha visto (a sessão é reidratável). A próxima
 * requisição autenticada leva 401.
 */
export async function expireSession(page: Page): Promise<void> {
  const token = await page.evaluate((key) => window.localStorage.getItem(key), TOKEN_STORAGE_KEY)
  await postMock(page, '/__mock__/expire-session', { token })
}

/** Arma o timeout de uma única vez no próximo `POST /orders`. */
export async function armCheckoutTimeout(page: Page): Promise<void> {
  await postMock(page, '/__mock__/arm-checkout-timeout', {})
}

/** Muda o preço de uma obra no servidor do mock e devolve o snapshot (com `version`). */
export async function setPrice(
  page: Page,
  nftId: string,
  priceEth: string,
): Promise<{ id: string; priceEth: string; version: number }> {
  return postMock(page, '/__mock__/set-price', { nftId, priceEth })
}

/** Altera disponibilidade no servidor e publica `nft.updated`. */
export async function setListing(
  page: Page,
  nftId: string,
  listed: boolean,
): Promise<{ id: string; listed: boolean; version: number }> {
  return postMock(page, '/__mock__/set-listing', { nftId, listed })
}

/** Fecha o transporte WebSocket para exercitar a reconexão automática. */
export async function disconnectSockets(page: Page): Promise<void> {
  await postMock(page, '/__mock__/disconnect-sockets', {})
}

/**
 * Emite um evento de preço CRU (sem tocar no estado do servidor).
 *
 * Serve para injetar um evento repetido ou fora de ordem e provar que a guarda
 * de versão do cliente ignora.
 */
export async function emitPrice(
  page: Page,
  payload: { nftId: string; priceEth: string; version: number },
): Promise<void> {
  await postMock(page, '/__mock__/emit-price', payload)
}

/** Lista os pedidos do usuário logado (direto na API do mock). */
export async function fetchOrders(page: Page): Promise<Array<{ id: string; code: string }>> {
  return page.evaluate(
    async ([api, key]) => {
      const token = window.localStorage.getItem(key)
      const response = await fetch(`${api}/orders`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      return response.json() as Promise<never>
    },
    [API_URL, TOKEN_STORAGE_KEY] as const,
  ) as Promise<Array<{ id: string; code: string }>>
}

/** Reenvia o corpo original de um pedido para verificar replay/conflito. */
export async function replayOrder(
  page: Page,
  body: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return page.evaluate(
    async ([api, key, payload]) => {
      const token = window.localStorage.getItem(key)
      const response = await fetch(`${api}/orders`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })
      return { status: response.status, body: (await response.json()) as Record<string, unknown> }
    },
    [API_URL, TOKEN_STORAGE_KEY, body] as const,
  )
}
