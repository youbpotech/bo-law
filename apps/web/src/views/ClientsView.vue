<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'
import Input from '@/components/ui/Input.vue'
import Select from '@/components/ui/Select.vue'
import Table from '@/components/ui/Table.vue'
import TableHeader from '@/components/ui/TableHeader.vue'
import TableBody from '@/components/ui/TableBody.vue'
import TableRow from '@/components/ui/TableRow.vue'
import TableHead from '@/components/ui/TableHead.vue'
import TableCell from '@/components/ui/TableCell.vue'
import GeographySearchField from '@/components/GeographySearchField.vue'
import { useClients, type Client, type ClientInput } from '@/composables/useApi'
import { Plus, Search, Users } from 'lucide-vue-next'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { clients, isLoading, error, criarCliente, atualizarCliente, excluirCliente, isCreating, isUpdating, isDeleting } = useClients()

type FormValue = string | number | undefined
type Form = Record<keyof ClientInput, FormValue>
type Field = { key: keyof ClientInput; label: string; max?: number; type?: string; placeholder?: string }

const blankForm = (): Form => ({
  name: '', surname: '', portugueseTaxId: '', foreignTaxId: '', foreignTaxIdType: undefined,
  birthDate: '', sex: undefined, maritalStatus: undefined, parent1Name: '', parent1Surname: '',
  parent2Name: '', parent2Surname: '', nationalityCountry: '', birthCountry: '', birthProvince: '',
  birthProvinceCode: '', birthPlace: '', birthDistrictId: '', birthMunicipalityId: '', birthParishId: '',
  civilDocumentType: undefined, civilDocumentNumber: '', civilDocumentExpiryDate: '', email: '',
  mobileCountryCode: '', mobile: '', phoneCountryCode: '', phone: '', residenceCountry: '',
  residenceAddress: '', residenceLocality: '', residencePostalCode: '', residencePostalLocality: '',
  residenceDistrictId: '', residenceMunicipalityId: '', residenceParishId: '', foreignAddress: '',
  foreignAddress1: '', foreignAddress2: '', foreignCity: '', foreignRegion: '', foreignPostalCode: '',
})

