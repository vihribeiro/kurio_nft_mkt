import { useSearch } from '@tanstack/react-router'
import { AuthPanel } from '@/components/auth-panel'

/**
 * Criar conta.
 *
 * Mesmo casco responsivo do login: diálogo no desktop, página no celular.
 */
export function RegisterScreen() {
  const { redirect } = useSearch({ from: '/register' })
  return <AuthPanel mode="register" redirect={redirect} />
}
