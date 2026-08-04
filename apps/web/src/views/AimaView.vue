<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  CircleCheck,
  CircleX,
  Clock3,
  ExternalLink,
  FileSearch,
  FolderOpen,
  Link,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  UserPlus,
  ChevronDown,
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
import AimaDossierModal from '@/components/AimaDossierModal.vue'
import AimaDocumentsModal from '@/components/AimaDocumentsModal.vue'
import ProcessStakeholderSelector from '@/components/ProcessStakeholderSelector.vue'
import { useAima, useClients, useSession, type AimaInput, type AimaProcess, type Client, type AimaDocument } from '@/composables/useApi'

const route = useRoute()
const router = useRouter()
const { clients, isLoading: clientsLoading } = useClients()
const { currentUser } = useSession()
const {
  processes,
  isLoading,
  error,
  criarAima,
  buscarDossie,
  buscarDocumentos,
  baixarDocumento,
  reprocessar,
  isCreating,
  isLoadingDossier,
  isLoadingDocuments,
  isReprocessing,
  refresh,
} = useAima()

const search = ref('')
const isDialogOpen = ref(false)
const formError = ref('')
const clientSearch = ref('')
const isClientMenuOpen = ref(false)
const form = reactive<AimaInput>({ clientId: '', trackingUrl: '', stakeholderUserIds: [] })
const dossier = ref<Record<string, unknown> | null>(null)
const dossierProcessId = ref('')
const dossierError = ref('')
const isDossierOpen = ref(false)
const documents = ref<AimaDocument[]>([])
const documentsProcessId = ref('')
const documentsError = ref('')
const isDocumentsOpen = ref(false)
const actionError = ref('')
const currentTime = ref(Date.now())
let currentTimeInterval: number | undefined

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
    [process.client.name, process.client.surname, process.processNumber, process.titleNumber, process.currentState, process.trackingUrl]
      .some((value) => String(value ?? '').toLowerCase().includes(term)),
  )
})

function clientName(client: Client): string {
  return [client.name, client.surname].filter(Boolean).join(' ')
}

function resetForm(): void {
  Object.assign(form, { clientId: '', trackingUrl: '', stakeholderUserIds: [] })
  clientSearch.value = ''
  isClientMenuOpen.value = false
  formError.value = ''
}

function openNewAima(): void {
  if (!clients.value.length) {
    void router.push({ path: '/clients', query: { new: '1', returnTo: '/aima', newAima: '1' } })
    return
  }
  resetForm()
  isDialogOpen.value = true
}

function selectClient(clientId: string): void {
  form.clientId = clientId
  const client = clients.value.find((item) => item.id === clientId)
  clientSearch.value = client ? clientName(client) : ''
  isClientMenuOpen.value = false
  formError.value = ''
}

function searchClient(value: string): void {
  clientSearch.value = value
  if (selectedClient.value && value !== clientName(selectedClient.value)) form.clientId = ''
  isClientMenuOpen.value = true
}

function openNewClient(): void {
  isDialogOpen.value = false
  void router.push({ path: '/clients', query: { new: '1', returnTo: '/aima', newAima: '1' } })
}

function closeClientMenuSoon(): void {
  window.setTimeout(() => { isClientMenuOpen.value = false }, 150)
}

async function saveAima(): Promise<void> {
  formError.value = ''
  try {
    await criarAima({ ...form, trackingUrl: form.trackingUrl.trim() })
    isDialogOpen.value = false
    resetForm()
  } catch (caughtError) {
    formError.value = caughtError instanceof Error ? caughtError.message : 'Não foi possível criar o acompanhamento AIMA.'
  }
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
  if (status === 3) return CircleCheck
  if (status === 2) return CircleX
  if (status === 1) return LoaderCircle
  return Clock3
}

function operationalStatus(process: AimaProcess): string {
  const labels: Record<string, string> = {
    A_CONSULTAR: 'A consultar',
    EM_CURSO: 'Em curso',
    BLOQUEADA: 'Bloqueada',
    CONCLUIDA: 'Concluída',
  }
  return labels[process.operationalStatusName] || process.operationalStatusName
}

async function openDossier(id: string): Promise<void> {
  dossierError.value = ''
  dossier.value = null
  dossierProcessId.value = id
  isDossierOpen.value = true
  try {
    dossier.value = await buscarDossie(id)
  } catch (caughtError) {
    dossierError.value = caughtError instanceof Error ? caughtError.message : 'Não foi possível consultar o dossiê AIMA.'
  }
}

