<template>
    <header class="header">
        <div class="header__container">
            <div class="header__logo">
                <i class="fa fa-comments header__logo-icon"></i>
                <h1 class="header__logo-text">SSE AI对话助手</h1>
            </div>
            <div class="header__title">{{ control.title() }}</div>
            <div class="header__actions">
                <button class="header__button" @click="control.focusNew()">
                    <i class="fa fa-history"></i>
                    <span class="header__button-text">新会话</span>
                </button>
                <button class="header__button" @click="control.toggle()">
                    <i class="fa fa-history"></i>
                    <span class="header__button-text">历史记录</span>
                </button>
            </div>
        </div>
        <div class="record_container" :ref="val => control.setOuter(val as any)">
            <div class="record-grid" :ref="val => control.setInner(val as any)">
                <li v-for="record in control.list()" :data-actived="control.records.currentId === record.recordId"
                    class="record-item__item" @click="control.focusTo(record.recordId)">
                    <span class="record-item__preview">{{ record.title || '新会话' }}</span>
                    <span class="record-item__time">8/20 13:24</span>
                    <button class="record-item__action">
                        <i class="fa fa-trash-o"></i>
                    </button>
                </li>
            </div>
        </div>
    </header>
</template>


<script lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { AIChatRecord } from '../base';
export const newRecord = reactive(new class BlankReocrd implements AIChatRecord {
    recordId = null as unknown as string
    title = ''
    updateTimestamp = new Date().getTime()
    createTimestamp = new Date().getTime()
})


export interface AIRecords {
    currentId: string | null
    list: AIChatRecord[]
    refresh(): Promise<void>
}


class AIRecordControl {
    show = false
    outer: HTMLElement | null = null
    inner: HTMLElement | null = null

    constructor(
        public records: AIRecords
    ) {

    }

    focusNew() {
        this.records.currentId = null
    }

    focusTo(id: string | null) {
        this.records.currentId = id
    }

    title() {
        const title = this.records.list
            .find(v => v.recordId === this.records.currentId)
            ?.title
        return title || '新会话'
    }

    list() {
        return (this.blank ? [this.blank] : []).concat(this.records.list)
    }

    init() {
        watch(computed(() => this.show), () => {
            console.log('watch')
            this.updateHeight()
        })

        watch(computed(() => this.records.currentId), () => {
            if (!this.records.currentId && !this.blank) {
                this.createBlank()
            }
            this.show = false
        })

        if (!this.records.currentId) {
            this.createBlank()
        }
        this.updateHeight()
    }

    blank: AIChatRecord | null = null

    createBlank() {
        this.blank = newRecord
    }

    setOuter(ele: HTMLElement) {
        this.outer = ele
    }
    setInner(ele: HTMLElement) {
        this.inner = ele
    }
    toggle() {
        this.show = !this.show
    }
    updateHeight() {
        console.log('updateHeight', this.outer, this.inner)
        if (this.show) {
            const outer = this.outer
            const inner = this.inner
            if (outer && inner) {
                outer.style.height = inner.clientHeight + 'px'
                setTimeout(() => {
                    if (this.show) {
                        outer.style.height = 'auto'
                    }
                }, 200)
            }

        } else {
            const outer = this.outer
            const inner = this.inner
            if (outer && inner) {
                outer.style.height = inner.clientHeight + 'px'
                setTimeout(() => {
                    if (!this.show) {
                        outer.style.height = '0'
                    }
                })
            }
        }
    }
}


</script>

<script lang="ts" setup>
import type { AIRcordModel } from './ChatClient';

const props = defineProps<{
    model: AIRcordModel
}>()


const control = reactive(new AIRecordControl(props.model))


onMounted(() => {
    control.init()
})

</script>

<style lang="scss" scoped>
.record_container {
    overflow: hidden;
    /* 元素间隙12px */
    transition: all 0.2s ease-in-out;
}

.record-grid {
    max-width: 800px;
    max-height: 30vh;
    overflow: auto;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
    padding: 12px 0;
    margin: 0 auto;
}

.record-item {
    list-style: none;
}

.record-item__item {
    padding: 12px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
    margin-bottom: 4px;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;

    &[data-actived="true"] {
        background-color: #eff6ff;
        border-left: 3px solid #3B82F6;
    }
}

.record-item__item:hover {
    background-color: #f3f4f6;
}

.record-item__preview {
    font-size: 14px;
    color: #1F2937;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.record-item__time {
    font-size: 12px;
    color: #6B7280;
}

.record-item__action {
    position: absolute;
    top: 8px;
    right: 8px;
    color: #9CA3AF;
    background: none;
    border: none;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s, color 0.2s;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.record-item__item:hover .record-item__action {
    opacity: 1;
}

.record-item__action:hover {
    color: #DC2626;
    background-color: #fef2f2;
}

/* 头部样式 */
.header {
    background-color: #ffffff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    padding: 16px 24px;
    position: sticky;
    top: 0;
    z-index: 10;
}

.header__container {
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.header__logo {
    display: flex;
    align-items: center;
    gap: 8px;
}

.header__logo-icon {
    color: #3B82F6;
    font-size: 24px;
}

.header__logo-text {
    font-size: 18px;
    font-weight: bold;
    color: #1F2937;
}

.header__actions {
    display: flex;
    align-items: center;
    gap: 16px;
}

.header__button {
    background-color: #3B82F6;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 8px 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    transition: background-color 0.3s;
}

.header__button:hover {
    background-color: #2563EB;
}
</style>