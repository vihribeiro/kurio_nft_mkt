import { useEffect, useState } from 'react'
import type { NftUpdatedPayload } from '@/shared/realtime/contracts'
import { useMarketSubscription, useRealtime } from './realtime-context'

/**
 * Versão e disponibilidade "vivas" por NFT, segundo o canal de tempo real.
 *
 * O checkout usa isto para saber se a cotação que ele está exibindo ainda é a
 * do mercado. Assina os ids informados (o servidor só emite para quem assinou)
 * e guarda a MAIOR versão vista — a mesma regra do cache: evento velho ou
 * repetido não regride o estado.
 *
 * É estado local de propósito: "esta cotação está desatualizada?" é uma
 * pergunta transitória da tela, não um dado do servidor.
 */
export interface LiveNftUpdate {
  version: number
  listed: boolean
}

export function useLiveNftUpdates(nftIds: readonly string[]): Record<string, LiveNftUpdate> {
  const { socket } = useRealtime()
  const key = nftIds.join('|')

  const [updates, setUpdates] = useState<Record<string, LiveNftUpdate>>({})

  useMarketSubscription(nftIds)

  useEffect(() => {
    if (!socket) return

    const handler = (payload: NftUpdatedPayload): void => {
      setUpdates((previous) =>
        payload.version > (previous[payload.nftId]?.version ?? -1)
          ? {
              ...previous,
              [payload.nftId]: { version: payload.version, listed: payload.listed },
            }
          : previous,
      )
    }

    socket.on('nft.updated', handler)
    return () => {
      socket.off('nft.updated', handler)
    }
  }, [socket, key])

  return updates
}
