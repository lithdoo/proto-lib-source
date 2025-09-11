import '@proto-lib/aichax/server.eg'
import { createServer } from '@proto-lib/jsrpc/wss'
import { ErMapState, UDBLinkMapServer, UDBSqliteController } from '@proto-lib/udatabase'

const server = new UDBLinkMapServer(new ErMapState(),{
    typeMeta:{},
    relations:[],
    structs:[{
        keyName:'test',
        fields:[{
            name:'id',
            type:'string',
            not_null: true,
        }],
        keyField:'id'
    }]
})

server.port = 7790

createServer(server)