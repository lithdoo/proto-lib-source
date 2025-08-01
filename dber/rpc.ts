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


    initController() {
        this.controller
            .addMethod({
                name: 'renderer/nodePosChanged',
                desc: '用户修改节点位置'
            }, async () => { })
            .addMethod({
                name: "renderer/viewPortChanged",
                desc: '用户修改视窗位置以及大小'
            }, async () => { })

    }

    initRenderer() {


        this.renderer
            .name('DBERMockServer.Renderer')
            .desc('模拟渲染 RPC 服务')
            .addMethod({
                name: 'view/nodeUpdate',
                desc: '添加或全量更新节点',
            }, async () => { })
            .addMethod({
                name: "view/clear",
                desc: '清空画布',
            }, async () => { })
            .addMethod({
                name: "view/nodeUpdateEntity",
                desc: "更新节点结构数据"
            }, async () => { })
            .addMethod({
                name: "view/nNodeUpdateRender",
                desc: "更新节点渲染数据"
            }, async () => { })
            .addMethod({
                name: "view/nodeFetchData",
                desc: "获取当前客户端节点数据"
            }, async () => { })


    }


}