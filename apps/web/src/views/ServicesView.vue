<script setup lang="ts">
import { reactive, ref } from 'vue'
import { Plus, Pencil } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'
import Input from '@/components/ui/Input.vue'
import Textarea from '@/components/ui/Textarea.vue'
import { useServices, type ServiceType } from '@/composables/useApi'

const { services, criarServico, atualizarServico } = useServices()
const open = ref(false); const editing = ref<ServiceType | null>(null); const error = ref('')
const form = reactive({ name: '', description: '', active: true })
function show(service?: ServiceType) { editing.value = service ?? null; form.name = service?.name ?? ''; form.description = service?.description ?? ''; form.active = service?.active ?? true; error.value = ''; open.value = true }
async function save() { try { if (editing.value) await atualizarServico({ id: editing.value.id, name: form.name, description: form.description, active: form.active }); else await criarServico({ name: form.name, description: form.description, active: form.active, processType: 'general' }); open.value = false } catch (e) { error.value = e instanceof Error ? e.message : 'Não foi possível guardar o serviço.' } }
</script>
<template><div class="space-y-6"><div class="flex items-center justify-between"><div><h1 class="text-2xl font-semibold">Serviços</h1><p class="text-sm text-muted-foreground">Tipos de serviço disponíveis para os processos desta empresa.</p></div><Button @click="show()"><Plus class="mr-2 h-4 w-4" />Novo serviço</Button></div><div class="rounded-lg border"><table class="w-full text-sm"><thead class="border-b text-left text-muted-foreground"><tr><th class="p-3">Serviço</th><th class="p-3">Processo</th><th class="p-3">Estado</th><th class="p-3"></th></tr></thead><tbody><tr v-for="service in services" :key="service.id" class="border-b last:border-0"><td class="p-3"><p class="font-medium">{{ service.name }}</p><p v-if="service.description" class="text-xs text-muted-foreground">{{ service.description }}</p></td><td class="p-3">{{ service.processType === 'niss' ? 'NISS' : service.processType === 'aima' ? 'AIMA' : 'Geral' }}</td><td class="p-3">{{ service.active ? 'Ativo' : 'Inativo' }}</td><td class="p-3 text-right"><Button size="sm" variant="ghost" @click="show(service)"><Pencil class="h-4 w-4" /></Button></td></tr></tbody></table></div><Dialog v-model:open="open" :title="editing ? 'Editar serviço' : 'Novo serviço'"><div class="space-y-4"><label class="block text-sm font-medium">Nome<Input v-model="form.name" class="mt-1" required /></label><label class="block text-sm font-medium">Descrição<Textarea v-model="form.description" class="mt-1" /></label><label class="flex items-center gap-2 text-sm"><input v-model="form.active" type="checkbox" />Ativo</label><p v-if="error" class="text-sm text-destructive">{{ error }}</p><div class="flex justify-end gap-2"><Button variant="outline" @click="open=false">Cancelar</Button><Button @click="save">Guardar</Button></div></div></Dialog></div></template>
