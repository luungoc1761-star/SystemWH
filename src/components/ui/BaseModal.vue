<script setup lang="ts">
defineProps<{
  show: boolean
}>()
const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="emit('close')">
      <slot />
    </div>
  </Teleport>
</template>
