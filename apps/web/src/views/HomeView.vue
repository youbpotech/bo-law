<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  BriefcaseBusiness,
  CalendarClock,
  Clock3,
  FileWarning,
  Flame,
  RefreshCw,
  Settings2,
  UsersRound,
  WalletCards,
} from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'
import type { DashboardWidgetKey } from '@/composables/useApi'
import { DEFAULT_DASHBOARD_WIDGETS, useDashboard } from '@/features/dashboard/useDashboard'

const { t, locale } = useI18n()
const { widgets, stats, isLoading, error, saveWidgets, isSaving, refresh } = useDashboard()

const isConfigOpen = ref(false)
const draftWidgets = ref<DashboardWidgetKey[]>([])
const configError = ref('')

const widgetOptions: Array<{ key: DashboardWidgetKey; icon: typeof UsersRound }> = [
  { key: 'totalLeads', icon: UsersRound },
  { key: 'hotLeads', icon: Flame },
  { key: 'pendingInterviews', icon: CalendarClock },
  { key: 'activeCases', icon: BriefcaseBusiness },
  { key: 'pendingDocuments', icon: FileWarning },
  { key: 'outstandingAmount', icon: WalletCards },
  { key: 'receivedAmount', icon: WalletCards },
  { key: 'rehydrationsDue', icon: Clock3 },
]

const enabledWidgetSet = computed(() => new Set(widgets.value))
const leadPipelineEntries = computed(() => Object.entries(stats.value?.leadPipeline ?? {}))
const casePipelineEntries = computed(() => Object.entries(stats.value?.casePipeline ?? {}))

watch(
  widgets,
  (value) => {
    if (!isConfigOpen.value) draftWidgets.value = [...value]
  },
  { immediate: true },
)

function openConfig(): void {
  draftWidgets.value = [...widgets.value]
  configError.value = ''
  isConfigOpen.value = true
}

function toggleWidget(key: DashboardWidgetKey): void {
  draftWidgets.value = draftWidgets.value.includes(key)
    ? draftWidgets.value.filter((widget) => widget !== key)
    : [...draftWidgets.value, key]
}

function resetWidgets(): void {
  draftWidgets.value = [...DEFAULT_DASHBOARD_WIDGETS]
  configError.value = ''
}

async function persistWidgets(): Promise<void> {
  configError.value = ''
  if (!draftWidgets.value.length) {
    configError.value = t('dashboard.selectOneWidget')
    return
  }
  try {
    await saveWidgets(draftWidgets.value)
    isConfigOpen.value = false
  } catch (caughtError) {
    configError.value =
      caughtError instanceof Error ? caughtError.message : t('dashboard.saveError')
  }
}

function widgetIcon(key: DashboardWidgetKey) {
  return widgetOptions.find((widget) => widget.key === key)?.icon ?? UsersRound
}

