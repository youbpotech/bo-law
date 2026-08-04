import { describe, expect, it } from 'vitest'
import type { NotificationChannel } from '../entities/Notification'
import { resolveLegalCaseNotificationChannels } from './case-events'

describe('canais de eventos de processos', () => {
  it('usa os canais preferidos que continuam disponíveis', () => {
    const available = new Set<NotificationChannel>(['internal', 'email'])
    expect(resolveLegalCaseNotificationChannels(['internal', 'email'], available)).toEqual([
      'internal',
      'email',
    ])
  })

  it('recorre ao alerta interno quando todos os canais preferidos ficam indisponíveis', () => {
    const available = new Set<NotificationChannel>(['internal'])
    expect(resolveLegalCaseNotificationChannels(['email', 'sms'], available)).toEqual([
      'internal',
    ])
  })
})
