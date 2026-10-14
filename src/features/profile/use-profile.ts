import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/features/auth/session-context'
import { queryKeys } from '@/shared/api/query-keys'
import type { PasswordChange, ProfileUpdate, Session, User } from '@/shared/contracts/auth'
import { changeMyPassword, fetchMyProfile, updateMyProfile } from './api'

/**
 * Perfil do usuário logado.
 *
 * O perfil vive em DUAS chaves: `['profile', scope]` (dados desta tela) e
 * `['session']` (o usuário que o cabeçalho, o avatar e o resto do app leem).
 * Ao salvar, escrevemos nas duas — senão o nome novo apareceria aqui mas não no
 * topo da página.
 */
export function useProfile() {
  const { scope } = useSession()
  const queryClient = useQueryClient()
  const key = queryKeys.profile(scope)

  const query = useQuery({ queryKey: key, queryFn: fetchMyProfile })

  function applyUser(user: User): void {
    queryClient.setQueryData(key, user)
    queryClient.setQueryData<Session>(queryKeys.session, (session) =>
      session ? { ...session, user } : session,
    )
  }

  const update = useMutation({
    mutationFn: (input: ProfileUpdate) => updateMyProfile(input),
    onSuccess: applyUser,
  })

  const changePassword = useMutation({
    mutationFn: (input: PasswordChange) => changeMyPassword(input),
  })

  return {
    profile: query.data,
    isPending: query.isPending,
    isError: query.isError,
    update,
    changePassword,
  }
}
