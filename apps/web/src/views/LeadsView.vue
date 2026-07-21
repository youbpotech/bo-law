<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  Bot,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  Flame,
  Handshake,
  MessageCircle,
  Mic,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  UserCheck,
  X,
} from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import WhatsAppIcon from '@/components/icons/WhatsAppIcon.vue'
import Input from '@/components/ui/Input.vue'
import Select from '@/components/ui/Select.vue'
import Textarea from '@/components/ui/Textarea.vue'
import { useClients } from '@/composables/useApi'
import LeadTemperatureChart from '@/features/leads/LeadTemperatureChart.vue'
import { useLeads } from '@/features/leads/useLeads'
import type {
  ConvertLeadInput,
  CreateLeadInput,
  Lead,
  LeadConversationStatus,
  LeadDocumentReadiness,
  LeadMessage,
  LeadQualificationInput,
  LeadQualificationLevel,
  LeadSalesStage,
  LeadSourceChannel,
  LeadUrgency,
} from '@/features/leads/types'

const {
  search,
  conversationStatus,
  qualificationLevel,
  salesStage,
  page,
  selectedLeadId,
  list,
  detail,
  isLoading,
  isFetching,
  error,
  isCreating,
  isUpdating,
  isAssuming,
  isSending,
  isConverting,
  selectLead,
  create,
  update,
  assume,
  sendMessage,
  convert,
  refresh,
  resetPage,
} = useLeads()
const { clients } = useClients()

const manualMessage = ref('')
const actionMessage = ref<string | null>(null)
const createMessage = ref<string | null>(null)
const showCreateForm = ref(false)
const showConvertForm = ref(false)
const qualificationLeadId = ref<string | null>(null)
const conversionLeadId = ref<string | null>(null)

const newLeadForm = reactive({
  phone: '',
  name: '',
  email: '',
  sourceChannel: 'other',
})

const qualificationForm = reactive({
  name: '',
  email: '',
  sourceChannel: 'other',
  legalArea: '',
  serviceType: '',
  caseSummary: '',
  jurisdiction: '',
  urgency: 'low',
  deadline: '',
  feeBudget: '' as string | number,
  paymentCapacity: '',
  documentReadiness: '',
  requestedHumanHelp: false,
  salesStage: 'new',
  interviewAt: '',
  rehydrateAt: '',
})

const conversionForm = reactive({
  title: '',
  serviceType: '',
  contractedFee: '' as string | number,
  clientId: '',
  clientName: '',
  description: '',
  contractSignedAt: '',
  dueAt: '',
})

watch([search, conversationStatus, qualificationLevel, salesStage], resetPage)
watch(
  () => list.value?.data,
  (leads) => {
    if (!selectedLeadId.value && leads?.[0]) selectLead(leads[0].id)
    if (selectedLeadId.value && leads && !leads.some((lead) => lead.id === selectedLeadId.value)) {
      selectedLeadId.value = leads[0]?.id ?? null
    }
  },
  { immediate: true },
)
watch(
  () => detail.value?.lead,
  (lead) => {
    if (!lead) return
    if (qualificationLeadId.value !== lead.id) hydrateQualificationForm(lead)
    if (conversionLeadId.value !== lead.id) {
      hydrateConversionForm(lead)
      showConvertForm.value = false
    }
  },
  { immediate: true },
)

const currency = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})
const dateTime = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const scoreTone = computed(() => {
  const score = detail.value?.lead.qualificationScore ?? 0
  return score >= 70
    ? 'from-red-600 to-red-800'
    : score >= 40
      ? 'from-amber-500 to-amber-700'
      : 'from-slate-600 to-slate-800'
})

const levelLabel: Record<LeadQualificationLevel, string> = {
  frio: 'Frio',
  morno: 'Morno',
  quente: 'Quente',
}
const conversationStatusLabel: Record<LeadConversationStatus, string> = {
  bot_active: 'Bot ativo',
  awaiting_human: 'Aguardando atendimento',
  human_active: 'Atendimento humano',
}
const salesStageLabel: Record<LeadSalesStage, string> = {
  new: 'Novo',
  interview_scheduled: 'Entrevista marcada',
  interview_completed: 'Entrevista realizada',
  nurturing: 'Em reidratação',
  contracted: 'Contratado',
  lost: 'Não convertido',
}
const sourceChannelLabel: Record<LeadSourceChannel, string> = {
  partners: 'Parceiros',
  lives: 'Lives',
  referrals: 'Indicações',
  website: 'Website',
  other: 'Outro',
}
const urgencyLabel: Record<LeadUrgency, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
}
const levelClass: Record<LeadQualificationLevel, string> = {
  frio: 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900',
  morno: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950',
  quente: 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950',
}

