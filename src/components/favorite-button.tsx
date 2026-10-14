import { useNavigate } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-context'
import { useFavorites } from '@/features/favorites/use-favorites'
import { apiErrorMessage } from '@/shared/api/errors'
import { cn } from 'cn'

/**
 * Botão de favorito com update otimista (ver `useFavorites`).
 *
 * Visitante é levado ao login com `?redirect=` de volta para o NFT —
 * favoritos são uma feature de contas, então exigem sessão.
 */
export function FavoriteButton({
  nftId,
  nftName,
  variant = 'labeled',
  className,
}: {
  nftId: string
  nftName: string
  variant?: 'labeled' | 'icon'
  className?: string
}) {
  const { status } = useSession()
  const { isFavorite, toggle } = useFavorites()
  const navigate = useNavigate()

  const saved = status === 'authenticated' && isFavorite(nftId)

  function handleClick(): void {
    if (status !== 'authenticated') {
      toast.info('Entre para salvar seus favoritos.')
      void navigate({ to: '/login', search: { redirect: `/nft/${nftId}` } })
      return
    }

    toggle.mutate(
      { nftId, save: !saved },
      {
        onSuccess: () => {
          toast.success(
            saved ? `${nftName} saiu dos favoritos.` : `${nftName} salvo nos favoritos.`,
          )
        },
        onError: (error) => {
          toast.error(apiErrorMessage(error, 'Não foi possível atualizar o favorito.'))
        },
      },
    )
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        data-testid={`favorite-toggle-${nftId}`}
        aria-pressed={saved}
        aria-label={saved ? `Remover ${nftName} dos favoritos` : `Salvar ${nftName} nos favoritos`}
        onClick={handleClick}
        className={cn(
          'flex size-9 items-center justify-center rounded-full bg-canvas/70 text-ink backdrop-blur transition-colors hover:text-brand',
          saved && 'text-brand',
          className,
        )}
      >
        <Heart
          aria-hidden="true"
          className="size-4"
          fill={saved ? 'currentColor' : 'none'}
          strokeWidth={1.75}
        />
      </button>
    )
  }

  return (
    <Button
      type="button"
      data-testid="favorite-toggle"
      variant="outline"
      aria-pressed={saved}
      onClick={handleClick}
      disabled={toggle.isPending}
      className={cn(
        'h-11 gap-2 border-field bg-transparent text-ink hover:bg-surface-raised',
        saved && 'text-brand',
        className,
      )}
    >
      <Heart
        aria-hidden="true"
        className="size-4"
        fill={saved ? 'currentColor' : 'none'}
        strokeWidth={1.75}
      />
      {saved ? 'Favoritado' : 'Favoritar'}
    </Button>
  )
}
