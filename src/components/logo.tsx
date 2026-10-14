import { Link } from '@tanstack/react-router'

/**
 * Marca "KURIO". Vem da identidade do Figma: só o nome, tipográfico, sem
 * símbolo — nas duas posições (cabeçalho e roda-pé).
 */
export function Logo({ muted = false }: { muted?: boolean }) {
  return (
    <Link
      to="/"
      aria-label="Kurio — página inicial"
      className={`text-sm font-bold tracking-[0.28em] ${
        muted ? 'text-ink-subtle' : 'text-ink'
      } transition-colors hover:text-brand`}
    >
      KURIO
    </Link>
  )
}
