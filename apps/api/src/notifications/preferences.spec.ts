import { describe, expect, it } from 'vitest'
import type { Company } from '../entities/Company'
import { notificationChannelCatalog } from './catalog'
import { parseNotificationChannels, validateNotificationChannels } from './preferences'

const company = { whatsappNumber: null } as Company

describe('preferências de notificação', () => {
  it('usa o canal interno por padrão e elimina duplicados', () => {
    expect(parseNotificationChannels(undefined)).toEqual(['internal'])
    expect(parseNotificationChannels(['internal', 'internal'])).toEqual(['internal'])
  })

  it('exige pelo menos um canal válido', () => {
    expect(() => parseNotificationChannels([])).toThrow('Selecione ao menos um canal')
    expect(() => parseNotificationChannels(['fax'])).toThrow('canal de notificação inválido')
  })

  it('expõe SMS como suportado, mas sem implementação', () => {
    const sms = notificationChannelCatalog(company).find(({ channel }) => channel === 'sms')

    expect(sms).toMatchObject({
      supported: true,
      implemented: false,
      configured: false,
      availableForUser: false,
    })
    expect(() =>
      validateNotificationChannels(['sms'], company, { email: null, phone: null }),
    ).toThrow('ainda não possui implementação')
  })

  it('mantém o canal interno sempre disponível', () => {
    expect(notificationChannelCatalog(company).find(({ channel }) => channel === 'internal')).toMatchObject({
      configured: true,
      availableForUser: true,
    })
  })
})
