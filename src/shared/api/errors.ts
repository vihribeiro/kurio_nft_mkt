import { AxiosError } from 'axios'

/** Corpo de erro padronizado pela API (`{ code, message }`). */
interface ApiErrorBody {
  code?: string
  message?: string
}

/** Código estável do erro (para decidir comportamento, não texto). */
export function apiErrorCode(error: unknown): string | undefined {
  if (error instanceof AxiosError) {
    return (error.response?.data as ApiErrorBody | undefined)?.code
  }
  return undefined
}

/** Mensagem pronta para exibir ao usuário. */
export function apiErrorMessage(
  error: unknown,
  fallback = 'Algo deu errado. Tente novamente.',
): string {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiErrorBody | undefined
    if (body?.message) return body.message

    if (error.code === 'ECONNABORTED') return 'A requisição demorou demais. Tente de novo.'
    if (!error.response) return 'Não foi possível falar com o servidor.'
  }

  if (error instanceof Error && error.message) return error.message
  return fallback
}

/** `true` quando a resposta foi 401 — usado para expulsar a sessão inválida. */
export function isUnauthorized(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 401
}
