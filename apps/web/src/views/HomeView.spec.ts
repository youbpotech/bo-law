import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import i18n from '@/i18n'
import HomeView from './HomeView.vue'

const dashboard = vi.hoisted(() => ({
  widgetValues: ['hotLeads'],
  saveWidgets: vi.fn().mockResolvedValue({ widgets: [] }),
}))

vi.mock('@/features/dashboard/useDashboard', async () => {
  const { ref } = await import('vue')
  return {
    DEFAULT_DASHBOARD_WIDGETS: [
      'totalLeads',
      'hotLeads',
      'pendingInterviews',
      'activeCases',
      'pendingDocuments',
      'outstandingAmount',
    ],
    useDashboard: () => ({
      widgets: ref([...dashboard.widgetValues]),
      stats: ref({
        totalLeads: 12,
        hotLeads: 4,
        pendingInterviews: 2,
        activeCases: 3,
        pendingDocuments: 1,
        outstandingAmount: '900.00',
        receivedAmount: '1200.00',
        rehydrationsDue: 1,
        leadPipeline: { new: 5 },
        casePipeline: { document_collection: 2 },
        recentLeads: [],
        recentCases: [],
      }),
      isLoading: ref(false),
      error: ref(null),
      saveWidgets: dashboard.saveWidgets,
      isSaving: ref(false),
      refresh: vi.fn(),
    }),
  }
})

const wrappers: VueWrapper[] = []

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  dashboard.widgetValues = ['hotLeads']
  vi.clearAllMocks()
})

function mountView() {
  i18n.global.locale.value = 'pt-BR'
  const wrapper = mount(HomeView, {
    global: {
      plugins: [i18n],
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
        Teleport: true,
      },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('HomeView configurável', () => {
  it('renderiza somente os indicadores habilitados pela empresa', () => {
    const wrapper = mountView()

    expect(wrapper.text()).toContain('Leads quentes')
    expect(wrapper.text()).toContain('4')
    expect(wrapper.text()).not.toContain('Leads totais')
    expect(wrapper.text()).not.toContain('Funil comercial')
  })

  it('persiste a nova seleção de widgets', async () => {
    const wrapper = mountView()
    const configure = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Configurar dashboard'))
    await configure!.trigger('click')

    const totalLeadsLabel = wrapper
      .findAll('label')
      .find((label) => label.text().includes('Leads totais'))
    await totalLeadsLabel!.get('input').setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(dashboard.saveWidgets).toHaveBeenCalledWith(['hotLeads', 'totalLeads'])
  })
})
