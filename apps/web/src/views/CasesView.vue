<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  FileCheck2,
  FolderOpen,
  Pencil,
  Plus,
  Search,
  WalletCards,
} from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'
import Input from '@/components/ui/Input.vue'
import Select from '@/components/ui/Select.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Table from '@/components/ui/Table.vue'
import TableHeader from '@/components/ui/TableHeader.vue'
import TableBody from '@/components/ui/TableBody.vue'
import TableRow from '@/components/ui/TableRow.vue'
import TableHead from '@/components/ui/TableHead.vue'
import TableCell from '@/components/ui/TableCell.vue'
import ProcessStakeholderSelector from '@/components/ProcessStakeholderSelector.vue'
import LegalCaseDocumentsModal from '@/components/LegalCaseDocumentsModal.vue'
import { useCaseDocuments, useClients, useServices, useSession, type LegalCaseDocument } from '@/composables/useApi'
import { useCases } from '@/features/cases/useCases'
import type {
  CreateCaseInput,
  Invoice,
  InvoiceStatus,
  LegalCase,
  LegalCaseStage,
} from '@/features/cases/types'

const { t, locale } = useI18n()
const { clients } = useClients()
const { services } = useServices()
const { currentUser } = useSession()
const route = useRoute()
const { cases, isLoading, error, createCase, updateCase, updateInvoice, isCreating, isUpdating } =
  useCases()
const { buscarDocumentos, baixarDocumento, isLoadingDocuments } = useCaseDocuments()

const stages: LegalCaseStage[] = [
  'awaiting_initial_payment',
  'document_collection',
  'public_services_scheduling',
  'diligences',
  'awaiting_documents',
  'final_artifacts',
  'client_final_delivery',
  'awaiting_final_payment',
  'closed',
]

const search = ref('')
const stageFilter = ref<LegalCaseStage | ''>('')
const isDialogOpen = ref(false)
const editingCase = ref<LegalCase | null>(null)
const formError = ref('')
const actionError = ref('')
const isDocumentsOpen = ref(false)
const documents = ref<LegalCaseDocument[]>([])
const documentsCase = ref<LegalCase | null>(null)
const documentsError = ref('')
const hasDocumentIntegration = ref(false)
const form = reactive({
  clientId: '',
  leadId: '',
  title: '',
  serviceId: '',
  description: '',
  contractedFee: '',
  stakeholderUserIds: [] as string[],
})

const filteredCases = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  const stakeholderId = typeof route.query.stakeholder === 'string' ? route.query.stakeholder : ''
  return cases.value.filter((legalCase) => {
    const matchesStage = !stageFilter.value || legalCase.stage === stageFilter.value
    const matchesStakeholder =
      !stakeholderId || legalCase.stakeholders?.some(({ userId }) => userId === stakeholderId)
    const matchesSearch =
      !term ||
      [
        legalCase.title,
        legalCase.service?.name,
        legalCase.client?.name,
        legalCase.client?.surname,
        legalCase.lead?.name,
      ].some(
        (value) => value?.toLocaleLowerCase().includes(term),
      )
    return matchesStage && matchesStakeholder && matchesSearch
  })
})

const formCreator = computed(() => {
  if (editingCase.value) {
    return {
      id: editingCase.value.createdByUserId,
      name: editingCase.value.createdByUser?.name || 'Criador do processo',
    }
  }
  return currentUser.value ? { id: currentUser.value.id, name: currentUser.value.name } : null
})

function resetForm(): void {
  editingCase.value = null
  form.clientId = clients.value[0]?.id ?? ''
  form.leadId = ''
  form.title = ''
  form.serviceId = services.value.find((service) => service.processType === 'general' && service.active)?.id ?? ''
  form.description = ''
  form.contractedFee = ''
  form.stakeholderUserIds = []
  formError.value = ''
}

function openCreateDialog(): void {
  resetForm()
  isDialogOpen.value = true
}

function openEditDialog(legalCase: LegalCase): void {
  editingCase.value = legalCase
  form.clientId = legalCase.clientId
  form.leadId = legalCase.leadId ?? ''
  form.title = legalCase.title
  form.serviceId = legalCase.serviceId
  form.description = legalCase.description ?? ''
  form.contractedFee = String(legalCase.contractedFee)
  form.stakeholderUserIds = (legalCase.stakeholders ?? [])
    .filter(({ role }) => role === 'stakeholder')
    .map(({ userId }) => userId)
  formError.value = ''
  isDialogOpen.value = true
}

function closeDialog(): void {
  isDialogOpen.value = false
  resetForm()
}

