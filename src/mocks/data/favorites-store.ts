/**
 * Favoritos simulados, por usuário.
 *
 * Diferente do carrinho (em memória), os favoritos são espelhados no
 * `localStorage` para sobreviverem a um F5 — é justamente a persistência que o
 * enunciado pede e que o E2E verifica. É um mock: os dados vivem no navegador,
 * não num backend.
 */

const STORAGE_KEY = 'kurio:mock-favorites'

type Persisted = Record<string, string[]>

function read(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  if (typeof localStorage === 'undefined') return map

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return map

    const parsed = JSON.parse(raw) as Persisted
    for (const [userId, ids] of Object.entries(parsed)) {
      if (Array.isArray(ids)) map.set(userId, new Set(ids))
    }
  } catch {
    // Conteúdo corrompido: recomeça do zero em vez de quebrar o boot.
  }

  return map
}

let byUser = read()

function persist(): void {
  if (typeof localStorage === 'undefined') return

  const plain: Persisted = {}
  for (const [userId, ids] of byUser) plain[userId] = [...ids]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plain))
}

export function getFavorites(userId: string): string[] {
  return [...(byUser.get(userId) ?? [])]
}

export function addFavorite(userId: string, nftId: string): string[] {
  const ids = byUser.get(userId) ?? new Set<string>()
  ids.add(nftId)
  byUser.set(userId, ids)
  persist()
  return [...ids]
}

export function removeFavorite(userId: string, nftId: string): string[] {
  const ids = byUser.get(userId)
  if (ids) {
    ids.delete(nftId)
    persist()
  }
  return getFavorites(userId)
}

export function resetFavorites(): void {
  byUser = new Map()
  if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY)
}
