import { RPCMockConnect } from "../jsrpc/mock";
import type { GraphView } from "./GraphView";






export class DBERMockServer {

    renderer: RPCMockConnect
    controller: RPCMockConnect

    constructor(
        public view: GraphView
    ) {
        const [renderer, controller] = RPCMockConnect.twins()
        this.renderer = renderer
        this.controller = controller
    }


    initController() { }

    initRenderer() {


        this.renderer
            .name('DBERMockServer.Renderer')
            .desc('模拟渲染 RPC 服务')
            .addMethod({
                name: 'NodeUpdate',
                desc: '添加或全量更新节点',
            }, async () => { })
            .addMethod({
                name: "ViewClear",
                desc: '清空画布',
            }, async () => { })
            .addMethod({
                name: "NodeUpdateEntity",
                desc: "更新节点结构数据"
            }, async () => { })
            .addMethod({
                name: "NodeUpdateRender",
                desc: "更新节点渲染数据"
            }, async () => { })
            .addMethod({
                name: "NodeFetchData",
                desc: "获取当前客户端节点数据"
            }, async () => { })
    }


}