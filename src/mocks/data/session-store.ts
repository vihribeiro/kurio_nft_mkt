import { userSchema, type ProfileUpdate, type User } from '@/shared/contracts/auth'
import { DEMO_PASSWORD_SHA256, users, walletsByUserId } from './fixtures'
import { sha256Hex } from './mock-crypto'
import { persistWallets } from './wallets-store'

/**
 * Sessões simuladas.
 *
 * Um token opaco é emitido no login/cadastro e guardado no `localStorage` do
 * cliente. O mock associa token -> usuário em memória. Sair (logout) destrói a
 * sessão, de modo que um token vazado deixa de valer.
 *
 * Usuários, perfil e hashes de senha persistem no localStorage do mock. Senhas
 * nunca são guardadas em claro; a sessão continua reidratável por token.
 */

/**
 * Cópia profunda o suficiente dos usuários-base.
 *
 * Editar o perfil muta o objeto em memória. Sem clonar, a mutação vazaria para
 * o fixture original e sobreviveria a um `reset` — e cada cenário de teste
 * começaria sujo.
 */
function cloneBaseUsers(): User[] {
  return users.map((user) => ({ ...user, stats: { ...user.stats } }))
}

const STORAGE_KEY = 'kurio:mock-accounts'

interface PersistedAccounts {
  users: User[]
  passwordHashes: Record<string, string>
}

function readPersistedAccounts(): PersistedAccounts | undefined {
  if (typeof localStorage === 'undefined') return undefined

  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as {
      users?: unknown
      passwordHashes?: unknown
    } | null
    if (!value || !Array.isArray(value.users) || !value.passwordHashes) return undefined

    const parsedUsers = value.users.map((candidate) => userSchema.safeParse(candidate))
    if (parsedUsers.some((candidate) => !candidate.success)) return undefined
    if (typeof value.passwordHashes !== 'object' || Array.isArray(value.passwordHashes)) {
      return undefined
    }

    return {
      users: parsedUsers.flatMap((candidate) => (candidate.success ? [candidate.data] : [])),
      passwordHashes: Object.fromEntries(
        Object.entries(value.passwordHashes).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      ),
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return undefined
  }
}

const persisted = readPersistedAccounts()
const runtimeUsers: User[] = persisted?.users ?? cloneBaseUsers()

/** userId -> hash da senha (nunca guardada em texto claro). */
const passwordHashes = new Map<string, string>([
  ...users.map((user) => [user.id, DEMO_PASSWORD_SHA256] as const),
  ...Object.entries(persisted?.passwordHashes ?? {}),
])

function persistAccounts(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      users: runtimeUsers,
      passwordHashes: Object.fromEntries(passwordHashes),
    } satisfies PersistedAccounts),
  )
}

/** token -> userId */
const sessionsByToken = new Map<string, string>()

/** Tokens destruídos no logout — não voltam a valer nesta página. */
const revokedTokens = new Set<string>()

const TOKEN_PREFIX = 'kurio'
const TOKEN_GENERATION_KEY = 'kurio:mock-session-generation'

function readTokenGeneration(): number {
  if (typeof localStorage === 'undefined') return 0
  const generation = Number(localStorage.getItem(TOKEN_GENERATION_KEY) ?? 0)
  return Number.isInteger(generation) && generation >= 0 ? generation : 0
}

export function findUserByEmail(email: string): User | undefined {
  const normalized = email.trim().toLowerCase()
  return runtimeUsers.find((user) => user.email.toLowerCase() === normalized)
}

export function findUserById(userId: string): User | undefined {
  return runtimeUsers.find((user) => user.id === userId)
}

export function listUsers(): User[] {
  return [...runtimeUsers]
}

/** Cria um usuário novo (cadastro) com uma carteira principal vazia. */
export async function createUser(input: {
  displayName: string
  email: string
  password: string
}): Promise<User> {
  const handle = input.email.split('@')[0] ?? 'colecionador'
  const id = `user-${slug(handle)}-${runtimeUsers.length + 1}`

  const user: User = {
    id,
    handle,
    displayName: input.displayName.trim(),
    email: input.email.trim().toLowerCase(),
    // Sem avatar no cadastro: a UI mostra as iniciais do nome. O usuário
    // escolhe um na tela de perfil (que dispara um `PATCH /users/me`).
    avatarUrl: '',
    walletAddress: pseudoAddress(id),
    bio: '',
    stats: { owned: 0, collections: 0, volumeEth: '0' },
  }

  runtimeUsers.push(user)
  walletsByUserId[id] = [
    {
      id: `${id}-primary`,
      label: 'Carteira principal',
      address: user.walletAddress,
      chain: 'Ethereum',
      balanceEth: '5.000',
      isPrimary: true,
    },
  ]
  passwordHashes.set(id, await sha256Hex(input.password))
  persistWallets()
  persistAccounts()

  return user
}

