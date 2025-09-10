<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { GraphView } from './GraphView'

const props = defineProps<{ view: GraphView }>()

const view = computed(() => props.view)

const dom = ref<HTMLDivElement>()

const load = (container: HTMLElement) => {
  view.value.loadContainer(container)
}

onMounted(() => {
  if (dom.value) load(dom.value)
})
</script>

<template>
  <div class="graph-view" ref="dom"></div>
</template>

<style lang="scss" scoped>
.graph-view {
  height: 100%;
  background-color: rgb(2, 8, 23);
}
</style>
