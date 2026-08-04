import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import ProcessStakeholderSelector from './ProcessStakeholderSelector.vue'

vi.mock('@/features/processes/useProcessStakeholders', async () => {
  const { ref } = await import('vue')
  return {
    useProcessStakeholders: () => ({
      candidates: ref([
        { id: 'creator-1', name: 'Renato', notificationChannels: ['internal'] },
        {
          id: 'user-2',
          name: 'Ana',
          notificationChannels: ['internal', 'email'],
        },
        { id: 'user-3', name: 'Bruno', notificationChannels: ['whatsapp'] },
      ]),
      isLoading: ref(false),
      error: ref(null),
      refetch: vi.fn(),
    }),
  }
})

const wrappers: VueWrapper[] = []

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

function mountSelector(modelValue: string[] = []) {
  const wrapper = mount(ProcessStakeholderSelector, {
    props: {
      modelValue,
      creator: { id: 'creator-1', name: 'Renato' },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('ProcessStakeholderSelector', () => {
  it('mostra o criador selecionado, esmaecido e impossível de remover', () => {
    const wrapper = mountSelector()
    const creator = wrapper.get('[data-testid="process-creator"]')
    const checkbox = creator.get('input[type="checkbox"]')

    expect(creator.text()).toContain('Renato')
    expect(creator.classes()).toContain('opacity-70')
    expect((checkbox.element as HTMLInputElement).checked).toBe(true)
    expect((checkbox.element as HTMLInputElement).disabled).toBe(true)
    expect(wrapper.findAll('[data-user-id="creator-1"]')).toHaveLength(1)
  })

  it('emite somente IDs adicionais e apresenta os canais dos candidatos', async () => {
    const wrapper = mountSelector(['creator-1', 'user-3'])

    expect(wrapper.get('[data-user-id="user-2"]').text()).toContain('Email')
    expect(wrapper.get('[data-user-id="user-3"]').text()).toContain('WhatsApp')

    await wrapper.get('input[aria-label="Notificar Ana"]').setValue(true)

    expect(wrapper.emitted('update:modelValue')).toEqual([[['user-3', 'user-2']]])
  })
})
