import { describe, expect, it } from 'vitest'
import { applyClientProfileInput } from './client-profile'
import { Client } from './entities/Client'

describe('applyClientProfileInput', () => {
  it('normaliza e aplica o perfil completo do cliente', () => {
    const client = new Client()

    applyClientProfileInput(client, {
      surname: '  Silva  ',
      portugueseTaxId: '123456789',
      foreignTaxIdType: 'BR_CPF_CNPJ',
      foreignTaxId: '123.456.789-00',
      birthDate: '1990-05-20',
      nationalityCountry: 'br',
      birthDistrictId: '11',
      mobileCountryCode: '+351',
      mobile: '912345678',
      niss: '12345678901',
      snsUserNumber: '123456789',
      arNumber: 'ab12cd345',
      citizenCardNumber: '000000000zz4',
    })

    expect(client.surname).toBe('Silva')
    expect(client.foreignTaxIdType).toBe('BR_CPF_CNPJ')
    expect(client.nationalityCountry).toBe('BR')
    expect(client.birthDistrictId).toBe(11)
    expect(client.mobile).toBe('912345678')
    expect(client.niss).toBe('12345678901')
    expect(client.snsUserNumber).toBe('123456789')
    expect(client.arNumber).toBe('AB12CD345')
    expect(client.citizenCardNumber).toBe('000000000ZZ4')
  })

  it('rejeita tipo fiscal estrangeiro fora do catálogo', () => {
    expect(() =>
      applyClientProfileInput(new Client(), { foreignTaxIdType: 'TIPO_DESCONHECIDO' }),
    ).toThrow('Tipo de identificação fiscal estrangeira inválido')
  })

  it('rejeita datas e códigos geográficos inválidos', () => {
    expect(() => applyClientProfileInput(new Client(), { birthDate: '20/05/1990' })).toThrow(
      'Data de nascimento inválida',
    )
    expect(() => applyClientProfileInput(new Client(), { residenceDistrictId: 0 })).toThrow(
      'Distrito de residência inválido',
    )
  })

  it('rejeita identificadores portugueses com formato ou controlo inválido', () => {
    expect(() => applyClientProfileInput(new Client(), { niss: '123' })).toThrow(
      'NISS deve conter exatamente 11 dígitos',
    )
    expect(() => applyClientProfileInput(new Client(), { snsUserNumber: '12345678A' })).toThrow(
      'Número de utente (SNS) deve conter exatamente 9 dígitos',
    )
    expect(() => applyClientProfileInput(new Client(), { arNumber: '1234-6789' })).toThrow(
      'Número AR deve conter exatamente 9 caracteres alfanuméricos',
    )
    expect(() =>
      applyClientProfileInput(new Client(), { citizenCardNumber: '000000000ZZ5' }),
    ).toThrow('N.º do Cartão de Cidadão possui dígito de controlo inválido')
  })
})
