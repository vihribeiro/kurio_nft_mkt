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
    <div className="inline-flex items-center rounded-md border border-field">
      <button
        type="button"
        onClick={decrease}
        disabled={disabled || quantity <= 1}
        aria-label="Diminuir quantidade"
        className="flex size-8 items-center justify-center text-ink transition-colors hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
      >
        −
      </button>
      <span aria-live="polite" className="min-w-8 text-center text-sm font-medium text-ink">
        {quantity}
      </span>
      <button
        type="button"
        onClick={() => onChange(quantity + 1)}
        disabled={disabled}
        aria-label="Aumentar quantidade"
        className="flex size-8 items-center justify-center text-ink transition-colors hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
      >
        +
      </button>
    </div>
  )
}
