/**
 * Seletor de quantidade de um item do carrinho.
 *
 * Aritmética com valor mínimo 1; o servidor é quem valida o limite máximo
 * (`PATCH /cart/items/:nftId`). Os botões têm rótulos acessíveis e o campo
 * exibe a quantidade para leitores de tela.
 */
export function QtyStepper({
  quantity,
  onChange,
  disabled = false,
}: {
  quantity: number
  onChange: (next: number) => void
  disabled?: boolean
}) {
  const decrease = (): void => {
    if (quantity > 1) onChange(quantity - 1)
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={decrease}
        disabled={disabled || quantity <= 1}
        aria-label="Diminuir quantidade"
        className="flex size-6 items-center justify-center rounded-full bg-surface-overlay text-xs text-ink-subtle transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 md:size-[18px] md:bg-brand md:text-[11px] md:text-canvas"
      >
        −
      </button>
      <span aria-live="polite" className="min-w-4 text-center text-sm font-medium text-ink">
        {quantity}
      </span>
      <button
        type="button"
        onClick={() => onChange(quantity + 1)}
        disabled={disabled}
        aria-label="Aumentar quantidade"
        className="flex size-6 items-center justify-center rounded-full bg-surface-overlay text-xs text-ink-subtle transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 md:size-[18px] md:bg-brand md:text-[11px] md:text-canvas"
      >
        +
      </button>
    </div>
  )
}
