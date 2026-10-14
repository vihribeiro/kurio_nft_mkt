const STORAGE_KEY = 'kurio.session.token'

/**
 * Onde vive o token de sessão.
 *
 * `localStorage` (e não cookie httpOnly) porque o app é 100% cliente e fala
 * com um mock no mesmo contexto: não há servidor para emitir cookie. O token
 * é opaco e descartável. Ao sair, é removido — e o cache do TanStack Query é
 * limpo junto, para que nenhum dado de uma conta sobreviva à troca.
 *
 * O acesso é defensivo: em modo privado ou com armazenamento bloqueado,
 * `localStorage` pode lançar. Nesse caso o app segue sem persistir o token.
 */
let memoryToken: string | null = null

function safeStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function getSessionToken(): string | null {
  const storage = safeStorage()
  if (!storage) return memoryToken

  try {
    return storage.getItem(STORAGE_KEY)
  } catch {
    return memoryToken
  }
}

export function setSessionToken(token: string): void {
  memoryToken = token
  const storage = safeStorage()
  if (!storage) return

  try {
    storage.setItem(STORAGE_KEY, token)
  } catch {
    /* segue em memória */
  }
}

export function clearSessionToken(): void {
  memoryToken = null
  const storage = safeStorage()
  if (!storage) return

  try {
    storage.removeItem(STORAGE_KEY)
  } catch {
    /* nada a fazer */
  }
}
