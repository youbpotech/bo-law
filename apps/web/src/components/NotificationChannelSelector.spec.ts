import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { NotificationChannelCatalogItem } from '@/features/notifications/types'
import NotificationChannelSelector from './NotificationChannelSelector.vue'

const catalog: NotificationChannelCatalogItem[] = [
  {
    channel: 'internal',
    supported: true,
    implemented: true,
    configured: true,
    availableForUser: true,
    reason: null,
  },
  {
    channel: 'email',
    supported: true,
    implemented: true,
    configured: true,
    availableForUser: true,
    reason: null,
  },
  {
    channel: 'whatsapp',
    supported: true,
    implemented: true,
    configured: true,
    availableForUser: true,
    reason: null,
  },
  {
    channel: 'sms',
    supported: true,
    implemented: false,
    configured: false,
    availableForUser: false,
    reason: 'SMS ainda não implementado.',
  },
]

const wrappers: VueWrapper[] = []

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

function mountSelector(overrides: Record<string, unknown> = {}) {
  const wrapper = mount(NotificationChannelSelector, {
    props: {
      modelValue: ['internal'],
      catalog,
      email: 'utilizador@example.pt',
      phone: '+351912345678',
      ...overrides,
    },
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('NotificationChannelSelector', () => {
  it('mostra sempre os quatro canais e mantém SMS esmaecido e desabilitado', () => {
    const wrapper = mountSelector()

    expect(wrapper.findAll('[data-channel]')).toHaveLength(4)
    expect(wrapper.text()).toContain('Notificação interna')
    expect(wrapper.text()).toContain('Email')
    expect(wrapper.text()).toContain('WhatsApp')

    const sms = wrapper.get('[data-channel="sms"]')
    expect(sms.text()).toContain('SMS')
    expect(sms.classes()).toContain('opacity-60')
    expect((sms.get('input').element as HTMLInputElement).disabled).toBe(true)
  })

  it('desabilita email e WhatsApp sem os respetivos dados do utilizador', () => {
    const wrapper = mountSelector({ email: '', phone: '' })

    const email = wrapper.get('[data-channel="email"]')
    const whatsapp = wrapper.get('[data-channel="whatsapp"]')
    expect((email.get('input').element as HTMLInputElement).disabled).toBe(true)
    expect(email.text()).toContain('Informe um endereço de email')
    expect((whatsapp.get('input').element as HTMLInputElement).disabled).toBe(true)
    expect(whatsapp.text()).toContain('Informe um telefone')
  })

  it('emite os canais selecionados em ordem canônica', async () => {
    const wrapper = mountSelector()

    await wrapper.get('[data-channel="email"] input').setValue(true)

    expect(wrapper.emitted('update:modelValue')).toEqual([[['internal', 'email']]])
  })

  it('mantém todos os canais visíveis mesmo quando o catálogo está incompleto', () => {
    const wrapper = mountSelector({ catalog: [catalog[0]] })

    expect(wrapper.findAll('[data-channel]')).toHaveLength(4)
    expect(
      (wrapper.get('[data-channel="whatsapp"] input').element as HTMLInputElement).disabled,
    ).toBe(true)
    expect((wrapper.get('[data-channel="sms"] input').element as HTMLInputElement).disabled).toBe(
      true,
    )
  })
})