async function save(): Promise<void> {
  formError.value = ''
  try {
    if (editingCase.value) {
      await updateCase({
        id: editingCase.value.id,
        input: {
          title: form.title.trim(),
          serviceId: form.serviceId,
          description: form.description.trim() || null,
          stakeholderUserIds: [...form.stakeholderUserIds],
        },
      })
    } else {
      const input: CreateCaseInput = {
        clientId: form.clientId,
        leadId: form.leadId.trim() || null,
        title: form.title.trim(),
        serviceId: form.serviceId,
        description: form.description.trim() || null,
        contractedFee: form.contractedFee.trim(),
        stakeholderUserIds: [...form.stakeholderUserIds],
      }
      await createCase(input)
    }
    closeDialog()
  } catch (caughtError) {
    formError.value = caughtError instanceof Error ? caughtError.message : t('cases.saveError')
  }
}

function clientName(legalCase: LegalCase): string {
  return [legalCase.client?.name, legalCase.client?.surname].filter(Boolean).join(' ') || '—'
}

async function openDocuments(legalCase: LegalCase): Promise<void> {
  documentsCase.value = legalCase
  documents.value = []
  documentsError.value = ''
  hasDocumentIntegration.value = Boolean(
    legalCase.integrations?.some(({ externalProcessId }) => externalProcessId),
  )
  isDocumentsOpen.value = true
  try {
    const result = await buscarDocumentos(legalCase.id)
    documents.value = result.documents
    hasDocumentIntegration.value = Boolean(result.provider)
  } catch (error) {
    documentsError.value = error instanceof Error ? error.message : 'Não foi possível listar os documentos.'
  }
}

function getNextStage(legalCase: LegalCase): LegalCaseStage | null {
  if (legalCase.stage === 'document_collection') return 'public_services_scheduling'
  if (legalCase.stage === 'public_services_scheduling') return 'diligences'
  if (legalCase.stage === 'diligences') {
    return legalCase.documentsComplete ? 'final_artifacts' : 'awaiting_documents'
  }
  if (legalCase.stage === 'awaiting_documents') return 'document_collection'
  if (legalCase.stage === 'final_artifacts') return 'client_final_delivery'
  if (legalCase.stage === 'client_final_delivery') return 'awaiting_final_payment'
  return null
}

async function advanceCase(legalCase: LegalCase): Promise<void> {
  const stage = getNextStage(legalCase)
  if (!stage) return
  actionError.value = ''
  try {
    await updateCase({
      id: legalCase.id,
      input: { stage },
    })
  } catch (caughtError) {
    actionError.value = caughtError instanceof Error ? caughtError.message : t('cases.updateError')
  }
}

async function toggleDocuments(legalCase: LegalCase): Promise<void> {
  actionError.value = ''
  try {
    await updateCase({
      id: legalCase.id,
      input: { documentsComplete: !legalCase.documentsComplete },
    })
  } catch (caughtError) {
    actionError.value = caughtError instanceof Error ? caughtError.message : t('cases.updateError')
  }
}

function nextInvoiceStatus(status: InvoiceStatus): InvoiceStatus | null {
  if (status === 'requested') return 'issued'
  if (status === 'issued') return 'paid'
  return null
}

async function advanceInvoice(legalCase: LegalCase, invoice: Invoice): Promise<void> {
  const status = nextInvoiceStatus(invoice.status)
  if (!status) return
  actionError.value = ''
  try {
    await updateInvoice({ caseId: legalCase.id, invoiceId: invoice.id, input: { status } })
  } catch (caughtError) {
    actionError.value =
      caughtError instanceof Error ? caughtError.message : t('cases.invoiceUpdateError')
  }
}

