<template>
    <div class="msg-content">
        <div v-if="showLoading" data-loading-dot="true" class="msg-content__loading">loading</div>
        <div v-if="errorMsg" class="msg-content__error">[ {{ errorMsg }} ]</div>
        <div ref="container" :style="{ height: (showLoading || errorMsg) ? '0' : 'auto' }"></div>
    </div>
</template>


<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { AIChatMessage } from '../base';
import { msgbox } from './ChatClient';
import { CacheRootViewNode, renderer, RootViewNode } from './ASTNode/render';

const emitter = defineEmits(['finish'])

const prop = defineProps<{
    msg: AIChatMessage,
    checkScrollBottom: (todo: () => void, smooth: boolean) => void
}>()

const container = ref<HTMLElement>(null as any)

const root = new CacheRootViewNode(renderer)

const errorMsg = ref<string | null>(null)

onMounted(() => {
    container.value.innerHTML = ''
    container.value.appendChild(root.target)
})

const showLoading = ref<boolean>(true)

const load = async () => {
    if (!msgbox.msgSSE[prop.msg.msgId]) {
        const content = await msgbox.content(prop.msg.msgId)
        if (!content.trim()) {
            errorMsg.value = '生成错误'
        } else {
            root.update(content)
        }
        showLoading.value = false
    } else {
        if (msgbox.msgSSE[prop.msg.msgId].total) {
            showLoading.value = false
        }
    }
    emitter('finish')
}

const sse = computed(() => msgbox.msgSSE[prop.msg.msgId]?.total ?? '')


watch(sse, () => {
    if (!sse.value) return
    if (showLoading.value) showLoading.value = false
    const content = sse.value
    prop.checkScrollBottom(() => {
        root.update(content)
    }, true)
})

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


<style>
/* ==============================================
   Markdown 基础容器样式（建议外层包裹容器添加此类）
   ============================================== */
.markdown-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 0 1.5rem;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
    line-height: 1.7;
    color: #333647;
    background-color: #ffffff;
}

/* ==============================================
   标题类（h1-h6）样式
   ============================================== */
.markdown-container h1,
.markdown-container h2,
.markdown-container h3,
.markdown-container h4,
.markdown-container h5,
.markdown-container h6 {
    margin-top: 2.5rem;
    margin-bottom: 1rem;
    font-weight: 600;
    color: #222430;
    line-height: 1.3;
}

.markdown-container h1 {
    font-size: 2.2rem;
    border-bottom: 2px solid #f0f0f2;
    padding-bottom: 0.8rem;
    margin-top: 0;
}

.markdown-container h2 {
    font-size: 1.8rem;
    border-bottom: 1px solid #f0f0f2;
    padding-bottom: 0.6rem;
}

.markdown-container h3 {
    font-size: 1.5rem;
}

.markdown-container h4 {
    font-size: 1.3rem;
}

.markdown-container h5,
.markdown-container h6 {
    font-size: 1.1rem;
}

/* ==============================================
   段落 & 文本基础样式
   ============================================== */
.markdown-container p {
    margin: 1.2rem 0;
    text-align: justify;
}

/* 粗体 */
.markdown-container strong {
    font-weight: 600;
    color: #222430;
}

/* 斜体 */
.markdown-container em {
    color: #4a4d60;
    font-style: italic;
}

/* 删除线 */
.markdown-container del {
    text-decoration: line-through;
    color: #8a8d9b;
}

/* ==============================================
   链接 & 图片样式
   ============================================== */
/* 链接 */
.markdown-container a {
    color: #2563eb;
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: all 0.2s ease;
}

.markdown-container a:hover {
    color: #1d4ed8;
    border-bottom-color: #1d4ed8;
}

.markdown-container a:focus {
    outline: 2px solid #bfdbfe;
    outline-offset: 2px;
    border-radius: 2px;
}

/* 图片（支持响应式） */
.markdown-container img {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
    margin: 1.5rem auto;
    display: block;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* ==============================================
   列表样式（有序列表/无序列表）
   ============================================== */
.markdown-container ul,
.markdown-container ol {
    margin: 1.2rem 0;
    padding-left: 1.8rem;
}

.markdown-container li {
    margin: 0.6rem 0;
    padding-left: 0.5rem;
}

/* 无序列表符号样式 */
.markdown-container ul {
    list-style-type: disc;
}

.markdown-container ul ul {
    list-style-type: circle;
    margin-top: 0.3rem;
    margin-bottom: 0.3rem;
}

/* 有序列表数字样式 */
.markdown-container ol {
    list-style-type: decimal;
}

.markdown-container ol ol {
    list-style-type: lower-alpha;
    margin-top: 0.3rem;
    margin-bottom: 0.3rem;
}

/* ==============================================
   引用块样式
   ============================================== */
.markdown-container blockquote {
    margin: 1.5rem 0;
    padding: 1.2rem 1.5rem;
    border-left: 4px solid #2563eb;
    background-color: #f8fafc;
    border-radius: 0 4px 4px 0;
    color: #4a4d60;
}

.markdown-container blockquote p {
    margin: 0;
}

/* ==============================================
   代码块 & 行内代码样式
   ============================================== */
/* 行内代码 */
.markdown-container .inline-code {
    padding: 0.2rem 0.4rem;
    font-family: "Fira Code", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.9rem;
    background-color: #f0f0f2;
    color: #dc2626;
    border-radius: 4px;
    white-space: nowrap;
}

/* 代码块容器 */
.markdown-container pre {
    margin: 1.5rem 0;
    padding: 1.2rem;
    background-color: #222430;
    border-radius: 6px;
    overflow-x: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* 代码块内容 */
.markdown-container pre code {
    font-family: "Fira Code", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.9rem;
    color: #e2e8f0;
    line-height: 1.6;
    white-space: pre;
}

/* 代码块语言标识（若后续扩展语法高亮可复用） */
.markdown-container pre code.language-js,
.markdown-container pre code.language-typescript,
.markdown-container pre code.language-css {
    /* 可针对不同语言添加特定样式，此处预留 */
}

/* ==============================================
   分割线样式
   ============================================== */
.markdown-container hr {
    border: none;
    border-top: 1px solid #f0f0f2;
    margin: 2.5rem 0;
}

/* ==============================================
   响应式适配（移动端优化）
   ============================================== */
@media (max-width: 768px) {
    .markdown-container {
        padding: 1.5rem 1rem;
        line-height: 1.6;
    }

    .markdown-container h1 {
        font-size: 1.8rem;
        padding-bottom: 0.6rem;
    }

    .markdown-container h2 {
        font-size: 1.5rem;
        padding-bottom: 0.5rem;
    }

    .markdown-container h3 {
        font-size: 1.3rem;
    }

    .markdown-container blockquote {
        padding: 1rem 1.2rem;
    }

    .markdown-container pre {
        padding: 1rem;
    }
}
</style>