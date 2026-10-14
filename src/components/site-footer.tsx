import { useState, type FormEvent } from 'react'
import { Logo } from './logo'

const FEATURES = [
  {
    icon: 'W',
    title: 'Segurança da carteira',
    body: 'Proteja sua carteira e colecione arte digital verificada com confiança.',
  },
  {
    icon: 'C',
    title: 'Criadores em destaque',
    body: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.',
  },
  {
    icon: 'D',
    title: 'Alertas de lançamentos',
    body: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.',
  },
] as const

const FOOTER_COLUMNS = [
  {
    title: 'Central de ajuda',
    links: ['como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item'],
  },
  {
    title: 'Coleções',
    links: ['Arte digital', 'Fotografia', 'Música', 'Arte 3D', 'Utilidade'],
  },
] as const

const SOCIAL_NETWORKS = ['Facebook', 'Instagram', 'Twitter', 'LinkedIn', 'YouTube'] as const
type SocialNetwork = (typeof SOCIAL_NETWORKS)[number]

const WALLETS = ['MetaMask', 'WalletConnect', 'Coinbase'] as const

/**
 * Roda-pé das páginas de desktop e celular.
 *
 * Mantém a estrutura do Figma: faixa integrada de diferenciais + newsletter,
 * colunas de links, redes sociais e carteiras compatíveis. Perfis
 * sociais não fornecidos pelo projeto são apresentados como marcas, não como
 * links falsos.
 */
