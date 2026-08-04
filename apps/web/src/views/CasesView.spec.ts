import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import i18n from '@/i18n'
import CasesView from './CasesView.vue'

const actions = vi.hoisted(() => ({
  createCase: vi.fn().mockResolvedValue({}),
  updateCase: vi.fn().mockResolvedValue({}),
  updateInvoice: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/composables/useApi', async () => {
  const { ref } = await import('vue')
  return {
    useClients: () => ({
      clients: ref([{ id: 'client-1', name: 'Ana Martins', email: 'ana@example.pt' }]),
    }),
    useServices: () => ({ services: ref([{ id: 'service-1', name: 'Nacionalidade portuguesa', processType: 'general', active: true }]) }),
    useSession: () => ({ currentUser: ref(null) }),
    useCaseDocuments: () => ({
      buscarDocumentos: vi.fn(),
      baixarDocumento: vi.fn(),
      isLoadingDocuments: ref(false),
    }),
  }
})

vi.mock('@/features/cases/useCases', async () => {
  const { ref } = await import('vue')
  return {
    useCases: () => ({
      cases: ref([
        {
          id: 'case-1',
          companyId: 1,
          caseType: 'general',
          integrationStatus: 'not_applicable',
          leadId: 'lead-1',
          clientId: 'client-1',
          title: 'Pedido de nacionalidade',
          serviceId: 'service-1',
          service: { id: 'service-1', name: 'Nacionalidade portuguesa', processType: 'general', active: true },
          description: 'Preparação e submissão do pedido.',
          contractedFee: '2000.00',
          stage: 'diligences',
          documentsComplete: false,
          contractSignedAt: '2026-07-20T10:00:00.000Z',
          startedAt: '2026-07-20T10:00:00.000Z',
          completedAt: null,
          createdAt: '2026-07-20T10:00:00.000Z',
          updatedAt: '2026-07-21T10:00:00.000Z',
          client: { id: 'client-1', name: 'Ana Martins', email: 'ana@example.pt' },
          invoices: [
            {
              id: 'invoice-1',
              legalCaseId: 'case-1',
              kind: 'partial',
              status: 'requested',
              percentage: 30,
              amount: '600.00',
              dueAt: null,
              issuedAt: null,
              paidAt: null,
              createdAt: '2026-07-20T10:00:00.000Z',
              updatedAt: '2026-07-20T10:00:00.000Z',
            },
          ],
        },
      ]),
      isLoading: ref(false),
      error: ref(null),
      createCase: actions.createCase,
      updateCase: actions.updateCase,
      updateInvoice: actions.updateInvoice,
      isCreating: ref(false),
      isUpdating: ref(false),
    }),
  }
})

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
}))

const wrappers: VueWrapper[] = []

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.clearAllMocks()
})

function mountView() {
  i18n.global.locale.value = 'pt-BR'
  const wrapper = mount(CasesView, { global: { plugins: [i18n] } })
  wrappers.push(wrapper)
  return wrapper
}

describe('CasesView', () => {
  it('encaminha diligências sem documentos completos para a pendência documental', async () => {
    const wrapper = mountView()
    const advance = wrapper.findAll('button').find((button) => button.text().includes('Avançar'))
    await advance!.trigger('click')
    await flushPromises()

    expect(actions.updateCase).toHaveBeenCalledWith({
      id: 'case-1',
      input: { stage: 'awaiting_documents' },
    })
  })

  it('permite confirmar documentos e emitir a faturação solicitada', async () => {
    const wrapper = mountView()
    const documents = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Incompleta'))
    await documents!.trigger('click')
    const issue = wrapper.findAll('button').find((button) => button.text().includes('Emitir'))
    await issue!.trigger('click')
    await flushPromises()

    expect(actions.updateCase).toHaveBeenCalledWith({
      id: 'case-1',
      input: { documentsComplete: true },
    })
    expect(actions.updateInvoice).toHaveBeenCalledWith({
      caseId: 'case-1',
      invoiceId: 'invoice-1',
      input: { status: 'issued' },
    })
  })
})
