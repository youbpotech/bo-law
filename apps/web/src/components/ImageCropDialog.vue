<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description: string
    assetName: string
    requirements: string[]
    outputWidth: number
    outputHeight: number
    sourceMinWidth: number
    sourceMinHeight: number
    sourceMaxBytes: number
    outputMaxBytes: number
    confirmLabel: string
    readyLabel: string
    sourceMaxDimension?: number
  }>(),
  { sourceMaxDimension: 16000 },
)

const emit = defineEmits<{
  'update:open': [open: boolean]
  confirm: [dataUrl: string]
}>()

const { t } = useI18n()
const canvas = ref<HTMLCanvasElement | null>(null)
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const sourceLoaded = ref(false)
const sourceDimensions = ref<{ width: number; height: number } | null>(null)
const sourceFileName = ref('')
const errorMessage = ref('')
let image: HTMLImageElement | null = null
let activePointerId: number | null = null
let lastPointerX = 0
let lastPointerY = 0

function reset(): void {
  image = null
  sourceLoaded.value = false
  sourceDimensions.value = null
  sourceFileName.value = ''
  errorMessage.value = ''
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

watch(
  () => props.open,
  (open) => {
    if (!open) reset()
  },
)

function close(): void {
  emit('update:open', false)
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error(t('imageCrop.invalidFile')))
    reader.onerror = () => reject(new Error(t('imageCrop.readError')))
    reader.readAsDataURL(file)
  })
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const loadedImage = new Image()
    loadedImage.onload = () => resolve(loadedImage)
    loadedImage.onerror = () => reject(new Error(t('imageCrop.dimensionReadError')))
    loadedImage.src = dataUrl
  })
}

async function createCropImage(sourceImage: HTMLImageElement): Promise<HTMLImageElement> {
  const maxDimension = Math.max(sourceImage.naturalWidth, sourceImage.naturalHeight)
  const workingMaxDimension = Math.max(2400, props.outputWidth, props.outputHeight)
  if (maxDimension <= workingMaxDimension) return sourceImage

  const scale = workingMaxDimension / maxDimension
  const resizeCanvas = document.createElement('canvas')
  resizeCanvas.width = Math.round(sourceImage.naturalWidth * scale)
  resizeCanvas.height = Math.round(sourceImage.naturalHeight * scale)
  const context = resizeCanvas.getContext('2d')
  if (!context) throw new Error(t('imageCrop.cropError', { asset: props.assetName }))
  context.drawImage(sourceImage, 0, 0, resizeCanvas.width, resizeCanvas.height)
  const resizedImage = await loadImage(resizeCanvas.toDataURL('image/webp', 0.92))
  sourceImage.src = ''
  return resizedImage
}

function drawPreview(): void {
  const target = canvas.value
  if (!target || !image) return
  const context = target.getContext('2d')
  if (!context) return

  const baseScale = Math.max(
    props.outputWidth / image.naturalWidth,
    props.outputHeight / image.naturalHeight,
  )
  const scale = baseScale * zoom.value
  const width = image.naturalWidth * scale
  const height = image.naturalHeight * scale
  const overflowX = Math.max(0, (width - props.outputWidth) / 2)
  const overflowY = Math.max(0, (height - props.outputHeight) / 2)
  const x = (props.outputWidth - width) / 2 + panX.value * overflowX
  const y = (props.outputHeight - height) / 2 + panY.value * overflowY

  context.clearRect(0, 0, props.outputWidth, props.outputHeight)
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, props.outputWidth, props.outputHeight)
  context.drawImage(image, x, y, width, height)
}

watch([zoom, panX, panY], drawPreview)

function handlePointerDown(event: PointerEvent): void {
  activePointerId = event.pointerId
  lastPointerX = event.clientX
  lastPointerY = event.clientY
  canvas.value?.setPointerCapture(event.pointerId)
}

function handlePointerMove(event: PointerEvent): void {
  if (activePointerId !== event.pointerId || !canvas.value || !image) return
  const rect = canvas.value.getBoundingClientRect()
  const scale =
    Math.max(props.outputWidth / image.naturalWidth, props.outputHeight / image.naturalHeight) *
    zoom.value
  const overflowX = Math.max(0, (image.naturalWidth * scale - props.outputWidth) / 2)
  const overflowY = Math.max(0, (image.naturalHeight * scale - props.outputHeight) / 2)
  const deltaX = ((event.clientX - lastPointerX) * props.outputWidth) / rect.width
  const deltaY = ((event.clientY - lastPointerY) * props.outputHeight) / rect.height
  if (overflowX > 0) panX.value = Math.max(-1, Math.min(1, panX.value + deltaX / overflowX))
  if (overflowY > 0) panY.value = Math.max(-1, Math.min(1, panY.value + deltaY / overflowY))
  lastPointerX = event.clientX
  lastPointerY = event.clientY
}

function handlePointerUp(event: PointerEvent): void {
  if (activePointerId !== event.pointerId) return
  canvas.value?.releasePointerCapture(event.pointerId)
  activePointerId = null
}

