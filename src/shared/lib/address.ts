/**
 * Abrevia um endereço 0x para caber em cartões estreitos.
 *
 * O Figma mobile mostra `0xA91F...E82C`; usar a mesma forma em todo lugar evita
 * que uma string de 42 caracteres estoure a largura do container (o endereço não
 * tem espaços para quebrar).
 */
export function shortAddress(address: string): string {
  if (address.length < 14) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}
