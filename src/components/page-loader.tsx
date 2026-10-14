/**
 * Carregamento de tela (transição de rota ou espera do chunk lazy).
 *
 * Um esqueleto discreto com shimmer e `aria-busy` — nunca um spinner solto,
 * para a experiência não "piscar" entre telas.
 */
export function PageLoader() {
  return (
    <div aria-busy="true" aria-live="polite" className="mx-auto w-full max-w-page px-5 py-8">
      <p className="sr-only">Carregando…</p>
      <div className="h-5 w-56 shimmer rounded-md" />
      <div className="mt-3 h-3 w-80 shimmer rounded-md" />
      <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-4">
        <div className="aspect-square shimmer rounded-xl" />
        <div className="aspect-square shimmer rounded-xl" />
        <div className="hidden aspect-square shimmer rounded-xl md:block" />
        <div className="hidden aspect-square shimmer rounded-xl md:block" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-5 md:grid-cols-4">
        <div className="h-16 shimmer rounded-lg" />
        <div className="h-16 shimmer rounded-lg" />
        <div className="hidden h-16 shimmer rounded-lg md:block" />
        <div className="hidden h-16 shimmer rounded-lg md:block" />
      </div>
    </div>
  )
}
