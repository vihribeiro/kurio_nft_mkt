export interface Crumb {
  label: string
  /** Caminho navegável; o último item não é link. */
  to?: string
}

/**
 * Trilha de navegação (Ex.: Início / Mercado / Carrinho).
 *
 * O último item é o atual e não é um link; os anteriores navegam.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Trilha de navegação">
      <ol className="flex flex-wrap items-center gap-x-2 text-xs text-ink-subtle">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-x-2">
              {index > 0 ? (
                <span aria-hidden="true" className="text-ink-subtle/60">
                  /
                </span>
              ) : null}
              {isLast || !item.to ? (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={isLast ? 'text-ink' : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <a href={item.to} className="transition-colors hover:text-brand">
                  {item.label}
                </a>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
