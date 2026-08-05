<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ImageCropDialog from '@/components/ImageCropDialog.vue'
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
const isBannerDialogOpen = ref(false)
const editingCompany = ref<Company | null>(null)
const formError = ref('')
const form = reactive({
  name: '',
  theme: 'default',
  whatsappNumber: '',
  logoDataUrl: undefined as string | null | undefined,
  faviconDataUrl: undefined as string | null | undefined,
  loginBannerDataUrl: undefined as string | null | undefined,
})
const logoPreview = ref<string | null>(null)
const faviconPreview = ref<string | null>(null)
const bannerPreview = ref<string | null>(null)
const faviconError = ref('')

const LOGO_MAX_BYTES = 512 * 1024
const LOGO_SOURCE_MAX_BYTES = 5 * 1024 * 1024
const LOGO_SOURCE_MIN_WIDTH = 168
const LOGO_SOURCE_MIN_HEIGHT = 40
const LOGO_OUTPUT_WIDTH = 1024
const LOGO_OUTPUT_HEIGHT = 256
const BANNER_MAX_BYTES = 2 * 1024 * 1024
const BANNER_SOURCE_MAX_BYTES = 15 * 1024 * 1024
const BANNER_SOURCE_MIN_WIDTH = 1600
const BANNER_SOURCE_MIN_HEIGHT = 1200
const BANNER_OUTPUT_WIDTH = 1600
const BANNER_OUTPUT_HEIGHT = 1200
const FAVICON_MAX_BYTES = 256 * 1024
const FAVICON_MIN_SIZE = 32
const FAVICON_MAX_SIZE = 512

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
  form.faviconDataUrl = undefined
  form.loginBannerDataUrl = undefined
  logoPreview.value = null
  faviconPreview.value = null
  bannerPreview.value = null
  faviconError.value = ''
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
  form.faviconDataUrl = undefined
  form.loginBannerDataUrl = undefined
  logoPreview.value = company.logoUrl
  faviconPreview.value = company.faviconUrl
  bannerPreview.value = company.loginBannerUrl
  faviconError.value = ''
  formError.value = ''
  isDialogOpen.value = true
}

function closeDialog(): void {
  closeLogoDialog()
  isBannerDialogOpen.value = false
  isDialogOpen.value = false
  editingCompany.value = null
  resetForm()
}

function openLogoDialog(): void {
  isLogoDialogOpen.value = true
}

function closeLogoDialog(): void {
  isLogoDialogOpen.value = false
}

function formatTheme(theme: string): string {
  return t(getCompanyTheme(theme).labelKey)
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Arquivo inválido'))
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

function confirmLogo(dataUrl: string): void {
  form.logoDataUrl = dataUrl
  logoPreview.value = dataUrl
}

function removeLogo(): void {
  form.logoDataUrl = null
  logoPreview.value = null
}

function confirmBanner(dataUrl: string): void {
  form.loginBannerDataUrl = dataUrl
  bannerPreview.value = dataUrl
}

function removeBanner(): void {
  form.loginBannerDataUrl = null
  bannerPreview.value = null
}

async function handleFaviconUpload(event: Event): Promise<void> {
  faviconError.value = ''
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      throw new Error(t('companies.faviconFormatError'))
    }
    if (file.size > FAVICON_MAX_BYTES) throw new Error(t('companies.faviconSizeError'))
    const dataUrl = await readFileAsDataUrl(file)
    const image = await loadImage(dataUrl)
    if (
      image.naturalWidth !== image.naturalHeight ||
      image.naturalWidth < FAVICON_MIN_SIZE ||
      image.naturalWidth > FAVICON_MAX_SIZE
    ) {
      throw new Error(t('companies.faviconDimensionsError'))
    }
    form.faviconDataUrl = dataUrl
    faviconPreview.value = dataUrl
  } catch (error) {
    input.value = ''
    faviconError.value = error instanceof Error ? error.message : t('companies.faviconInvalid')
  }
}

function removeFavicon(): void {
  form.faviconDataUrl = null
  faviconPreview.value = null
  faviconError.value = ''
}