const identityFields: Field[] = [
  { key: 'name', label: 'Nome', max: 200 }, { key: 'surname', label: 'Apelido', max: 200 },
  { key: 'birthDate', label: 'Data de nascimento', type: 'date' },
]
const parentFields: Field[] = [
  { key: 'parent1Name', label: 'Nome do progenitor 1', max: 200 }, { key: 'parent1Surname', label: 'Apelido do progenitor 1', max: 200 },
  { key: 'parent2Name', label: 'Nome do progenitor 2', max: 200 }, { key: 'parent2Surname', label: 'Apelido do progenitor 2', max: 200 },
]
const birthFields: Field[] = [
  { key: 'birthPlace', label: 'Local de nascimento', max: 200 }, { key: 'birthDistrictId', label: 'Distrito de naturalidade (código)', type: 'number' },
  { key: 'birthMunicipalityId', label: 'Concelho de naturalidade (código)', type: 'number' }, { key: 'birthParishId', label: 'Freguesia de naturalidade (código)', type: 'number' },
]
const documentFields: Field[] = [
  { key: 'civilDocumentNumber', label: 'Número do documento civil', max: 100 },
  { key: 'civilDocumentExpiryDate', label: 'Validade do documento civil', type: 'date' },
]
const contactFields: Field[] = [
  { key: 'email', label: 'Email', type: 'email', max: 320 }, { key: 'mobileCountryCode', label: 'Indicativo do telemóvel', max: 10, placeholder: '+351' },
  { key: 'mobile', label: 'Telemóvel', type: 'tel', max: 30 }, { key: 'phoneCountryCode', label: 'Indicativo do telefone', max: 10, placeholder: '+351' },
  { key: 'phone', label: 'Telefone', type: 'tel', max: 30 },
]
const residenceFields: Field[] = [
  { key: 'residenceAddress', label: 'Morada de residência', max: 500 },
  { key: 'residenceLocality', label: 'Localidade de residência', max: 200 }, { key: 'residencePostalCode', label: 'Código postal', max: 30 },
  { key: 'residencePostalLocality', label: 'Localidade postal', max: 200 }, { key: 'residenceDistrictId', label: 'Distrito de residência (código)', type: 'number' },
  { key: 'residenceMunicipalityId', label: 'Concelho de residência (código)', type: 'number' }, { key: 'residenceParishId', label: 'Freguesia de residência (código)', type: 'number' },
]
const foreignAddressFields: Field[] = [
  { key: 'foreignAddress', label: 'Endereço estrangeiro', max: 500 }, { key: 'foreignAddress1', label: 'Endereço estrangeiro - linha 1', max: 500 },
  { key: 'foreignAddress2', label: 'Endereço estrangeiro - linha 2', max: 500 }, { key: 'foreignCity', label: 'Cidade no estrangeiro', max: 200 },
  { key: 'foreignRegion', label: 'Região no estrangeiro', max: 200 }, { key: 'foreignPostalCode', label: 'Código postal estrangeiro', max: 30 },
]
const foreignTaxTypes = [
  ['EU_VAT', 'IVA intracomunitário (UE)'], ['ES_NIF_NIE', 'Espanha — NIF/NIE'], ['FR_NIF', 'França — NIF'],
  ['DE_STEUER_ID', 'Alemanha — Steuer-ID'], ['IT_CODICE_FISCALE', 'Itália — Codice Fiscale'], ['BE_NATIONAL_NUMBER', 'Bélgica — Número nacional'],
  ['NL_BSN', 'Países Baixos — BSN'], ['IE_PPSN', 'Irlanda — PPSN'], ['UK_UTR_NINO', 'Reino Unido — UTR/NINO'], ['CH_AHV', 'Suíça — AHV'],
  ['US_SSN', 'Estados Unidos — SSN'], ['US_EIN', 'Estados Unidos — EIN'], ['CA_SIN_BN', 'Canadá — SIN/BN'],
  ['BR_CPF_CNPJ', 'Brasil — CPF/CNPJ'], ['MX_RFC', 'México — RFC'], ['AR_CUIT_CUIL', 'Argentina — CUIT/CUIL'],
  ['CL_RUT', 'Chile — RUT'], ['CO_NIT', 'Colômbia — NIT'], ['PE_RUC', 'Peru — RUC'], ['UY_RUT', 'Uruguai — RUT'], ['OTHER', 'Outro'],
]
const sexTypes = [['FEMALE', 'Feminino'], ['MALE', 'Masculino'], ['OTHER', 'Outro'], ['UNSPECIFIED', 'Não especificado']]
const maritalStatuses = [['SINGLE', 'Solteiro(a)'], ['MARRIED', 'Casado(a)'], ['DIVORCED', 'Divorciado(a)'], ['WIDOWED', 'Viúvo(a)'], ['SEPARATED', 'Separado(a)'], ['CIVIL_UNION', 'União de facto']]
const documentTypes = [['CITIZEN_CARD', 'Cartão de cidadão'], ['IDENTITY_CARD', 'Documento de identidade'], ['PASSPORT', 'Passaporte'], ['RESIDENCE_PERMIT', 'Título de residência'], ['DRIVING_LICENCE', 'Carta de condução'], ['OTHER', 'Outro']]

const search = ref('')
const isDialogOpen = ref(false)
const editingClient = ref<Client | null>(null)
const formError = ref('')
const form = reactive<Form>(blankForm())
const isSaving = computed(() => isCreating.value || isUpdating.value)
const filteredClients = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return clients.value
  return clients.value.filter((client) => [client.name, client.surname, client.portugueseTaxId, client.email, client.mobile, client.phone].some((value) => String(value ?? '').toLowerCase().includes(term)))
})

