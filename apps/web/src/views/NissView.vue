<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  CircleX,
  Clock3,
  Download,
  FileSearch,
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
import { useClients, useNiss, type Client, type NissInput } from '@/composables/useApi'

const route = useRoute()
const router = useRouter()
const { clients, isLoading: clientsLoading } = useClients()
const {
  processes, isLoading, error, criarNiss, buscarDossie, baixarDocumentos,
  isCreating, isLoadingDossier, isDownloadingDocuments, refresh,
} = useNiss()
const search = ref('')
const isDialogOpen = ref(false)
const formError = ref('')
const clientSearch = ref('')
const isClientMenuOpen = ref(false)
const isDossierOpen = ref(false)
const dossier = ref<Record<string, unknown> | null>(null)
const dossierProcessId = ref('')
const actionError = ref('')
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
  actionError.value = ''
  dossier.value = null
  dossierProcessId.value = id
  isDossierOpen.value = true
  try {
    dossier.value = await buscarDossie(id)
  } catch (caughtError) {
    actionError.value = caughtError instanceof Error ? caughtError.message : 'Não foi possível consultar o dossiê.'
  }
}

async function downloadDocuments(id: string): Promise<void> {
  actionError.value = ''
  try {
    const blob = await baixarDocumentos(id)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `pedido-niss-${id}.zip`
    anchor.click()
    URL.revokeObjectURL(url)
  } catch (caughtError) {
    actionError.value = caughtError instanceof Error ? caughtError.message : 'Não foi possível baixar os documentos.'
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
          <TableHead>NISS</TableHead><TableHead>Tentativas</TableHead><TableHead>Atualizado em</TableHead><TableHead class="text-right">Ações</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          <TableRow v-if="isLoading"><TableCell colspan="7" class="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
          <TableRow v-else-if="error"><TableCell colspan="7" class="text-center text-destructive">{{ error.message }}</TableCell></TableRow>
          <TableRow v-else-if="!filteredProcesses.length"><TableCell colspan="7" class="text-center text-muted-foreground">Nenhuma solicitação NISS encontrada.</TableCell></TableRow>
          <TableRow v-for="process in filteredProcesses" v-else :key="process.id">
            <TableCell><p class="font-medium">{{ clientName(process.client) }}</p><p class="text-xs text-muted-foreground">{{ process.email }}</p><p class="text-xs text-muted-foreground">Nascimento: {{ date(process.birthDate) }}</p></TableCell>
            <TableCell><p class="font-medium">{{ process.requestNumber }}</p></TableCell>
            <TableCell><span :class="['inline-flex rounded-full p-1.5', statusClass(process.operationalStatus)]" :title="process.operationalStatusName.replace(/_/g, ' ')"><component :is="statusIcon(process.operationalStatus)" :class="['h-5 w-5', process.operationalStatus === 1 ? 'animate-spin' : '']" /><span class="sr-only">{{ process.operationalStatusName.replace(/_/g, ' ') }}</span></span></TableCell>
            <TableCell>{{ process.niss || '-' }}<BadgeCheck v-if="process.nissCommunicated" class="ml-1 inline h-4 w-4 text-green-600" /></TableCell>
            <TableCell>{{ process.attempts }}<p v-if="process.denialReason" class="max-w-xs text-xs text-destructive">{{ process.denialReason }}</p></TableCell>
            <TableCell>{{ date(process.updatedAt, true) }}</TableCell>
            <TableCell><div class="flex justify-end gap-2"><Button size="sm" variant="outline" :disabled="isLoadingDossier" @click="openDossier(process.id)"><FileSearch class="mr-2 h-4 w-4" />Dossiê</Button><Button size="sm" variant="outline" :disabled="isDownloadingDocuments" title="Baixar documentos em ZIP" aria-label="Baixar documentos em ZIP" @click="downloadDocuments(process.id)"><Download class="h-4 w-4" /></Button></div></TableCell>
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

  <Dialog :open="isDossierOpen" class="max-h-[92vh] max-w-5xl overflow-y-auto" @update:open="(open) => !open && (isDossierOpen = false)">
    <div class="space-y-4">
      <div><h2 class="text-xl font-semibold">Dossiê do pedido {{ dossierProcessId }}</h2><p class="text-sm text-muted-foreground">Todas as informações retornadas pelo BotNiss para este pedido.</p></div>
      <p v-if="isLoadingDossier" class="py-8 text-center text-muted-foreground">Carregando dossiê...</p>
      <p v-else-if="actionError" class="rounded-md bg-destructive/5 p-3 text-sm text-destructive">{{ actionError }}</p>
      <pre v-else-if="dossier" class="max-h-[65vh] overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-4 text-xs">{{ JSON.stringify(dossier, null, 2) }}</pre>
      <div class="flex justify-end border-t pt-4"><Button variant="outline" @click="isDossierOpen = false">Fechar</Button></div>
    </div>
  </Dialog>
</template>
