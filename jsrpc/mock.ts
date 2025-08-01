import type { RPCConnectServer, RPCMethod } from "./base"
import { ServerDoc, type MethodDocData } from "./doc"


export class RPCMockConnect implements RPCConnectServer {

    static twins(): [RPCMockConnect, RPCMockConnect] {
        const s1 = new RPCMockConnect()
        const s2 = new RPCMockConnect()
        s1.target = s2
        s2.target = s1
        return [s1, s2]
    }


    target?: RPCMockConnect
    methods: { [key: string]: RPCMethod } = {}
    doc = new ServerDoc(this)

    name(name: string) {
        this.doc.setName(name)
        return this
    }

    desc(desc: string) {
        this.doc.setDesc(desc)
        return this
    }

    addMethod(info: MethodDocData, call: RPCMethod['call']) {
        this.doc.addMethod(info)
        this.methods[info.name] = {
            ...info, call,
            params: (info.params ?? []).map(v => v.name)
        }

        return this
    }

}