async function saveCompany(): Promise<void> {
  formError.value = ''

  try {
    const data = {
      name: form.name,
      theme: form.theme,
      whatsappNumber: form.whatsappNumber.trim() || null,
      ...(form.logoDataUrl !== undefined ? { logoDataUrl: form.logoDataUrl } : {}),
      ...(form.faviconDataUrl !== undefined ? { faviconDataUrl: form.faviconDataUrl } : {}),
      ...(form.loginBannerDataUrl !== undefined
        ? { loginBannerDataUrl: form.loginBannerDataUrl }
        : {}),
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
          <Button v-if="logoPreview" type="button" variant="outline" size="sm" @click="removeLogo">
            {{ $t('companies.removeLogo') }}
          </Button>
        </div>
      </div>

      <div class="space-y-2">
        <span class="text-sm font-medium">{{ $t('companies.loginBanner') }}</span>
        <div v-if="bannerPreview" class="aspect-[4/3] w-48 overflow-hidden rounded-md border">
          <img
            :src="bannerPreview"
            :alt="$t('companies.loginBannerPreview')"
            class="h-full w-full object-cover"
          />
        </div>
        <div class="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" @click="isBannerDialogOpen = true">
            {{
              bannerPreview ? $t('companies.replaceLoginBanner') : $t('companies.uploadLoginBanner')
            }}
          </Button>
          <Button
            v-if="bannerPreview"
            type="button"
            variant="outline"
            size="sm"
            @click="removeBanner"
          >
            {{ $t('companies.removeLoginBanner') }}
          </Button>
        </div>
        <p class="text-xs text-muted-foreground">{{ $t('companies.loginBannerHelp') }}</p>
      </div>

      <div class="space-y-2">
        <span class="text-sm font-medium">{{ $t('companies.favicon') }}</span>
        <div
          v-if="faviconPreview"
          class="flex h-16 w-16 items-center justify-center rounded-md border bg-background p-2"
        >
          <img
            :src="faviconPreview"
            :alt="$t('companies.faviconPreview')"
            class="h-full w-full object-contain"
          />
        </div>
        <input
          id="company-favicon-file"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          class="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-secondary-foreground"
          @change="handleFaviconUpload"
        />
        <p class="text-xs text-muted-foreground">{{ $t('companies.faviconHelp') }}</p>
        <p v-if="faviconError" class="text-sm text-destructive">{{ faviconError }}</p>
        <Button
          v-if="faviconPreview"
          type="button"
          variant="outline"
          size="sm"
          @click="removeFavicon"
        >
          {{ $t('companies.removeFavicon') }}
        </Button>
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

  <ImageCropDialog
    v-model:open="isLogoDialogOpen"
    :title="$t('companies.logoDialogTitle')"
    :description="$t('companies.logoDialogDescription')"
    :asset-name="$t('companies.logoAssetName')"
    :requirements="[
      $t('companies.logoRequirementFormat'),
      $t('companies.logoRequirementSize'),
      $t('companies.logoRequirementDimensions'),
      $t('companies.logoRequirementRatio'),
      $t('companies.logoRequirementDisplay'),
    ]"
    :output-width="LOGO_OUTPUT_WIDTH"
    :output-height="LOGO_OUTPUT_HEIGHT"
    :source-min-width="LOGO_SOURCE_MIN_WIDTH"
    :source-min-height="LOGO_SOURCE_MIN_HEIGHT"
    :source-max-bytes="LOGO_SOURCE_MAX_BYTES"
    :output-max-bytes="LOGO_MAX_BYTES"
    :confirm-label="$t('companies.useLogo')"
    :ready-label="$t('companies.logoCropReady')"
    @confirm="confirmLogo"
  />

  <ImageCropDialog
    v-model:open="isBannerDialogOpen"
    :title="$t('companies.loginBannerDialogTitle')"
    :description="$t('companies.loginBannerDialogDescription')"
    :asset-name="$t('companies.loginBannerAssetName')"
    :requirements="[
      $t('companies.loginBannerRequirementFormat'),
      $t('companies.loginBannerRequirementSize'),
      $t('companies.loginBannerRequirementDimensions'),
      $t('companies.loginBannerRequirementRatio'),
      $t('companies.loginBannerRequirementDisplay'),
    ]"
    :output-width="BANNER_OUTPUT_WIDTH"
    :output-height="BANNER_OUTPUT_HEIGHT"
    :source-min-width="BANNER_SOURCE_MIN_WIDTH"
    :source-min-height="BANNER_SOURCE_MIN_HEIGHT"
    :source-max-bytes="BANNER_SOURCE_MAX_BYTES"
    :output-max-bytes="BANNER_MAX_BYTES"
    :confirm-label="$t('companies.useLoginBanner')"
    :ready-label="$t('companies.loginBannerCropReady')"
    @confirm="confirmBanner"
  />
</template>
