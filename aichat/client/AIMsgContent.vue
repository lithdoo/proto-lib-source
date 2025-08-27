<template>
    <div class="msg-content">
        <pre>{{ content }}</pre>
    </div>
</template>


<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { AIChatMessage } from '../base';
import { msgbox } from './ChatClient';

const content = ref('')
const emitter = defineEmits(['changed'])

const prop = defineProps<{
    msg: AIChatMessage
}>()

const load = async () => {
    content.value = await msgbox.content(prop.msg.msgId)
}

const sse = computed(()=> msgbox.msgSSE[prop.msg.msgId]?.total)

watch(sse,()=>{
    if(!sse.value) return
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
.msg-content{
    overflow: hidden;
    word-break: break-all;
    word-wrap: break-word;
    
}

</style>