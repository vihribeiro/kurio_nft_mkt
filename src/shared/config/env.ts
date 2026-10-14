import { z } from 'zod'

/**
 * Leitura das variáveis de ambiente com validação.
 *
 * O projeto precisa rodar em um checkout limpo, sem backend real: por isso
 * todos os valores têm um padrão seguro e nenhuma variável é obrigatória.
 */
const envSchema = z.object({
  VITE_API_URL: z.string().default('https://api.kurio.local'),
  VITE_SOCKET_PATH: z.string().default('/socket.io'),
  VITE_ENABLE_MOCKS: z
    .string()
    .default('true')
    .transform((value) => value !== 'false'),
  VITE_MOCK_SCENARIO: z.string().default('happy-path'),
  VITE_ENABLE_SCENARIO_SWITCHER: z
    .string()
    .default('true')
    .transform((value) => value !== 'false'),
})

const parsed = envSchema.safeParse(import.meta.env)

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
    .join('\n')

  throw new Error(`Variáveis de ambiente inválidas:\n${details}`)
}

export const env = {
  apiUrl: parsed.data.VITE_API_URL,
  socketPath: parsed.data.VITE_SOCKET_PATH,
  mocksEnabled: parsed.data.VITE_ENABLE_MOCKS,
  mockScenario: parsed.data.VITE_MOCK_SCENARIO,
  scenarioSwitcherEnabled: parsed.data.VITE_ENABLE_SCENARIO_SWITCHER,
} as const
