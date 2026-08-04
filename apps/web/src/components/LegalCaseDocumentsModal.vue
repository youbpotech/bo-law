<script setup lang="ts">
import { ref } from 'vue'
import { Download, File, FileImage, FileText, LoaderCircle } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'
import type { LegalCaseDocument, NissDocumentDownload } from '@/composables/useApi'

const props = defineProps<{
  open: boolean
  caseTitle: string
  documents: LegalCaseDocument[]
  isLoading: boolean
  error: string
  hasIntegration: boolean
  baixarDocumento: (args: { caseId: string; fileName: string }) => Promise<NissDocumentDownload>
  caseId: string
}>()

defineEmits<{ (event: 'update:open', value: boolean): void }>()

const downloadingIndex = ref<number | null>(null)
const actionError = ref('')

function fileIcon(mimeType: string | null) {
  if (mimeType?.startsWith('image/')) return FileImage
  if (mimeType?.includes('pdf') || mimeType?.includes('text')) return FileText
  return File
}

async function download(index: number, fileName: string): Promise<void> {
  downloadingIndex.value = index
  actionError.value = ''
  try {
    const result = await props.baixarDocumento({ caseId: props.caseId, fileName })
    const url = URL.createObjectURL(result.blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = result.fileName
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
  <Dialog :open="open" class="max-h-[92vh] max-w-3xl overflow-y-auto" @update:open="(value) => $emit('update:open', value)">
    <div class="space-y-4">
      <div>
        <h2 class="text-xl font-semibold">Documentos do processo</h2>
        <p class="text-sm text-muted-foreground">{{ caseTitle }}</p>
      </div>
      <p v-if="actionError" role="alert" class="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{{ actionError }}</p>
      <p v-if="isLoading" class="py-8 text-center text-muted-foreground">Carregando documentos...</p>
      <p v-else-if="error" class="rounded-md bg-destructive/5 p-3 text-sm text-destructive">{{ error }}</p>
      <p v-else-if="!hasIntegration" class="py-8 text-center text-sm text-muted-foreground">Este processo ainda não possui documentos eletrónicos associados.</p>
      <p v-else-if="!documents.length" class="py-8 text-center text-sm text-muted-foreground">Nenhum documento encontrado para este processo.</p>
      <div v-else class="space-y-2">
        <div v-for="(document, index) in documents" :key="document.id" class="flex items-center justify-between gap-3 rounded-md border bg-background p-3 hover:bg-muted/30">
          <div class="flex min-w-0 items-center gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted/50">
              <component :is="fileIcon(document.mimeType)" class="h-5 w-5 text-muted-foreground" />
            </div>
            <div class="min-w-0">
              <p class="truncate text-sm font-medium">{{ document.fileName }}</p>
              <p class="text-xs text-muted-foreground">{{ document.mimeType || 'Ficheiro' }}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" :disabled="downloadingIndex === index" @click="download(index, document.fileName)">
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
