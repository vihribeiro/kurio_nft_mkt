/**
 * Aviso de sessão recusada.
 *
 * O interceptor do Axios vive FORA do React e descobre o 401 antes de qualquer
 * componente. Ele não pode chamar `setState`; então publica um evento no
 * `window`, e o `SessionProvider` — que é quem manda na sessão — escuta e
 * derruba a identidade. Um caminho só, sem estado duplicado.
 *
 * Existe como módulo próprio para que `http.ts` (dados) e `session.tsx` (UI)
 * compartilhem o MESMO nome de evento sem um importar o outro.
 */
export const UNAUTHORIZED_EVENT = 'kurio:unauthorized'

export function notifyUnauthorized(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
}

export function onUnauthorized(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  window.addEventListener(UNAUTHORIZED_EVENT, handler)
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler)
}
