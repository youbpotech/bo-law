<script setup lang="ts">
import { ref } from 'vue'
import { Download, File, FileImage, FileText, LoaderCircle } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'
import type { AimaDocument, AimaDocumentDownload } from '@/composables/useApi'

interface Props {
  open: boolean
  processId: string
  documents: AimaDocument[]
  isLoading: boolean
  error: string
  baixarDocumento: (args: { processId: string; fileName: string }) => Promise<AimaDocumentDownload>
}

const props = defineProps<Props>()
defineEmits<{ (e: 'update:open', value: boolean): void }>()
const downloadingIndex = ref<number | null>(null)
const actionError = ref('')

function fileIcon(mimeType: string | null) {
  if (mimeType?.startsWith('image/')) return FileImage
  if (mimeType?.includes('pdf') || mimeType?.includes('text')) return FileText
  return File
}

function fileTypeLabel(document: AimaDocument): string {
  if (document.documentTypeDescription) return document.documentTypeDescription
  if (document.mimeType) return document.mimeType.split('/').pop()?.toUpperCase() || 'Ficheiro'
  return 'Ficheiro'
}

async function downloadSingle(index: number, fileName: string): Promise<void> {
  downloadingIndex.value = index
  actionError.value = ''
  try {
    const download = await props.baixarDocumento({ processId: props.processId, fileName })
    const url = URL.createObjectURL(download.blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = download.fileName
    anchor.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Não foi possível baixar o documento.'
  } finally {
    downloadingIndex.value = null
  }
}
</script>

<template>
  <Dialog :open="open" class="max-h-[92vh] max-w-3xl overflow-y-auto" @update:open="(v) => $emit('update:open', v)">
    <div class="space-y-4">
      <div>
        <h2 class="text-xl font-semibold">Documentos do processo AIMA {{ processId }}</h2>
        <p class="text-sm text-muted-foreground">Snapshots e documentos associados à consulta.</p>
      </div>
      <p v-if="actionError" role="alert" class="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{{ actionError }}</p>
      <p v-if="isLoading" class="py-8 text-center text-muted-foreground">Carregando documentos...</p>
      <p v-else-if="error" class="rounded-md bg-destructive/5 p-3 text-sm text-destructive">{{ error }}</p>
      <p v-else-if="!documents.length" class="py-8 text-center text-muted-foreground">Nenhum documento encontrado para este processo.</p>
      <div v-else class="space-y-2">
        <div v-for="(document, index) in documents" :key="document.id" class="flex items-center justify-between gap-3 rounded-md border bg-background p-3 hover:bg-muted/30">
          <div class="flex min-w-0 items-center gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted/50">
              <component :is="fileIcon(document.mimeType)" class="h-5 w-5 text-muted-foreground" />
            </div>
            <div class="min-w-0">
              <p class="truncate text-sm font-medium">{{ document.fileName }}</p>
              <p class="text-xs text-muted-foreground">{{ fileTypeLabel(document) }}<span v-if="document.documentDate"> · {{ document.documentDate }}</span></p>
            </div>
          </div>
          <Button size="sm" variant="outline" :disabled="downloadingIndex === index" @click="downloadSingle(index, document.fileName)">
            <LoaderCircle v-if="downloadingIndex === index" class="mr-2 h-4 w-4 animate-spin" />
            <Download v-else class="mr-2 h-4 w-4" />
            Baixar
          </Button>
        </div>
      </div>
      <div class="flex justify-end border-t pt-4">
        <Button variant="outline" @click="$emit('update:open', false)">Fechar</Button>
      </div>
    </div>
  </Dialog>
</template>
