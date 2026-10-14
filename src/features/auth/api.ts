import { http } from '@/shared/api/http'
import {
  sessionSchema,
  type Credentials,
  type Registration,
  type Session,
} from '@/shared/contracts/auth'

export async function fetchSession(): Promise<Session> {
  const { data } = await http.get('/session')
  return sessionSchema.parse(data)
}

export async function login(credentials: Credentials): Promise<Session> {
  const { data } = await http.post('/auth/login', credentials)
  return sessionSchema.parse(data)
}

export async function register(input: Registration): Promise<Session> {
  const { data } = await http.post('/auth/register', input)
  return sessionSchema.parse(data)
}

export async function logout(): Promise<void> {
  await http.delete('/session')
}
