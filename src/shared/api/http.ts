import axios, { AxiosError } from 'axios'
import { env } from '@/shared/config/env'
import { clearSessionToken, getSessionToken } from '@/shared/auth/token-storage'
import { notifyUnauthorized } from '@/shared/auth/session-events'

/**
 * Instância única do Axios usada por toda a camada de dados.
 *
 * Componentes de UI nunca chamam `http` diretamente: quem fala com a API são
 * as funções de `features/*\/api` e os hooks do TanStack Query.
 */
export const http = axios.create({
  baseURL: env.apiUrl,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

/**
 * Anexa o token de sessão em toda requisição.
 *
 * O token é lido do armazenamento a cada chamada (e não capturado uma vez), de
 * modo que login e logout passam a valer imediatamente para a requisição
 * seguinte — sem estado duplicado no módulo do Axios.
 */
http.interceptors.request.use((config) => {
  const token = getSessionToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

/**
 * Sessão recusada pelo servidor deixa de valer.
 *
 * Um 401 significa que o token morreu (expirou ou foi derrubado). Guardá-lo
 * faria o app tentar de novo em cada montagem. Aqui ele é descartado uma vez,
 * no único lugar por onde TODA requisição passa.
 *
 * Além de limpar o token, avisamos a camada React (`kurio:unauthorized`): o
 * `SessionProvider` então derruba a identidade e o porteiro das rotas privadas
 * leva o usuário ao login guardando o destino — a expiração no meio da
 * navegação (ou do checkout) não vira uma tela quebrada.
 *
 * A exceção são os próprios endpoints de autenticação: um 401 em `/auth/login`
 * é "senha errada", não "sessão expirada" — e não há sessão para limpar.
 */
http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const isUnauthorized = error instanceof AxiosError && error.response?.status === 401
    const url = error instanceof AxiosError ? (error.config?.url ?? '') : ''

    if (isUnauthorized && !url.startsWith('/auth/')) {
      clearSessionToken()
      notifyUnauthorized()
    }

    return Promise.reject(error)
  },
)