export function SiteFooter() {
  const [justSubscribed, setJustSubscribed] = useState(false)

  function handleSubscribe(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setJustSubscribed(true)
  }

  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto w-full max-w-page px-5">
        {/* Faixa integrada de diferenciais e newsletter (frames 100/101 do Figma). */}
        <section
          id="criadores"
          aria-label="Diferenciais e próximos lançamentos"
          className="scroll-mt-24 bg-surface md:-mx-5"
        >
          <div className="mx-auto grid w-full max-w-page grid-cols-1 lg:grid-cols-[repeat(3,minmax(0,1fr))_1.5fr]">
            {FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="border-b border-line px-6 py-6 sm:px-8 lg:border-b-0 lg:border-r lg:border-brand lg:px-12 lg:pb-[26px] lg:pt-8"
              >
                <span
                  aria-hidden="true"
                  className="flex size-[74px] items-center justify-center rounded-full bg-brand text-2xl font-bold text-primary-foreground"
                >
                  {feature.icon}
                </span>
                <h3 className="mt-3 text-sm font-bold text-ink lg:whitespace-nowrap">
                  {feature.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-ink-subtle">{feature.body}</p>
              </article>
            ))}

            <div className="px-6 py-6 sm:px-8 lg:py-7 lg:pl-12 lg:pr-7">
              <h2 id="newsletter-title" className="text-base font-bold leading-tight text-ink">
                <span className="block">Antecipe-se ao próximo</span>
                <span className="block">lançamento</span>
              </h2>
              <form onSubmit={handleSubscribe} className="mt-4 flex w-full max-w-[325px]">
                <label htmlFor="newsletter-email" className="sr-only">
                  Seu e-mail
                </label>
                <input
                  id="newsletter-email"
                  type="email"
                  required
                  placeholder="digite seu e-mail.."
                  className="h-10 min-w-0 flex-1 rounded-l-md border border-field bg-surface-overlay px-3 text-xs text-ink placeholder:text-ink-subtle focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-brand"
                />
                <button
                  type="submit"
                  className="h-10 shrink-0 rounded-r-md bg-brand px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-brand-strong focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                >
                  Enviar
                </button>
              </form>
              <p className="mt-3 max-w-[290px] text-xs leading-relaxed text-ink-subtle">
                Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
              </p>
              {justSubscribed ? (
                <p role="status" className="mt-2 text-xs text-brand-strong">
                  Obrigado por assinar! (demonstração — nada é enviado.)
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {/* Colunas de links */}
        <div className="grid gap-8 border-t border-line py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-ink-subtle">
              Feito para colecionadores, criadores e cultura digital.
            </p>
            <div className="mt-3">
              <Logo muted />
            </div>
            <div className="mt-4 flex flex-col gap-2 text-xs text-ink-subtle">
              <a className="transition-colors hover:text-brand" href="mailto:contato@email.com">
                contato@email.com
              </a>
              <a className="transition-colors hover:text-brand" href="tel:+551140828922">
                +55 11 4082 8922
              </a>
            </div>
          </div>
          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h3 className="text-sm font-bold text-ink">{column.title}</h3>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#conteudo"
                      className="text-sm text-ink-subtle transition-colors hover:text-brand"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div>
            <h3 className="text-sm font-bold text-ink">Redes sociais</h3>
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Redes sociais">
              {SOCIAL_NETWORKS.map((network) => (
                <span
                  key={network}
                  role="img"
                  aria-label={network}
                  title={network}
                  className="flex size-8 items-center justify-center rounded border border-brand/70 text-brand"
                >
                  <SocialGlyph network={network} />
                </span>
              ))}
            </div>

            <h3 className="mt-6 text-sm font-bold text-ink">Carteiras compatíveis</h3>
            <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Carteiras compatíveis">
              {WALLETS.map((wallet) => (
                <span
                  key={wallet}
                  role="img"
                  aria-label={wallet}
                  className="rounded border border-brand/30 bg-surface-raised px-1.5 py-1 text-[8px] font-bold uppercase tracking-wide text-brand"
                >
                  {wallet}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center border-t border-line py-6 text-xs text-ink-subtle">
          <p>© 2026 Kurio. Propriedade digital para todos.</p>
        </div>
      </div>
    </footer>
  )
}

function SocialGlyph({ network }: { network: SocialNetwork }) {
  if (network === 'Facebook') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor">
        <path d="M13.7 21v-8.2h2.8l.4-3.2h-3.2V7.5c0-.9.3-1.5 1.6-1.5H17V3.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.3H7.5v3.2h2.8V21h3.4Z" />
      </svg>
    )
  }

  if (network === 'Instagram') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.6" cy="6.7" r="1" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  if (network === 'Twitter') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor">
        <path d="M22 5.9c-.75.33-1.56.55-2.4.65a4.18 4.18 0 0 0 1.84-2.3 8.4 8.4 0 0 1-2.65 1.02 4.16 4.16 0 0 0-7.18 2.85c0 .33.04.65.11.96a11.82 11.82 0 0 1-8.58-4.35 4.16 4.16 0 0 0 1.29 5.56 4.1 4.1 0 0 1-1.89-.52v.05a4.17 4.17 0 0 0 3.34 4.09 4.2 4.2 0 0 1-1.88.07 4.18 4.18 0 0 0 3.9 2.9A8.37 8.37 0 0 1 1.7 18.6a11.8 11.8 0 0 0 6.4 1.88c7.68 0 11.88-6.36 11.88-11.88l-.02-.54A8.5 8.5 0 0 0 22 5.9Z" />
      </svg>
    )
  }

  if (network === 'LinkedIn') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor">
        <path d="M5.2 3.5a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6ZM3.7 8.5h3v12h-3v-12Zm5 0h2.9v1.64h.04a3.18 3.18 0 0 1 2.86-1.86c3.06 0 3.63 2.01 3.63 4.63v7.59h-3v-6.73c0-1.61-.03-3.68-2.24-3.68-2.25 0-2.59 1.75-2.59 3.56v6.85h-3v-12h2.9Z" />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor">
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.28 5 12 5 12 5s-6.28 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.76 1.77C5.72 19 12 19 12 19s6.28 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15.2V8.8l5.5 3.2-5.5 3.2Z" />
    </svg>
  )
}
