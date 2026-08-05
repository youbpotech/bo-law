<script setup lang="ts">
import { computed } from 'vue'
import { buildAimaDossierSections, buildAimaDossierTitle } from '@/lib/aima-dossier'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'

interface Props {
  open: boolean
  processId: string
  dossier: Record<string, unknown> | null
  isLoading: boolean
  error: string
}

const props = defineProps<Props>()
defineEmits<{ (e: 'update:open', value: boolean): void }>()

const sections = computed(() => (props.dossier ? buildAimaDossierSections(props.dossier) : []))
const dossierTitle = computed(() =>
  props.dossier ? buildAimaDossierTitle(props.dossier) : `Processo AIMA ${props.processId}`,
)
</script>

<template>
  <Dialog
    :open="open"
    class="max-h-[92vh] max-w-5xl overflow-y-auto"
    @update:open="(v) => $emit('update:open', v)"
  >
    <div class="space-y-4">
      <div>
        <h2 class="text-xl font-semibold">{{ dossierTitle }}</h2>
        <p class="text-sm text-muted-foreground">Informações devolvidas pela API do BotAIMA.</p>
      </div>

      <p v-if="isLoading" class="py-8 text-center text-muted-foreground">Carregando dossiê...</p>
      <p v-else-if="error" class="rounded-md bg-destructive/5 p-3 text-sm text-destructive">{{ error }}</p>

      <div v-else-if="dossier" class="space-y-6 rounded-lg border bg-background p-5 shadow-sm">
        <div v-for="section in sections" :key="section.title" class="space-y-3">
          <div class="border-b pb-2">
            <h3 class="text-base font-semibold">{{ section.title }}</h3>
          </div>
          <div class="grid gap-3 md:grid-cols-2">
            <div v-for="entry in section.entries" :key="entry.label" class="rounded-md border bg-muted/10 p-3">
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{{ entry.label }}</p>
              <p class="mt-1 break-words whitespace-pre-line text-sm leading-6">{{ entry.value }}</p>
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
