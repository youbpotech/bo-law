<script setup lang="ts">
import { ref, computed } from 'vue'
import { FileDown, LoaderCircle } from 'lucide-vue-next'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

interface Props {
  open: boolean
  processId: string
  dossier: Record<string, unknown> | null
  isLoading: boolean
  error: string
  logoUrl: string | null
  companyName: string
}

const props = defineProps<Props>()
defineEmits<{ (e: 'update:open', value: boolean): void }>()

const isExporting = ref(false)
const contentRef = ref<HTMLElement | null>(null)

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase())
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'number') return String(value)
  const str = String(value)
  if (/^\d{4}-\d{2}-\d{2}(T|\s)/.test(str)) {
    try {
      return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(str))
    } catch {
      return str
    }
  }
  return str
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isArrayOfObjects(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => isObject(item))
}

function isPrimitive(value: unknown): boolean {
  return value === null || value === undefined || typeof value !== 'object'
}

const flatEntries = computed(() => {
  if (!props.dossier) return []
  return Object.entries(props.dossier).filter(([, value]) => isPrimitive(value))
})

const objectEntries = computed(() => {
  if (!props.dossier) return []
  return Object.entries(props.dossier).filter(([, value]) => isObject(value))
})

const arrayEntries = computed(() => {
  if (!props.dossier) return []
  return Object.entries(props.dossier).filter(([, value]) => Array.isArray(value))
})

function objectKeys(arr: Record<string, unknown>[]): string[] {
  const keys = new Set<string>()
  arr.forEach((item) => Object.keys(item).forEach((key) => keys.add(key)))
  return Array.from(keys)
}

