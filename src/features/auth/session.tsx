import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys, sessionScope } from '@/shared/api/query-keys'
import { clearSessionToken, getSessionToken, setSessionToken } from '@/shared/auth/token-storage'
import { onUnauthorized } from '@/shared/auth/session-events'
import { disposeMarketSocket } from '@/shared/realtime/socket'
import type { Credentials, Registration, Session } from '@/shared/contracts/auth'
import {
  fetchSession,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
} from './api'
import { SessionContext, type SessionContextValue, type SessionStatus } from './session-context'

/**
 * Sessão do app.
 *
 * Regras que a UI e o resto do código dependem:
 *
 *  - **Uma fonte de verdade.** O token vive no `localStorage`; o usuário vive
 *    no cache do TanStack Query (`['session']`). Nada é duplicado em contexto.
 *  - **Login não refaz requisição.** A resposta do login já É a sessão; ela é
 *    semeada no cache, então não há um `GET /session` logo em seguida.
 *  - **Logout não deixa rastro.** Limpa o token, limpa TODO o cache e derruba o
 *    socket. Nenhum dado de uma conta sobrevive à troca.
 *  - **401 é tratado fora do React.** Quem descarta um token recusado é o
 *    interceptor do Axios (ver `shared/api/http.ts`) — não um efeito que
 *    chama `setState` e provoca render em cascata.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState<string | null>(() => getSessionToken())

  /**
   * Só busca `/session` se existe token. Sem token, não há o que confirmar:
   * o app é anônimo por definição.
   *
   * `retry: false` é intencional: um token inválido não deve ser reenviado em
   * laço, e uma falha de rede não deve derrubar a sessão — o usuário tenta de
   * novo quando quiser.
   */
  const sessionQuery = useQuery({
    queryKey: queryKeys.session,
    queryFn: fetchSession,
    enabled: token !== null,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  const applySession = useCallback(
    (session: Session) => {
      setSessionToken(session.token)
      setToken(session.token)
      queryClient.setQueryData(queryKeys.session, session)
    },
    [queryClient],
  )

  const signIn = useCallback(
    async (credentials: Credentials) => {
      const session = await loginRequest(credentials)
      applySession(session)
      return session
    },
    [applySession],
  )

  const signUp = useCallback(
    async (input: Registration) => {
      const session = await registerRequest(input)
      applySession(session)
      return session
    },
    [applySession],
  )

  const signOut = useCallback(async () => {
    try {
      await logoutRequest()
    } catch {
      // O servidor pode estar fora: sair localmente continua valendo.
    }

    clearSessionToken()
    setToken(null)
    queryClient.clear()
    await disposeMarketSocket()
  }, [queryClient])

  /**
   * Sessão expirada em pleno uso.
   *
   * Quando qualquer requisição leva 401, o interceptor avisa aqui. Derrubar a
   * identidade faz o `status` virar `anonymous` e o porteiro das rotas privadas
   * redirecionar para o login levando o destino atual — a retomada do contexto
   * é consequência de um fluxo só, não de um tratamento ad hoc no checkout.
   */
  useEffect(
    () =>
      onUnauthorized(() => {
        setToken(null)
        queryClient.clear()
        void disposeMarketSocket()
      }),
    [queryClient],
  )

  const user = sessionQuery.data?.user ?? null
  const status: SessionStatus =
    token === null || sessionQuery.isError ? 'anonymous' : user ? 'authenticated' : 'loading'

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      user,
      token,
      scope: sessionScope(user?.id),
      signIn,
      signUp,
      signOut,
    }),
    [status, user, token, signIn, signUp, signOut],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
