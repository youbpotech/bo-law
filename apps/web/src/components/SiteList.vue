<script setup lang="ts">
import Table from '@/components/ui/Table.vue'
import TableHeader from '@/components/ui/TableHeader.vue'
import TableBody from '@/components/ui/TableBody.vue'
import TableRow from '@/components/ui/TableRow.vue'
import TableHead from '@/components/ui/TableHead.vue'
import TableCell from '@/components/ui/TableCell.vue'
import Button from '@/components/ui/Button.vue'
</script>

<template>
  <div class="flex items-center justify-between">
    <h2 class="text-2xl font-semibold tracking-tight">{{ $t('dashboard.sites') }}</h2>
    <Button>{{ $t('dashboard.viewAll') }}</Button>
  </div>

  <div class="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{{ $t('users.name') }}</TableHead>
          <TableHead>{{ $t('users.email') }}</TableHead>
          <TableHead>{{ $t('common.status') }}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>João Silva</TableCell>
          <TableCell>joao@exemplo.com</TableCell>
          <TableCell>
            <span
              class="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800"
            >
              {{ $t('common.active') }}
            </span>
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Maria Santos</TableCell>
          <TableCell>maria@exemplo.com</TableCell>
          <TableCell>
            <span
              class="inline-flex items-center rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800"
            >
              {{ $t('common.pending') }}
            </span>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
