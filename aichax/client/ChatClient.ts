import { computed, reactive, watch } from "vue"
import { type AIRecords } from "./AIChatHeader.vue"
import { AIChatMessage, AIChatRecord } from "../base"






export class SSEMessage {

    total: string = ''
    source?: EventSource
    constructor(public msgId: string) { }


    start() {
        this.source = new EventSource(`/ai/message/content/sse/${this.msgId}`);

        this.source.onmessage = (event) => {
            const data = event.data
            try {
                const { type, content } = JSON.parse(data)
                if (type === 'chunk') {
                    this.total = this.total + content
                } else if (type === 'init') {
                    this.total = content
                } else if (type === 'done') {
                    this.source?.close()
                    this.onClose?.()
                }
                console.log(this.total)
            } catch (e) {
                console.error(e)
            }
        }
    }

    onClose?: () => void
}


export class MsgBox {
    msgList: { [key: string]: AIChatMessage[] } = {}
    msgContent: { [key: string]: string } = {}
    msgSSE: { [key: string]: SSEMessage } = {}


    async reload(recordId: string) {
        const res = await fetch(`/ai/message/list/${recordId}`)
        const data = await res.json()
        this.msgList[recordId] = data
        const unfinished = this.msgList[recordId].filter(v => {
            return v.unfinished
        }).forEach(msg => {
            if (this.msgSSE[msg.msgId]) return
            const sse = reactive(new SSEMessage(msg.msgId))
            this.msgSSE[msg.msgId] = sse
            sse.start()
            sse.onClose = () => {
                delete this.msgSSE[msg.msgId]
            }
        })

    }

    async content(msgId: string, useCache = true) {
        if ((!useCache) && this.msgContent[msgId]) return this.msgContent[msgId]
        const res = await fetch(`/ai/message/content/${msgId}`)
        const data = await res.text()
        this.msgContent[msgId] = data
        return data
    }


}



export class AIRcordModel implements AIRecords {
    currentId: string | null = null
    list: AIChatRecord[] = []
    msgbox: MsgBox = reactive(new MsgBox())

    async refresh(): Promise<void> {
        if (this.currentId) {
            this.msgbox.reload(this.currentId)
        }
    }

    async loadRecords() {
        const res = await fetch('/ai/record/list')
        const data = await res.json()
        this.list = data
    }

    async init() {
        await this.loadRecords()
        watch(computed(() => this.currentId), () => {
            console.log(this.currentId)
            this.refresh()
        })

        // this.send('请生成一个图书管理系统的实体结构')
    }

    async send(content: string) {
        const data = {
            recordId: this.currentId || null,
            content
        }

        const res = await fetch('/ai/chat', {
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST'
        })

        const { recordId } = await res.json()

        if (recordId !== this.currentId) {
            console.log({ recordId })
            await this.loadRecords()
            this.currentId = recordId
        }
        this.refresh()
    }
}


// export const record = reactive(new AIRcordModel)

// export const newRecord = reactive(new class BlankReocrd implements AIChatRecord {
//     recordId = null as unknown as string
//     title = ''
//     updateTimestamp = new Date().getTime()
//     createTimestamp = new Date().getTime()
// })


// record.init()