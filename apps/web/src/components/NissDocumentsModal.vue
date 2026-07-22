<script setup lang="ts">
import { ref } from 'vue'
import {
  Download,
  DownloadCloud,
  FileText,
  FileImage,
  FileSpreadsheet,
  File as FileIcon,
  LoaderCircle,
} from 'lucide-vue-next'
import JSZip from 'jszip'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'
import type { NissDocument } from '@/composables/useApi'

interface Props {
  open: boolean
  processId: string
  documents: NissDocument[]
  isLoading: boolean
  error: string
  baixarDocumento: (args: { processId: string; docIndex: number }) => Promise<Blob>
  generateDossierPdf: (() => Promise<Blob>) | null
}

const props = defineProps<Props>()
defineEmits<{ (e: 'update:open', value: boolean): void }>()

const downloadingIndex = ref<number | null>(null)
const isDownloadingAll = ref(false)
const downloadProgress = ref('')
const actionError = ref('')

function fileIcon(mimeType: string | null) {
  if (!mimeType) return FileIcon
  if (mimeType.startsWith('image/')) return FileImage
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return FileSpreadsheet
  if (mimeType.includes('pdf') || mimeType.includes('text') || mimeType.includes('word') || mimeType.includes('document')) return FileText
  return FileIcon
}

function fileTypeLabel(mimeType: string | null): string {
  if (!mimeType) return 'Ficheiro'
  const map: Record<string, string> = {
    'application/pdf': 'PDF',
    'image/png': 'PNG',
    'image/jpeg': 'JPEG',
    'image/webp': 'WebP',
    'text/plain': 'Texto',
    'text/csv': 'CSV',
  }
  return map[mimeType] || mimeType.split('/').pop()?.toUpperCase() || 'Ficheiro'
}

async function downloadSingle(docIndex: number, fileName: string): Promise<void> {
  downloadingIndex.value = docIndex
  actionError.value = ''
  try {
    const blob = await props.baixarDocumento({ processId: props.processId, docIndex })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Não foi possível baixar o documento.'
  } finally {
    downloadingIndex.value = null
  }
}

async function downloadAll(): Promise<void> {
  isDownloadingAll.value = true
  actionError.value = ''
  downloadProgress.value = 'Preparando...'
  try {
    const zip = new JSZip()
    const total = props.documents.length + (props.generateDossierPdf ? 1 : 0)
    let completed = 0

    // Download all documents
    for (let i = 0; i < props.documents.length; i++) {
      const doc = props.documents[i]
      downloadProgress.value = `Baixando documento ${i + 1} de ${props.documents.length}...`
      try {
        const blob = await props.baixarDocumento({ processId: props.processId, docIndex: i })
        const sanitizedName = doc.fileName.replace(/[^a-zA-Z0-9._ -]/g, '_')
        const name = `${String(i + 1).padStart(2, '0')}-${sanitizedName}`
        zip.file(name, blob)
      } catch {
        // Continue with other documents even if one fails
      }
      completed++
      downloadProgress.value = `${Math.round((completed / total) * 100)}% concluído...`
    }

    // Generate and add dossier PDF
    if (props.generateDossierPdf) {
      downloadProgress.value = 'Gerando dossiê PDF...'
      try {
        const pdfBlob = await props.generateDossierPdf()
        zip.file('dossie.pdf', pdfBlob)
      } catch {
        // Continue even if PDF generation fails
      }
      completed++
      downloadProgress.value = `${Math.round((completed / total) * 100)}% concluído...`
    }

    downloadProgress.value = 'Criando arquivo ZIP...'
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(zipBlob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `pedido-niss-${props.processId}-completo.zip`
    anchor.click()
    URL.revokeObjectURL(url)
    downloadProgress.value = ''
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Não foi possível gerar o arquivo.'
  } finally {
    isDownloadingAll.value = false
    downloadProgress.value = ''
  }
}
</script>

<template>
  <Dialog :open="open" class="max-h-[92vh] max-w-3xl overflow-y-auto" @update:open="(v) => $emit('update:open', v)">
    <div class="space-y-4">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h2 class="text-xl font-semibold">Documentos do pedido {{ processId }}</h2>
          <p class="text-sm text-muted-foreground">Ficheiros associados a esta solicitação NISS.</p>
        </div>
        <Button
          :disabled="isDownloadingAll || isLoading || !documents.length"
          @click="downloadAll"
        >
          <LoaderCircle v-if="isDownloadingAll" class="mr-2 h-4 w-4 animate-spin" />
          <DownloadCloud v-else class="mr-2 h-4 w-4" />
          Baixar Tudo
        </Button>
      </div>

      <p v-if="isDownloadingAll && downloadProgress" class="rounded-md border border-blue-600/20 bg-blue-600/5 p-3 text-sm text-blue-700 dark:text-blue-400">
        {{ downloadProgress }}
      </p>

      <p v-if="actionError" role="alert" class="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        {{ actionError }}
      </p>

      <p v-if="isLoading" class="py-8 text-center text-muted-foreground">Carregando documentos...</p>
      <p v-else-if="error" class="rounded-md bg-destructive/5 p-3 text-sm text-destructive">{{ error }}</p>
      <p v-else-if="!documents.length" class="py-8 text-center text-muted-foreground">Nenhum documento encontrado para este pedido.</p>

      <div v-else class="space-y-2">
        <div
          v-for="(doc, index) in documents"
          :key="doc.id"
          class="flex items-center justify-between gap-3 rounded-md border bg-background p-3 transition-colors hover:bg-muted/30"
        >
          <div class="flex items-center gap-3 overflow-hidden">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted/50">
              <component :is="fileIcon(doc.mimeType)" class="h-5 w-5 text-muted-foreground" />
            </div>
            <div class="overflow-hidden">
              <p class="truncate text-sm font-medium">{{ doc.fileName }}</p>
              <p class="text-xs text-muted-foreground">{{ fileTypeLabel(doc.mimeType) }}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            :disabled="downloadingIndex === index"
            @click="downloadSingle(index, doc.fileName)"
          >
            <LoaderCircle v-if="downloadingIndex === index" class="mr-2 h-4 w-4 animate-spin" />
            <Download v-else class="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>
      </div>

      <div class="flex justify-end border-t pt-4">
        <Button variant="outline" @click="$emit('update:open', false)">Fechar</Button>
      </div>
    </div>
  </Dialog>
</template>
