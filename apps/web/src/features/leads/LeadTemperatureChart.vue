<script setup lang="ts">
import { computed } from 'vue'
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js'
import { Doughnut } from 'vue-chartjs'
import type { LeadsResponse } from './types'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps<{ summary?: LeadsResponse['summary'] }>()

const chartData = computed(() => ({
  labels: ['Qualificação fria', 'Qualificação morna', 'Qualificação quente'],
  datasets: [
    {
      data: [
        props.summary?.byLevel.frio ?? 0,
        props.summary?.byLevel.morno ?? 0,
        props.summary?.byLevel.quente ?? 0,
      ],
      backgroundColor: ['#64748b', '#d97706', '#dc2626'],
      borderWidth: 0,
      spacing: 2,
    },
  ],
}))
</script>

<template>
  <div class="mx-auto h-36 w-36">
    <Doughnut
      :data="chartData"
      :options="{
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: { legend: { display: false } },
      }"
    />
  </div>
</template>
