// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { ref } from 'vue'
import i18n from '@/i18n'
import NotificationInbox from './NotificationInbox.vue'

const inbox = vi.hoisted(() => ({
  acknowledge: vi.fn().mockResolvedValue(undefined),
  refetch: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/features/notifications/useNotifications', () => ({
  useNotifications: () => ({
    notifications: ref([
      {
        id: 'notification-1',
        companyId: 1,
        recipientUserId: 'user-1',
        title: 'Documento disponível',
        body: 'O documento já pode ser consultado.',
        channels: ['internal'],
        status: 'sent',
        metadata: {},
        readAt: null,
        createdAt: '2026-07-29T10:00:00.000Z',
        updatedAt: '2026-07-29T10:00:00.000Z',
      },
    ]),
    unreadCount: ref(1),
    isLoading: ref(false),
    error: ref(null),
    refetch: inbox.refetch,
    acknowledge: inbox.acknowledge,
    acknowledgingId: ref(null),
  }),
}))

const wrappers: VueWrapper[] = []

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.clearAllMocks()
})

describe('NotificationInbox', () => {
  it('abre o menu, mostra as notificações e registra a ciência pelo polegar', async () => {
    i18n.global.locale.value = 'pt-BR'
    const wrapper = mount(NotificationInbox, { global: { plugins: [i18n] } })
    wrappers.push(wrapper)

    expect(wrapper.text()).toContain('1')
    await wrapper.get('button[aria-label="Abrir notificações"]').trigger('click')

    expect(wrapper.text()).toContain('Documento disponível')
    expect(wrapper.text()).toContain('O documento já pode ser consultado.')

    await wrapper.get('button[aria-label="Dar ciência"]').trigger('click')

    expect(inbox.acknowledge).toHaveBeenCalledWith('notification-1')
  })
})
