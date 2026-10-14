import { http } from '@/shared/api/http'
import {
  walletListSchema,
  type Wallet,
  type WalletDraft,
  type WalletUpdate,
} from '@/shared/contracts/wallet'

export async function fetchWallets(): Promise<Wallet[]> {
  const { data } = await http.get('/wallets')
  return walletListSchema.parse(data)
}

/** Conecta uma carteira nova; devolve a lista atualizada do usuário. */
export async function connectWallet(input: WalletDraft): Promise<Wallet[]> {
  const { data } = await http.post('/wallets', input)
  return walletListSchema.parse(data)
}

/** Remove a carteira; se era a principal, o servidor promove outra. */
export async function disconnectWallet(walletId: string): Promise<Wallet[]> {
  const { data } = await http.delete(`/wallets/${walletId}`)
  return walletListSchema.parse(data)
}

export async function promoteWallet(walletId: string): Promise<Wallet[]> {
  const { data } = await http.patch(`/wallets/${walletId}`, { isPrimary: true })
  return walletListSchema.parse(data)
}

/** Renomeia (e/ou promove) uma carteira: um `PATCH` parcial. */
export async function updateWallet(walletId: string, input: WalletUpdate): Promise<Wallet[]> {
  const { data } = await http.patch(`/wallets/${walletId}`, input)
  return walletListSchema.parse(data)
}
