<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'
import Input from '@/components/ui/Input.vue'
import Table from '@/components/ui/Table.vue'
import TableHeader from '@/components/ui/TableHeader.vue'
import TableBody from '@/components/ui/TableBody.vue'
import TableRow from '@/components/ui/TableRow.vue'
import TableHead from '@/components/ui/TableHead.vue'
import TableCell from '@/components/ui/TableCell.vue'
import { useClients, type Client } from '@/composables/useApi'
import { Plus, Search, Users } from 'lucide-vue-next'

const { t } = useI18n()

const {
  clients,
  isLoading,
  error,
  criarCliente,
  atualizarCliente,
  excluirCliente,
  isCreating,
  isUpdating,
  isDeleting,
} = useClients()

const search = ref('')
const isDialogOpen = ref(false)
const editingClient = ref<Client | null>(null)
const formError = ref('')
const form = reactive({
  name: '',
  email: '',
  phone: '',
})

const filteredClients = computed(() => {
  const term = search.value.trim().toLowerCase()

  if (!term) {
    return clients.value
  }

  return clients.value.filter((client) =>
    [client.name, client.email, client.phone].some((value) => value?.toLowerCase().includes(term)),
  )
})

const isSaving = computed(() => isCreating.value || isUpdating.value)

function resetForm(): void {
  form.name = ''
  form.email = ''
  form.phone = ''
  formError.value = ''
}

function openCreateDialog(): void {
  editingClient.value = null
  resetForm()
  isDialogOpen.value = true
}

function openEditDialog(client: Client): void {
  editingClient.value = client
  form.name = client.name
  form.email = client.email ?? ''
  form.phone = client.phone ?? ''
  formError.value = ''
  isDialogOpen.value = true
}

function closeDialog(): void {
  isDialogOpen.value = false
  editingClient.value = null
  resetForm()
}

async function saveClient(): Promise<void> {
  formError.value = ''

  try {
    const data = {
      name: form.name,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
    }

    if (editingClient.value) {
      await atualizarCliente({ id: editingClient.value.id, dados: data })
    } else {
      await criarCliente(data)
    }

    closeDialog()
  } catch (caughtError) {
    formError.value = caughtError instanceof Error ? caughtError.message : t('clients.saveError')
  }
}

async function deleteClient(client: Client): Promise<void> {
  if (!window.confirm(t('clients.deleteConfirm', { name: client.name }))) {
    return
  }

  try {
    await excluirCliente(client.id)
  } catch (caughtError) {
    window.alert(caughtError instanceof Error ? caughtError.message : t('clients.deleteError'))
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">{{ $t('clients.title') }}</h1>
        <p class="text-muted-foreground">{{ $t('clients.subtitle') }}</p>
      </div>
      <Button @click="openCreateDialog">
        <Plus class="mr-2 h-4 w-4" />
        {{ $t('clients.newClient') }}
      </Button>
    </div>

    <div class="relative max-w-sm">
      <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input v-model="search" :placeholder="$t('clients.searchClients')" class="pl-8" />
    </div>

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{{ $t('clients.name') }}</TableHead>
            <TableHead>{{ $t('clients.email') }}</TableHead>
            <TableHead>{{ $t('clients.phone') }}</TableHead>
            <TableHead>{{ $t('clients.createdAt') }}</TableHead>
            <TableHead>{{ $t('clients.updatedAt') }}</TableHead>
            <TableHead class="text-right">{{ $t('common.actions') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="isLoading">
            <TableCell colspan="6" class="text-center text-muted-foreground">
              {{ $t('common.loading') }}
            </TableCell>
          </TableRow>
          <TableRow v-else-if="error">
            <TableCell colspan="6" class="text-center text-destructive">
              {{ error.message }}
            </TableCell>
          </TableRow>
          <TableRow v-else-if="filteredClients.length === 0">
            <TableCell colspan="6" class="text-center text-muted-foreground">
              {{ $t('clients.empty') }}
            </TableCell>
          </TableRow>
          <TableRow v-for="client in filteredClients" v-else :key="client.id">
            <TableCell class="font-medium">
              <div class="flex items-center gap-2">
                <Users class="h-4 w-4" />
                <span>{{ client.name }}</span>
              </div>
            </TableCell>
            <TableCell>{{ client.email || '-' }}</TableCell>
            <TableCell>{{ client.phone || '-' }}</TableCell>
            <TableCell>{{ formatDate(client.createdAt) }}</TableCell>
            <TableCell>{{ formatDate(client.updatedAt) }}</TableCell>
            <TableCell>
              <div class="flex justify-end gap-2">
                <Button variant="outline" size="sm" @click="openEditDialog(client)">
                  {{ $t('common.edit') }}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  :disabled="isDeleting"
                  @click="deleteClient(client)"
                >
                  {{ $t('common.delete') }}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>

  <Dialog :open="isDialogOpen" @update:open="(open) => !open && closeDialog()">
    <form class="space-y-4" @submit.prevent="saveClient">
      <div>
        <h2 class="text-xl font-semibold">
          {{ editingClient ? $t('clients.editClient') : $t('clients.newClient') }}
        </h2>
        <p class="text-sm text-muted-foreground">{{ $t('clients.formDescription') }}</p>
      </div>

      <div class="space-y-2">
        <label for="client-name" class="text-sm font-medium">{{ $t('clients.name') }}</label>
        <Input id="client-name" v-model="form.name" required maxlength="255" />
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-2">
          <label for="client-email" class="text-sm font-medium">{{ $t('clients.email') }}</label>
          <Input id="client-email" v-model="form.email" type="email" maxlength="255" />
        </div>

        <div class="space-y-2">
          <label for="client-phone" class="text-sm font-medium">{{ $t('clients.phone') }}</label>
          <Input id="client-phone" v-model="form.phone" type="tel" maxlength="50" />
        </div>
      </div>

      <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>

      <div class="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" @click="closeDialog">
          {{ $t('common.cancel') }}
        </Button>
        <Button type="submit" :disabled="isSaving">
          {{ isSaving ? $t('common.loading') : $t('common.save') }}
        </Button>
      </div>
    </form>
  </Dialog>
</template>
