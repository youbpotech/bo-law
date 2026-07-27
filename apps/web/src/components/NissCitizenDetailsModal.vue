<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'
import Table from '@/components/ui/Table.vue'
import TableBody from '@/components/ui/TableBody.vue'
import TableCell from '@/components/ui/TableCell.vue'
import TableHead from '@/components/ui/TableHead.vue'
import TableHeader from '@/components/ui/TableHeader.vue'
import TableRow from '@/components/ui/TableRow.vue'
import type { Client, ClientInput } from '@/composables/useApi'
import {
  citizenComparisons,
  citizenDetails,
  displayCitizenValue,
  dossierCitizen,
  mergedClientInput,
} from '@/lib/niss-citizen'

interface Props {
  open: boolean
  requestNumber: string
  client: Client | null
  dossier: Record<string, unknown> | null
  isLoading: boolean
  isSaving: boolean
  error: string
  updateClient: (args: { id: string; dados: ClientInput }) => Promise<Client>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'saved'): void
}>()

type Stage = 'details' | 'compare' | 'confirm'
const stage = ref<Stage>('details')
const selected = ref(new Set<keyof ClientInput>())
const saveError = ref('')

const citizen = computed(() => dossierCitizen(props.dossier))
const comparisons = computed(() =>
  props.client && citizen.value ? citizenComparisons(props.client, citizen.value) : [],
)
const details = computed(() => (citizen.value ? citizenDetails(citizen.value) : []))
const selectedRows = computed(() => comparisons.value.filter((row) => selected.value.has(row.key)))

watch(
  () => props.open,
  (open) => {
    if (open) {
      stage.value = 'details'
      selected.value = new Set()
      saveError.value = ''
    }
  },
)

function setSelected(key: keyof ClientInput, value: boolean): void {
  const next = new Set(selected.value)
  if (value) next.add(key)
  else next.delete(key)
  selected.value = next
}

async function save(): Promise<void> {
  if (!props.client || !selectedRows.value.length) return
  saveError.value = ''
  try {
    const dados = mergedClientInput(props.client, comparisons.value, selected.value)
    await props.updateClient({ id: props.client.id, dados })
    emit('saved')
    emit('update:open', false)
  } catch (error) {
    saveError.value =
      error instanceof Error ? error.message : 'Não foi possível atualizar o cliente.'
  }
}
</script>

<template>
  <Dialog
    :open="open"
    class="max-h-[92vh] max-w-6xl overflow-y-auto"
    @update:open="(value) => emit('update:open', value)"
  >
    <div class="space-y-5">
      <div>
        <h2 class="text-xl font-semibold">Detalhes do cidadão</h2>
        <p class="text-sm text-muted-foreground">
          Informações recebidas da API NISS para o pedido {{ requestNumber }}.
        </p>
      </div>

      <p v-if="isLoading" class="py-10 text-center text-muted-foreground">
        <LoaderCircle class="mr-2 inline h-4 w-4 animate-spin" />Carregando dados do cidadão...
      </p>
      <p
        v-else-if="error"
        role="alert"
        class="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
      >
        {{ error }}
      </p>
      <p v-else-if="!citizen" class="py-10 text-center text-muted-foreground">
        A API NISS ainda não devolveu informações do cidadão para este processo.
      </p>

      <template v-else-if="stage === 'details'">
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="row in details" :key="row.key" class="rounded-md border bg-muted/10 p-3">
            <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {{ row.label }}
            </p>
            <p class="mt-1 break-words text-sm">{{ row.value }}</p>
          </div>
        </div>
        <div class="flex justify-end border-t pt-4">
          <Button variant="outline" @click="emit('update:open', false)">Fechar</Button>
          <Button class="ml-2" :disabled="!comparisons.length" @click="stage = 'compare'">
            <RefreshCw class="mr-2 h-4 w-4" />Atualizar Cliente
          </Button>
        </div>
      </template>

      <template v-else-if="stage === 'compare'">
        <div class="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campo</TableHead>
                <TableHead>Dado atual</TableHead>
                <TableHead>Dado do processo NISS</TableHead>
                <TableHead class="w-28 text-center">Aplicar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="row in comparisons" :key="row.key">
                <TableCell class="font-medium">{{ row.label }}</TableCell>
                <TableCell>{{ displayCitizenValue(row.currentValue) }}</TableCell>
                <TableCell>{{ displayCitizenValue(row.nissValue) }}</TableCell>
                <TableCell>
                  <div class="flex justify-center gap-1">
                    <Button
                      size="icon"
                      :variant="selected.has(row.key) ? 'default' : 'outline'"
                      :aria-label="`Aplicar ${row.label}`"
                      :title="`Aplicar ${row.label}`"
                      @click="setSelected(row.key, true)"
                    >
                      V
                    </Button>
                    <Button
                      size="icon"
                      :variant="!selected.has(row.key) ? 'destructive' : 'outline'"
                      :aria-label="`Não aplicar ${row.label}`"
                      :title="`Não aplicar ${row.label}`"
                      @click="setSelected(row.key, false)"
                    >
                      X
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <div class="flex justify-between border-t pt-4">
          <Button variant="outline" @click="stage = 'details'">Voltar</Button>
          <Button :disabled="!selectedRows.length" @click="stage = 'confirm'">
            Salvar Alterações
          </Button>
        </div>
      </template>

      <template v-else>
        <div class="rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
          <div class="flex gap-3">
            <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <p class="font-semibold">Confirme a atualização do cadastro</p>
              <p class="mt-1 text-sm text-muted-foreground">
                Esta ação grava os dados selecionados sobre o cadastro atual. A operação é
                irreversível por este fluxo; confira cuidadosamente antes de confirmar.
              </p>
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <h3 class="font-semibold">Resumo das alterações</h3>
          <div v-for="row in selectedRows" :key="row.key" class="rounded-md border p-3 text-sm">
            <p class="font-medium">{{ row.label }}</p>
            <p class="mt-1 text-muted-foreground">
              {{ displayCitizenValue(row.currentValue) }}
              <span class="px-1">→</span>
              <span class="text-foreground">{{ displayCitizenValue(row.nissValue) }}</span>
            </p>
          </div>
        </div>

        <p
          v-if="saveError"
          role="alert"
          class="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {{ saveError }}
        </p>

        <div class="flex justify-between border-t pt-4">
          <Button variant="outline" :disabled="isSaving" @click="stage = 'compare'">Voltar</Button>
          <Button :disabled="isSaving" @click="save">
            <LoaderCircle v-if="isSaving" class="mr-2 h-4 w-4 animate-spin" />
            {{ isSaving ? 'Salvando...' : 'Confirmar e salvar' }}
          </Button>
        </div>
      </template>
    </div>
  </Dialog>
</template>
