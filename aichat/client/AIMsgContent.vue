<template>
    <div class="msg-content">
        <div v-if="content === null" data-loading-dot="true" class="msg-content__loading">loading</div>
        <pre v-else>{{ content }}</pre>
    </div>
</template>


<script setup lang="ts">
import { ref } from 'vue';
import type { AIChatMessage } from '../base';
import { msgbox } from './ChatClient';

const content = ref<string | null>(null)
const emitter = defineEmits(['finish'])

const prop = defineProps<{
    msg: AIChatMessage,
    checkScrollBottom: (todo: () => void,smooth:boolean ) => void
}>()

const load = async () => {
    const text = (await msgbox.content(prop.msg.msgId)) ?? '<无信息>'
    content.value = text
    emitter('finish')
}

load()
</script>

<style>
.msg-content {
    overflow: hidden;
    word-break: break-all;
    word-wrap: break-word;
}

[data-loading-dot="true"] {
    &::after {
        content: '';
        animation: dotPulse 1.4s 0.4s infinite ease-in-out;
        ;
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