async function handleUpload(event: Event): Promise<void> {
  reset()
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      throw new Error(t('imageCrop.formatError', { asset: props.assetName }))
    }
    if (file.size > props.sourceMaxBytes) {
      throw new Error(t('imageCrop.sourceSizeError', { size: props.sourceMaxBytes / 1024 / 1024 }))
    }
    const dataUrl = await readFileAsDataUrl(file)
    const loadedImage = await loadImage(dataUrl)
    const width = loadedImage.naturalWidth
    const height = loadedImage.naturalHeight
    if (
      width < props.sourceMinWidth ||
      height < props.sourceMinHeight ||
      width > props.sourceMaxDimension ||
      height > props.sourceMaxDimension
    ) {
      throw new Error(
        t('imageCrop.sourceDimensionsError', {
          minWidth: props.sourceMinWidth,
          minHeight: props.sourceMinHeight,
          max: props.sourceMaxDimension,
        }),
      )
    }

    image = await createCropImage(loadedImage)
    sourceDimensions.value = { width, height }
    sourceFileName.value = file.name
    sourceLoaded.value = true
    await nextTick()
    drawPreview()
  } catch (error) {
    input.value = ''
    errorMessage.value =
      error instanceof Error
        ? error.message
        : t('imageCrop.invalidAsset', { asset: props.assetName })
  }
}

function canvasToDataUrl(): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.value?.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(t('imageCrop.cropError', { asset: props.assetName })))
          return
        }
        if (blob.size > props.outputMaxBytes) {
          reject(
            new Error(
              t('imageCrop.outputSizeError', {
                asset: props.assetName,
                size: props.outputMaxBytes / 1024 / 1024,
              }),
            ),
          )
          return
        }
        const reader = new FileReader()
        reader.onload = () =>
          typeof reader.result === 'string'
            ? resolve(reader.result)
            : reject(new Error(t('imageCrop.cropError', { asset: props.assetName })))
        reader.onerror = () =>
          reject(new Error(t('imageCrop.cropError', { asset: props.assetName })))
        reader.readAsDataURL(blob)
      },
      'image/webp',
      0.9,
    )
  })
}

async function confirm(): Promise<void> {
  if (!canvas.value || !image) return
  errorMessage.value = ''
  try {
    emit('confirm', await canvasToDataUrl())
    close()
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : t('imageCrop.cropError', { asset: props.assetName })
  }
}
</script>

<template>
  <Dialog
    :open="open"
    class="max-h-[90vh] max-w-xl overflow-y-auto"
    @update:open="(value) => !value && close()"
  >
    <div class="space-y-1">
      <h2 class="text-xl font-semibold">{{ title }}</h2>
      <p class="text-sm text-muted-foreground">{{ description }}</p>
    </div>

    <div class="rounded-md border bg-muted/40 p-4 text-sm">
      <p class="font-medium">{{ $t('imageCrop.requirementsTitle') }}</p>
      <ul class="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
        <li v-for="requirement in requirements" :key="requirement">{{ requirement }}</li>
      </ul>
    </div>

    <div class="space-y-2">
      <label class="text-sm font-medium">{{ $t('imageCrop.chooseFile') }}</label>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        class="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-secondary-foreground"
        @change="handleUpload"
      />
    </div>

    <div v-if="sourceLoaded" class="space-y-3">
      <div>
        <p class="text-sm font-medium">{{ $t('imageCrop.cropTitle') }}</p>
        <p class="text-xs text-muted-foreground">{{ $t('imageCrop.cropHelp') }}</p>
      </div>
      <div class="overflow-hidden rounded-md border bg-muted shadow-inner">
        <canvas
          ref="canvas"
          :width="outputWidth"
          :height="outputHeight"
          class="block w-full cursor-grab touch-none active:cursor-grabbing"
          :style="{ aspectRatio: `${outputWidth} / ${outputHeight}` }"
          @pointerdown="handlePointerDown"
          @pointermove="handlePointerMove"
          @pointerup="handlePointerUp"
          @pointercancel="handlePointerUp"
        />
      </div>
      <label class="block space-y-1 text-sm">
        <span class="font-medium">{{ $t('imageCrop.zoom') }}</span>
        <input
          v-model.number="zoom"
          type="range"
          min="1"
          max="3"
          step="0.01"
          class="w-full accent-primary"
        />
      </label>
      <p class="text-xs text-muted-foreground">
        {{ sourceFileName }} · {{ sourceDimensions?.width }} × {{ sourceDimensions?.height }} px
      </p>
      <p class="text-sm text-primary">{{ readyLabel }}</p>
    </div>

    <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>

    <div class="flex justify-end gap-2 pt-2">
      <Button type="button" variant="outline" @click="close">{{ $t('common.cancel') }}</Button>
      <Button type="button" :disabled="!sourceLoaded" @click="confirm">{{ confirmLabel }}</Button>
    </div>
  </Dialog>
</template>
