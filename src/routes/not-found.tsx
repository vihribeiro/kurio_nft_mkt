import { Link } from '@tanstack/react-router'

/** 404 — rota inexistente. O caminho de volta é sempre o catálogo. */
export function NotFoundScreen() {
  return (
    <section className="mx-auto flex w-full max-w-page flex-col items-center px-5 py-24 text-center">
      <p className="text-sm font-medium tracking-widest text-brand">404</p>
      <h1 className="mt-3 text-3xl font-bold text-ink">Esta peça saiu do acervo</h1>
      <p className="mt-3 max-w-prose text-sm text-ink-subtle">
        A página que você procurou não existe — ou nunca existiu por aqui.
      </p>
      <Link
        to="/"
        className="mt-8 rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-brand-strong"
      >
        Voltar ao catálogo
      </Link>
    </section>
  )
}
