<template>
    <div class="msg-content">
        <div v-if="sseLoading" data-loading-dot="true" class="msg-content__loading">loading</div>
        <pre v-else>{{ content }}</pre>
    </div>
</template>


<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { AIChatMessage } from '../base';
import { msgbox } from './ChatClient';

const content = ref('')
const emitter = defineEmits(['changed'])

const prop = defineProps<{
    msg: AIChatMessage
}>()

const load = async () => {
    content.value = await msgbox.content(prop.msg.msgId)
}

const sse = computed(() => msgbox.msgSSE[prop.msg.msgId]?.total)

const sseLoading = computed(() => {
    return msgbox.msgSSE[prop.msg.msgId] && (!msgbox.msgSSE[prop.msg.msgId].total)
})

watch(sse, () => {
    if (!sse.value) return
    content.value = sse.value
})



watch(computed(() => prop.msg.msgId), () => load())

watch(content, async () => {
    await nextTick()
    emitter('changed')
})

load()
</script>

<style>
.msg-content {
    overflow: hidden;
    word-break: break-all;
    word-wrap: break-word;
}

[data-loading-dot="true"]{
    &::after{
        content:'';
        animation: dotPulse 1.4s 0.4s infinite ease-in-out;;
    }
}


/* 省略号动画 */
@keyframes dotPulse {

    0%,
    100% {
        content: '.';
    }

    30% {
        
        content: '..';
    }
    
    66% {
        
        content: '...';
    }
}
</style>