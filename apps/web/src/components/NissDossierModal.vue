<script setup lang="ts">
import { ref, computed } from 'vue'
import { FileDown, LoaderCircle } from 'lucide-vue-next'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'
import { buildDossierSections } from '@/lib/niss-dossier'

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

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'number') return String(value)
  const str = String(value)
  if (/^\d{4}-\d{2}-\d{2}(T|\s)/.test(str)) {
    try {
      return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(str))
    } catch {
      return str
    }
  }
  return str
}

const sections = computed(() => {
  if (!props.dossier) return []
  return buildDossierSections(props.dossier as Record<string, unknown>)
})

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

      <div v-else-if="dossier" ref="contentRef" class="space-y-6 rounded-lg border bg-background p-5 shadow-sm">
        <div class="rounded-lg border border-border/70 bg-muted/20 p-4">
          <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p class="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Dossiê NISS</p>
              <h3 class="mt-1 text-2xl font-semibold text-foreground">Pedido {{ processId }}</h3>
              <p class="mt-2 max-w-3xl text-sm text-muted-foreground">
                Documento preparado para acompanhamento do advogado e do cliente, com foco nas informações relevantes para a análise do processo.
              </p>
            </div>
            <div v-if="companyName" class="rounded-md border bg-background px-3 py-2 text-sm font-medium text-muted-foreground">
              {{ companyName }}
            </div>
          </div>
        </div>

        <div v-for="section in sections" :key="section.title" class="space-y-3">
          <div class="border-b pb-2">
            <h4 class="text-base font-semibold text-foreground">{{ section.title }}</h4>
          </div>
          <div class="grid gap-3 md:grid-cols-2">
            <div
              v-for="entry in section.entries"
              :key="entry.label"
              class="rounded-md border border-border/70 bg-muted/10 p-3"
            >
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{{ entry.label }}</p>
              <p class="mt-1 text-sm leading-6 text-foreground whitespace-pre-line">{{ entry.value }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-end border-t pt-4">
        <Button variant="outline" @click="$emit('update:open', false)">Fechar</Button>
      </div>
    </div>
  </Dialog>
</template>
