const encoder = new TextEncoder()

/**
 * SHA-256 em hexadecimal, usando a Web Crypto API.
 *
 * Só existe para o mock não guardar a senha dos usuários fictícios em texto
 * puro — como um backend de verdade faria. NÃO é segurança de produção: não há
 * sal, nem custo de derivação.
 */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
