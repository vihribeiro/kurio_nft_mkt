import { describe, expect, it } from 'vitest'
import { shortAddress } from './address'

describe('shortAddress', () => {
  it('abrevia endereços longos preservando o prefixo e o sufixo', () => {
    expect(shortAddress('0x7Ac3F1b2D9e845a0C6B4f2E1d8A75C3091bE6f42')).toBe('0x7Ac3…6f42')
  })

  it('preserva strings curtas', () => {
    expect(shortAddress('0x12345678')).toBe('0x12345678')
  })
})
