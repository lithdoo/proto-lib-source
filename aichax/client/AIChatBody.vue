<template>
    <!-- 主要对话区域 -->
    <main class="main">
        <template v-for="value in model.list">
            <keep-alive>
                <component :is="AIConversation" :model="model" v-if="value.recordId === model.currentId"
                    :record="value" :key="value.recordId" />
                <div v-else></div>
            </keep-alive>
        </template>

        <AIConversation v-if="!model.currentId" :model="model"></AIConversation>
    </main>
</template>

<script lang="ts" setup>
import type { AIRcordModel } from './ChatClient'
import AIConversation from './AIConversation.vue'


const props = defineProps<{
    model: AIRcordModel
}>()



</script>
