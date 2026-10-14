import { env } from '@/shared/config/env'

/**
 * Cenários do mock.
 *
 * Permitem demonstrar caminhos que não são o "caminho feliz" sem precisar
 * editar código: catálogo vazio, falha no checkout, rede lenta. O cenário
 * inicial vem de `VITE_MOCK_SCENARIO` e pode ser trocado em tempo de execução
 * pelo painel de cenários (`VITE_ENABLE_SCENARIO_SWITCHER`).
 */
export const SCENARIOS = [
  'happy-path',
  'empty-catalog',
  'checkout-error',
  'payment-declined',
  'wallet-disconnected',
  'slow-network',
  'variable-network',
  'network-offline',
  'frozen-prices',
  'favorites-error',
] as const

export type ScenarioName = (typeof SCENARIOS)[number]

const fallback: ScenarioName = 'happy-path'

/**
 * Chave onde o cenário escolhido é lembrado.
 *
 * O mock roda DENTRO da página, então o cenário vive em memória e voltaria ao
 * padrão a cada recarga. Guardá-lo no `localStorage` faz a escolha sobreviver
 * ao F5 — e, mais importante, permite que o E2E fixe um cenário antes do app
 * carregar (`addInitScript`), sem depender de tempo.
 */
export const SCENARIO_STORAGE_KEY = 'kurio:mock-scenario'

function normalize(value: string | null | undefined): ScenarioName {
  return SCENARIOS.includes(value as ScenarioName) ? (value as ScenarioName) : fallback
}

function readInitialScenario(): ScenarioName {
  const stored =
    typeof localStorage === 'undefined' ? null : localStorage.getItem(SCENARIO_STORAGE_KEY)
  return normalize(stored ?? env.mockScenario)
}

let current: ScenarioName = readInitialScenario()

export function getScenario(): ScenarioName {
  return current
}

export function setScenario(name: string): ScenarioName {
  current = normalize(name)
  variableDelayCursor = 0
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SCENARIO_STORAGE_KEY, current)
  }
  return current
}

export function isScenario(name: ScenarioName): boolean {
  return current === name
}

/** Atraso artificial (ms) quando o cenário de rede lenta está ativo. */
export function scenarioDelayMs(): number {
  if (isScenario('slow-network')) return 1_200
  if (isScenario('variable-network')) {
    const delays = [1_200, 120, 650, 280, 900, 180] as const
    const delay = delays[variableDelayCursor % delays.length] ?? 0
    variableDelayCursor += 1
    return delay
  }
  return 0
}

let variableDelayCursor = 0

/**
 * Quando `true`, o canal de tempo real continua aberto (conexão, assinaturas,
 * ping), mas o servidor para de emitir alterações de preço.
 *
 * Existe para o E2E: com preços parados, somas de carrinho e totais de pedido
 * viram asserções exatas em vez de flaky. Não é um cenário de produto.
 *
 * `checkout-error` também congela: a falha de pagamento é o que o teste quer
 * observar, e um tick de preço no meio do caminho só criaria ruído (a cotação
 * ficaria obsoleta e a confirmação seria legitimamente bloqueada).
 */
export function pricesFrozen(): boolean {
  return (
    isScenario('frozen-prices') || isScenario('checkout-error') || isScenario('payment-declined')
  )
}
