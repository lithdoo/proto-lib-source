<template>
    <div class="ai-chat">
        <!-- 顶部导航栏 -->
        <AIChatHeader class="ai-chat__header"></AIChatHeader>

        <!-- 主要对话区域 -->

        <AIChatBody class="ai-chat__main"></AIChatBody>

    </div>

</template>

<script lang="ts" setup>

import AIChatHeader from './AIChatHeader.vue'
import AIChatBody from './AIChatBody.vue'

if (!document.head.querySelector('link#font-css')) {
    const link = document.createElement('link')
    link.href = "https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css"
    link.setAttribute('ref', 'stylesheet')
    link.id = 'font-css'
    document.head.appendChild(link)
}

</script>

<style lang="scss" scoped>
.ai-chat {
    height: 100%;
    display: flex;
    position: relative;
    flex-direction: column;

    .ai-chat__header {
        position: static !important;
        flex: 0 0 auto;
    }

    .ai-chat__main {
        position: static !important;
        flex: 1 1 0;
        height: 0;
        overflow: auto;
        background-color: #f6f6f6;
    }
}



/* 基础样式重置 */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

// body {
//     background-color: #f5f5f5;
//     min-height: 100vh;
//     display: flex;
//     flex-direction: column;
// }



/* 主内容区样式 */
// .main {
//     // flex-grow: 1;
// }
</style>