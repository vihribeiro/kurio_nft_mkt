import {
  walletListSchema,
  type Wallet,
  type WalletDraft,
  type WalletUpdate,
} from '@/shared/contracts/wallet'
import { walletsByUserId } from './fixtures'

/**
 * Carteiras simuladas.
 *
 * As carteiras dos fixtures servem de estado inicial; a partir daí add/remove/
 * marcar-como-principal mutam ESTA cópia. O snapshot `pristine` existe para o
 * `reset` entre cenários devolver o mundo ao ponto de partida — inclusive o que
 * um cadastro tenha criado.
 *
 * A carteira é sempre de um usuário (chave = id da conta): não há como uma conta
 * ler a carteira de outra.
 */

const pristine: Record<string, Wallet[]> = structuredClone(walletsByUserId)
const STORAGE_KEY = 'kurio:mock-wallets'

function hydrateWallets(): void {
  if (typeof localStorage === 'undefined') return

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const saved = JSON.parse(raw) as Record<string, unknown>
    for (const [userId, value] of Object.entries(saved)) {
      const parsed = walletListSchema.safeParse(value)
      if (parsed.success) walletsByUserId[userId] = parsed.data
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export function persistWallets(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(walletsByUserId))
}

hydrateWallets()

export function listWallets(userId: string): Wallet[] {
  return [...(walletsByUserId[userId] ?? [])]
}

export function addWallet(userId: string, input: WalletDraft): Wallet {
  const current = walletsByUserId[userId] ?? []

  const wallet: Wallet = {
    id: `${userId}-wallet-${crypto.randomUUID().slice(0, 8)}`,
    label: input.label,
    address: input.address,
    chain: input.chain,
    // Carteira recém-conectada começa zerada; o saldo é do mundo real.
    balanceEth: '0',
    isPrimary: current.length === 0,
  }

  walletsByUserId[userId] = [...current, wallet]
  persistWallets()
  return wallet
}

/**
 * Remove uma carteira. Se a removida era a principal e ainda restam outras, a
 * primeira da lista é promovida — nunca ficamos sem principal.
 */
export function removeWallet(userId: string, walletId: string): Wallet[] {
  const current = walletsByUserId[userId] ?? []
  const removed = current.find((wallet) => wallet.id === walletId)
  const next = current.filter((wallet) => wallet.id !== walletId)

  if (removed?.isPrimary && next.length > 0) {
    next[0] = { ...next[0], isPrimary: true }
  }

  walletsByUserId[userId] = next
  persistWallets()
  return next
}

export function updateWallet(userId: string, walletId: string, input: WalletUpdate): Wallet[] {
  const current = walletsByUserId[userId] ?? []

  const next = current.map((wallet) => {
    if (wallet.id !== walletId) {
      // Promover uma carteira rebaixa as outras: só existe UMA principal.
      return input.isPrimary ? { ...wallet, isPrimary: false } : wallet
    }

    return {
      ...wallet,
      label: input.label ?? wallet.label,
      isPrimary: input.isPrimary ?? wallet.isPrimary,
    }
  })

  walletsByUserId[userId] = next
  persistWallets()
  return next
}

/** Reset entre cenários: reidrata as carteiras a partir dos fixtures. */
export function resetWallets(): void {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY)
  for (const key of Object.keys(walletsByUserId)) delete walletsByUserId[key]
  for (const [key, value] of Object.entries(pristine)) {
    walletsByUserId[key] = structuredClone(value)
  }
}
