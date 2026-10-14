import { createContext, useContext } from 'react'
import type { Credentials, Registration, Session, User } from '@/shared/contracts/auth'

/**
 * Contexto e hook da sessão, separados do provedor.
 *
 * A separação existe para o provedor poder ser o único export do seu arquivo
 * (fast refresh) e, principalmente, para deixar o contrato do contexto visível
 * sem arrastar o provedor junto.
 */

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous'

export interface SessionContextValue {
  status: SessionStatus
  user: User | null
  token: string | null
  /** Escopo das chaves de query: id do usuário ou `guest`. */
  scope: string
  signIn: (credentials: Credentials) => Promise<Session>
  signUp: (input: Registration) => Promise<Session>
  signOut: () => Promise<void>
}

export const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession precisa estar dentro de <SessionProvider>.')
  return value
}