async function loadLogoAsDataUrl(): Promise<string | null> {
  if (!props.logoUrl) return null
  try {
    const url = props.logoUrl.startsWith('http') ? props.logoUrl : `${API_BASE_URL}${props.logoUrl}`
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${(await import('@/lib/auth')).getAuthToken() ?? ''}` },
    })
    if (!response.ok) return null
    const blob = await response.blob()
    return new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

async function exportPdf(): Promise<Blob> {
  isExporting.value = true
  try {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    let yOffset = 15

    const logoDataUrl = await loadLogoAsDataUrl()
    if (logoDataUrl) {
      try {
        const img = new Image()
        img.src = logoDataUrl
        await new Promise<void>((resolve) => {
          img.onload = () => resolve()
          img.onerror = () => resolve()
        })
        const maxLogoWidth = 50
        const maxLogoHeight = 20
        const scale = Math.min(maxLogoWidth / img.width, maxLogoHeight / img.height, 1)
        const logoWidth = img.width * scale
        const logoHeight = img.height * scale
        pdf.addImage(logoDataUrl, 'PNG', (pageWidth - logoWidth) / 2, yOffset, logoWidth, logoHeight)
        yOffset += logoHeight + 5
      } catch {
        /* skip logo on error */
      }
    }

    pdf.setFontSize(16)
    pdf.setFont('helvetica', 'bold')
    const title = 'Relatório de Solicitação de NISS'
    const titleWidth = pdf.getTextWidth(title)
    pdf.text(title, (pageWidth - titleWidth) / 2, yOffset + 6)
    yOffset += 14

    pdf.setDrawColor(200, 200, 200)
    pdf.line(15, yOffset, pageWidth - 15, yOffset)
    yOffset += 6

    if (contentRef.value) {
      const canvas = await html2canvas(contentRef.value, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      })
      const imgData = canvas.toDataURL('image/png')
      const imgWidth = pageWidth - 30
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      const availableHeight = pdf.internal.pageSize.getHeight() - yOffset - 15

      if (imgHeight <= availableHeight) {
        pdf.addImage(imgData, 'PNG', 15, yOffset, imgWidth, imgHeight)
      } else {
        let remainingHeight = imgHeight
        let sourceY = 0
        const pageContentHeight = pdf.internal.pageSize.getHeight() - 30
        while (remainingHeight > 0) {
          const sliceHeight = Math.min(remainingHeight, yOffset === (yOffset) ? availableHeight : pageContentHeight)
          const sliceCanvas = document.createElement('canvas')
          sliceCanvas.width = canvas.width
          sliceCanvas.height = (sliceHeight / imgHeight) * canvas.height
          const ctx = sliceCanvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(
              canvas,
              0, sourceY, canvas.width, sliceCanvas.height,
              0, 0, sliceCanvas.width, sliceCanvas.height,
            )
            const sliceData = sliceCanvas.toDataURL('image/png')
            if (sourceY > 0) {
              pdf.addPage()
              yOffset = 15
            }
            pdf.addImage(sliceData, 'PNG', 15, yOffset, imgWidth, sliceHeight)
          }
          sourceY += sliceCanvas.height
          remainingHeight -= sliceHeight
          yOffset = 15
        }
      }
    }

    return pdf.output('blob')
  } finally {
    isExporting.value = false
  }
}

async function handleExportPdf(): Promise<void> {
  const blob = await exportPdf()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `dossie-niss-${props.processId}.pdf`
  anchor.click()
  URL.revokeObjectURL(url)
}

defineExpose({ generatePdf: exportPdf })
</script>

<template>
  <Dialog :open="open" class="max-h-[92vh] max-w-5xl overflow-y-auto" @update:open="(v) => $emit('update:open', v)">
    <div class="space-y-4">
      <div class="flex items-start justify-between">
        <div>
          <h2 class="text-xl font-semibold">Dossiê do pedido {{ processId }}</h2>
          <p class="text-sm text-muted-foreground">Todas as informações retornadas pelo BotNiss para este pedido.</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          :disabled="isExporting || isLoading || !dossier"
          @click="handleExportPdf"
        >
          <LoaderCircle v-if="isExporting" class="mr-2 h-4 w-4 animate-spin" />
          <FileDown v-else class="mr-2 h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      <p v-if="isLoading" class="py-8 text-center text-muted-foreground">Carregando dossiê...</p>
      <p v-else-if="error" class="rounded-md bg-destructive/5 p-3 text-sm text-destructive">{{ error }}</p>

      <div v-else-if="dossier" ref="contentRef" class="space-y-5">
        <!-- Primitive fields -->
        <div v-if="flatEntries.length" class="rounded-md border">
          <div class="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0">
            <div
              v-for="([key, value], index) in flatEntries"
              :key="key"
              :class="[
                'flex flex-col gap-0.5 px-4 py-3',
                index % 2 === 0 ? 'bg-muted/30' : 'bg-background',
                'sm:border-b',
              ]"
            >
              <span class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{{ humanizeKey(key) }}</span>
              <span class="text-sm font-medium">{{ formatValue(value) }}</span>
            </div>
          </div>
        </div>

        <!-- Nested objects -->
        <div v-for="[key, value] in objectEntries" :key="key" class="space-y-2">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{{ humanizeKey(key) }}</h3>
          <div class="rounded-md border">
            <div class="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0">
              <div
                v-for="([subKey, subValue], subIndex) in Object.entries(value as Record<string, unknown>)"
                :key="subKey"
                :class="[
                  'flex flex-col gap-0.5 px-4 py-3',
                  subIndex % 2 === 0 ? 'bg-muted/30' : 'bg-background',
                  'sm:border-b',
                ]"
              >
                <span class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{{ humanizeKey(subKey) }}</span>
                <span v-if="isPrimitive(subValue)" class="text-sm font-medium">{{ formatValue(subValue) }}</span>
                <pre v-else class="max-w-full overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">{{ JSON.stringify(subValue, null, 2) }}</pre>
              </div>
            </div>
          </div>
        </div>

        <!-- Arrays -->
        <div v-for="[key, value] in arrayEntries" :key="key" class="space-y-2">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{{ humanizeKey(key) }}</h3>
          <!-- Array of objects → table -->
          <div v-if="isArrayOfObjects(value)" class="overflow-auto rounded-md border">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b bg-muted/50">
                  <th
                    v-for="col in objectKeys(value)"
                    :key="col"
                    class="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {{ humanizeKey(col) }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, rowIndex) in value" :key="rowIndex" class="border-b last:border-0">
                  <td
                    v-for="col in objectKeys(value)"
                    :key="col"
                    class="px-3 py-2"
                  >
                    {{ isPrimitive(row[col]) ? formatValue(row[col]) : JSON.stringify(row[col]) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- Simple array → list -->
          <ul v-else class="space-y-1 rounded-md border p-3">
            <li v-for="(item, i) in (value as unknown[])" :key="i" class="text-sm">
              {{ isPrimitive(item) ? formatValue(item) : JSON.stringify(item) }}
            </li>
          </ul>
        </div>
      </div>

      <div class="flex justify-end border-t pt-4">
        <Button variant="outline" @click="$emit('update:open', false)">Fechar</Button>
      </div>
    </div>
  </Dialog>
</template>