async function openDocuments(id: string): Promise<void> {
  documentsError.value = ''
  documents.value = []
  documentsProcessId.value = id
  isDocumentsOpen.value = true
  try {
    documents.value = await buscarDocumentos(id)
  } catch (caughtError) {
    documentsError.value = caughtError instanceof Error ? caughtError.message : 'Não foi possível listar os documentos AIMA.'
  }
}

async function reprocess(process: AimaProcess): Promise<void> {
  if (!window.confirm(`Solicitar uma nova consulta para o processo AIMA de ${clientName(process.client)}?`)) return
  actionError.value = ''
  try {
    await reprocessar(process.id)
  } catch (caughtError) {
    actionError.value = caughtError instanceof Error ? caughtError.message : 'Não foi possível solicitar o reprocessamento.'
  }
}

watch(
  () => [clientsLoading.value, clients.value.length, route.query.newAima] as const,
  ([loading, count, newAima]) => {
    if (!loading && count > 0 && newAima === '1') {
      void router.replace('/aima')
      openNewAima()
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
        <h1 class="text-3xl font-bold tracking-tight">Processos AIMA</h1>
        <p class="text-muted-foreground">Acompanhe os processos de autorização de residência associados aos clientes.</p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" :disabled="isLoading" @click="refresh()"><RefreshCw :class="['mr-2 h-4 w-4', isLoading ? 'animate-spin' : '']" />Atualizar</Button>
        <Button @click="openNewAima"><Plus class="mr-2 h-4 w-4" />Novo processo AIMA</Button>
      </div>
    </div>

    <div class="relative max-w-xl">
      <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input v-model="search" class="pl-8" placeholder="Buscar por cliente, processo, estado ou link..." />
    </div>

    <p v-if="actionError" role="alert" class="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{{ actionError }}</p>

    <div class="rounded-md border">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Cliente</TableHead><TableHead>Processo AIMA</TableHead><TableHead>Estado AIMA</TableHead>
          <TableHead>Status</TableHead><TableHead>Última consulta</TableHead><TableHead>Atualizado</TableHead><TableHead class="text-right">Ações</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          <TableRow v-if="isLoading"><TableCell colspan="7" class="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
          <TableRow v-else-if="error"><TableCell colspan="7" class="text-center text-destructive">{{ error.message }}</TableCell></TableRow>
          <TableRow v-else-if="!filteredProcesses.length"><TableCell colspan="7" class="text-center text-muted-foreground">Nenhum processo AIMA encontrado.</TableCell></TableRow>
          <TableRow v-for="process in filteredProcesses" v-else :key="process.id">
            <TableCell><p class="font-medium">{{ clientName(process.client) }}</p><p class="text-xs text-muted-foreground">ID {{ process.id }}</p></TableCell>
            <TableCell>
              <p class="font-medium">{{ process.processNumber || process.titleNumber || 'Ainda não atribuído' }}</p>
              <a :href="process.trackingUrl" target="_blank" rel="noreferrer" class="mt-1 inline-flex max-w-[18rem] items-center gap-1 truncate text-xs text-primary hover:underline" :title="process.trackingUrl"><Link class="h-3 w-3 shrink-0" />{{ process.trackingUrl }}<ExternalLink class="h-3 w-3 shrink-0" /></a>
            </TableCell>
            <TableCell><div class="max-w-xs"><p class="font-medium">{{ process.currentState || 'A aguardar primeira consulta' }}</p><p v-if="process.currentGuidance" class="mt-1 text-xs text-muted-foreground">{{ process.currentGuidance }}</p></div></TableCell>
            <TableCell><span :class="['inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium', statusClass(process.operationalStatus)]"><component :is="statusIcon(process.operationalStatus)" :class="['h-4 w-4', process.operationalStatus === 1 ? 'animate-spin' : '']" />{{ operationalStatus(process) }}</span><p v-if="process.denialReason" class="mt-1 max-w-xs text-xs text-destructive">{{ process.denialReason }}</p></TableCell>
          <TableCell>{{ process.lastPortalConsultationAt ? date(process.lastPortalConsultationAt, true) : 'Ainda não consultado' }}</TableCell>
          <TableCell><span :title="date(process.updatedAt, true)" :aria-label="`Atualizado em ${date(process.updatedAt, true)}`">{{ elapsedTime(process.updatedAt) }}</span></TableCell>
            <TableCell><div class="flex justify-end gap-2"><Button size="sm" variant="outline" :disabled="isLoadingDossier" title="Dossiê" aria-label="Dossiê" @click="openDossier(process.id)"><FileSearch class="h-4 w-4" /><span class="sr-only">Dossiê</span></Button><Button size="sm" variant="outline" :disabled="isLoadingDocuments" title="Documentos" aria-label="Documentos" @click="openDocuments(process.id)"><FolderOpen class="h-4 w-4" /><span class="sr-only">Documentos</span></Button><Button size="sm" variant="outline" :disabled="isReprocessing || process.operationalStatus === 1" title="Solicitar nova consulta" aria-label="Solicitar nova consulta" @click="reprocess(process)"><RefreshCw :class="['h-4 w-4', isReprocessing ? 'animate-spin' : '']" /><span class="sr-only">Solicitar nova consulta</span></Button></div></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>

  <Dialog :open="isDialogOpen" @update:open="(open) => !open && (isDialogOpen = false)">
    <form class="space-y-5" @submit.prevent="saveAima">
      <div><h2 class="text-xl font-semibold">Novo Processo AIMA</h2><p class="text-sm text-muted-foreground">Associe o link público do acompanhamento AIMA do cliente para que o Agente AIMDA acomoanhe o processo e notifique-o sempre que houver atualizações.</p></div>
      <div class="space-y-2">
        <label for="aima-client" class="text-sm font-medium">Cliente</label>
        <div class="relative">
          <Input id="aima-client" :model-value="clientSearch" autocomplete="off" placeholder="Pesquisar cliente pelo nome..." role="combobox" aria-autocomplete="list" :aria-expanded="isClientMenuOpen" aria-controls="aima-client-options" @focus="isClientMenuOpen = true" @blur="closeClientMenuSoon" @update:model-value="searchClient(String($event))" />
          <ChevronDown class="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <div v-if="isClientMenuOpen" id="aima-client-options" role="listbox" class="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
            <button v-for="client in filteredClients" :key="client.id" type="button" role="option" :aria-selected="form.clientId === client.id" class="flex w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground" @mousedown.prevent="selectClient(client.id)">{{ clientName(client) }}</button>
            <p v-if="!filteredClients.length" class="px-3 py-2 text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
            <div class="mt-1 border-t pt-1"><button type="button" class="flex w-full items-center rounded-sm px-3 py-2 text-left text-sm font-medium text-primary hover:bg-accent" @mousedown.prevent="openNewClient"><UserPlus class="mr-2 h-4 w-4" />Novo Cliente</button></div>
          </div>
        </div>
      </div>
      <div class="space-y-2" :class="{ 'opacity-50': !selectedClient }"><label for="aima-url" class="text-sm font-medium">Link de acompanhamento AIMA</label><Input id="aima-url" v-model="form.trackingUrl" type="url" required :disabled="!selectedClient" placeholder="https://contactenos.aima.gov.pt/tracking/<UUID>" /><p class="text-xs text-muted-foreground">Use o link completo copiado do portal AIMA.</p></div>
      <ProcessStakeholderSelector
        v-if="currentUser"
        v-model="form.stakeholderUserIds"
        :creator="{ id: currentUser.id, name: currentUser.name }"
        :disabled="!selectedClient"
      />
      <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>
      <div class="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" @click="isDialogOpen = false">Cancelar</Button><Button type="submit" :disabled="!selectedClient || isCreating">{{ isCreating ? 'Criando...' : 'Criar acompanhamento' }}</Button></div>
    </form>
  </Dialog>

  <AimaDossierModal :open="isDossierOpen" :process-id="dossierProcessId" :dossier="dossier" :is-loading="isLoadingDossier" :error="dossierError" @update:open="(v) => !v && (isDossierOpen = false)" />
  <AimaDocumentsModal :open="isDocumentsOpen" :process-id="documentsProcessId" :documents="documents" :is-loading="isLoadingDocuments" :error="documentsError" :baixar-documento="baixarDocumento" @update:open="(v) => !v && (isDocumentsOpen = false)" />
</template>
