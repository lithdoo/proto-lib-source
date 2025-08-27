<template>
    <!-- 主要对话区域 -->
    <main class="main">
        <template v-for="value in record.list">
            <keep-alive>
                <component :is="AIConversation" v-if="value.recordId === record.currentId" :record="value" :key="value.recordId"/>
                <div v-else ></div>
            </keep-alive>
        </template>

        <AIConversation v-if="!record.currentId"></AIConversation>
    </main>
</template>

<script lang="ts" setup>
import { record } from './ChatClient'
import AIConversation from './AIConversation.vue'

</script>
