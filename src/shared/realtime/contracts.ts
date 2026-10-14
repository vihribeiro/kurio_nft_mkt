/**
 * Contrato de eventos de tempo real.
 *
 * Estes tipos são a fonte única de verdade: o cliente (`socket.io-client`) e o
 * mock (MSW) usam exatamente os mesmos nomes e formatos. Qualquer evento novo
 * nasce aqui primeiro.
 *
 * Limitações do transporte simulado (ver ARCHITECTURE.md):
 *  - apenas o namespace padrão `/`;
 *  - apenas eventos de texto (sem binário);
 *  - sem acknowledgements — eventos são "fire-and-forget", toda confirmação
 *    de escrita vem da resposta REST.
 */

/** Eventos enviados pelo cliente para o servidor. */
export interface ClientToServerEvents {
  /**
   * Identifica a sessão nesta conexão.
   *
   * Sem isto, o servidor não sabe de quem é a conexão e não pode garantir
   * isolamento: eventos de pedido/carrinho só podem ir para o dono. Enviar
   * `{ token: null }` desautentica (usado no logout).
   */
  'session:authenticate': (payload: { token: string | null }) => void
  'market:subscribe': (payload: { nftIds: string[] }) => void
  'market:unsubscribe': (payload: { nftIds: string[] }) => void
}

/** Eventos enviados pelo servidor para o cliente. */
export interface ServerToClientEvents {
  /** Update integral de preço/disponibilidade; `version` cresce por NFT. */
  'nft.updated': (payload: NftUpdatedPayload) => void
  /** Reserva do carrinho expirou: os itens voltaram para o mercado. */
  'cart:reservation-expired': (payload: CartReservationExpiredPayload) => void
  /** O status do pedido mudou (ex.: `settling` -> `settled`). */
  'order.updated': (payload: OrderUpdatedPayload) => void
}

export interface RealtimeEnvelope {
  /** Identificador único do evento. Usado para deduplicação. */
  eventId: string
  /** Instante do evento, em ISO 8601. */
  occurredAt: string
  /** Versão monotônica por entidade. */
  version: number
}

export interface NftUpdatedPayload extends RealtimeEnvelope {
  nftId: string
  priceEth: string
  previousPriceEth: string
  listed: boolean
  previousListed: boolean
}

export interface CartReservationExpiredPayload extends RealtimeEnvelope {
  reservationId: string
  nftIds: string[]
}

export interface OrderUpdatedPayload extends RealtimeEnvelope {
  orderId: string
  status: 'pending' | 'settling' | 'settled' | 'failed'
}

/** Status da conexão exposto para a UI. */
export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

/** Estrutura mínima que o app precisa de um NFT para reagir a preço. */
export interface RealtimeNftSnapshot {
  id: string
  priceEth: string
  version: number
  updatedAt: string
}
