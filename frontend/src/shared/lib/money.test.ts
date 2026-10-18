import { describe, expect, it } from 'vitest'
import { fromKopecks, normalizeMoney, sumKopecks, toKopecks } from './money'

describe('money', () => {
  it('переводит строки API в копейки и обратно', () => {
    expect(toKopecks('72000.00')).toBe(7200000)
    expect(toKopecks('5400,5')).toBe(540050)
    expect(fromKopecks(540050)).toBe('5400.50')
  })
  it('суммирует без потери точности', () => {
    expect(sumKopecks(['0.10', '0.20'])).toBe(30)
  })
  it('нормализует ввод пользователя', () => {
    expect(normalizeMoney('72000,5')).toBe('72000.50')
  })
})
