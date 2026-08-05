import { describe, expect, it } from 'vitest'
import {
  hasRemoteStageChanged,
  isStaleRemoteSnapshot,
  parseStakeholderUserIds,
  remoteStageEventKey,
} from './process-service'

describe('stakeholders de processos', () => {
  it('aceita uma lista vazia e remove duplicados', () => {
    const first = '11111111-1111-4111-8111-111111111111'
    const second = '22222222-2222-4222-8222-222222222222'
    expect(parseStakeholderUserIds(undefined)).toEqual([])
    expect(parseStakeholderUserIds([first, first, ` ${second} `])).toEqual([first, second])
  })

  it('recusa formatos inválidos', () => {
    expect(() => parseStakeholderUserIds('user-1')).toThrow('lista de utilizadores')
    expect(() => parseStakeholderUserIds(['user-1', 2])).toThrow('lista de utilizadores')
    expect(() => parseStakeholderUserIds(['user-1'])).toThrow('lista de utilizadores')
  })

  it('não permite que um snapshot remoto antigo regrida o processo', () => {
    expect(
      isStaleRemoteSnapshot('2026-08-04T12:00:00.000Z', '2026-08-04T11:59:59.000Z'),
    ).toBe(true)
    expect(isStaleRemoteSnapshot('2026-08-04T12:00:00.000Z', null)).toBe(true)
    expect(
      isStaleRemoteSnapshot('2026-08-04T12:00:00.000Z', '2026-08-04T12:00:00.000Z'),
    ).toBe(false)
    expect(
      isStaleRemoteSnapshot('2026-08-04T12:00:00.000Z', '2026-08-04T12:00:01.000Z'),
    ).toBe(false)
  })

  it('compara etapas ignorando apenas diferenças de acento, caixa e espaços', () => {
    expect(hasRemoteStageChanged('Em análise', 'Cartão Enviado')).toBe(true)
    expect(hasRemoteStageChanged(' Cartão enviado ', 'cartao ENVIADO')).toBe(false)
    expect(hasRemoteStageChanged(null, 'Cartão Enviado')).toBe(false)
  })

  it('gera uma chave idempotente por processo e etapa', () => {
    const first = remoteStageEventKey('2', 'Cartão Enviado')
    expect(remoteStageEventKey('2', 'cartao enviado')).toBe(first)
    expect(remoteStageEventKey('2', 'Cartão entregue')).not.toBe(first)
    expect(remoteStageEventKey('3', 'Cartão Enviado')).not.toBe(first)
  })
})
