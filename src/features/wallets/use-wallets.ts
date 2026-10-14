import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/features/auth/session-context'
import { queryKeys } from '@/shared/api/query-keys'
import type { Wallet, WalletDraft, WalletUpdate } from '@/shared/contracts/wallet'
import { connectWallet, disconnectWallet, fetchWallets, promoteWallet, updateWallet } from './api'

/**
 * Carteiras do usuário.
 *
 * Cada mutation devolve a lista completa, então escrevemos direto no cache: sem
 * refetch, sem estado intermediário inconsistente (duas carteiras "principais"
 * por um instante, por exemplo).
 */
export function useWallets() {
  const { scope } = useSession()
  const queryClient = useQueryClient()
  const key = queryKeys.wallets(scope)

  const query = useQuery({ queryKey: key, queryFn: fetchWallets })

  function store(wallets: Wallet[]): void {
    queryClient.setQueryData(key, wallets)
  }

  const connect = useMutation({
    mutationFn: (input: WalletDraft) => connectWallet(input),
    onSuccess: store,
  })

  const disconnect = useMutation({
    mutationFn: (walletId: string) => disconnectWallet(walletId),
    onSuccess: store,
  })

  const promote = useMutation({
    mutationFn: (walletId: string) => promoteWallet(walletId),
    onSuccess: store,
  })

  const rename = useMutation({
    mutationFn: ({ walletId, input }: { walletId: string; input: WalletUpdate }) =>
      updateWallet(walletId, input),
    onSuccess: store,
  })

  return {
    wallets: query.data ?? [],
    isPending: query.isPending,
    isError: query.isError,
    connect,
    disconnect,
    promote,
    rename,
  }
}
