import { http } from '@/shared/api/http'
import {
  userSchema,
  type PasswordChange,
  type ProfileUpdate,
  type User,
} from '@/shared/contracts/auth'

export async function fetchMyProfile(): Promise<User> {
  const { data } = await http.get('/users/me')
  return userSchema.parse(data)
}

/** `PATCH /users/me`: envia só os campos alterados e devolve o perfil novo. */
export async function updateMyProfile(input: ProfileUpdate): Promise<User> {
  const { data } = await http.patch('/users/me', input)
  return userSchema.parse(data)
}

export async function changeMyPassword(input: PasswordChange): Promise<void> {
  await http.post('/users/me/password', input)
}

export async function fetchUserByHandle(handle: string): Promise<User> {
  const { data } = await http.get(`/users/${handle}`)
  return userSchema.parse(data)
}
