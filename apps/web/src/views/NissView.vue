<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  CircleX,
  Clock3,
  FileSearch,
  FolderOpen,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  UserPlus,
} from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'
import Input from '@/components/ui/Input.vue'
import Table from '@/components/ui/Table.vue'
import TableBody from '@/components/ui/TableBody.vue'
import TableCell from '@/components/ui/TableCell.vue'
import TableHead from '@/components/ui/TableHead.vue'
import TableHeader from '@/components/ui/TableHeader.vue'
import TableRow from '@/components/ui/TableRow.vue'
import NissDossierModal from '@/components/NissDossierModal.vue'
import NissDocumentsModal from '@/components/NissDocumentsModal.vue'
import NissCitizenDetailsModal from '@/components/NissCitizenDetailsModal.vue'
import { useClients, useNiss, useSession, type Client, type NissInput, type NissDocument } from '@/composables/useApi'
import { resolveCompanyLogoUrl } from '@/lib/branding'

const route = useRoute()
const router = useRouter()
const {
  clients,
  isLoading: clientsLoading,
  atualizarCliente,
  isUpdating: isUpdatingClient,
} = useClients()
const { currentUser } = useSession()
const {
  processes, isLoading, error, criarNiss, buscarDossie, buscarDocumentos, baixarDocumento,
  isCreating, isLoadingDossier, isLoadingDocuments, refresh,
} = useNiss()
const search = ref('')
const isDialogOpen = ref(false)
const formError = ref('')
const clientSearch = ref('')
const isClientMenuOpen = ref(false)
const isDossierOpen = ref(false)
const dossier = ref<Record<string, unknown> | null>(null)
const dossierProcessId = ref('')
const dossierError = ref('')
const isDocumentsOpen = ref(false)
const documents = ref<NissDocument[]>([])
const documentsProcessId = ref('')
const documentsRequestNumber = ref('')
const documentsError = ref('')
const isCitizenDetailsOpen = ref(false)
const citizenDetailsRequestNumber = ref('')
const citizenDetailsClient = ref<Client | null>(null)
const citizenDetailsDossier = ref<Record<string, unknown> | null>(null)
const citizenDetailsError = ref('')
const actionError = ref('')
const currentTime = ref(Date.now())
let currentTimeInterval: number | undefined
const dossierModalRef = ref<InstanceType<typeof NissDossierModal> | null>(null)
const form = reactive<NissInput>({ clientId: '', requestNumber: '', email: '', birthDate: '' })

const selectedClient = computed(() => clients.value.find((client) => client.id === form.clientId))
const filteredClients = computed(() => {
  const term = clientSearch.value.trim().toLowerCase()
  if (!term || selectedClient.value) return clients.value
  return clients.value.filter((client) => clientName(client).toLowerCase().includes(term))
})
const filteredProcesses = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return processes.value
  return processes.value.filter((process) =>
    [process.client.name, process.client.surname, process.requestNumber, process.email, process.niss]
      .some((value) => String(value ?? '').toLowerCase().includes(term)),
  )
})

function resetForm(): void {
  Object.assign(form, { clientId: '', requestNumber: '', email: '', birthDate: '' })
  clientSearch.value = ''
  isClientMenuOpen.value = false
  formError.value = ''
}

function openNewNiss(): void {
  if (!clients.value.length) {
    void router.push({ path: '/clients', query: { new: '1', returnTo: '/niss', newNiss: '1' } })
    return
  }
  resetForm()
  isDialogOpen.value = true
}

function selectClient(clientId: string): void {
  form.clientId = clientId
  const client = clients.value.find((item) => item.id === clientId)
  form.email = client?.email || ''
  form.birthDate = client?.birthDate || ''
  form.requestNumber = ''
  clientSearch.value = client ? clientName(client) : ''
  isClientMenuOpen.value = false
  formError.value = ''
}

function searchClient(value: string): void {
  clientSearch.value = value
  if (selectedClient.value && value !== clientName(selectedClient.value)) {
    form.clientId = ''
    form.email = ''
    form.birthDate = ''
    form.requestNumber = ''
  }
  isClientMenuOpen.value = true
}

function openNewClient(): void {
  isDialogOpen.value = false
  void router.push({ path: '/clients', query: { new: '1', returnTo: '/niss', newNiss: '1' } })
}

