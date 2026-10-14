import type { ReactNode } from 'react'

/**
 * Barra de topo das telas no CELULAR.
 *
 * O Figma mobile não tem cabeçalho global: cada tela desenha o próprio topo.
 * Este componente padroniza o caso mais comum — um título à esquerda e, opcional
 * à direita, uma ação. Só aparece abaixo de `md`, onde o cabeçalho do desktop
 * está escondido.
 */
export function MobileTopBar({
  title,
  action,
  className,
}: {
  title: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={['flex min-h-14 items-center gap-3 px-5 pt-3 md:hidden', className].join(' ')}>
      <h1 className="text-lg font-bold text-ink">{title}</h1>
      {action ? <div className="ml-auto">{action}</div> : null}
    </div>
  )
}
