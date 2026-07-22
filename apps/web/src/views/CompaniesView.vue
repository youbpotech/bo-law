<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
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
import { useCompanies, type Company } from '@/composables/useApi'
import { COMPANY_THEMES, getCompanyTheme } from '@/lib/company-themes'
import { Building2, Plus, Search } from 'lucide-vue-next'

const { t } = useI18n()

const {
  companies,
  isLoading,
  error,
  criarEmpresa,
  atualizarEmpresa,
  excluirEmpresa,
  isCreating,
  isUpdating,
  isDeleting,
} = useCompanies()

const search = ref('')
const isDialogOpen = ref(false)
const isLogoDialogOpen = ref(false)
const editingCompany = ref<Company | null>(null)
const formError = ref('')
const form = reactive({
  name: '',
  theme: 'default',
  whatsappNumber: '',
  logoDataUrl: undefined as string | null | undefined,
})
const logoPreview = ref<string | null>(null)
const pendingLogoDataUrl = ref<string | null>(null)
const pendingLogoDimensions = ref<{ width: number; height: number } | null>(null)
const pendingLogoError = ref('')
const pendingLogoFileName = ref('')
const cropCanvas = ref<HTMLCanvasElement | null>(null)
const cropZoom = ref(1)
const cropPanX = ref(0)
const cropPanY = ref(0)
let cropImage: HTMLImageElement | null = null
let activePointerId: number | null = null
let lastPointerX = 0
let lastPointerY = 0

const LOGO_MAX_BYTES = 512 * 1024
const LOGO_SOURCE_MAX_BYTES = 5 * 1024 * 1024
const LOGO_SOURCE_MIN_WIDTH = 168
const LOGO_SOURCE_MIN_HEIGHT = 40
const LOGO_SOURCE_MAX_DIMENSION = 16000
const LOGO_OUTPUT_WIDTH = 1024
const LOGO_OUTPUT_HEIGHT = 256

const filteredCompanies = computed(() => {
  const term = search.value.trim().toLowerCase()

  if (!term) {
    return companies.value
  }

  return companies.value.filter((company) =>
    [company.name, company.theme, company.whatsappNumber].some((value) =>
      value?.toLowerCase().includes(term),
    ),
  )
})

const isSaving = computed(() => isCreating.value || isUpdating.value)

function resetForm(): void {
  form.name = ''
  form.theme = 'default'
  form.whatsappNumber = ''
  form.logoDataUrl = undefined
  logoPreview.value = null
  formError.value = ''
}

function openCreateDialog(): void {
  editingCompany.value = null
  resetForm()
  isDialogOpen.value = true
}

function openEditDialog(company: Company): void {
  editingCompany.value = company
  form.name = company.name
  form.theme = company.theme || 'default'
  form.whatsappNumber = company.whatsappNumber ?? ''
  form.logoDataUrl = undefined
  logoPreview.value = company.logoUrl
  formError.value = ''
  isDialogOpen.value = true
}

function closeDialog(): void {
  closeLogoDialog()
  isDialogOpen.value = false
  editingCompany.value = null
  resetForm()
}

function openLogoDialog(): void {
  pendingLogoDataUrl.value = null
  pendingLogoDimensions.value = null
  pendingLogoError.value = ''
  pendingLogoFileName.value = ''
  cropImage = null
  cropZoom.value = 1
  cropPanX.value = 0
  cropPanY.value = 0
  isLogoDialogOpen.value = true
}

function closeLogoDialog(): void {
  isLogoDialogOpen.value = false
  pendingLogoDataUrl.value = null
  pendingLogoDimensions.value = null
  pendingLogoError.value = ''
  pendingLogoFileName.value = ''
  cropImage = null
}

function formatTheme(theme: string): string {
  return t(getCompanyTheme(theme).labelKey)
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Arquivo inválido'))
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo'))
    reader.readAsDataURL(file)
  })
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Não foi possível ler as dimensões da imagem'))
    image.src = dataUrl
  })
}

async function createCropImage(image: HTMLImageElement): Promise<HTMLImageElement> {
  const maxDimension = Math.max(image.naturalWidth, image.naturalHeight)
  if (maxDimension <= 2400) return image

  const scale = 2400 / maxDimension
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.naturalWidth * scale)
  canvas.height = Math.round(image.naturalHeight * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error(t('companies.logoCropError'))
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const resizedImage = await loadImage(canvas.toDataURL('image/webp', 0.92))
  image.src = ''
  return resizedImage
}

