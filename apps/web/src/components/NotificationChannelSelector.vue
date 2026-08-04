<script setup lang="ts">
import { computed } from 'vue'
import { Bell, Mail, MessageSquareText } from 'lucide-vue-next'
import WhatsAppIcon from '@/components/icons/WhatsAppIcon.vue'
import {
  NOTIFICATION_CHANNELS,
  type NotificationChannel,
  type NotificationChannelCatalogItem,
} from '@/features/notifications/types'

const props = withDefaults(
  defineProps<{
    modelValue: NotificationChannel[]
    catalog: NotificationChannelCatalogItem[]
    email?: string | null
    phone?: string | null
    disabled?: boolean
  }>(),
  {
    email: null,
    phone: null,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: NotificationChannel[]]
}>()

const selectedChannels = computed(() => new Set(props.modelValue))
const catalogByChannel = computed(() => new Map(props.catalog.map((item) => [item.channel, item])))

function fallbackCatalogItem(channel: NotificationChannel): NotificationChannelCatalogItem {
  if (channel === 'internal') {
    return {
      channel,
      supported: true,
      implemented: true,
      configured: true,
      availableForUser: true,
      reason: null,
    }
  }
  return {
    channel,
    supported: true,
    implemented: false,
    configured: false,
    availableForUser: false,
    reason:
      channel === 'sms'
        ? 'O canal SMS é suportado pela plataforma, mas ainda não possui implementação.'
        : 'Canal ainda não configurado.',
  }
}

const options = computed(() =>
  NOTIFICATION_CHANNELS.map(
    (channel) => catalogByChannel.value.get(channel) ?? fallbackCatalogItem(channel),
  ),
)

function localUnavailableReason(channel: NotificationChannel): string | null {
  if (channel === 'sms') {
    return 'O canal SMS é suportado pela plataforma, mas ainda não possui implementação.'
  }
  if (channel === 'email' && !props.email?.trim()) {
    return 'Informe um endereço de email para utilizar este canal.'
  }
  if (channel === 'whatsapp' && !props.phone?.trim()) {
    return 'Informe um telefone para utilizar este canal.'
  }
  return null
}

function unavailableReason(option: NotificationChannelCatalogItem): string | null {
  if (!option.supported) return option.reason ?? 'Canal não suportado.'
  if (!option.implemented) return option.reason ?? 'Canal ainda não implementado.'
  if (!option.configured) return option.reason ?? 'Canal ainda não configurado.'
  const localReason = localUnavailableReason(option.channel)
  if (localReason) return localReason
  if (!option.availableForUser) return option.reason ?? 'Canal indisponível para este utilizador.'
  return null
}

function optionDisabled(option: NotificationChannelCatalogItem): boolean {
  if (props.disabled) return true
  if (unavailableReason(option) && !selectedChannels.value.has(option.channel)) return true
  return selectedChannels.value.has(option.channel) && selectedChannels.value.size === 1
}

function toggleChannel(channel: NotificationChannel, selected: boolean): void {
  const option = options.value.find((item) => item.channel === channel)
  if (!option || optionDisabled(option)) return
  const next = new Set(selectedChannels.value)
  if (selected) next.add(channel)
  else next.delete(channel)
  if (next.size)
    emit(
      'update:modelValue',
      NOTIFICATION_CHANNELS.filter((item) => next.has(item)),
    )
}

function channelLabel(channel: NotificationChannel): string {
  const labels: Record<NotificationChannel, string> = {
    internal: 'Notificação interna',
    email: 'Email',
    whatsapp: 'WhatsApp',
    sms: 'SMS',
  }
  return labels[channel]
}
</script>

<template>
  <fieldset class="space-y-2" :disabled="disabled">
    <legend class="text-sm font-medium">Canais de notificação</legend>
    <p class="text-xs text-muted-foreground">
      Selecione ao menos um canal. Canais indisponíveis permanecem visíveis.
    </p>

    <div class="grid gap-2 sm:grid-cols-2">
      <label
        v-for="option in options"
        :key="option.channel"
        :data-channel="option.channel"
        class="flex items-start gap-3 rounded-md border p-3 transition-colors"
        :class="[
          unavailableReason(option)
            ? 'cursor-not-allowed bg-muted/40 text-muted-foreground opacity-60'
            : 'hover:bg-accent/50',
          { 'cursor-not-allowed': disabled },
        ]"
        :title="unavailableReason(option) ?? undefined"
      >
        <input
          type="checkbox"
          :checked="selectedChannels.has(option.channel)"
          :disabled="optionDisabled(option)"
          class="mt-0.5 h-4 w-4 shrink-0"
          :aria-label="channelLabel(option.channel)"
          @change="toggleChannel(option.channel, ($event.target as HTMLInputElement).checked)"
        />

        <span class="mt-0.5 shrink-0">
          <Bell v-if="option.channel === 'internal'" class="h-4 w-4" />
          <Mail v-else-if="option.channel === 'email'" class="h-4 w-4" />
          <WhatsAppIcon v-else-if="option.channel === 'whatsapp'" class="h-4 w-4" />
          <MessageSquareText v-else class="h-4 w-4" />
        </span>

        <span class="min-w-0">
          <span class="block text-sm font-medium">{{ channelLabel(option.channel) }}</span>
          <span v-if="unavailableReason(option)" class="mt-1 block text-xs">
            {{ unavailableReason(option) }}
          </span>
          <span
            v-else-if="option.channel === 'internal'"
            class="mt-1 block text-xs text-muted-foreground"
          >
            Alertas dentro da plataforma.
          </span>
        </span>
      </label>
    </div>
  </fieldset>
</template>