function nullableText(value: string) {
  return value.trim() || null
}

function formatMoney(value: number | string | null) {
  if (value === null || value === '') return 'Não informado'
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? currency.format(numericValue) : 'Não informado'
}

function formatDate(value: string | null, fallback = 'Não informado') {
  if (!value) return fallback
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : dateTime.format(parsed)
}

function toDateTimeInput(value: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function toIsoDateTime(value: string) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function hydrateQualificationForm(lead: Lead) {
  Object.assign(qualificationForm, {
    name: lead.name ?? '',
    email: lead.email ?? '',
    sourceChannel: lead.sourceChannel,
    legalArea: lead.legalArea ?? '',
    serviceType: lead.serviceType ?? '',
    caseSummary: lead.caseSummary ?? '',
    jurisdiction: lead.jurisdiction ?? '',
    urgency: lead.urgency ?? '',
    deadline: lead.deadline ?? '',
    feeBudget: lead.feeBudget ?? '',
    paymentCapacity: lead.paymentCapacity ?? '',
    documentReadiness: lead.documentReadiness ?? '',
    requestedHumanHelp: lead.requestedHumanHelp,
    salesStage: lead.salesStage,
    interviewAt: toDateTimeInput(lead.interviewAt),
    rehydrateAt: toDateTimeInput(lead.rehydrateAt),
  })
  qualificationLeadId.value = lead.id
}

function hydrateConversionForm(lead: Lead) {
  const contactName = lead.name || lead.phone
  Object.assign(conversionForm, {
    title: lead.serviceType ? `${lead.serviceType} — ${contactName}` : `Processo — ${contactName}`,
    serviceType: lead.serviceType ?? '',
    contractedFee: lead.feeBudget ?? '',
    clientId: lead.clientId ?? '',
    clientName: lead.clientId ? '' : (lead.name ?? ''),
    description: lead.caseSummary ?? '',
    contractSignedAt: '',
    dueAt: '',
  })
  conversionLeadId.value = lead.id
}

function resetCreateForm() {
  Object.assign(newLeadForm, { phone: '', name: '', email: '', sourceChannel: 'other' })
}

function messageContent(message: LeadMessage) {
  if (message.messageType !== 'audio') return message.content
  if (message.processingStatus === 'transcribing') return 'Transcrevendo áudio…'
  if (['pending', 'downloading', 'converting'].includes(message.processingStatus))
    return 'Preparando áudio…'
  if (message.processingStatus === 'failed') return 'Não foi possível transcrever este áudio'
  return message.content
}

async function handleCreate() {
  const phone = newLeadForm.phone.trim()
  if (!phone) return
  createMessage.value = null
  try {
    const input: CreateLeadInput = {
      phone,
      sourceChannel: newLeadForm.sourceChannel as LeadSourceChannel,
      name: nullableText(newLeadForm.name),
      email: nullableText(newLeadForm.email),
    }
    await create(input)
    resetCreateForm()
    showCreateForm.value = false
    createMessage.value = 'Lead registrado com sucesso.'
  } catch (cause) {
    createMessage.value =
      cause instanceof Error ? cause.message : 'Não foi possível registrar o lead.'
  }
}

async function handleUpdate() {
  actionMessage.value = null
  const numericBudget =
    qualificationForm.feeBudget === '' ? null : Number(qualificationForm.feeBudget)
  const input: LeadQualificationInput = {
    name: nullableText(qualificationForm.name),
    email: nullableText(qualificationForm.email),
    sourceChannel: qualificationForm.sourceChannel as LeadSourceChannel,
    legalArea: nullableText(qualificationForm.legalArea),
    serviceType: nullableText(qualificationForm.serviceType),
    caseSummary: nullableText(qualificationForm.caseSummary),
    jurisdiction: nullableText(qualificationForm.jurisdiction),
    urgency: ['low', 'medium', 'high'].includes(qualificationForm.urgency)
      ? (qualificationForm.urgency as LeadUrgency)
      : null,
    deadline: qualificationForm.deadline || null,
    feeBudget: Number.isFinite(numericBudget) ? numericBudget : null,
    paymentCapacity: nullableText(qualificationForm.paymentCapacity),
    documentReadiness: ['none', 'partial', 'complete'].includes(
      String(qualificationForm.documentReadiness),
    )
      ? (qualificationForm.documentReadiness as LeadDocumentReadiness)
      : null,
    requestedHumanHelp: qualificationForm.requestedHumanHelp,
    interviewAt: toIsoDateTime(qualificationForm.interviewAt),
    rehydrateAt: toIsoDateTime(qualificationForm.rehydrateAt),
  }
  if (detail.value?.lead.salesStage !== 'contracted') {
    input.salesStage = qualificationForm.salesStage as LeadSalesStage
  }
  try {
    await update(input)
    actionMessage.value = 'Qualificação atualizada.'
  } catch (cause) {
    actionMessage.value =
      cause instanceof Error ? cause.message : 'Não foi possível atualizar a qualificação.'
  }
}

async function handleAssume() {
  actionMessage.value = null
  try {
    await assume()
    actionMessage.value = 'Conversa assumida. O bot não enviará novas respostas.'
  } catch (cause) {
    actionMessage.value =
      cause instanceof Error ? cause.message : 'Não foi possível assumir a conversa.'
  }
}

async function handleSend() {
  const content = manualMessage.value.trim()
  if (!content) return
  actionMessage.value = null
  try {
    const result = await sendMessage(content)
    manualMessage.value = ''
    actionMessage.value =
      result.deliveryStatus === 'sent'
        ? 'Mensagem enviada pelo WhatsApp.'
        : `Mensagem registrada, mas o envio falhou: ${result.deliveryError ?? 'falha desconhecida'}`
  } catch (cause) {
    actionMessage.value =
      cause instanceof Error ? cause.message : 'Não foi possível enviar a mensagem.'
  }
}

async function handleConvert() {
  actionMessage.value = null
  const lead = detail.value?.lead
  if (!lead) return
  const title = conversionForm.title.trim()
  const serviceType = conversionForm.serviceType.trim()
  const contractedFee = Number(conversionForm.contractedFee)
  const clientId = conversionForm.clientId.trim()
  const clientName = conversionForm.clientName.trim()
  if (!title || !serviceType || !Number.isFinite(contractedFee) || contractedFee <= 0) {
    actionMessage.value = 'Informe título, serviço e honorários válidos para converter o lead.'
    return
  }
  if (!clientId && !clientName) {
    actionMessage.value = 'Informe o nome do cliente que será criado para o processo.'
    return
  }
  const input: ConvertLeadInput = {
    title,
    serviceType,
    contractedFee,
    description: nullableText(conversionForm.description),
    ...(clientId ? { clientId } : { clientName }),
  }
  const contractSignedAt = toIsoDateTime(conversionForm.contractSignedAt)
  const dueAt = toIsoDateTime(conversionForm.dueAt)
  if (contractSignedAt) input.contractSignedAt = contractSignedAt
  if (dueAt) input.dueAt = dueAt
  try {
    await convert(input)
    showConvertForm.value = false
    actionMessage.value = 'Lead convertido em processo jurídico.'
  } catch (cause) {
    actionMessage.value =
      cause instanceof Error ? cause.message : 'Não foi possível converter o lead.'
  }
}
</script>

<template>
  <div class="space-y-5">
    <section class="relative overflow-hidden rounded-xl border bg-card">
      <div class="absolute inset-y-0 left-0 w-1 bg-primary" />
      <div class="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div
            class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
          >
            <WhatsAppIcon class="h-4 w-4 text-primary" />
            Captação e atendimento
          </div>
          <h1 class="text-3xl font-bold tracking-tight">Leads jurídicos e conversas</h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Qualifique potenciais clientes, acompanhe entrevistas e converta contratos em processos
            jurídicos.
          </p>
          <div class="mt-4 flex flex-wrap items-center gap-3">
            <Button size="sm" @click="showCreateForm = !showCreateForm">
              <X v-if="showCreateForm" class="mr-2 h-4 w-4" />
              <Plus v-else class="mr-2 h-4 w-4" />
              {{ showCreateForm ? 'Cancelar cadastro' : 'Novo lead' }}
            </Button>
            <p v-if="createMessage" class="text-xs text-muted-foreground">{{ createMessage }}</p>
          </div>
        </div>
        <div
          class="flex items-center justify-between gap-6 border-t pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
        >
          <LeadTemperatureChart v-if="(list?.summary.total ?? 0) > 0" :summary="list?.summary" />
          <div class="space-y-2">
            <p class="text-3xl font-bold">{{ list?.summary.total ?? 0 }}</p>
            <p class="text-xs uppercase tracking-wider text-muted-foreground">Leads totais</p>
            <p
              class="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400"
            >
              <Handshake class="h-4 w-4" />
              {{ list?.summary.awaitingHuman ?? 0 }} aguardando
            </p>
          </div>
        </div>
      </div>
    </section>

    <form
      v-if="showCreateForm"
      aria-label="Cadastrar lead"
      class="grid gap-3 rounded-xl border bg-card p-5 md:grid-cols-2 xl:grid-cols-5"
      @submit.prevent="handleCreate"
    >
      <div>
        <label for="new-lead-phone" class="mb-1.5 block text-xs font-medium">Telefone *</label>
        <Input id="new-lead-phone" v-model="newLeadForm.phone" required placeholder="+351…" />
      </div>
      <div>
        <label for="new-lead-name" class="mb-1.5 block text-xs font-medium">Nome</label>
        <Input id="new-lead-name" v-model="newLeadForm.name" placeholder="Nome do contato" />
      </div>
      <div>
        <label for="new-lead-email" class="mb-1.5 block text-xs font-medium">Email</label>
        <Input
          id="new-lead-email"
          v-model="newLeadForm.email"
          type="email"
          placeholder="contato@exemplo.pt"
        />
      </div>
      <div>
        <label for="new-lead-source" class="mb-1.5 block text-xs font-medium">Canal</label>
        <Select id="new-lead-source" v-model="newLeadForm.sourceChannel">
          <option value="partners">Parceiros</option>
          <option value="lives">Lives</option>
          <option value="referrals">Indicações</option>
          <option value="website">Website</option>
          <option value="other">Outro</option>
        </Select>
      </div>
      <div class="flex items-end">
        <Button type="submit" class="w-full" :disabled="!newLeadForm.phone.trim() || isCreating">
          <Plus class="mr-2 h-4 w-4" />{{ isCreating ? 'Registrando…' : 'Registrar lead' }}
        </Button>
      </div>
    </form>

    <div class="grid min-h-[680px] gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside class="overflow-hidden rounded-xl border bg-card">
        <div class="space-y-3 border-b p-4">
          <div class="relative">
            <Search
              class="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"
            />
            <Input v-model="search" class="pl-9" placeholder="Buscar por nome, telefone ou email" />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <Select v-model="qualificationLevel" aria-label="Filtrar qualificação">
              <option value="">Qualificação</option>
              <option value="frio">Frios</option>
              <option value="morno">Mornos</option>
              <option value="quente">Quentes</option>
            </Select>
            <Select v-model="conversationStatus" aria-label="Filtrar atendimento">
              <option value="">Atendimento</option>
              <option value="bot_active">Bot ativo</option>
              <option value="awaiting_human">Aguardando</option>
              <option value="human_active">Humano</option>
            </Select>
          </div>
          <Select v-model="salesStage" aria-label="Filtrar etapa comercial">
            <option value="">Todas as etapas comerciais</option>
            <option v-for="(label, value) in salesStageLabel" :key="value" :value="value">
              {{ label }}
            </option>
          </Select>
        </div>

        <div class="max-h-[570px] divide-y overflow-y-auto">
          <button
            v-for="leadItem in list?.data"
            :key="leadItem.id"
            type="button"
            :aria-pressed="selectedLeadId === leadItem.id"
            :class="[
              'w-full px-4 py-4 text-left transition-colors hover:bg-accent/60',
              selectedLeadId === leadItem.id
                ? 'bg-accent shadow-[inset_3px_0_0_hsl(var(--primary))]'
                : '',
            ]"
            @click="selectLead(leadItem.id)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate font-semibold">{{ leadItem.name || leadItem.phone }}</p>
                <p class="mt-1 truncate text-xs text-muted-foreground">
                  {{ leadItem.lastMessage || leadItem.serviceType || 'Aguardando qualificação' }}
                </p>
              </div>
              <span class="text-xl font-bold tabular-nums">{{ leadItem.qualificationScore }}</span>
            </div>
            <div class="mt-3 flex items-center justify-between gap-2">
              <div class="flex min-w-0 items-center gap-1.5">
                <span
                  :class="[
                    'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    levelClass[leadItem.qualificationLevel],
                  ]"
                >
                  {{ levelLabel[leadItem.qualificationLevel] }}
                </span>
                <span class="truncate text-[10px] text-muted-foreground">{{
                  salesStageLabel[leadItem.salesStage]
                }}</span>
              </div>
              <time class="shrink-0 text-[10px] text-muted-foreground">{{
                formatDate(leadItem.lastMessageAt, 'Sem mensagens')
              }}</time>
            </div>
          </button>
          <div v-if="isLoading" class="p-8 text-center text-sm text-muted-foreground">
            Carregando leads…
          </div>
          <div v-else-if="!list?.data.length" class="p-8 text-center">
            <MessageCircle class="mx-auto h-8 w-8 text-muted-foreground" />
            <p class="mt-3 text-sm font-medium">Nenhum lead encontrado</p>
            <p class="mt-1 text-xs leading-5 text-muted-foreground">
              Cadastre um contato ou aguarde novas conversas recebidas pelo WhatsApp.
            </p>
          </div>
        </div>

        <div
          v-if="list?.pagination.totalPages && list.pagination.totalPages > 1"
          class="flex items-center justify-between border-t p-3"
        >
          <Button
            variant="ghost"
            size="icon"
            :disabled="page <= 1"
            aria-label="Página anterior"
            @click="page--"
          >
            <ChevronLeft class="h-4 w-4" />
          </Button>
          <span class="text-xs text-muted-foreground"
            >{{ page }} de {{ list.pagination.totalPages }}</span
          >
          <Button
            variant="ghost"
            size="icon"
            :disabled="page >= list.pagination.totalPages"
            aria-label="Próxima página"
            @click="page++"
          >
            <ChevronRight class="h-4 w-4" />
          </Button>
        </div>
      </aside>

      <main class="min-w-0">
        <div
          v-if="error"
          class="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {{ error instanceof Error ? error.message : 'Não foi possível carregar os leads.' }}
        </div>
        <div
          v-if="!detail"
          class="flex min-h-[680px] items-center justify-center rounded-xl border bg-card p-8 text-center"
        >
          <div class="max-w-sm">
            <UserCheck class="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 class="mt-4 text-xl font-semibold">Selecione um lead</h2>
            <p class="mt-2 text-sm leading-6 text-muted-foreground">
              A qualificação jurídica e o histórico da conversa serão exibidos aqui.
            </p>
          </div>
        </div>

        <div v-else class="space-y-5">
          <section class="overflow-hidden rounded-xl border bg-card">
            <div class="grid lg:grid-cols-[minmax(0,1fr)_170px]">
              <div class="p-6">
                <div class="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
                  <div>
                    <p
                      class="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                    >
                      Potencial cliente
                    </p>
                    <h2 class="mt-2 text-3xl font-bold tracking-tight">
                      {{ detail.lead.name || detail.lead.phone }}
                    </h2>
                    <p class="mt-1 text-sm text-muted-foreground">
                      {{ detail.lead.phone
                      }}<template v-if="detail.lead.email"> · {{ detail.lead.email }}</template>
                    </p>
                  </div>
                  <div class="flex max-w-lg flex-wrap justify-end gap-2">
                    <span
                      :class="[
                        'rounded-full border px-3 py-1 text-xs font-semibold',
                        levelClass[detail.lead.qualificationLevel],
                      ]"
                    >
                      {{ levelLabel[detail.lead.qualificationLevel] }}
                    </span>
                    <span class="rounded-full border bg-muted px-3 py-1 text-xs font-semibold">{{
                      conversationStatusLabel[detail.lead.conversationStatus]
                    }}</span>
                    <span class="rounded-full border bg-muted px-3 py-1 text-xs font-semibold">{{
                      salesStageLabel[detail.lead.salesStage]
                    }}</span>
                  </div>
                </div>
                <dl class="grid gap-x-6 gap-y-5 pt-5 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <dt class="text-xs uppercase tracking-wider text-muted-foreground">
                      Área jurídica
                    </dt>
                    <dd class="mt-1 font-medium">{{ detail.lead.legalArea || 'Não informada' }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs uppercase tracking-wider text-muted-foreground">
                      Serviço pretendido
                    </dt>
                    <dd class="mt-1 font-medium">
                      {{ detail.lead.serviceType || 'Não informado' }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs uppercase tracking-wider text-muted-foreground">
                      Jurisdição
                    </dt>
                    <dd class="mt-1 font-medium">
                      {{ detail.lead.jurisdiction || 'Não informada' }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs uppercase tracking-wider text-muted-foreground">Canal</dt>
                    <dd class="mt-1 font-medium">
                      {{ sourceChannelLabel[detail.lead.sourceChannel] }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs uppercase tracking-wider text-muted-foreground">Urgência</dt>
                    <dd class="mt-1 font-medium">
                      {{
                        detail.lead.urgency ? urgencyLabel[detail.lead.urgency] : 'Não informada'
                      }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs uppercase tracking-wider text-muted-foreground">
                      Honorários previstos
                    </dt>
                    <dd class="mt-1 font-medium">{{ formatMoney(detail.lead.feeBudget) }}</dd>
                  </div>
                </dl>
                <div
                  v-if="detail.legalCase"
                  class="mt-5 flex items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                >
                  <FileCheck2 class="h-5 w-5" />
                  <div>
                    <p class="font-semibold">Processo jurídico criado</p>
                    <p class="text-xs opacity-80">Referência {{ detail.legalCase.id }}</p>
                  </div>
                </div>
                <div class="mt-6 flex flex-wrap items-center gap-3 border-t pt-5">
                  <Button
                    :disabled="detail.lead.conversationStatus === 'human_active' || isAssuming"
                    @click="handleAssume"
                  >
                    <UserCheck class="mr-2 h-4 w-4" />Assumir conversa
                  </Button>
                  <Button
                    variant="outline"
                    :disabled="
                      Boolean(detail.legalCase) ||
                      detail.lead.salesStage !== 'interview_completed' ||
                      isConverting
                    "
                    :title="
                      detail.lead.salesStage !== 'interview_completed'
                        ? 'Conclua a entrevista antes de formalizar o contrato'
                        : undefined
                    "
                    @click="showConvertForm = !showConvertForm"
                  >
                    <X v-if="showConvertForm" class="mr-2 h-4 w-4" />
                    <Briefcase v-else class="mr-2 h-4 w-4" />
                    {{ showConvertForm ? 'Cancelar conversão' : 'Converter em processo' }}
                  </Button>
                  <Button variant="ghost" :disabled="isFetching" @click="refresh">
                    <RefreshCw
                      :class="['mr-2 h-4 w-4', isFetching ? 'animate-spin' : '']"
                    />Atualizar
                  </Button>
                  <p v-if="actionMessage" role="status" class="text-xs text-muted-foreground">
                    {{ actionMessage }}
                  </p>
                </div>
              </div>
              <aside
                :class="[
                  'flex min-h-44 flex-col justify-between bg-gradient-to-br p-6 text-white',
                  scoreTone,
                ]"
              >
                <p class="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                  Índice de qualificação
                </p>
                <div>
                  <Flame class="mb-3 h-6 w-6 text-white/70" />
                  <p class="text-7xl font-black leading-none tabular-nums">
                    {{ detail.lead.qualificationScore }}
                  </p>
                  <p class="mt-2 text-xs uppercase tracking-wider text-white/70">de 100</p>
                </div>
              </aside>
            </div>
          </section>

          <form
            v-if="showConvertForm && !detail.legalCase"
            aria-label="Converter lead em processo"
            class="rounded-xl border border-primary/30 bg-card p-5"
            @submit.prevent="handleConvert"
          >
            <div class="flex items-center gap-3 border-b pb-4">
              <Briefcase class="h-5 w-5 text-primary" />
              <div>
                <h3 class="font-semibold">Formalizar contrato e abrir processo</h3>
                <p class="text-xs text-muted-foreground">
                  Confirme os dados contratuais usados na criação do processo e da faturação
                  inicial.
                </p>
              </div>
            </div>
            <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <label for="convert-title" class="mb-1.5 block text-xs font-medium"
                  >Título do processo *</label
                >
                <Input id="convert-title" v-model="conversionForm.title" required />
              </div>
              <div>
                <label for="convert-service" class="mb-1.5 block text-xs font-medium"
                  >Serviço contratado *</label
                >
                <Input id="convert-service" v-model="conversionForm.serviceType" required />
              </div>
              <div>
                <label for="convert-fee" class="mb-1.5 block text-xs font-medium"
                  >Honorários contratados *</label
                >
                <Input
                  id="convert-fee"
                  v-model="conversionForm.contractedFee"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>
              <div>
                <label for="convert-client" class="mb-1.5 block text-xs font-medium"
                  >Cliente existente</label
                >
                <Select id="convert-client" v-model="conversionForm.clientId">
                  <option value="">Criar novo cliente</option>
                  <option v-for="client in clients" :key="client.id" :value="client.id">
                    {{ client.name }}
                  </option>
                </Select>
              </div>
              <div v-if="!conversionForm.clientId">
                <label for="convert-client-name" class="mb-1.5 block text-xs font-medium"
                  >Nome do cliente a criar *</label
                >
                <Input id="convert-client-name" v-model="conversionForm.clientName" required />
              </div>
              <div>
                <label for="convert-signed-at" class="mb-1.5 block text-xs font-medium"
                  >Contrato assinado em</label
                >
                <Input
                  id="convert-signed-at"
                  v-model="conversionForm.contractSignedAt"
                  type="datetime-local"
                />
              </div>
              <div>
                <label for="convert-due-at" class="mb-1.5 block text-xs font-medium"
                  >Vencimento da parcela inicial</label
                >
                <Input id="convert-due-at" v-model="conversionForm.dueAt" type="datetime-local" />
              </div>
              <div class="md:col-span-2 xl:col-span-3">
                <label for="convert-description" class="mb-1.5 block text-xs font-medium"
                  >Descrição</label
                >
                <Textarea
                  id="convert-description"
                  v-model="conversionForm.description"
                  class="min-h-20"
                />
              </div>
            </div>
            <div class="mt-5 flex justify-end gap-3 border-t pt-4">
              <Button type="button" variant="ghost" @click="showConvertForm = false"
                >Cancelar</Button
              >
              <Button type="submit" :disabled="isConverting">
                <Briefcase class="mr-2 h-4 w-4" />{{
                  isConverting ? 'Convertendo…' : 'Confirmar e criar processo'
                }}
              </Button>
            </div>
          </form>

          <div class="grid gap-5 2xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,.9fr)]">
            <section class="rounded-xl border bg-card p-5">
              <div class="flex items-center gap-3 border-b pb-4">
                <MessageCircle class="h-5 w-5 text-primary" />
                <div>
                  <h3 class="font-semibold">Histórico da conversa</h3>
                  <p class="text-xs text-muted-foreground">
                    Mensagens do lead, bot e atendimento humano
                  </p>
                </div>
              </div>
              <div class="mt-4 grid max-h-[520px] gap-3 overflow-y-auto pr-1">
                <article
                  v-for="message in detail.messages"
                  :key="message.id"
                  :class="[
                    'max-w-[82%] rounded-lg px-4 py-3 text-sm',
                    message.direction === 'inbound'
                      ? 'justify-self-start border bg-background'
                      : 'justify-self-end bg-primary text-primary-foreground',
                  ]"
                >
                  <p class="whitespace-pre-wrap leading-6">{{ messageContent(message) }}</p>
                  <div
                    class="mt-2 flex items-center gap-2 border-t border-current/15 pt-2 text-[10px] uppercase tracking-wider opacity-70"
                  >
                    <Mic v-if="message.messageType === 'audio'" class="h-3 w-3" />
                    <Bot v-else-if="message.senderType === 'bot'" class="h-3 w-3" />
                    {{ message.senderType }} · {{ formatDate(message.createdAt) }}
                  </div>
                </article>
                <p
                  v-if="!detail.messages.length"
                  class="py-12 text-center text-sm text-muted-foreground"
                >
                  Nenhuma mensagem registrada.
                </p>
              </div>
              <div class="mt-5 border-t pt-5">
                <div class="flex items-center gap-3">
                  <Send class="h-5 w-5 text-primary" />
                  <div>
                    <h3 class="font-semibold">Mensagem manual</h3>
                    <p class="text-xs text-muted-foreground">Envie pelo WhatsApp configurado</p>
                  </div>
                </div>
                <Textarea
                  v-model="manualMessage"
                  class="mt-4 min-h-28"
                  placeholder="Escreva uma mensagem para o lead"
                />
                <Button
                  class="mt-3 w-full"
                  :disabled="!manualMessage.trim() || isSending"
                  @click="handleSend"
                >
                  <Send class="mr-2 h-4 w-4" />{{ isSending ? 'Enviando…' : 'Enviar mensagem' }}
                </Button>
              </div>
            </section>

            <form
              class="rounded-xl border bg-card p-5"
              aria-label="Qualificação jurídica"
              @submit.prevent="handleUpdate"
            >
              <div class="flex items-center justify-between gap-3 border-b pb-4">
                <div class="flex items-center gap-3">
                  <Briefcase class="h-5 w-5 text-primary" />
                  <div>
                    <h3 class="font-semibold">Qualificação jurídica</h3>
                    <p class="text-xs text-muted-foreground">
                      Dados comerciais para a contratação do serviço
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  @click="hydrateQualificationForm(detail.lead)"
                  >Repor</Button
                >
              </div>
              <div class="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label for="lead-name" class="mb-1.5 block text-xs font-medium">Nome</label
                  ><Input id="lead-name" v-model="qualificationForm.name" />
                </div>
                <div>
                  <label for="lead-email" class="mb-1.5 block text-xs font-medium">Email</label
                  ><Input id="lead-email" v-model="qualificationForm.email" type="email" />
                </div>
                <div>
                  <label for="lead-source" class="mb-1.5 block text-xs font-medium"
                    >Canal de captação</label
                  >
                  <Select id="lead-source" v-model="qualificationForm.sourceChannel">
                    <option
                      v-for="(label, value) in sourceChannelLabel"
                      :key="value"
                      :value="value"
                    >
                      {{ label }}
                    </option>
                  </Select>
                </div>
                <div>
                  <label for="lead-legal-area" class="mb-1.5 block text-xs font-medium"
                    >Área jurídica</label
                  ><Input
                    id="lead-legal-area"
                    v-model="qualificationForm.legalArea"
                    placeholder="Ex.: Direito laboral"
                  />
                </div>
                <div>
                  <label for="lead-service" class="mb-1.5 block text-xs font-medium"
                    >Serviço pretendido</label
                  ><Input
                    id="lead-service"
                    v-model="qualificationForm.serviceType"
                    placeholder="Ex.: Consultoria"
                  />
                </div>
                <div>
                  <label for="lead-jurisdiction" class="mb-1.5 block text-xs font-medium"
                    >Jurisdição</label
                  ><Input
                    id="lead-jurisdiction"
                    v-model="qualificationForm.jurisdiction"
                    placeholder="Ex.: Lisboa"
                  />
                </div>
                <div>
                  <label for="lead-urgency" class="mb-1.5 block text-xs font-medium"
                    >Urgência</label
                  >
                  <Select id="lead-urgency" v-model="qualificationForm.urgency">
                    <option value="">Não informada</option>
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                  </Select>
                </div>
                <div>
                  <label for="lead-deadline" class="mb-1.5 block text-xs font-medium"
                    >Prazo relevante</label
                  ><Input
                    id="lead-deadline"
                    v-model="qualificationForm.deadline"
                    placeholder="Ex.: 25/07/2026, amanhã ou sem prazo informado"
                  />
                </div>
                <div>
                  <label for="lead-fee-budget" class="mb-1.5 block text-xs font-medium"
                    >Orçamento de honorários</label
                  ><Input
                    id="lead-fee-budget"
                    v-model="qualificationForm.feeBudget"
                    type="number"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label for="lead-payment-capacity" class="mb-1.5 block text-xs font-medium"
                    >Capacidade de pagamento</label
                  ><Input
                    id="lead-payment-capacity"
                    v-model="qualificationForm.paymentCapacity"
                    placeholder="Ex.: Pagamento faseado"
                  />
                </div>
                <div class="sm:col-span-2">
                  <label for="lead-documents" class="mb-1.5 block text-xs font-medium"
                    >Situação documental</label
                  >
                  <Select id="lead-documents" v-model="qualificationForm.documentReadiness">
                    <option value="">Não informada</option>
                    <option value="none">Sem documentos</option>
                    <option value="partial">Documentação parcial</option>
                    <option value="complete">Documentação completa</option>
                  </Select>
                </div>
                <div class="sm:col-span-2">
                  <label for="lead-summary" class="mb-1.5 block text-xs font-medium"
                    >Resumo da demanda</label
                  ><Textarea
                    id="lead-summary"
                    v-model="qualificationForm.caseSummary"
                    class="min-h-24"
                  />
                </div>
                <div>
                  <label for="lead-sales-stage" class="mb-1.5 block text-xs font-medium"
                    >Etapa comercial</label
                  >
                  <Select
                    id="lead-sales-stage"
                    v-model="qualificationForm.salesStage"
                    :disabled="detail?.lead.salesStage === 'contracted'"
                  >
                    <option
                      v-for="(label, value) in salesStageLabel"
                      :key="value"
                      :value="value"
                      :disabled="value === 'contracted'"
                    >
                      {{ label }}
                    </option>
                  </Select>
                </div>
                <div>
                  <label for="lead-interview" class="mb-1.5 block text-xs font-medium"
                    >Entrevista</label
                  ><Input
                    id="lead-interview"
                    v-model="qualificationForm.interviewAt"
                    type="datetime-local"
                  />
                </div>
                <div>
                  <label for="lead-rehydrate" class="mb-1.5 block text-xs font-medium"
                    >Reidratar em</label
                  ><Input
                    id="lead-rehydrate"
                    v-model="qualificationForm.rehydrateAt"
                    type="datetime-local"
                  />
                </div>
                <label
                  class="flex items-center gap-2 self-end rounded-md border px-3 py-2.5 text-sm"
                >
                  <input
                    v-model="qualificationForm.requestedHumanHelp"
                    type="checkbox"
                    class="h-4 w-4 rounded border-input accent-primary"
                  />
                  Solicitou atendimento humano
                </label>
              </div>
              <Button type="submit" class="mt-5 w-full" :disabled="isUpdating">
                <Save class="mr-2 h-4 w-4" />{{ isUpdating ? 'Salvando…' : 'Salvar qualificação' }}
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>
