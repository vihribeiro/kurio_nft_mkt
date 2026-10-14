/**
 * Estado de busca da vitrine — vive na URL.
 *
 * O enunciado exige que busca, filtros, ordenação e paginação componham o
 * estado da URL e sobrevivam a refresh e ao histórico. Por isso nada disso é
 * `useState`: `parseCatalogSearch` é o `validateSearch` da rota `/` e as telas
 * escrevem aqui via `navigate({ search })`.
 */

export const TAB_VALUES = ['todos', 'novos', 'alta'] as const
export const SORT_VALUES = ['recent', 'price-asc', 'price-desc', 'name'] as const

export type CatalogTab = (typeof TAB_VALUES)[number]
export type CatalogSort = (typeof SORT_VALUES)[number]

export interface CatalogSearch {
  /** Busca textual (vai para a API em `?q=`). */
  q?: string
  /** Coleção selecionada (`?colecao=`). */
  colecao?: string
  /** Faixa de preço em ETH (`?min=` / `?max=`). */
  min?: number
  max?: number
  /** Aba ativa (`?aba=`). */
  aba?: CatalogTab
  /** Ordenação (`?ordem=`). */
  ordem?: CatalogSort
  /** Página atual, 1-based (`?pagina=`). */
  pagina?: number
}

/** Itens por página da vitrine. */
export { CATALOG_PAGE_SIZE } from '@/shared/contracts/catalog'

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

function asNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return value !== undefined && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined
}

/** Normaliza (e valida) os parâmetros vindos da URL. */
export function parseCatalogSearch(search: Record<string, unknown>): CatalogSearch {
  const pagina = asNumber(search.pagina)

  return {
    q: asText(search.q),
    colecao: asText(search.colecao),
    min: asNumber(search.min),
    max: asNumber(search.max),
    aba: oneOf(asText(search.aba), TAB_VALUES),
    ordem: oneOf(asText(search.ordem), SORT_VALUES),
    pagina: pagina !== undefined && Number.isInteger(pagina) && pagina >= 1 ? pagina : undefined,
  }
}
