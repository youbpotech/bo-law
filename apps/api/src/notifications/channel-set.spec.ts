import { describe, expect, it } from 'vitest'
import { toNotificationChannelSet } from './channel-set'

describe('toNotificationChannelSet', () => {
  it('cria um conjunto sem canais duplicados', () => {
    const channels = toNotificationChannelSet(['internal', 'email', 'internal'])

    expect(channels).toEqual(new Set(['internal', 'email']))
  })

  it('exige ao menos um canal', () => {
    expect(() => toNotificationChannelSet([])).toThrow(
      'Informe ao menos um canal de notificação',
    )
  })

  it('recusa canais sem adapter previsto no contrato', () => {
    expect(() => toNotificationChannelSet(['fax'])).toThrow(
      'Canal de notificação inválido: fax',
    )
  })

  it('reconhece SMS como canal suportado pelo contrato', () => {
    expect(toNotificationChannelSet(['sms'])).toEqual(new Set(['sms']))
  })
})