function widgetValue(key: DashboardWidgetKey): string | number {
  const data = stats.value
  if (!data) return 0
  if (key === 'outstandingAmount' || key === 'receivedAmount') {
    return new Intl.NumberFormat(locale.value, { style: 'currency', currency: 'EUR' }).format(
      Number(data[key]),
    )
  }
  return data[key]
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'short' }).format(new Date(value))
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">{{ $t('dashboard.title') }}</h1>
        <p class="text-muted-foreground">{{ $t('dashboard.subtitle') }}</p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" :disabled="isLoading" @click="refresh">
          <RefreshCw :class="['mr-2 h-4 w-4', isLoading ? 'animate-spin' : '']" />
          {{ $t('common.refresh') }}
        </Button>
        <Button variant="outline" @click="openConfig">
          <Settings2 class="mr-2 h-4 w-4" />
          {{ $t('dashboard.configure') }}
        </Button>
      </div>
    </div>

    <div
      v-if="error"
      class="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
    >
      {{ error instanceof Error ? error.message : $t('dashboard.loadError') }}
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article v-for="key in widgets" :key="key" class="rounded-xl border bg-card p-5 shadow-sm">
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm font-medium text-muted-foreground">
            {{ $t(`dashboard.widgets.${key}`) }}
          </p>
          <component :is="widgetIcon(key)" class="h-5 w-5 text-primary" />
        </div>
        <p class="mt-4 text-3xl font-bold tabular-nums">{{ isLoading ? '…' : widgetValue(key) }}</p>
      </article>
    </div>

    <div class="grid gap-6 xl:grid-cols-2">
      <section v-if="enabledWidgetSet.has('totalLeads')" class="rounded-xl border bg-card p-5">
        <div class="flex items-center gap-3 border-b pb-4">
          <UsersRound class="h-5 w-5 text-primary" />
          <h2 class="font-semibold">{{ $t('dashboard.leadPipeline') }}</h2>
        </div>
        <div v-if="leadPipelineEntries.length" class="mt-3 divide-y">
          <div
            v-for="[stage, count] in leadPipelineEntries"
            :key="stage"
            class="flex items-center justify-between py-3 text-sm"
          >
            <span>{{ $t(`dashboard.leadStages.${stage}`) }}</span>
            <strong class="rounded-full bg-muted px-3 py-1">{{ count }}</strong>
          </div>
        </div>
        <p v-else class="py-8 text-center text-sm text-muted-foreground">
          {{ $t('dashboard.noData') }}
        </p>
      </section>

      <section v-if="enabledWidgetSet.has('activeCases')" class="rounded-xl border bg-card p-5">
        <div class="flex items-center gap-3 border-b pb-4">
          <BriefcaseBusiness class="h-5 w-5 text-primary" />
          <h2 class="font-semibold">{{ $t('dashboard.casePipeline') }}</h2>
        </div>
        <div v-if="casePipelineEntries.length" class="mt-3 divide-y">
          <div
            v-for="[stage, count] in casePipelineEntries"
            :key="stage"
            class="flex items-center justify-between py-3 text-sm"
          >
            <span>{{ $t(`cases.stages.${stage}`) }}</span>
            <strong class="rounded-full bg-muted px-3 py-1">{{ count }}</strong>
          </div>
        </div>
        <p v-else class="py-8 text-center text-sm text-muted-foreground">
          {{ $t('dashboard.noData') }}
        </p>
      </section>
    </div>

    <div class="grid gap-6 xl:grid-cols-2">
      <section v-if="enabledWidgetSet.has('totalLeads')" class="rounded-xl border bg-card p-5">
        <h2 class="font-semibold">{{ $t('dashboard.recentLeads') }}</h2>
        <div v-if="stats?.recentLeads.length" class="mt-3 divide-y">
          <RouterLink
            v-for="lead in stats.recentLeads"
            :key="lead.id"
            to="/leads"
            class="flex items-center justify-between gap-4 py-3 text-sm hover:text-primary"
          >
            <div>
              <p class="font-medium">{{ lead.name || lead.phone }}</p>
              <p class="text-xs text-muted-foreground">{{ lead.phone }}</p>
            </div>
            <span class="text-xs text-muted-foreground">{{
              $t(`dashboard.leadStages.${lead.salesStage}`)
            }}</span>
          </RouterLink>
        </div>
        <p v-else class="py-8 text-center text-sm text-muted-foreground">
          {{ $t('dashboard.noData') }}
        </p>
      </section>

      <section v-if="enabledWidgetSet.has('activeCases')" class="rounded-xl border bg-card p-5">
        <h2 class="font-semibold">{{ $t('dashboard.recentCases') }}</h2>
        <div v-if="stats?.recentCases.length" class="mt-3 divide-y">
          <RouterLink
            v-for="legalCase in stats.recentCases"
            :key="legalCase.id"
            to="/cases"
            class="flex items-center justify-between gap-4 py-3 text-sm hover:text-primary"
          >
            <div>
              <p class="font-medium">{{ legalCase.title }}</p>
              <p class="text-xs text-muted-foreground">{{ legalCase.clientName }}</p>
            </div>
            <div class="text-right">
              <p class="text-xs">{{ $t(`cases.stages.${legalCase.stage}`) }}</p>
              <p class="text-xs text-muted-foreground">{{ formatDate(legalCase.updatedAt) }}</p>
            </div>
          </RouterLink>
        </div>
        <p v-else class="py-8 text-center text-sm text-muted-foreground">
          {{ $t('dashboard.noData') }}
        </p>
      </section>
    </div>
  </div>

  <Dialog
    :open="isConfigOpen"
    @update:open="
      (open) => {
        if (!open) isConfigOpen = false
      }
    "
  >
    <form class="space-y-5" @submit.prevent="persistWidgets">
      <div>
        <h2 class="text-xl font-semibold">{{ $t('dashboard.configTitle') }}</h2>
        <p class="text-sm text-muted-foreground">{{ $t('dashboard.configDescription') }}</p>
      </div>
      <div class="grid gap-2 sm:grid-cols-2">
        <label
          v-for="option in widgetOptions"
          :key="option.key"
          class="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm hover:bg-accent/50"
        >
          <input
            type="checkbox"
            class="h-4 w-4"
            :checked="draftWidgets.includes(option.key)"
            @change="toggleWidget(option.key)"
          />
          <component :is="option.icon" class="h-4 w-4 text-primary" />
          <span>{{ $t(`dashboard.widgets.${option.key}`) }}</span>
        </label>
      </div>
      <p v-if="configError" class="text-sm text-destructive">{{ configError }}</p>
      <div class="flex flex-wrap justify-between gap-2 border-t pt-4">
        <Button type="button" variant="ghost" @click="resetWidgets">{{
          $t('dashboard.restoreDefault')
        }}</Button>
        <div class="flex gap-2">
          <Button type="button" variant="outline" @click="isConfigOpen = false">{{
            $t('common.cancel')
          }}</Button>
          <Button type="submit" :disabled="isSaving">{{
            isSaving ? $t('common.loading') : $t('common.save')
          }}</Button>
        </div>
      </div>
    </form>
  </Dialog>
</template>