function drawCropPreview(): void {
  const canvas = cropCanvas.value
  if (!canvas || !cropImage) return
  const context = canvas.getContext('2d')
  if (!context) return

  const baseScale = Math.max(
    LOGO_OUTPUT_WIDTH / cropImage.naturalWidth,
    LOGO_OUTPUT_HEIGHT / cropImage.naturalHeight,
  )
  const scale = baseScale * cropZoom.value
  const width = cropImage.naturalWidth * scale
  const height = cropImage.naturalHeight * scale
  const overflowX = Math.max(0, (width - LOGO_OUTPUT_WIDTH) / 2)
  const overflowY = Math.max(0, (height - LOGO_OUTPUT_HEIGHT) / 2)
  const x = (LOGO_OUTPUT_WIDTH - width) / 2 + cropPanX.value * overflowX
  const y = (LOGO_OUTPUT_HEIGHT - height) / 2 + cropPanY.value * overflowY

  context.clearRect(0, 0, LOGO_OUTPUT_WIDTH, LOGO_OUTPUT_HEIGHT)
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, LOGO_OUTPUT_WIDTH, LOGO_OUTPUT_HEIGHT)
  context.drawImage(cropImage, x, y, width, height)
}

watch([cropZoom, cropPanX, cropPanY], drawCropPreview)

function handleCropPointerDown(event: PointerEvent): void {
  activePointerId = event.pointerId
  lastPointerX = event.clientX
  lastPointerY = event.clientY
  cropCanvas.value?.setPointerCapture(event.pointerId)
}

function handleCropPointerMove(event: PointerEvent): void {
  if (activePointerId !== event.pointerId || !cropCanvas.value || !cropImage) return
  const rect = cropCanvas.value.getBoundingClientRect()
  const scale = Math.max(
    LOGO_OUTPUT_WIDTH / cropImage.naturalWidth,
    LOGO_OUTPUT_HEIGHT / cropImage.naturalHeight,
  ) * cropZoom.value
  const overflowX = Math.max(0, (cropImage.naturalWidth * scale - LOGO_OUTPUT_WIDTH) / 2)
  const overflowY = Math.max(0, (cropImage.naturalHeight * scale - LOGO_OUTPUT_HEIGHT) / 2)
  const deltaX = ((event.clientX - lastPointerX) * LOGO_OUTPUT_WIDTH) / rect.width
  const deltaY = ((event.clientY - lastPointerY) * LOGO_OUTPUT_HEIGHT) / rect.height
  if (overflowX > 0) cropPanX.value = Math.max(-1, Math.min(1, cropPanX.value + deltaX / overflowX))
  if (overflowY > 0) cropPanY.value = Math.max(-1, Math.min(1, cropPanY.value + deltaY / overflowY))
  lastPointerX = event.clientX
  lastPointerY = event.clientY
}

function handleCropPointerUp(event: PointerEvent): void {
  if (activePointerId !== event.pointerId) return
  cropCanvas.value?.releasePointerCapture(event.pointerId)
  activePointerId = null
}

function canvasToDataUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(t('companies.logoCropError')))
          return
        }
        if (blob.size > LOGO_MAX_BYTES) {
          reject(new Error(t('companies.logoSizeError')))
          return
        }
        const reader = new FileReader()
        reader.onload = () =>
          typeof reader.result === 'string'
            ? resolve(reader.result)
            : reject(new Error(t('companies.logoCropError')))
        reader.onerror = () => reject(new Error(t('companies.logoCropError')))
        reader.readAsDataURL(blob)
      },
      'image/webp',
      0.9,
    )
  })
}

async function handleLogoUpload(event: Event): Promise<void> {
  pendingLogoError.value = ''
  pendingLogoDataUrl.value = null
  pendingLogoDimensions.value = null
  pendingLogoFileName.value = ''
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      throw new Error(t('companies.logoFormatError'))
    }
    if (file.size > LOGO_SOURCE_MAX_BYTES) throw new Error(t('companies.logoSourceSizeError'))

    const dataUrl = await readFileAsDataUrl(file)
    const image = await loadImage(dataUrl)
    const width = image.naturalWidth
    const height = image.naturalHeight
    if (
      width < LOGO_SOURCE_MIN_WIDTH ||
      height < LOGO_SOURCE_MIN_HEIGHT ||
      width > LOGO_SOURCE_MAX_DIMENSION ||
      height > LOGO_SOURCE_MAX_DIMENSION
    ) {
      throw new Error(t('companies.logoSourceDimensionsError'))
    }

    cropImage = await createCropImage(image)
    pendingLogoDataUrl.value = dataUrl
    pendingLogoDimensions.value = { width, height }
    pendingLogoFileName.value = file.name
    cropZoom.value = 1
    cropPanX.value = 0
    cropPanY.value = 0
    await nextTick()
    drawCropPreview()
  } catch (error) {
    input.value = ''
    pendingLogoError.value = error instanceof Error ? error.message : t('companies.logoInvalid')
  }
}

