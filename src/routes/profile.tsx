import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { MobileTopBar } from '@/components/mobile-top-bar'
import { SidebarNav } from '@/components/sidebar-nav'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-context'
import { useProfile } from '@/features/profile/use-profile'
import { apiErrorMessage } from '@/shared/api/errors'
import type { PasswordChange, ProfileUpdate, User } from '@/shared/contracts/auth'
import { AVATAR_PRESETS, initialsOf } from '@/shared/lib/avatars'
import { cn } from 'cn'

/**
 * Perfil do colecionador.
 *
 * Tela de conta, autenticada. Nome de exibição, nome de usuário e avatar são
 * editáveis (`PATCH /users/me`); e-mail, ENS e carteira são dados derivados de
 * outras partes do cadastro e ficam somente-leitura. A troca de senha exige a
 * senha atual — o servidor confere o hash antes de aceitar (`POST
 * /users/me/password`).
 */
export function ProfileScreen() {
  const { user } = useSession()
  const { profile: fetched, isPending, update, changePassword } = useProfile()
  const profile = fetched ?? user

  return (
    <div className="pb-6 md:py-6">
      <MobileTopBar title="Meu perfil" />
      <div className="mx-auto w-full max-w-page px-5">
        <div className="hidden md:block">
          <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Meu perfil' }]} />
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-[310px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-line bg-surface p-4">
            <SidebarNav active="perfil" />
          </aside>

          <section className="min-w-0">
            <h1 className="text-2xl font-bold text-ink">Perfil do colecionador</h1>

            {isPending || !profile ? (
              <div aria-busy="true" className="mt-6 grid gap-5 sm:grid-cols-2">
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className="h-16 shimmer rounded-md" />
                ))}
              </div>
            ) : (
              <ProfileForm
                profile={profile}
                onSave={(input) => update.mutateAsync(input)}
                onChangePassword={(input) => changePassword.mutateAsync(input)}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function ProfileForm({
  profile,
  onSave,
  onChangePassword,
}: {
  profile: User
  onSave: (input: ProfileUpdate) => Promise<User>
  onChangePassword: (input: PasswordChange) => Promise<void>
}) {
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [handle, setHandle] = useState(profile.handle)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl)
  const [pickerOpen, setPickerOpen] = useState(false)

  const [saving, setSaving] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [changing, setChanging] = useState(false)

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault()
    setProfileError(null)
    setSaving(true)
    try {
      await onSave({ displayName: displayName.trim(), handle: handle.trim(), avatarUrl })
      toast.success('Perfil atualizado.')
    } catch (error) {
      setProfileError(apiErrorMessage(error, 'Não foi possível salvar o perfil.'))
    } finally {
      setSaving(false)
    }
  }

  async function submitPassword(event: FormEvent): Promise<void> {
    event.preventDefault()
    setPasswordError(null)

    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem.')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('A nova senha precisa de ao menos 8 caracteres.')
      return
    }

    setChanging(true)
    try {
      await onChangePassword({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success('Senha alterada.')
    } catch (error) {
      setPasswordError(apiErrorMessage(error, 'Não foi possível alterar a senha.'))
    } finally {
      setChanging(false)
    }
  }

  return (
    <>
      <form onSubmit={save} className="mt-6" noValidate>
        <div className="flex flex-wrap items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`Avatar de ${displayName}`}
              width={64}
              height={64}
              className="size-16 rounded-full border border-line object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-16 items-center justify-center rounded-full bg-brand text-lg font-bold text-primary-foreground"
            >
              {initialsOf(displayName)}
            </span>
          )}

          <div>
            <p className="text-sm font-bold text-ink">Avatar</p>
            <div className="mt-2 flex gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-expanded={pickerOpen}
                aria-controls="avatar-picker"
                onClick={() => setPickerOpen((open) => !open)}
                className="border-field bg-transparent text-ink hover:bg-surface-raised"
              >
                Alterar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAvatarUrl('')}
                className="text-ink-subtle hover:text-ink"
              >
                Remover
              </Button>
            </div>
          </div>
        </div>

        {pickerOpen ? (
          <div
            id="avatar-picker"
            className="mt-4 rounded-lg border border-line bg-surface-raised p-4"
          >
            <p className="text-sm text-ink-subtle">Escolha um avatar ou cole uma URL.</p>

            <div className="mt-3 flex flex-wrap gap-3">
              {AVATAR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  aria-label={preset.label}
                  aria-pressed={avatarUrl === preset.url}
                  onClick={() => setAvatarUrl(preset.url)}
                  className={cn(
                    'size-12 overflow-hidden rounded-full border-2 transition-colors',
                    avatarUrl === preset.url ? 'border-brand' : 'border-line hover:border-brand/50',
                  )}
                >
                  <img src={preset.url} alt="" width={48} height={48} className="size-full" />
                </button>
              ))}
            </div>

            <Field
              id="profile-avatar-url"
              label="URL do avatar"
              value={avatarUrl}
              onChange={setAvatarUrl}
              placeholder="https://…"
              className="mt-4 max-w-md"
            />
          </div>
        ) : null}

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <Field
            id="profile-displayName"
            label="Nome de exibição *"
            value={displayName}
            onChange={setDisplayName}
          />
          <Field
            id="profile-handle"
            label="Nome de usuário *"
            value={handle}
            onChange={setHandle}
          />
          <Field id="profile-email" label="E-mail *" value={profile.email} readOnly />
          <Field id="profile-ens" label="Nome ENS *" value="kurio.eth" readOnly />
          <Field
            id="profile-wallet"
            label="Apelido da carteira *"
            value="Carteira principal"
            readOnly
          />
          <Field
            id="profile-address"
            label="Endereço da carteira *"
            value={profile.walletAddress}
            readOnly
          />
        </div>

        {profileError ? (
          <p role="alert" data-testid="profile-error" className="mt-3 text-sm text-danger">
            {profileError}
          </p>
        ) : null}

        <Button type="submit" disabled={saving} className="mt-4 h-11 px-8 font-bold">
          {saving ? 'Salvando…' : 'Salvar'}
        </Button>
      </form>

      <h2 className="mt-10 text-lg font-bold text-ink">Alterar senha</h2>
      <form onSubmit={submitPassword} className="mt-4 grid max-w-md gap-5" noValidate>
        <Field
          id="current-password"
          label="Senha atual"
          type="password"
          value={currentPassword}
          onChange={setCurrentPassword}
          placeholder="••••••••"
        />
        <Field
          id="new-password"
          label="Nova senha"
          type="password"
          value={newPassword}
          onChange={setNewPassword}
          placeholder="••••••••"
        />
        <Field
          id="confirm-password"
          label="Confirmar nova senha"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="••••••••"
        />

        {passwordError ? (
          <p role="alert" data-testid="password-error" className="text-sm text-danger">
            {passwordError}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={changing}
          variant="outline"
          className="h-11 border-field bg-transparent font-bold text-ink hover:bg-surface-raised"
        >
          {changing ? 'Alterando…' : 'Alterar senha'}
        </Button>
      </form>
    </>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  readOnly = false,
  className,
}: {
  id: string
  label: string
  value: string
  onChange?: (value: string) => void
  type?: string
  placeholder?: string
  readOnly?: boolean
  className?: string
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm text-ink-subtle">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className={cn(
          'mt-2 h-10 w-full rounded-md border border-field bg-surface-raised px-3 text-sm text-ink placeholder:text-ink-subtle',
          readOnly && 'cursor-not-allowed text-ink-subtle',
        )}
      />
    </div>
  )
}
