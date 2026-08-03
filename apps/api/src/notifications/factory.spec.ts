import { describe, expect, it, vi } from 'vitest'
import type { NotificationChannelAdapter } from './contracts'
import { NotificationChannelFactory } from './factory'

function adapter(channel: NotificationChannelAdapter['channel']): NotificationChannelAdapter {
  return { channel, send: vi.fn().mockResolvedValue({}) }
}

describe('NotificationChannelFactory', () => {
  it('resolve o adapter registrado para cada canal', () => {
    const internal = adapter('internal')
    const factory = new NotificationChannelFactory().register(internal)

    expect(factory.get('internal')).toBe(internal)
    expect(factory.has('internal')).toBe(true)
  })

  it('impede registrar dois adapters para o mesmo canal', () => {
    const factory = new NotificationChannelFactory().register(adapter('email'))

    expect(() => factory.register(adapter('email'))).toThrow(
      'Já existe um adapter para o canal email',
    )
  })

  it('falha claramente quando o canal não foi configurado', () => {
    expect(() => new NotificationChannelFactory().get('whatsapp')).toThrow(
      'Não existe adapter configurado para o canal whatsapp',
    )
  })
})
