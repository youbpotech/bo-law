<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'
import Input from '@/components/ui/Input.vue'
import Table from '@/components/ui/Table.vue'
import TableHeader from '@/components/ui/TableHeader.vue'
import TableBody from '@/components/ui/TableBody.vue'
import TableRow from '@/components/ui/TableRow.vue'
import TableHead from '@/components/ui/TableHead.vue'
import TableCell from '@/components/ui/TableCell.vue'
import { useRoles, useSession, useUsers, type User } from '@/composables/useApi'
import { Plus, Search } from 'lucide-vue-next'

const {
  users,
  isLoading,
  error,
  criarUsuario,
  atualizarUsuario,
  excluirUsuario,
  isCreating,
  isUpdating,
  isDeleting,
} = useUsers()
const { currentUser } = useSession()
const canManageUsers = computed(() => Boolean(currentUser.value?.roleRoot))
const { roles } = useRoles(canManageUsers)

const search = ref('')
const isDialogOpen = ref(false)
const editingUser = ref<User | null>(null)
const formError = ref('')
const form = reactive({
  name: '',
  username: '',
  email: '',
  password: '',
  roleIds: [] as string[],
})

const filteredUsers = computed(() => {
  const term = search.value.trim().toLowerCase()

  if (!term) {
    return users.value
  }

  return users.value.filter((user) =>
    [user.name, user.username, user.email].some((value) => value?.toLowerCase().includes(term)),
  )
})

const isSaving = computed(() => isCreating.value || isUpdating.value)

function resetForm(): void {
  form.name = ''
  form.username = ''
  form.email = ''
  form.password = ''
  form.roleIds = []
  formError.value = ''
}

function openCreateDialog(): void {
  editingUser.value = null
  resetForm()
  isDialogOpen.value = true
}

function openEditDialog(user: User): void {
  editingUser.value = user
  form.name = user.name
  form.username = user.username
  form.email = user.email ?? ''
  form.password = ''
  form.roleIds = [...(user.roleIds || [])]
  formError.value = ''
  isDialogOpen.value = true
}

function closeDialog(): void {
  isDialogOpen.value = false
  editingUser.value = null
  resetForm()
}

async function saveUser(): Promise<void> {
  formError.value = ''

  try {
    const data = {
      name: form.name,
      username: form.username,
      email: form.email || undefined,
      password: form.password || undefined,
      roleIds: form.roleIds,
    }

    if (editingUser.value) {
      await atualizarUsuario({ id: editingUser.value.id, dados: data })
    } else {
      await criarUsuario(data)
    }

    closeDialog()
  } catch (caughtError) {
    formError.value =
      caughtError instanceof Error ? caughtError.message : 'Não foi possível salvar o usuário.'
  }
}

async function deleteUser(user: User): Promise<void> {
  if (!window.confirm(`Excluir o usuário "${user.name}"?`)) {
    return
  }

  try {
    await excluirUsuario(user.id)
  } catch (caughtError) {
    window.alert(
      caughtError instanceof Error ? caughtError.message : 'Não foi possível excluir o usuário.',
    )
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
        <h1 class="text-3xl font-bold tracking-tight">{{ $t('users.title') }}</h1>
        <p class="text-muted-foreground">{{ $t('users.subtitle') }}</p>
      </div>
      <Button v-if="canManageUsers" @click="openCreateDialog">
        <Plus class="mr-2 h-4 w-4" />
        {{ $t('users.newUser') }}
      </Button>
    </div>

    <div class="relative max-w-sm">
      <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input v-model="search" :placeholder="$t('users.searchUsers')" class="pl-8" />
    </div>

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{{ $t('users.name') }}</TableHead>
            <TableHead>{{ $t('users.username') }}</TableHead>
            <TableHead>{{ $t('users.email') }}</TableHead>
            <TableHead>{{ $t('users.updatedAt') }}</TableHead>
            <TableHead v-if="canManageUsers" class="text-right">{{
              $t('common.actions')
            }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="isLoading">
            <TableCell :colspan="canManageUsers ? 5 : 4" class="text-center text-muted-foreground">
              {{ $t('common.loading') }}
            </TableCell>
          </TableRow>
          <TableRow v-else-if="error">
            <TableCell :colspan="canManageUsers ? 5 : 4" class="text-center text-destructive">
              {{ error.message }}
            </TableCell>
          </TableRow>
          <TableRow v-else-if="filteredUsers.length === 0">
            <TableCell :colspan="canManageUsers ? 5 : 4" class="text-center text-muted-foreground">
              {{ $t('users.empty') }}
            </TableCell>
          </TableRow>
          <TableRow v-for="user in filteredUsers" v-else :key="user.id">
            <TableCell class="font-medium">{{ user.name }}</TableCell>
            <TableCell>{{ user.username }}</TableCell>
            <TableCell>{{ user.email || '-' }}</TableCell>
            <TableCell>{{ formatDate(user.updatedAt) }}</TableCell>
            <TableCell v-if="canManageUsers">
              <div class="flex justify-end gap-2">
                <Button variant="outline" size="sm" @click="openEditDialog(user)">
                  {{ $t('common.edit') }}
                </Button>
                <Button
                  v-if="!user.root"
                  variant="destructive"
                  size="sm"
                  :disabled="isDeleting"
                  @click="deleteUser(user)"
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
    <form class="space-y-4" @submit.prevent="saveUser">
      <div>
        <h2 class="text-xl font-semibold">
          {{ editingUser ? $t('users.editUser') : $t('users.newUser') }}
        </h2>
        <p class="text-sm text-muted-foreground">{{ $t('users.formDescription') }}</p>
      </div>

      <div class="space-y-2">
        <label for="user-name" class="text-sm font-medium">{{ $t('users.name') }}</label>
        <Input id="user-name" v-model="form.name" required maxlength="255" />
      </div>

      <fieldset class="space-y-2">
        <legend class="text-sm font-medium">Roles</legend>
        <div class="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
          <label v-for="role in roles" :key="role.id" class="flex items-center gap-2 text-sm">
            <input v-model="form.roleIds" type="checkbox" :value="role.id" class="h-4 w-4" />
            <span>{{ role.name }}</span>
          </label>
          <p v-if="roles.length === 0" class="text-sm text-muted-foreground">Nenhuma role disponível.</p>
        </div>
      </fieldset>

      <div class="space-y-2">
        <label for="user-username" class="text-sm font-medium">{{ $t('users.username') }}</label>
        <Input
          id="user-username"
          v-model="form.username"
          required
          maxlength="100"
          autocomplete="username"
        />
      </div>

      <div class="space-y-2">
        <label for="user-email" class="text-sm font-medium">{{ $t('users.email') }}</label>
        <Input id="user-email" v-model="form.email" type="email" maxlength="255" />
      </div>

      <div class="space-y-2">
        <label for="user-password" class="text-sm font-medium">{{ $t('users.password') }}</label>
        <Input
          id="user-password"
          v-model="form.password"
          type="password"
          :required="!editingUser"
          minlength="8"
          autocomplete="new-password"
          :placeholder="editingUser ? $t('users.passwordOptional') : ''"
        />
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