/** Verifica e-mail + senha. Retorna o usuário ou `undefined`. */
export async function authenticate(email: string, password: string): Promise<User | undefined> {
  const user = findUserByEmail(email)
  if (!user) return undefined

  const expected = passwordHashes.get(user.id)
  if (!expected) return undefined

  const provided = await sha256Hex(password)
  return provided === expected ? user : undefined
}

export type UpdateProfileResult = { ok: true; user: User } | { ok: false; reason: 'handle_taken' }

/**
 * Atualiza os campos editáveis do perfil.
 *
 * O `handle` é único entre os usuários vivos: dois colecionadores não podem
 * compartilhar o mesmo nome público.
 */
export function updateProfile(userId: string, input: ProfileUpdate): UpdateProfileResult {
  const user = findUserById(userId)
  if (!user) return { ok: false, reason: 'handle_taken' }

  if (input.handle !== undefined) {
    const normalized = input.handle.toLowerCase()
    const taken = runtimeUsers.some(
      (candidate) => candidate.id !== userId && candidate.handle.toLowerCase() === normalized,
    )
    if (taken) return { ok: false, reason: 'handle_taken' }
  }

  if (input.displayName !== undefined) user.displayName = input.displayName
  if (input.handle !== undefined) user.handle = input.handle
  if (input.avatarUrl !== undefined) user.avatarUrl = input.avatarUrl
  persistAccounts()

  return { ok: true, user }
}

/**
 * Troca a senha conferindo a atual.
 *
 * Guarda só o hash, como um backend de verdade. Retorna `false` quando a senha
 * atual não confere — o handler traduz isso num 403.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const expected = passwordHashes.get(userId)
  if (!expected) return false

  const provided = await sha256Hex(currentPassword)
  if (provided !== expected) return false

  passwordHashes.set(userId, await sha256Hex(newPassword))
  persistAccounts()
  return true
}

/**
 * Emite um token que carrega o id do usuário e um nonce.
 *
 * O mock roda DENTRO da página, então o mapa token -> usuário mora em memória e
 * some a cada recarga. Para que um endereço protegido sobreviva ao F5 (e ao
 * rewrite de SPA na Vercel), o token é reidratável: `getUserIdByToken` remonta a
 * sessão a partir do próprio token; os dados de conta persistem no store local.
 */
export function issueToken(userId: string): string {
  const generation = readTokenGeneration()
  const token = `${TOKEN_PREFIX}.${generation}.${encodeURIComponent(userId)}.${crypto.randomUUID()}`
  sessionsByToken.set(token, userId)
  return token
}

export function getUserIdByToken(token: string): string | undefined {
  if (revokedTokens.has(token)) return undefined

  const decoded = decodeToken(token)
  if (!decoded || decoded.generation !== readTokenGeneration()) return undefined

  const known = sessionsByToken.get(token)
  if (known) return known

  if (findUserById(decoded.userId)) {
    sessionsByToken.set(token, decoded.userId)
    return decoded.userId
  }

  return undefined
}

export function destroySession(token: string): void {
  sessionsByToken.delete(token)
  revokedTokens.add(token)
}

/**
 * Revoga um token específico.
 *
 * Diferente de `destroySession`, serve para o E2E simular a expiração do token
 * que está NO NAVEGADOR — inclusive um token que o mock ainda não viu (ele é
 * reidratável, então pode não estar em `sessionsByToken`). Ao entrar em
 * `revokedTokens`, deixa de ser aceito nem pelo caminho de reidratação.
 */
export function revokeToken(token: string): void {
  sessionsByToken.delete(token)
  revokedTokens.add(token)
}

/** Lê a geração e o usuário embutidos no token do mock. */
function decodeToken(token: string): { generation: number; userId: string } | undefined {
  const [prefix, rawGeneration, encoded] = token.split('.')
  const generation = Number(rawGeneration)
  if (prefix !== TOKEN_PREFIX || !encoded || !Number.isInteger(generation) || generation < 0) {
    return undefined
  }
  try {
    return { generation, userId: decodeURIComponent(encoded) }
  } catch {
    return undefined
  }
}

/** Reset entre cenários: derruba todas as sessões e volta aos usuários base. */
export function resetSessions(): void {
  sessionsByToken.clear()
  revokedTokens.clear()
  runtimeUsers.length = 0
  runtimeUsers.push(...cloneBaseUsers())
  passwordHashes.clear()
  for (const user of users) passwordHashes.set(user.id, DEMO_PASSWORD_SHA256)
  if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY)
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(TOKEN_GENERATION_KEY, String(readTokenGeneration() + 1))
  }
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/** Endereço pseudoaleatório porém determinístico a partir de um id. */
function pseudoAddress(seed: string): string {
  let hex = ''
  let hash = 2166136261
  for (let index = 0; hex.length < 40; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index % seed.length), 16777619)
    hex += (hash >>> 0).toString(16).padStart(8, '0')
  }
  return `0x${hex.slice(0, 40)}`
}
