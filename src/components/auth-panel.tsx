import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSession } from '@/features/auth/session-context'
import { useIsDesktop } from '@/hooks/use-media-query'
import { apiErrorMessage } from '@/shared/api/errors'
import { credentialsSchema, type Credentials } from '@/shared/contracts/auth'

export type AuthMode = 'login' | 'register'

const inputClass =
  'h-11 border-field bg-surface-raised focus-visible:border-brand focus-visible:ring-brand/40'

/**
 * Autenticação — diálogo no desktop, página no celular.
 *
 * O conteúdo é o mesmo nos dois invólucros; o que muda é o casco. No desktop o
 * Radix Dialog dá scrim, foco preso e ESC de graça; no celular a mesma peça é
 * uma página rolável. `login` e `register` são ROTAS distintas, então cada uma
 * sobrevive a um refresh e pode ser compartilhada.
 */
export function AuthPanel({ mode, redirect }: { mode: AuthMode; redirect?: string }) {
  const isDesktop = useIsDesktop()
  const navigate = useNavigate()

  const close = (): void => {
    void navigate({ to: safeRedirect(redirect) })
  }

  const card = <AuthCard mode={mode} redirect={redirect} onDone={close} />

  if (isDesktop) {
    return (
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) close()
        }}
      >
        <DialogContent className="max-h-[90dvh] w-full gap-0 overflow-y-auto border-line bg-surface p-7 sm:max-w-[500px]">
          <DialogTitle className="sr-only">
            {mode === 'login' ? 'Entrar na Kurio' : 'Criar conta na Kurio'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Informe seus dados para continuar.
          </DialogDescription>
          {card}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <section className="mx-auto w-full max-w-[500px] px-5 py-10">
      <h1 className="sr-only">{mode === 'login' ? 'Entrar' : 'Criar conta'}</h1>
      {card}
    </section>
  )
}

function AuthCard({
  mode,
  redirect,
  onDone,
}: {
  mode: AuthMode
  redirect?: string
  onDone: () => void
}) {
  const navigate = useNavigate()

  const goToMode = (next: AuthMode): void => {
    void navigate({
      to: next === 'login' ? '/login' : '/register',
      search: redirect ? { redirect } : {},
    })
  }

  return (
    <div>
      <Tabs value={mode} onValueChange={(value) => goToMode(value as AuthMode)}>
        <TabsList variant="line" className="w-full justify-start gap-6 border-b border-line pb-2">
          <TabsTrigger value="login" className="flex-none px-0 text-base">
            Entrar
          </TabsTrigger>
          <TabsTrigger value="register" className="flex-none px-0 text-base">
            Criar conta
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <p className="mt-5 text-sm leading-relaxed text-ink-subtle">
        {mode === 'login'
          ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.'
          : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'}
      </p>

      <div className="mt-6">
        {mode === 'login' ? (
          <LoginForm redirect={redirect} onDone={onDone} />
        ) : (
          <RegisterForm onDone={onDone} />
        )}
      </div>

      <SocialButtons />
    </div>
  )
}

function LoginForm({ redirect, onDone }: { redirect?: string; onDone: () => void }) {
  const { signIn } = useSession()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<Credentials>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: Credentials): Promise<void> {
    setFormError(null)
    try {
      const session = await signIn(values)
      toast.success(`Bem-vindo de volta, ${session.user.displayName}!`)
      onDone()
    } catch (error) {
      setFormError(apiErrorMessage(error, 'Não foi possível entrar.'))
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm text-ink-subtle">E-mail</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  autoComplete="email"
                  placeholder="voce@email.com"
                  className={inputClass}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm text-ink-subtle">Senha</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={inputClass}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => toast.info('Recuperação de senha é uma demonstração neste ambiente.')}
            className="text-sm text-ink-subtle transition-colors hover:text-brand"
          >
            Esqueceu a senha?
          </button>
        </div>

        {formError ? (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="h-11 w-full font-bold"
        >
          {form.formState.isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>

        <p className="text-center text-sm text-ink-subtle">
          Novo na Kurio?{' '}
          <Link
            to="/register"
            search={redirect ? { redirect } : {}}
            className="font-medium text-brand hover:text-brand-strong"
          >
            Crie uma conta
          </Link>
        </p>
      </form>
    </Form>
  )
}

const registerFormSchema = z
  .object({
    displayName: z.string().min(2, 'Informe seu nome.'),
    email: z.string().email('Informe um e-mail válido.'),
    password: z.string().min(8, 'A senha precisa de ao menos 8 caracteres.'),
    confirmPassword: z.string().min(8, 'Confirme a senha.'),
    terms: z.boolean().refine((value) => value, { message: 'É preciso aceitar os termos.' }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem.',
  })

type RegisterFormValues = z.infer<typeof registerFormSchema>

function RegisterForm({ onDone }: { onDone: () => void }) {
  const { signUp } = useSession()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: '',
      terms: false,
    },
  })

  async function onSubmit(values: RegisterFormValues): Promise<void> {
    setFormError(null)
    try {
      const session = await signUp({
        displayName: values.displayName,
        email: values.email,
        password: values.password,
        terms: true,
      })
      toast.success(`Conta criada. Bem-vindo, ${session.user.displayName}!`)
      onDone()
    } catch (error) {
      setFormError(apiErrorMessage(error, 'Não foi possível criar a conta.'))
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm text-ink-subtle">Nome de usuário</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  autoComplete="name"
                  placeholder="Como devemos te chamar"
                  className={inputClass}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm text-ink-subtle">E-mail</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  autoComplete="email"
                  placeholder="voce@email.com"
                  className={inputClass}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm text-ink-subtle">Senha</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={inputClass}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm text-ink-subtle">Confirmar senha</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={inputClass}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="terms"
          render={({ field }) => (
            <FormItem className="flex-row items-start gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(value) => field.onChange(value === true)}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="text-sm font-normal text-ink-subtle">
                  Aceito os termos de uso e a política de privacidade.
                </FormLabel>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        {formError ? (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="h-11 w-full font-bold"
        >
          {form.formState.isSubmitting ? 'Criando…' : 'Criar conta'}
        </Button>
      </form>
    </Form>
  )
}

/** Botões de provedor externo — simulados (não há OAuth neste mock). */
function SocialButtons() {
  const notify = (provider: string): void => {
    toast.info(`Login com ${provider} é uma demonstração neste ambiente.`)
  }

  return (
    <div className="mt-6 border-t border-line pt-6">
      <p className="text-center text-xs text-ink-subtle">Ou continue com</p>
      <div className="mt-3 space-y-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => notify('Google')}
          className="h-10 w-full border-field bg-transparent text-ink hover:bg-surface-raised"
        >
          Continuar com Google
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => notify('Facebook')}
          className="h-10 w-full border-field bg-transparent text-ink hover:bg-surface-raised"
        >
          Continuar com Facebook
        </Button>
      </div>
    </div>
  )
}

/** Aceita apenas caminhos internos; qualquer outra coisa volta para a home. */
function safeRedirect(value: string | undefined): '/' {
  if (value && value.startsWith('/') && !value.startsWith('//')) return value as '/'
  return '/'
}
