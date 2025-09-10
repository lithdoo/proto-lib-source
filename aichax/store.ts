import path from "node:path";
import fs from "node:fs";
import { AIChatMessage, AIChatRecord, DeepSeekMessage } from "./base";

const key = 'sk-5069284b93a7481db08a15f65628906a'



export interface AIChatDataStore {
    fetchRecordList(): AIChatRecord[]
    updateRecord(record: AIChatRecord): void
    fetchRecordMessage(recordId: string): AIChatMessage[]
    fetchMsgContent(msgId: string): string
    updateRecordMessage(recordId: string, msg: AIChatMessage): void
    updateMsgContent(msgId: string, content: string): void
}


export interface AiChartStreamStore extends AIChatDataStore {
    isProcessing(msgId: string): boolean
    onMsgChunk?: (msgId: string, chunk: string, isDone: boolean) => void
}


export class AIChatFileStore implements AIChatDataStore {

    constructor(
        public targetDir: string
    ) {
        try {
            fs.accessSync(targetDir)
        } catch (_e) {
            fs.mkdirSync(targetDir, { recursive: true })
        }

    }

    loadedRecords: AIChatRecord[] | null = null
    loadedMessage: Map<string, AIChatMessage[]> = new Map()

    get recordFilePath() {
        const recordFilePath = path.join(this.targetDir, 'record.index.json')
        try {
            fs.accessSync(recordFilePath)
        } catch (_e) {
            fs.writeFileSync(recordFilePath, JSON.stringify([]))
        }
        return path.join(this.targetDir, 'record.index.json')
    }

    get messageDirPath() {
        const dir = path.join(this.targetDir, 'message')
        try {
            fs.accessSync(dir)
        } catch (e) {
            fs.mkdirSync(dir, { recursive: true })
        }
        return dir
    }
    get contentDirPath() {
        const dir = path.join(this.targetDir, 'content')
        try {
            fs.accessSync(dir)
        } catch (e) {
            fs.mkdirSync(dir, { recursive: true })
        }
        return dir
    }

    fetchRecordList(): AIChatRecord[] {
        if (this.loadedRecords) return this.loadedRecords
        try {
            fs.accessSync(this.recordFilePath)
            const text = fs.readFileSync(this.recordFilePath).toString()
            return this.loadedRecords = JSON.parse(text)
        } catch (e) {
            console.log(e)
            return []
        }
    }

    updateRecord(record: AIChatRecord) {
        const newone = [record].concat(this.fetchRecordList().filter(v => v.recordId !== record.recordId))
        fs.accessSync(this.recordFilePath)
        fs.writeFileSync(this.recordFilePath, JSON.stringify(newone, null, 2))
        this.loadedRecords = newone
    }


    fetchRecordMessage(recordId: string): AIChatMessage[] {
        const msg = this.loadedMessage.get(recordId)
        if (msg) return msg

        const filePath = path.resolve(this.messageDirPath, `${recordId}.json`)
        try {
            fs.accessSync(filePath)
            const text = fs.readFileSync(filePath).toString()
            const msg = JSON.parse(text)
            this.loadedMessage.set(recordId, msg)
            return msg
        } catch (e) { return [] }
    }

    updateRecordMessage(recordId: string, msg: AIChatMessage) {
        delete msg.unfinished
        const msgList = this.fetchRecordMessage(recordId)
        const newone = [msg].concat(msgList.filter(v => v.msgId !== msg.msgId))
        const filePath = path.resolve(this.messageDirPath, `${recordId}.json`)
        // fs.accessSync(filePath)
        fs.writeFileSync(filePath, JSON.stringify(newone, null, 2))
        this.loadedMessage.set(recordId, newone)
    }


    fetchMsgContent(msgId: string) {
        const filePath = path.resolve(this.contentDirPath, `${msgId}`)
        try {
            fs.accessSync(filePath)
            const text = fs.readFileSync(filePath).toString()
            return text
        } catch (e) {
            return ''
        }
    }

    updateMsgContent(msgId: string, content: string) {
        const filePath = path.resolve(this.contentDirPath, `${msgId}`)
        if (fs.existsSync(filePath)) {
            fs.appendFileSync(filePath, content)
        } else {
            fs.writeFileSync(filePath, content)
        }
    }
}


export class AIChatStreamFileStore extends AIChatFileStore implements AiChartStreamStore {

    onMsgChunk?: (msgId: string, chunk: string, isDone: boolean) => void

    // 用于控制 chunk 更新频率,并记录当前正处于更新的消息
    updateChunkTimeout = new Map<string, { content: string, timeout: any, total: string }>

    fetchMsgContent(msgId: string) {
        const timeout = this.updateChunkTimeout.get(msgId)
        if(timeout) return timeout.total
        return super.fetchMsgContent(msgId)
    }


    fetchRecordMessage(recordId: string) {
        console.log('fetchRecordMessage', recordId)
        const list = super.fetchRecordMessage(recordId)
        return list.map(v => ({
            ...v,
            unfinished: !!this.updateChunkTimeout.has(v.msgId),
            error: v.error ?? (v.unfinished && !this.updateChunkTimeout.has(v.msgId) ? 'unfinished' : undefined)
        }))
    }

    isProcessing(msgId: string) {
        return this.updateChunkTimeout.has(msgId)
    }


    updateRecordMessage(recordId: string, msg: AIChatMessage) {
        if (msg.unfinished) {
            msg.unfinished = undefined
            this.updateChunkTimeout.set(msg.msgId, {
                content: '',
                total: '',
                timeout: null
            })
        }
        super.updateRecordMessage(recordId, msg)
    }



    loadChunk(msgId: string, content: string) {
        const timeout = this.updateChunkTimeout.get(msgId)
        if (!timeout) return


        timeout.content = timeout.content + content
        if (!timeout.timeout) (
            timeout.timeout = setTimeout(() => {
                timeout.timeout = null
                const content = timeout.content
                timeout.total = timeout.total + content
                timeout.content = ''
                this.onMsgChunk?.(msgId, content, false)
            }, 300)
        )
    }

    finishMessage(msgId: string, recordId: string, error?: string) {
        const timeout = this.updateChunkTimeout.get(msgId)
        if (!timeout) return
        if (timeout.timeout) {
            clearTimeout(timeout.timeout)
            const content = timeout.content
            this.onMsgChunk?.(msgId, content, false)
        }
        const total = timeout.total
        this.updateMsgContent(msgId, total)
        this.updateChunkTimeout.delete(msgId)
        this.onMsgChunk?.(msgId, '', true)
        return total
    }

}



export interface RecordHandler {




}




export abstract class AiChatCenter {

    abstract records: AIChatRecord[]

    abstract RecordHandler: Map<string, RecordHandler>


}