async function confirmLogo(): Promise<void> {
  if (!cropCanvas.value || !cropImage) return
  pendingLogoError.value = ''
  try {
    const croppedDataUrl = await canvasToDataUrl(cropCanvas.value)
    form.logoDataUrl = croppedDataUrl
    logoPreview.value = croppedDataUrl
    closeLogoDialog()
  } catch (error) {
    pendingLogoError.value = error instanceof Error ? error.message : t('companies.logoCropError')
  }
}

function removeLogo(): void {
  form.logoDataUrl = null
  logoPreview.value = null
}

async function saveCompany(): Promise<void> {
  formError.value = ''

  try {
    const data = {
      name: form.name,
      theme: form.theme,
      whatsappNumber: form.whatsappNumber.trim() || null,
      ...(form.logoDataUrl !== undefined ? { logoDataUrl: form.logoDataUrl } : {}),
    }

    if (editingCompany.value) {
      await atualizarEmpresa({ id: editingCompany.value.id, dados: data })
    } else {
      await criarEmpresa(data)
    }

    closeDialog()
  } catch (caughtError) {
    formError.value = caughtError instanceof Error ? caughtError.message : t('companies.saveError')
  }
}

async function deleteCompany(company: Company): Promise<void> {
  if (!window.confirm(t('companies.deleteConfirm', { name: company.name }))) {
    return
  }

  try {
    await excluirEmpresa(company.id)
  } catch (caughtError) {
    window.alert(caughtError instanceof Error ? caughtError.message : t('companies.deleteError'))
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
        <h1 class="text-3xl font-bold tracking-tight">{{ $t('companies.title') }}</h1>
        <p class="text-muted-foreground">{{ $t('companies.subtitle') }}</p>
      </div>
      <Button @click="openCreateDialog">
        <Plus class="mr-2 h-4 w-4" />
        {{ $t('companies.newCompany') }}
      </Button>
    </div>

    <div class="relative max-w-sm">
      <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input v-model="search" :placeholder="$t('companies.searchCompanies')" class="pl-8" />
    </div>

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{{ $t('companies.name') }}</TableHead>
            <TableHead>{{ $t('companies.theme') }}</TableHead>
            <TableHead>{{ $t('companies.whatsappNumber') }}</TableHead>
            <TableHead>{{ $t('companies.registrationDate') }}</TableHead>
            <TableHead>{{ $t('companies.updatedAt') }}</TableHead>
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
          <TableRow v-else-if="filteredCompanies.length === 0">
            <TableCell colspan="6" class="text-center text-muted-foreground">
              {{ $t('companies.empty') }}
            </TableCell>
          </TableRow>
          <TableRow v-for="company in filteredCompanies" v-else :key="company.id">
            <TableCell class="font-medium">
              <div class="flex items-center gap-2">
                <Building2 class="h-4 w-4" />
                <span>{{ company.name }}</span>
              </div>
            </TableCell>
            <TableCell>{{ formatTheme(company.theme) }}</TableCell>
            <TableCell>{{ company.whatsappNumber || '-' }}</TableCell>
            <TableCell>{{ formatDate(company.createdAt) }}</TableCell>
            <TableCell>{{ formatDate(company.updatedAt) }}</TableCell>
            <TableCell>
              <div class="flex justify-end gap-2">
                <Button variant="outline" size="sm" @click="openEditDialog(company)">
                  {{ $t('common.edit') }}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  :disabled="isDeleting || company.id === 1"
                  @click="deleteCompany(company)"
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
    <form class="space-y-4" @submit.prevent="saveCompany">
      <div>
        <h2 class="text-xl font-semibold">
          {{ editingCompany ? $t('companies.editCompany') : $t('companies.newCompany') }}
        </h2>
        <p class="text-sm text-muted-foreground">{{ $t('companies.formDescription') }}</p>
      </div>

      <div class="space-y-2">
        <label for="company-name" class="text-sm font-medium">{{ $t('companies.name') }}</label>
        <Input id="company-name" v-model="form.name" required maxlength="255" />
      </div>

      <div class="space-y-2">
        <label for="company-theme" class="text-sm font-medium">{{ $t('companies.theme') }}</label>
        <Select id="company-theme" v-model="form.theme">
          <option v-for="theme in COMPANY_THEMES" :key="theme.value" :value="theme.value">
            {{ $t(theme.labelKey) }}
          </option>
        </Select>
      </div>

      <div class="space-y-2">
        <label for="company-whatsapp" class="text-sm font-medium">{{
          $t('companies.whatsappNumber')
        }}</label>
        <Input
          id="company-whatsapp"
          v-model="form.whatsappNumber"
          type="tel"
          maxlength="50"
          :placeholder="$t('companies.whatsappPlaceholder')"
        />
        <p class="text-xs text-muted-foreground">{{ $t('companies.whatsappHelp') }}</p>
      </div>

      <div class="space-y-2">
        <span class="text-sm font-medium">{{ $t('companies.logo') }}</span>
        <div v-if="logoPreview" class="h-16 w-64 overflow-hidden rounded-md border">
          <img
            :src="logoPreview"
            :alt="$t('companies.logoPreview')"
            class="h-full w-full object-cover"
          />
        </div>
        <div class="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" @click="openLogoDialog">
            {{ logoPreview ? $t('companies.replaceLogo') : $t('companies.uploadLogo') }}
          </Button>
          <Button
            v-if="logoPreview"
            type="button"
            variant="outline"
            size="sm"
            @click="removeLogo"
          >
            {{ $t('companies.removeLogo') }}
          </Button>
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

  <Dialog
    :open="isLogoDialogOpen"
    class="max-h-[90vh] max-w-xl overflow-y-auto"
    @update:open="(open) => !open && closeLogoDialog()"
  >
    <div class="space-y-1">
      <h2 class="text-xl font-semibold">{{ $t('companies.logoDialogTitle') }}</h2>
      <p class="text-sm text-muted-foreground">{{ $t('companies.logoDialogDescription') }}</p>
    </div>

    <div class="rounded-md border bg-muted/40 p-4 text-sm">
      <p class="font-medium">{{ $t('companies.logoRequirementsTitle') }}</p>
      <ul class="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
        <li>{{ $t('companies.logoRequirementFormat') }}</li>
        <li>{{ $t('companies.logoRequirementSize') }}</li>
        <li>{{ $t('companies.logoRequirementDimensions') }}</li>
        <li>{{ $t('companies.logoRequirementRatio') }}</li>
        <li>{{ $t('companies.logoRequirementDisplay') }}</li>
      </ul>
    </div>

    <div class="space-y-2">
      <label for="company-logo-file" class="text-sm font-medium">
        {{ $t('companies.logoChooseFile') }}
      </label>
      <input
        id="company-logo-file"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        class="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-secondary-foreground"
        @change="handleLogoUpload"
      />
    </div>

    <div v-if="pendingLogoDataUrl" class="space-y-3">
      <div>
        <p class="text-sm font-medium">{{ $t('companies.logoCropTitle') }}</p>
        <p class="text-xs text-muted-foreground">{{ $t('companies.logoCropHelp') }}</p>
      </div>
      <div class="overflow-hidden rounded-md border bg-muted shadow-inner">
        <canvas
          ref="cropCanvas"
          :width="LOGO_OUTPUT_WIDTH"
          :height="LOGO_OUTPUT_HEIGHT"
          class="block aspect-[4/1] w-full cursor-grab touch-none active:cursor-grabbing"
          @pointerdown="handleCropPointerDown"
          @pointermove="handleCropPointerMove"
          @pointerup="handleCropPointerUp"
          @pointercancel="handleCropPointerUp"
        />
      </div>
      <label for="company-logo-zoom" class="block space-y-1 text-sm">
        <span class="font-medium">{{ $t('companies.logoZoom') }}</span>
        <input
          id="company-logo-zoom"
          v-model.number="cropZoom"
          type="range"
          min="1"
          max="3"
          step="0.01"
          class="w-full accent-primary"
        />
      </label>
      <p class="text-xs text-muted-foreground">
        {{ pendingLogoFileName }} · {{ pendingLogoDimensions?.width }} ×
        {{ pendingLogoDimensions?.height }} px
      </p>
      <p class="text-sm text-primary">{{ $t('companies.logoCropReady') }}</p>
    </div>

    <p v-if="pendingLogoError" class="text-sm text-destructive">{{ pendingLogoError }}</p>

    <div class="flex justify-end gap-2 pt-2">
      <Button type="button" variant="outline" @click="closeLogoDialog">
        {{ $t('common.cancel') }}
      </Button>
      <Button type="button" :disabled="!pendingLogoDataUrl" @click="confirmLogo">
        {{ $t('companies.useLogo') }}
      </Button>
    </div>
  </Dialog>
</template>
