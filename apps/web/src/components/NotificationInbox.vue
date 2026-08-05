<template>
  <DropdownMenu v-model="isOpen" align="end">
    <template #trigger="{ toggle }">
      <Button
        variant="outline"
        size="sm"
        class="relative h-9 w-9 p-0"
        :aria-label="t('notifications.openInbox')"
        :title="t('notifications.openInbox')"
        @click="toggle"
      >
        <Bell class="h-4 w-4" />
        <span
          v-if="unreadCount"
          class="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground"
          :aria-label="t('notifications.unreadCount', { count: unreadCount })"
        >
          {{ unreadCount > 99 ? '99+' : unreadCount }}
        </span>
      </Button>
    </template>

    <div class="w-[min(24rem,calc(100vw-2rem))]">
      <div class="flex items-center justify-between border-b px-3 py-2.5">
        <div>
          <p class="text-sm font-semibold">{{ t('notifications.title') }}</p>
          <p class="text-xs text-muted-foreground">
            {{ t('notifications.unreadCount', { count: unreadCount }) }}
          </p>
        </div>
        <button
          type="button"
          class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          :title="t('notifications.refresh')"
          :aria-label="t('notifications.refresh')"
          :disabled="isLoading"
          @click="() => refetch()"
        >
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isLoading }" />
        </button>
      </div>

      <div v-if="isLoading && notifications.length === 0" class="px-3 py-8 text-center">
        <LoaderCircle class="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        <p class="mt-2 text-xs text-muted-foreground">{{ t('common.loading') }}</p>
      </div>

      <div v-else-if="error" class="px-3 py-6 text-center text-sm text-destructive">
        {{ t('notifications.loadError') }}
      </div>

      <div
        v-else-if="notifications.length === 0"
        class="px-3 py-8 text-center text-sm text-muted-foreground"
      >
        <BellOff class="mx-auto mb-2 h-5 w-5" />
        {{ t('notifications.empty') }}
      </div>

      <div v-else class="max-h-[28rem] overflow-y-auto">
        <article
          v-for="notification in notifications"
          :key="notification.id"
          class="border-b px-3 py-3 last:border-b-0"
          :class="{ 'bg-primary/5': !notification.readAt }"
        >
          <div class="flex items-start gap-3">
            <span
              class="mt-1 h-2 w-2 shrink-0 rounded-full"
              :class="notification.readAt ? 'bg-muted-foreground/30' : 'bg-primary'"
              aria-hidden="true"
            />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold leading-5">{{ notification.title }}</p>
              <p class="mt-1 whitespace-pre-line text-sm leading-5 text-muted-foreground">
                {{ notification.body }}
              </p>
              <div class="mt-2 flex items-center justify-between gap-3">
                <time class="text-xs text-muted-foreground" :datetime="notification.createdAt">
                  {{ formatDate(notification.createdAt) }}
                </time>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-8 gap-1.5 px-2 text-xs"
                  :class="{ 'text-primary': !notification.readAt }"
                  :disabled="Boolean(notification.readAt) || acknowledgingId === notification.id"
                  :aria-label="
                    notification.readAt
                      ? t('notifications.acknowledged')
                      : t('notifications.acknowledge')
                  "
                  @click="acknowledge(notification.id)"
                >
                  <LoaderCircle
                    v-if="acknowledgingId === notification.id"
                    class="h-4 w-4 animate-spin"
                  />
                  <ThumbsUp v-else class="h-4 w-4" />
                  {{
                    notification.readAt
                      ? t('notifications.acknowledged')
                      : t('notifications.acknowledge')
                  }}
                </Button>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Bell, BellOff, LoaderCircle, RefreshCw, ThumbsUp } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import { useNotifications } from '@/features/notifications/useNotifications'

const { t, locale } = useI18n()
const isOpen = ref(false)
const {
  notifications,
  unreadCount,
  isLoading,
  error,
  refetch,
  acknowledge,
  acknowledgingId,
} = useNotifications()

watch(isOpen, (open) => {
  if (open) void refetch()
})

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}
</script>
