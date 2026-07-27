<script setup lang="ts">
import { reactive, ref } from 'vue'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'
import Input from '@/components/ui/Input.vue'
import Table from '@/components/ui/Table.vue'
import TableHeader from '@/components/ui/TableHeader.vue'
import TableBody from '@/components/ui/TableBody.vue'
import TableRow from '@/components/ui/TableRow.vue'
import TableHead from '@/components/ui/TableHead.vue'
import TableCell from '@/components/ui/TableCell.vue'
import { useRoles, type ManagedRole, type ResourceKey } from '@/composables/useApi'
import { Plus, ShieldCheck } from 'lucide-vue-next'

const { roles, resources, isLoading, error, criarRole, atualizarRole, excluirRole, isSaving, isDeleting } = useRoles()
const isOpen = ref(false)
const editing = ref<ManagedRole | null>(null)
const formError = ref('')
const form = reactive({ name: '', description: '', resources: [] as ResourceKey[] })

function close(): void { isOpen.value = false; editing.value = null; form.name = ''; form.description = ''; form.resources = []; formError.value = '' }
function create(): void { close(); isOpen.value = true }
function edit(role: ManagedRole): void { editing.value = role; form.name = role.name; form.description = role.description || ''; form.resources = [...role.resources]; formError.value = ''; isOpen.value = true }
async function save(): Promise<void> {
  formError.value = ''
  try {
    const data = { name: form.name, description: form.description || null, resources: form.resources }
    if (editing.value) await atualizarRole({ id: editing.value.id, dados: data })
    else await criarRole(data)
    close()
  } catch (caught) { formError.value = caught instanceof Error ? caught.message : 'Não foi possível salvar a role.' }
}
async function remove(role: ManagedRole): Promise<void> {
  if (!window.confirm(`Excluir a role "${role.name}"?`)) return
  try { await excluirRole(role.id) } catch (caught) { window.alert(caught instanceof Error ? caught.message : 'Não foi possível excluir a role.') }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-4"><div><h1 class="text-3xl font-bold tracking-tight">Roles</h1><p class="text-muted-foreground">Associe recursos e processos aos perfis de acesso da empresa.</p></div><Button @click="create"><Plus class="mr-2 h-4 w-4" />Nova Role</Button></div>
    <div class="rounded-md border"><Table><TableHeader><TableRow><TableHead>Role</TableHead><TableHead>Recursos e processos</TableHead><TableHead class="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>
      <TableRow v-if="isLoading"><TableCell colspan="3" class="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
      <TableRow v-else-if="error"><TableCell colspan="3" class="text-center text-destructive">{{ error.message }}</TableCell></TableRow>
      <TableRow v-for="role in roles" v-else :key="role.id"><TableCell><div class="flex items-center gap-2 font-medium"><ShieldCheck class="h-4 w-4" />{{ role.name }}<span v-if="role.isRoot" class="rounded bg-muted px-2 py-0.5 text-xs">sistema</span></div><p v-if="role.description" class="text-xs text-muted-foreground">{{ role.description }}</p></TableCell><TableCell><div class="flex flex-wrap gap-1"><span v-for="resource in role.resources" :key="resource" class="rounded bg-secondary px-2 py-1 text-xs">{{ resources.find((item) => item.key === resource)?.name || resource }}</span></div></TableCell><TableCell><div v-if="!role.isRoot" class="flex justify-end gap-2"><Button variant="outline" size="sm" @click="edit(role)">Editar</Button><Button variant="destructive" size="sm" :disabled="isDeleting" @click="remove(role)">Excluir</Button></div></TableCell></TableRow>
    </TableBody></Table></div>
  </div>
  <Dialog :open="isOpen" @update:open="(value) => !value && close()"><form class="space-y-4" @submit.prevent="save"><div><h2 class="text-xl font-semibold">{{ editing ? 'Editar Role' : 'Nova Role' }}</h2><p class="text-sm text-muted-foreground">Selecione quais menus e processos esta role pode acessar.</p></div><div class="space-y-2"><label class="text-sm font-medium">Nome</label><Input v-model="form.name" required maxlength="100" /></div><div class="space-y-2"><label class="text-sm font-medium">Descrição</label><Input v-model="form.description" maxlength="500" /></div><fieldset class="space-y-2"><legend class="text-sm font-medium">Recursos e processos</legend><div class="grid gap-2 rounded-md border p-3 sm:grid-cols-2"><label v-for="resource in resources" :key="resource.key" class="flex items-center gap-2 text-sm"><input v-model="form.resources" type="checkbox" :value="resource.key" class="h-4 w-4" /><span>{{ resource.name }}</span><span class="text-xs text-muted-foreground">({{ resource.kind === 'process' ? 'processo' : 'recurso' }})</span></label></div></fieldset><p v-if="formError" class="text-sm text-destructive">{{ formError }}</p><div class="flex justify-end gap-2"><Button type="button" variant="outline" @click="close">Cancelar</Button><Button type="submit" :disabled="isSaving">{{ isSaving ? 'Salvando...' : 'Salvar' }}</Button></div></form></Dialog>
</template>
