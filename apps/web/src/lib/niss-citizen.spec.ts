import { describe, expect, it } from 'vitest'
import { citizenComparisons, citizenDetails, mergedClientInput } from './niss-citizen'
import type { Client } from '@/composables/useApi'

const client = {
  id: 'client-1',
  name: 'Ana',
  surname: 'Silva',
  email: 'antigo@example.com',
  companyId: 1,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
} as Client

describe('comparação do cidadão NISS', () => {
  it('normaliza os campos recebidos para o contrato do cliente', () => {
    const rows = citizenComparisons(client, {
      nome: 'Ana Cristina',
      sexo: 'F',
      estado_civil: 'Casada',
      data_nascimento: '1990-12-31T00:00:00Z',
      distrito_residencia: '11',
    })
    expect(rows.map(({ key, nissValue }) => [key, nissValue])).toEqual([
      ['name', 'Ana Cristina'],
      ['birthDate', '1990-12-31'],
      ['sex', 'FEMALE'],
      ['maritalStatus', 'MARRIED'],
      ['residenceDistrictId', 11],
    ])
  })

  it('preserva o cadastro atual e troca somente os campos aprovados', () => {
    const rows = citizenComparisons(client, {
      nome: 'Ana Cristina',
      email: 'novo@example.com',
    })
    const input = mergedClientInput(client, rows, new Set(['email']))
    expect(input).toMatchObject({
      name: 'Ana',
      surname: 'Silva',
      email: 'novo@example.com',
    })
  })

  it('mantém os valores recebidos da API na visualização detalhada', () => {
    expect(citizenDetails({ sexo: 'F', estado_civil: 'Casada' })).toEqual([
      { key: 'sexo', label: 'Sexo', value: 'F' },
      { key: 'estado_civil', label: 'Estado civil', value: 'Casada' },
    ])
  })
})