function resetForm(): void { Object.assign(form, blankForm()); formError.value = '' }
function openCreateDialog(): void { editingClient.value = null; resetForm(); isDialogOpen.value = true }
function openEditDialog(client: Client): void {
  editingClient.value = client
  resetForm()
  for (const key of Object.keys(form) as (keyof ClientInput)[]) form[key] = client[key] ?? ''
  isDialogOpen.value = true
}
function closeDialog(): void { isDialogOpen.value = false; editingClient.value = null; resetForm() }
function normalizedData(): ClientInput {
  const data = {} as Record<string, string | number | null>
  for (const [key, value] of Object.entries(form)) data[key] = typeof value === 'string' ? (value.trim() || null) : (value ?? null)
  data.name = String(form.name).trim()
  return data as ClientInput
}
async function saveClient(): Promise<void> {
  formError.value = ''
  try {
    const data = normalizedData()
    if (editingClient.value) await atualizarCliente({ id: editingClient.value.id, dados: data })
    else await criarCliente(data)
    closeDialog()
    if (typeof route.query.returnTo === 'string') {
      await router.push({ path: route.query.returnTo, query: route.query.newNiss === '1' ? { newNiss: '1' } : {} })
    }
  } catch (caughtError) { formError.value = caughtError instanceof Error ? caughtError.message : t('clients.saveError') }
}
async function deleteClient(client: Client): Promise<void> {
  if (!window.confirm(t('clients.deleteConfirm', { name: client.name }))) return
  try { await excluirCliente(client.id) } catch (caughtError) { window.alert(caughtError instanceof Error ? caughtError.message : t('clients.deleteError')) }
}
function formatDate(value: string): string { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) }
function selectBirthCountry(value: string): void {
  if (form.birthCountry !== value) {
    form.birthProvince = ''
    form.birthProvinceCode = ''
  }
  form.birthCountry = value
}
onMounted(() => { if (route.query.new === '1') openCreateDialog() })
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-4"><div><h1 class="text-3xl font-bold tracking-tight">{{ $t('clients.title') }}</h1><p class="text-muted-foreground">{{ $t('clients.subtitle') }}</p></div><Button @click="openCreateDialog"><Plus class="mr-2 h-4 w-4" />{{ $t('clients.newClient') }}</Button></div>
    <div class="relative max-w-sm"><Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input v-model="search" :placeholder="$t('clients.searchClients')" class="pl-8" /></div>
    <div class="rounded-md border"><Table><TableHeader><TableRow><TableHead>{{ $t('clients.name') }}</TableHead><TableHead>NIF</TableHead><TableHead>{{ $t('clients.email') }}</TableHead><TableHead>Contacto</TableHead><TableHead>{{ $t('clients.createdAt') }}</TableHead><TableHead class="text-right">{{ $t('common.actions') }}</TableHead></TableRow></TableHeader><TableBody>
      <TableRow v-if="isLoading"><TableCell colspan="6" class="text-center text-muted-foreground">{{ $t('common.loading') }}</TableCell></TableRow>
      <TableRow v-else-if="error"><TableCell colspan="6" class="text-center text-destructive">{{ error.message }}</TableCell></TableRow>
      <TableRow v-else-if="filteredClients.length === 0"><TableCell colspan="6" class="text-center text-muted-foreground">{{ $t('clients.empty') }}</TableCell></TableRow>
      <TableRow v-for="client in filteredClients" v-else :key="client.id"><TableCell class="font-medium"><div class="flex items-center gap-2"><Users class="h-4 w-4" /><span>{{ [client.name, client.surname].filter(Boolean).join(' ') }}</span></div></TableCell><TableCell>{{ client.portugueseTaxId || '-' }}</TableCell><TableCell>{{ client.email || '-' }}</TableCell><TableCell>{{ client.mobile || client.phone || '-' }}</TableCell><TableCell>{{ formatDate(client.createdAt) }}</TableCell><TableCell><div class="flex justify-end gap-2"><Button variant="outline" size="sm" @click="openEditDialog(client)">{{ $t('common.edit') }}</Button><Button variant="destructive" size="sm" :disabled="isDeleting" @click="deleteClient(client)">{{ $t('common.delete') }}</Button></div></TableCell></TableRow>
    </TableBody></Table></div>
  </div>

  <Dialog :open="isDialogOpen" class="max-h-[92vh] max-w-5xl overflow-y-auto" @update:open="(open) => !open && closeDialog()">
    <form class="space-y-6" @submit.prevent="saveClient">
      <div><h2 class="text-xl font-semibold">{{ editingClient ? $t('clients.editClient') : $t('clients.newClient') }}</h2><p class="text-sm text-muted-foreground">Dados pessoais, fiscais e de contacto do cliente.</p></div>

      <section><h3 class="mb-3 font-semibold">Identificação</h3><div class="grid gap-4 sm:grid-cols-3"><div v-for="field in identityFields" :key="field.key" class="space-y-2"><label :for="`client-${field.key}`" class="text-sm font-medium">{{ field.label }}</label><Input :id="`client-${field.key}`" v-model="form[field.key]" :type="field.type" :maxlength="field.max" :required="field.key === 'name'" /></div><div class="space-y-2"><label class="text-sm font-medium">Sexo</label><Select v-model="form.sex"><option value="">Selecione</option><option v-for="option in sexTypes" :key="option[0]" :value="option[0]">{{ option[1] }}</option></Select></div><div class="space-y-2"><label class="text-sm font-medium">Estado civil</label><Select v-model="form.maritalStatus"><option value="">Selecione</option><option v-for="option in maritalStatuses" :key="option[0]" :value="option[0]">{{ option[1] }}</option></Select></div></div></section>

      <section><h3 class="mb-3 font-semibold">Identificação fiscal</h3><div class="grid gap-4 sm:grid-cols-3"><div class="space-y-2"><label class="text-sm font-medium">NIF português</label><Input v-model="form.portugueseTaxId" maxlength="20" /></div><div class="space-y-2"><label class="text-sm font-medium">Tipo de identificação fiscal estrangeira</label><Select v-model="form.foreignTaxIdType"><option value="">Selecione</option><option v-for="option in foreignTaxTypes" :key="option[0]" :value="option[0]">{{ option[1] }}</option></Select></div><div class="space-y-2"><label class="text-sm font-medium">Identificação fiscal estrangeira</label><Input v-model="form.foreignTaxId" maxlength="20" /></div></div></section>

      <section><h3 class="mb-3 font-semibold">Filiação</h3><div class="grid gap-4 sm:grid-cols-2"><div v-for="field in parentFields" :key="field.key" class="space-y-2"><label class="text-sm font-medium">{{ field.label }}</label><Input v-model="form[field.key]" :maxlength="field.max" /></div></div></section>
      <section><h3 class="mb-3 font-semibold">Nacionalidade e naturalidade</h3><div class="grid gap-4 sm:grid-cols-3"><div class="space-y-2"><label class="text-sm font-medium">País de nacionalidade</label><GeographySearchField v-model="form.nationalityCountry" kind="country" placeholder="Pesquisar país..." /></div><div class="space-y-2"><label class="text-sm font-medium">País de naturalidade</label><GeographySearchField :model-value="form.birthCountry" kind="country" placeholder="Pesquisar país..." @update:model-value="selectBirthCountry" /></div><div class="space-y-2"><label class="text-sm font-medium">Estado / província</label><GeographySearchField v-model="form.birthProvinceCode" v-model:selected-label="form.birthProvince" kind="state" :country="form.birthCountry" placeholder="Pesquisar estado..." /></div><div v-for="field in birthFields" :key="field.key" class="space-y-2"><label class="text-sm font-medium">{{ field.label }}</label><Input v-model="form[field.key]" :type="field.type" :maxlength="field.max" :placeholder="field.placeholder" :min="field.type === 'number' ? 1 : undefined" /></div></div></section>
      <section><h3 class="mb-3 font-semibold">Documento civil</h3><div class="grid gap-4 sm:grid-cols-3"><div class="space-y-2"><label class="text-sm font-medium">Tipo de documento</label><Select v-model="form.civilDocumentType"><option value="">Selecione</option><option v-for="option in documentTypes" :key="option[0]" :value="option[0]">{{ option[1] }}</option></Select></div><div v-for="field in documentFields" :key="field.key" class="space-y-2"><label class="text-sm font-medium">{{ field.label }}</label><Input v-model="form[field.key]" :type="field.type" :maxlength="field.max" /></div></div></section>
      <section><h3 class="mb-3 font-semibold">Contactos</h3><div class="grid gap-4 sm:grid-cols-3"><div v-for="field in contactFields" :key="field.key" class="space-y-2"><label class="text-sm font-medium">{{ field.label }}</label><Input v-model="form[field.key]" :type="field.type" :maxlength="field.max" :placeholder="field.placeholder" /></div></div></section>
      <section><h3 class="mb-3 font-semibold">Residência</h3><div class="grid gap-4 sm:grid-cols-3"><div class="space-y-2"><label class="text-sm font-medium">País de residência</label><GeographySearchField v-model="form.residenceCountry" kind="country" placeholder="Pesquisar país..." /></div><div v-for="field in residenceFields" :key="field.key" :class="['space-y-2', field.key === 'residenceAddress' ? 'sm:col-span-2' : '']"><label class="text-sm font-medium">{{ field.label }}</label><Input v-model="form[field.key]" :type="field.type" :maxlength="field.max" :placeholder="field.placeholder" :min="field.type === 'number' ? 1 : undefined" /></div></div></section>
      <section><h3 class="mb-3 font-semibold">Endereço estrangeiro</h3><div class="grid gap-4 sm:grid-cols-2"><div v-for="field in foreignAddressFields" :key="field.key" class="space-y-2"><label class="text-sm font-medium">{{ field.label }}</label><Input v-model="form[field.key]" :maxlength="field.max" /></div></div></section>

      <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p><div class="sticky bottom-0 flex justify-end gap-2 border-t bg-background py-4"><Button type="button" variant="outline" @click="closeDialog">{{ $t('common.cancel') }}</Button><Button type="submit" :disabled="isSaving">{{ isSaving ? $t('common.loading') : $t('common.save') }}</Button></div>
    </form>
  </Dialog>
</template>