function formatMoney(value: string | number | null): string {
  if (!value) return '—'
  return new Intl.NumberFormat(locale.value, { style: 'currency', currency: 'EUR' }).format(
    Number(value),
  )
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'short' }).format(new Date(value))
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">{{ $t('cases.title') }}</h1>
        <p class="text-muted-foreground">{{ $t('cases.subtitle') }}</p>
      </div>
      <Button :disabled="!clients.length" @click="openCreateDialog">
        <Plus class="mr-2 h-4 w-4" />
        {{ $t('cases.newCase') }}
      </Button>
    </div>

    <div class="grid gap-3 sm:grid-cols-[minmax(0,360px)_minmax(220px,320px)]">
      <div class="relative">
        <Search class="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input v-model="search" class="pl-9" :placeholder="$t('cases.search')" />
      </div>
      <Select v-model="stageFilter" :aria-label="$t('cases.filterStage')">
        <option value="">{{ $t('cases.allStages') }}</option>
        <option v-for="stage in stages" :key="stage" :value="stage">
          {{ $t(`cases.stages.${stage}`) }}
        </option>
      </Select>
    </div>

    <p
      v-if="actionError"
      class="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
    >
      {{ actionError }}
    </p>

    <div class="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Processo</TableHead>
            <TableHead>{{ $t('cases.stage') }}</TableHead>
            <TableHead>{{ $t('cases.invoices') }}</TableHead>
            <TableHead class="text-right">{{ $t('common.actions') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="isLoading">
            <TableCell colspan="4" class="text-center text-muted-foreground">{{
              $t('common.loading')
            }}</TableCell>
          </TableRow>
          <TableRow v-else-if="error">
            <TableCell colspan="4" class="text-center text-destructive">
              {{ error instanceof Error ? error.message : $t('cases.loadError') }}
            </TableCell>
          </TableRow>
          <TableRow v-else-if="!filteredCases.length">
            <TableCell colspan="4" class="py-10 text-center text-muted-foreground">{{
              $t('cases.empty')
            }}</TableCell>
          </TableRow>
          <TableRow v-for="legalCase in filteredCases" v-else :key="legalCase.id" class="align-top">
            <TableCell class="min-w-64">
              <div class="flex gap-3">
                <BriefcaseBusiness class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p class="text-xs font-medium text-muted-foreground">Tipo: {{ legalCase.service?.name || '—' }}</p>
                  <p class="font-semibold">{{ clientName(legalCase) }}</p>
                  <p class="mt-1 line-clamp-2 text-xs text-muted-foreground">Descrição: {{ legalCase.description || '—' }}</p>
                  <p class="mt-2 text-xs">{{ formatMoney(legalCase.contractedFee) }}</p>
                  <p class="mt-2 text-xs text-muted-foreground">
                    Criador: {{ legalCase.createdByUser?.name || '—' }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    Notificados:
                    {{ legalCase.stakeholders?.map(({ user }) => user.name).join(', ') || legalCase.createdByUser?.name || '—' }}
                  </p>
                </div>
              </div>
            </TableCell>
            <TableCell class="min-w-56">
              <span class="inline-flex rounded-full border bg-muted px-3 py-1 text-xs font-medium">
                {{ $t(`cases.stages.${legalCase.stage}`) }}
              </span>
              <p class="mt-2 text-xs text-muted-foreground">
                {{ $t('cases.updatedAt') }}: {{ formatDate(legalCase.updatedAt) }}
              </p>
            </TableCell>
            <TableCell class="min-w-64">
              <div v-if="legalCase.invoices?.length" class="space-y-2">
                <div
                  v-for="invoice in legalCase.invoices"
                  :key="invoice.id"
                  class="flex items-center justify-between gap-3 rounded-md border p-2"
                >
                  <div class="flex items-center gap-2 text-xs">
                    <WalletCards class="h-4 w-4 text-primary" />
                    <span>
                      {{ $t(`cases.invoiceKinds.${invoice.kind}`) }} ·
                      {{ $t(`cases.invoiceStatuses.${invoice.status}`) }}
                    </span>
                  </div>
                  <Button
                    v-if="nextInvoiceStatus(invoice.status)"
                    size="sm"
                    variant="ghost"
                    :disabled="isUpdating"
                    @click="advanceInvoice(legalCase, invoice)"
                  >
                    {{ $t(`cases.invoiceActions.${nextInvoiceStatus(invoice.status)}`) }}
                  </Button>
                  <CheckCircle2
                    v-else-if="invoice.status === 'paid'"
                    class="h-4 w-4 text-emerald-600"
                  />
                </div>
              </div>
              <span v-else class="text-xs text-muted-foreground">{{ $t('cases.noInvoices') }}</span>
            </TableCell>
            <TableCell>
              <div class="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  title="Documentos"
                  aria-label="Documentos"
                  :disabled="isLoadingDocuments"
                  @click="openDocuments(legalCase)"
                >
                  <FolderOpen class="h-4 w-4" />
                  <span class="sr-only">Documentos</span>
                </Button>
                <Button
                  v-if="legalCase.caseType === 'general'"
                  size="sm"
                  variant="outline"
                  :disabled="isUpdating"
                  :title="legalCase.documentsComplete ? $t('cases.complete') : $t('cases.incomplete')"
                  @click="toggleDocuments(legalCase)"
                >
                  <FileCheck2
                    :class="[
                      'h-4 w-4',
                      legalCase.documentsComplete ? 'text-emerald-600' : 'text-muted-foreground',
                    ]"
                  />
                  <span class="sr-only">{{ legalCase.documentsComplete ? $t('cases.complete') : $t('cases.incomplete') }}</span>
                </Button>
                <Button variant="outline" size="sm" @click="openEditDialog(legalCase)">
                  <Pencil class="h-4 w-4" />
                  <span class="sr-only">{{ $t('common.edit') }}</span>
                </Button>
                <Button
                  v-if="legalCase.caseType === 'general' && getNextStage(legalCase)"
                  size="sm"
                  :disabled="isUpdating"
                  :title="
                    $t('cases.advanceTo', { stage: $t(`cases.stages.${getNextStage(legalCase)}`) })
                  "
                  @click="advanceCase(legalCase)"
                >
                  <ArrowRight class="mr-2 h-4 w-4" />
                  {{
                    legalCase.stage === 'awaiting_documents'
                      ? $t('cases.returnDocuments')
                      : $t('cases.advance')
                  }}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>

  <Dialog
    :open="isDialogOpen"
    class="max-w-2xl"
    @update:open="
      (open) => {
        if (!open) closeDialog()
      }
    "
  >
    <form class="space-y-5" @submit.prevent="save">
      <div>
        <h2 class="text-xl font-semibold">
          {{ editingCase ? $t('cases.editCase') : $t('cases.newCase') }}
        </h2>
        <p class="text-sm text-muted-foreground">{{ $t('cases.formDescription') }}</p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div v-if="!editingCase" class="space-y-2 sm:col-span-2">
          <label for="case-client" class="text-sm font-medium">{{ $t('cases.client') }}</label>
          <Select id="case-client" v-model="form.clientId" required>
            <option value="" disabled>{{ $t('cases.selectClient') }}</option>
            <option v-for="client in clients" :key="client.id" :value="client.id">
              {{ [client.name, client.surname].filter(Boolean).join(' ') }}
            </option>
          </Select>
        </div>

        <div v-if="!editingCase" class="space-y-2 sm:col-span-2">
          <label for="case-lead" class="text-sm font-medium">{{ $t('cases.leadId') }}</label>
          <Input id="case-lead" v-model="form.leadId" :placeholder="$t('cases.leadIdHelp')" />
        </div>

        <div class="space-y-2 sm:col-span-2">
          <label for="case-title" class="text-sm font-medium">{{ $t('cases.name') }}</label>
          <Input id="case-title" v-model="form.title" required maxlength="255" />
        </div>

        <div class="space-y-2">
          <label for="case-service" class="text-sm font-medium">{{
            $t('cases.serviceType')
          }}</label>
          <Select id="case-service" v-model="form.serviceId" required :disabled="Boolean(editingCase && editingCase.caseType !== 'general')">
            <option value="" disabled>Selecione o serviço</option>
            <option v-for="service in services.filter((item) => item.processType === 'general' && (item.active || item.id === form.serviceId))" :key="service.id" :value="service.id">{{ service.name }}</option>
          </Select>
        </div>

        <div class="space-y-2 sm:col-span-2">
          <label for="case-description" class="text-sm font-medium">{{
            $t('cases.description')
          }}</label>
          <Textarea id="case-description" v-model="form.description" />
        </div>

        <div v-if="!editingCase" class="space-y-2">
          <label for="case-contracted-fee" class="text-sm font-medium">{{
            $t('cases.contractedFee')
          }}</label>
          <Input
            id="case-contracted-fee"
            v-model="form.contractedFee"
            type="number"
            required
            min="0.01"
            step="0.01"
            inputmode="decimal"
            placeholder="0.00"
          />
        </div>
      </div>

      <ProcessStakeholderSelector
        v-if="formCreator"
        v-model="form.stakeholderUserIds"
        :creator="formCreator"
      />

      <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>

      <div class="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" @click="closeDialog">{{
          $t('common.cancel')
        }}</Button>
        <Button type="submit" :disabled="isCreating || isUpdating">
          {{ isCreating || isUpdating ? $t('common.loading') : $t('common.save') }}
        </Button>
      </div>
    </form>
  </Dialog>

  <LegalCaseDocumentsModal
    :open="isDocumentsOpen"
    :case-id="documentsCase?.id || ''"
    :case-title="documentsCase?.title || ''"
    :documents="documents"
    :has-integration="hasDocumentIntegration"
    :is-loading="isLoadingDocuments"
    :error="documentsError"
    :baixar-documento="baixarDocumento"
    @update:open="(open) => !open && (isDocumentsOpen = false)"
  />
</template>
