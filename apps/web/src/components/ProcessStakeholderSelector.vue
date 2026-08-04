<script setup lang="ts">
import { computed } from 'vue'
import { Bell, Mail, MessageSquareText } from 'lucide-vue-next'
import WhatsAppIcon from '@/components/icons/WhatsAppIcon.vue'
import type { NotificationChannel } from '@/features/notifications/types'
import type { ProcessCreator } from '@/features/processes/types'
import { useProcessStakeholders } from '@/features/processes/useProcessStakeholders'

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    creator: ProcessCreator
    disabled?: boolean
  }>(),
  {
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const { candidates, isLoading, error } = useProcessStakeholders()

const selectableCandidates = computed(() => {
  const seen = new Set<string>()
  return candidates.value.filter((candidate) => {
    if (candidate.id === props.creator.id || seen.has(candidate.id)) return false
    seen.add(candidate.id)
    return true
  })
})

const selectedIds = computed(
  () => new Set(props.modelValue.filter((id) => id !== props.creator.id)),
)
const creatorChannels = computed(
  () =>
    candidates.value.find((candidate) => candidate.id === props.creator.id)?.notificationChannels ??
    (['internal'] as NotificationChannel[]),
)

function toggleCandidate(userId: string, selected: boolean): void {
  if (props.disabled) return
  const next = new Set(selectedIds.value)
  if (selected) next.add(userId)
  else next.delete(userId)
  emit('update:modelValue', [...next])
}

function channelLabel(channel: NotificationChannel): string {
  const labels: Record<NotificationChannel, string> = {
    internal: 'Interno',
    email: 'Email',
    whatsapp: 'WhatsApp',
    sms: 'SMS',
  }
  return labels[channel]
}
</script>

<template>
  <fieldset class="space-y-2" :disabled="disabled">
    <legend class="text-sm font-medium">Utilizadores a notificar</legend>
    <p class="text-xs text-muted-foreground">
      O criador é sempre notificado. Selecione outros participantes do processo.
    </p>

    <div class="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3">
      <label
        :data-user-id="creator.id"
        data-testid="process-creator"
        class="flex items-start gap-3 rounded-md bg-muted/50 p-3 text-muted-foreground opacity-70"
      >
        <input
          type="checkbox"
          checked
          disabled
          class="mt-0.5 h-4 w-4 shrink-0"
          aria-label="Criador do processo"
        />
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-medium">{{ creator.name }}</span>
          <span class="block text-xs">Criador do processo · sempre notificado</span>
        </span>
        <span class="flex flex-wrap justify-end gap-1">
          <span
            v-for="channel in creatorChannels"
            :key="channel"
            class="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-1 text-xs"
          >
            <Bell v-if="channel === 'internal'" class="h-3 w-3" />
            <Mail v-else-if="channel === 'email'" class="h-3 w-3" />
            <WhatsAppIcon v-else-if="channel === 'whatsapp'" class="h-3 w-3" />
            <MessageSquareText v-else class="h-3 w-3" />
            {{ channelLabel(channel) }}
          </span>
        </span>
      </label>

      <p v-if="isLoading" class="px-3 py-4 text-center text-sm text-muted-foreground">
        Carregando utilizadores...
      </p>
      <p v-else-if="error" class="px-3 py-4 text-center text-sm text-destructive">
        Não foi possível carregar os utilizadores disponíveis.
      </p>
      <template v-else>
        <label
          v-for="candidate in selectableCandidates"
          :key="candidate.id"
          :data-user-id="candidate.id"
          class="flex items-start gap-3 rounded-md border p-3 transition-colors hover:bg-accent/50"
          :class="{ 'cursor-not-allowed opacity-50': disabled }"
        >
          <input
            type="checkbox"
            :checked="selectedIds.has(candidate.id)"
            :disabled="disabled"
            class="mt-0.5 h-4 w-4 shrink-0"
            :aria-label="`Notificar ${candidate.name}`"
            @change="toggleCandidate(candidate.id, ($event.target as HTMLInputElement).checked)"
          />
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium">{{ candidate.name }}</span>
            <span class="mt-1 flex flex-wrap gap-1">
              <span
                v-for="channel in candidate.notificationChannels"
                :key="channel"
                class="inline-flex items-center gap-1 rounded-full border bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                <Bell v-if="channel === 'internal'" class="h-3 w-3" />
                <Mail v-else-if="channel === 'email'" class="h-3 w-3" />
                <WhatsAppIcon v-else-if="channel === 'whatsapp'" class="h-3 w-3" />
                <MessageSquareText v-else class="h-3 w-3" />
                {{ channelLabel(channel) }}
              </span>
            </span>
          </span>
        </label>

        <p
          v-if="selectableCandidates.length === 0"
          class="px-3 py-4 text-center text-sm text-muted-foreground"
        >
          Nenhum outro utilizador disponível.
        </p>
      </template>
    </div>
  </fieldset>
</template>