function closeClientMenuSoon(): void {
  window.setTimeout(() => { isClientMenuOpen.value = false }, 150)
}

async function saveNiss(): Promise<void> {
  formError.value = ''
  try {
    await criarNiss({ ...form })
    isDialogOpen.value = false
    resetForm()
  } catch (caughtError) {
    formError.value = caughtError instanceof Error ? caughtError.message : 'Não foi possível criar a solicitação.'
  }
}

function clientName(client: Client): string {
  return [client.name, client.surname].filter(Boolean).join(' ')
}

function date(value: string | null, includeTime = false): string {
  if (!value) return '-'
  return new Intl.DateTimeFormat('pt-PT', includeTime ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' }).format(new Date(value))
}

function elapsedTime(value: string | null): string {
  if (!value) return '—'
  const difference = Math.max(0, currentTime.value - new Date(value).getTime())
  const totalHours = Math.floor(difference / 3_600_000)
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  if (days > 0) {
    const dayText = `${days} ${days === 1 ? 'dia' : 'dias'}`
    const hourText = hours > 0 ? ` e ${hours} ${hours === 1 ? 'hora' : 'horas'}` : ''
    return `${dayText}${hourText} atrás`
  }
  if (totalHours > 0) return `${totalHours} ${totalHours === 1 ? 'hora' : 'horas'} atrás`
  return 'Há menos de 1 hora'
}

function statusClass(status: number): string {
  if (status === 3) return 'bg-green-600/10 text-green-700 dark:text-green-400'
  if (status === 2) return 'bg-destructive/10 text-destructive'
  if (status === 1) return 'bg-blue-600/10 text-blue-700 dark:text-blue-400'
  return 'bg-amber-600/10 text-amber-700 dark:text-amber-400'
}

function statusIcon(status: number) {
  if (status === 3) return CheckCircle2
  if (status === 2) return CircleX
  if (status === 1) return LoaderCircle
  return Clock3
}

async function openDossier(id: string): Promise<void> {
  dossierError.value = ''
  dossier.value = null
  dossierProcessId.value = id
  isDossierOpen.value = true
  try {
    dossier.value = await buscarDossie(id)
  } catch (caughtError) {
    dossierError.value = caughtError instanceof Error ? caughtError.message : 'Não foi possível consultar o dossiê.'
  }
}

async function openDocuments(id: string, requestNumber: string): Promise<void> {
  documentsError.value = ''
  documents.value = []
  documentsProcessId.value = id
  documentsRequestNumber.value = requestNumber
  isDocumentsOpen.value = true
  try {
    documents.value = await buscarDocumentos(id)
  } catch (caughtError) {
    documentsError.value = caughtError instanceof Error ? caughtError.message : 'Não foi possível listar os documentos.'
  }
}

async function openCitizenDetails(process: {
  id: string
  requestNumber: string
  client: Client
}): Promise<void> {
  citizenDetailsRequestNumber.value = process.requestNumber
  citizenDetailsClient.value = process.client
  citizenDetailsDossier.value = null
  citizenDetailsError.value = ''
  isCitizenDetailsOpen.value = true
  try {
    citizenDetailsDossier.value = await buscarDossie(process.id)
  } catch (caughtError) {
    citizenDetailsError.value =
      caughtError instanceof Error
        ? caughtError.message
        : 'Não foi possível consultar os dados do cidadão.'
  }
}

function handleCitizenSaved(): void {
  void refresh()
}

function getDossierPdfGenerator(): (() => Promise<Blob>) | null {
  if (!dossierModalRef.value) return null
  return async () => {
    // If dossier hasn't been loaded yet for the current documents process, load it
    if (!dossier.value || dossierProcessId.value !== documentsProcessId.value) {
      dossier.value = await buscarDossie(documentsProcessId.value)
      dossierProcessId.value = documentsProcessId.value
    }
    return dossierModalRef.value!.generatePdf()
  }
}

watch(
  () => [clientsLoading.value, clients.value.length, route.query.newNiss] as const,
  ([loading, count, newNiss]) => {
    if (!loading && count > 0 && newNiss === '1') {
      void router.replace('/niss')
      openNewNiss()
    }
  },
  { immediate: true },
)

onMounted(() => {
  currentTimeInterval = window.setInterval(() => {
    currentTime.value = Date.now()
  }, 60_000)
})

onUnmounted(() => {
  if (currentTimeInterval) window.clearInterval(currentTimeInterval)
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Pedidos NISS</h1>
        <p class="text-muted-foreground">Acompanhe as solicitações de consulta NISS associadas aos clientes.</p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" :disabled="isLoading" @click="refresh()">
          <RefreshCw :class="['mr-2 h-4 w-4', isLoading ? 'animate-spin' : '']" />Atualizar
        </Button>
        <Button @click="openNewNiss"><Plus class="mr-2 h-4 w-4" />Novo NISS</Button>
      </div>
    </div>

    <div class="relative max-w-sm">
      <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input v-model="search" class="pl-8" placeholder="Buscar por cliente, pedido, email ou NISS..." />
    </div>

    <p v-if="actionError" role="alert" class="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{{ actionError }}</p>

    <div class="rounded-md border">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Cliente</TableHead><TableHead>Pedido NISS</TableHead><TableHead>Status</TableHead>
          <TableHead>NISS</TableHead><TableHead>Apontamentos</TableHead><TableHead>Atualizado a</TableHead><TableHead class="text-right">Ações</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          <TableRow v-if="isLoading"><TableCell colspan="7" class="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
          <TableRow v-else-if="error"><TableCell colspan="7" class="text-center text-destructive">{{ error.message }}</TableCell></TableRow>
          <TableRow v-else-if="!filteredProcesses.length"><TableCell colspan="7" class="text-center text-muted-foreground">Nenhuma solicitação NISS encontrada.</TableCell></TableRow>
          <TableRow v-for="process in filteredProcesses" v-else :key="process.id">
            <TableCell><div class="flex w-full items-start justify-between gap-3"><div><p class="font-medium">{{ clientName(process.client) }}</p><p class="text-xs text-muted-foreground">{{ process.email }}</p><p class="text-xs text-muted-foreground">Nascimento: {{ date(process.birthDate) }}</p></div><Button size="sm" variant="outline" class="h-7 shrink-0 px-2 text-xs" @click="openCitizenDetails(process)">Detalhes</Button></div></TableCell>
            <TableCell><p class="font-medium">{{ process.requestNumber }}</p></TableCell>
            <TableCell><span :class="['inline-flex rounded-full p-1.5', statusClass(process.operationalStatus)]" :title="process.operationalStatusName.replace(/_/g, ' ')"><component :is="statusIcon(process.operationalStatus)" :class="['h-5 w-5', process.operationalStatus === 1 ? 'animate-spin' : '']" /><span class="sr-only">{{ process.operationalStatusName.replace(/_/g, ' ') }}</span></span></TableCell>
            <TableCell>
              <div class="flex items-center gap-1">
                <span>{{ process.niss || '-' }}</span>
                <BadgeCheck v-if="process.nissCommunicated" class="inline h-4 w-4 text-green-600" />
                <AlertTriangle v-else-if="process.operationalStatus === 3 && !process.niss" class="inline h-4 w-4 text-amber-600" />
                <span v-if="process.operationalStatus === 3 && !process.niss" class="sr-only">Solicitar comprovativo à entidade</span>
              </div>
            </TableCell>
            <TableCell><p v-if="process.denialReason" class="max-w-xs text-xs text-destructive">{{ process.denialReason }}</p><span v-else>—</span></TableCell>
            <TableCell>{{ elapsedTime(process.updatedAt) }}</TableCell>
            <TableCell>
              <div class="flex justify-end gap-2">
                <Button size="sm" variant="outline" :disabled="isLoadingDossier" @click="openDossier(process.id)" title="Dossiê" aria-label="Dossiê">
                  <FileSearch class="h-4 w-4" />
                  <span class="sr-only">Dossiê</span>
                </Button>
                <Button size="sm" variant="outline" :disabled="isLoadingDocuments" @click="openDocuments(process.id, process.requestNumber)" title="Documentos" aria-label="Documentos">
                  <FolderOpen class="h-4 w-4" />
                  <span class="sr-only">Documentos</span>
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>

  <Dialog :open="isDialogOpen" @update:open="(open) => !open && (isDialogOpen = false)">
    <form class="space-y-5" @submit.prevent="saveNiss">
      <div><h2 class="text-xl font-semibold">Novo NISS</h2><p class="text-sm text-muted-foreground">Selecione primeiro o cliente. O email utilizado no pedido poderá ser ajustado; a data de nascimento será obtida do cadastro do cliente.</p></div>
      <div class="space-y-2">
        <label for="niss-client" class="text-sm font-medium">Cliente</label>
        <div class="relative">
          <Input
            id="niss-client"
            :model-value="clientSearch"
            autocomplete="off"
            placeholder="Pesquisar cliente pelo nome..."
            role="combobox"
            aria-autocomplete="list"
            :aria-expanded="isClientMenuOpen"
            aria-controls="niss-client-options"
            @focus="isClientMenuOpen = true"
            @blur="closeClientMenuSoon"
            @update:model-value="searchClient(String($event))"
          />
          <ChevronDown class="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <div
            v-if="isClientMenuOpen"
            id="niss-client-options"
            role="listbox"
            class="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          >
            <button
              v-for="client in filteredClients"
              :key="client.id"
              type="button"
              role="option"
              :aria-selected="form.clientId === client.id"
              class="flex w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              @mousedown.prevent="selectClient(client.id)"
            >
              {{ clientName(client) }}
            </button>
            <p v-if="!filteredClients.length" class="px-3 py-2 text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
            <div class="mt-1 border-t pt-1">
              <button
                type="button"
                class="flex w-full items-center rounded-sm px-3 py-2 text-left text-sm font-medium text-primary hover:bg-accent"
                @mousedown.prevent="openNewClient"
              >
                <UserPlus class="mr-2 h-4 w-4" />Novo Cliente
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="grid gap-4 sm:grid-cols-2" :class="{ 'opacity-50': !selectedClient }">
        <div class="space-y-2"><label for="niss-request" class="text-sm font-medium">Número do pedido NISS</label><Input id="niss-request" v-model="form.requestNumber" inputmode="numeric" pattern="[0-9]+" required :disabled="!selectedClient" /></div>
        <div class="space-y-2"><label for="niss-email" class="text-sm font-medium">Email utilizado no pedido</label><Input id="niss-email" v-model="form.email" type="email" required :disabled="!selectedClient" /></div>
        <div class="space-y-2"><label for="niss-birth" class="text-sm font-medium">Data de nascimento</label><Input id="niss-birth" v-model="form.birthDate" type="date" required :disabled="!selectedClient" :readonly="!!selectedClient" class="read-only:cursor-default read-only:bg-muted/50" /></div>
        <div class="rounded-md border bg-muted/30 p-3 text-sm"><p class="font-medium">Referência de origem</p><p class="mt-1 break-all text-muted-foreground">{{ selectedClient ? selectedClient.id : 'Definida após selecionar o cliente' }}</p></div>
      </div>
      <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>
      <div class="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" @click="isDialogOpen = false">Cancelar</Button><Button type="submit" :disabled="!selectedClient || isCreating">{{ isCreating ? 'Criando...' : 'Criar solicitação' }}</Button></div>
    </form>
  </Dialog>

  <NissDossierModal
    ref="dossierModalRef"
    :open="isDossierOpen"
    :process-id="dossierProcessId"
    :dossier="dossier"
    :is-loading="isLoadingDossier"
    :error="dossierError"
    :logo-url="resolveCompanyLogoUrl(currentUser?.company?.logoUrl)"
    :company-name="currentUser?.company?.name ?? ''"
    @update:open="(v) => !v && (isDossierOpen = false)"
  />

  <NissDocumentsModal
    :open="isDocumentsOpen"
    :process-id="documentsProcessId"
    :request-number="documentsRequestNumber"
    :documents="documents"
    :is-loading="isLoadingDocuments"
    :error="documentsError"
    :baixar-documento="baixarDocumento"
    :generate-dossier-pdf="getDossierPdfGenerator()"
    @update:open="(v) => !v && (isDocumentsOpen = false)"
  />

  <NissCitizenDetailsModal
    :open="isCitizenDetailsOpen"
    :request-number="citizenDetailsRequestNumber"
    :client="citizenDetailsClient"
    :dossier="citizenDetailsDossier"
    :is-loading="isLoadingDossier"
    :is-saving="isUpdatingClient"
    :error="citizenDetailsError"
    :update-client="atualizarCliente"
    @saved="handleCitizenSaved"
    @update:open="(v) => !v && (isCitizenDetailsOpen = false)"
  />
</template>
