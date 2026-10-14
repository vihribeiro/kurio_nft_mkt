import { z } from 'zod'
import { addressSchema, ethAmountSchema, quantitySchema } from './primitives'

/** Perfil público do colecionador. */
export const userSchema = z.object({
  id: z.string().min(1),
  handle: z.string().min(1),
  displayName: z.string().min(1),
  email: z.string().email(),
  /** Vazio significa "sem avatar": a UI cai nas iniciais do nome. */
  avatarUrl: z.string(),
  walletAddress: addressSchema,
  bio: z.string(),
  stats: z.object({
    owned: quantitySchema,
    collections: quantitySchema,
    volumeEth: ethAmountSchema,
  }),
})

/** Sessão emitida no login/cadastro. O `token` vai para o `localStorage`. */
export const sessionSchema = z.object({
  token: z.string().min(1),
  user: userSchema,
})

export const credentialsSchema = z.object({
  email: z.string().email('Informe um e-mail válido.'),
  password: z.string().min(8, 'A senha precisa de ao menos 8 caracteres.'),
})

export const registrationSchema = credentialsSchema.extend({
  displayName: z.string().min(2, 'Informe seu nome.'),
  terms: z.literal(true, { message: 'É preciso aceitar os termos.' }),
})

/**
 * Campos editáveis do próprio perfil.
 *
 * Tudo opcional: o `PATCH` é parcial e o handler recusa um corpo vazio. O
 * `handle` é o identificador público, então tem regra mais rígida.
 */
export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(2, 'Informe seu nome.').optional(),
  handle: z
    .string()
    .trim()
    .min(3, 'O nome de usuário precisa de ao menos 3 caracteres.')
    .regex(/^[a-z0-9][a-z0-9._-]*$/, 'Use minúsculas, números, ponto, hífen ou sublinhado.')
    .optional(),
  avatarUrl: z.string().optional(),
})

/** Troca de senha: exige a senha atual (o servidor confere o hash). */
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual.'),
  newPassword: z.string().min(8, 'A nova senha precisa de ao menos 8 caracteres.'),
})

export type User = z.infer<typeof userSchema>
export type Session = z.infer<typeof sessionSchema>
export type Credentials = z.infer<typeof credentialsSchema>
export type Registration = z.infer<typeof registrationSchema>
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>
export type PasswordChange = z.infer<typeof passwordChangeSchema>
