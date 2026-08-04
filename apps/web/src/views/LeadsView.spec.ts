import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import LeadsView from './LeadsView.vue'

const actions = vi.hoisted(() => ({
  create: vi.fn().mockResolvedValue({ id: 'lead-2' }),
  update: vi.fn().mockResolvedValue({}),
  assume: vi.fn().mockResolvedValue({}),
  sendMessage: vi.fn().mockResolvedValue({ deliveryStatus: 'sent' }),
  convert: vi.fn().mockResolvedValue({}),
  refresh: vi.fn(),
}))

vi.mock('@/features/leads/useLeads', async () => {
  const { ref } = await import('vue')
  const lead = {
    id: 'lead-1',
    companyId: 1,
    clientId: 'client-1',
    phone: '+351900000000',
    email: 'ana@example.pt',
    name: 'Ana Martins',
    sourceChannel: 'referrals',
    legalArea: 'Direito laboral',
    serviceType: 'Impugnação de despedimento',
    caseSummary: 'Cliente pretende contestar o despedimento dentro do prazo legal.',
    jurisdiction: 'Lisboa',
    urgency: 'high',
    deadline: '2026-08-10',
    feeBudget: 2_500,
    paymentCapacity: 'Pagamento em duas fases',
    documentReadiness: 'partial',
    requestedHumanHelp: true,
    qualificationScore: 82,
    qualificationLevel: 'quente',
    conversationStatus: 'awaiting_human',
    salesStage: 'interview_completed',
    interviewAt: '2026-07-22T10:00:00.000Z',
    rehydrateAt: null,
    lastMessage: 'Tenho os documentos do despedimento.',
    lastMessageAt: '2026-07-20T12:00:00.000Z',
    createdAt: '2026-07-20T12:00:00.000Z',
    updatedAt: '2026-07-20T12:00:00.000Z',
  }

  return {
    useLeads: () => ({
      search: ref(''),
      conversationStatus: ref(''),
      qualificationLevel: ref(''),
      salesStage: ref(''),
      page: ref(1),
      selectedLeadId: ref('lead-1'),
      list: ref({
        data: [lead],
        pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
        summary: { total: 0, awaitingHuman: 1, byLevel: { frio: 0, morno: 0, quente: 1 } },
      }),
      detail: ref({
        lead,
        messages: [
          {
            id: 'message-1',
            direction: 'inbound',
            senderType: 'lead',
            messageType: 'text',
            processingStatus: 'ready',
            content: 'Tenho os documentos do despedimento.',
            createdAt: '2026-07-20T12:00:00.000Z',
          },
        ],
        legalCase: null,
      }),
      isLoading: ref(false),
      isFetching: ref(false),
      error: ref(null),
      isCreating: ref(false),
      isUpdating: ref(false),
      isAssuming: ref(false),
      isSending: ref(false),
      isConverting: ref(false),
      selectLead: vi.fn(),
      create: actions.create,
      update: actions.update,
      assume: actions.assume,
      sendMessage: actions.sendMessage,
      convert: actions.convert,
      refresh: actions.refresh,
      resetPage: vi.fn(),
    }),
  }
})

vi.mock('@/composables/useApi', async () => {
  const { ref } = await import('vue')
  return {
    useClients: () => ({
      clients: ref([
        {
          id: 'client-1',
          companyId: 1,
          name: 'Ana Martins',
          email: 'ana@example.pt',
          phone: '+351900000000',
        },
      ]),
    }),
    useServices: () => ({ services: ref([{ id: 'service-1', name: 'Nacionalidade portuguesa', processType: 'general', active: true }]) }),
    useSession: () => ({ currentUser: ref(null) }),
  }
})

const wrappers: VueWrapper[] = []

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('LeadsView jurídico', () => {
  it('apresenta a qualificação jurídica e o histórico', () => {
    const wrapper = mount(LeadsView, { attachTo: document.body })
    wrappers.push(wrapper)

    expect(wrapper.text()).toContain('Direito laboral')
    expect(wrapper.text()).toContain('Impugnação de despedimento')
    expect(wrapper.text()).toContain('Índice de qualificação')
    expect(wrapper.text()).toContain('Tenho os documentos do despedimento.')
  })

  it('envia os parâmetros jurídicos ao atualizar a qualificação', async () => {
    const wrapper = mount(LeadsView, { attachTo: document.body })
    wrappers.push(wrapper)

    await wrapper.get('#lead-legal-area').setValue('Direito da imigração')
    await wrapper.get('#lead-service').setValue('Pedido de nacionalidade')
    await wrapper.get('#lead-documents select').setValue('complete')
    const contractedOption = wrapper.get('#lead-sales-stage option[value="contracted"]')
    expect(contractedOption.attributes('disabled')).toBeDefined()
    await wrapper.get('#lead-sales-stage select').setValue('nurturing')
    await wrapper.get('form[aria-label="Qualificação jurídica"]').trigger('submit')
    await flushPromises()

    expect(actions.update).toHaveBeenCalledWith(
      expect.objectContaining({
        legalArea: 'Direito da imigração',
        serviceType: 'Pedido de nacionalidade',
        documentReadiness: 'complete',
        salesStage: 'nurturing',
        feeBudget: 2_500,
      }),
    )
  })

  it('registra um contato e permite convertê-lo em processo', async () => {
    const wrapper = mount(LeadsView, { attachTo: document.body })
    wrappers.push(wrapper)

    const newLeadButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Novo lead'))
    expect(newLeadButton).toBeDefined()
    await newLeadButton!.trigger('click')
    await wrapper.get('#new-lead-phone').setValue('+351911111111')
    await wrapper.get('#new-lead-name').setValue('Bruno Costa')
    await wrapper.get('#new-lead-source select').setValue('partners')
    await wrapper.get('form[aria-label="Cadastrar lead"]').trigger('submit')
    await flushPromises()

    expect(actions.create).toHaveBeenCalledWith({
      phone: '+351911111111',
      sourceChannel: 'partners',
      name: 'Bruno Costa',
      email: null,
    })

    const convertButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Converter em processo'))
    expect(convertButton).toBeDefined()
    await convertButton!.trigger('click')
    await wrapper.get('form[aria-label="Converter lead em processo"]').trigger('submit')
    await flushPromises()
    expect(actions.convert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Impugnação de despedimento — Ana Martins',
        serviceId: 'service-1',
        contractedFee: 2_500,
        clientId: 'client-1',
        description: 'Cliente pretende contestar o despedimento dentro do prazo legal.',
      }),
    )
  })
})
