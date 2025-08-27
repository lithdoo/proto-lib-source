import path from 'node:path'
import { v4 } from 'uuid'
import Koa from 'koa'
import KoaRouter from 'koa-router'
import cors from '@koa/cors'
import fs from 'node:fs'
import { spawn } from 'node:child_process'

const { exec } = require('child_process');


export class HLSTransformTask {
    static HLS_TEMP_PATH = path.resolve(__dirname, '../temp')
    static FFMPEG_EXE_PATH = path.resolve(__dirname, '..//ffmpeg/bin/ffmpeg.exe')

    constructor(
        public filePath: string = path.resolve(HLSTransformTask.HLS_TEMP_PATH, '../ffmpeg/PSYCHO-PASS.mkv')
    ) {

    }



    uuid = v4()



    ffmpeg(filePath:string) {
        // FFmpeg 实时转码命令（关键参数）
        // -re: 按实际播放速度读取输入（重要，避免过快处理）
        // -i: 输入文件
        // -c:v: 视频编码器（H.264）
        // -c:a: 音频编码器（AAC）
        // -hls_time: 每个切片时长（秒）
        // -hls_list_size: 播放列表中包含的切片数
        // -hls_flags: 允许流式处理（delete_segments 自动删除旧片段节省空间）
        // -f hls: 输出格式为 HLS
        const ffmpeg = spawn(HLSTransformTask.FFMPEG_EXE_PATH, [
            '-re',
            '-i', this.filePath,
            '-c:v', 'libx264',
            '-preset', 'ultrafast',  // 超快模式，优先保证实时性
            '-crf', '28',           // 质量参数（值越高质量越低）
            '-c:a', 'aac',
            '-b:a', '128k',
            '-hls_time', '5',       // 5秒一个切片
            '-hls_list_size', '0',  // 0表示包含所有切片
            '-hls_flags', 'delete_segments+omit_endlist',  // 自动删除旧片段，不添加结束标记
            '-hls_segment_filename', filePath,
            '-f', 'hls',
            '-'  // 输出到 stdout
        ]);

        return ffmpeg
    }


}

export class HLSWebServer {


    private app: Koa
    private router: KoaRouter

    private task = new HLSTransformTask()

    constructor() {
        this.app = new Koa()
        this.router = new KoaRouter();
        this.init()
    }


    init() {
        // this.router.get('/hls/:videoId/master.m3u8')、
        console.log('init')

        // 确保目录存在
        async function ensureDir(dir: string) {
            try {
                fs.accessSync(dir);
            } catch {
                 fs.mkdirSync(dir, { recursive: true });
            }
        }

        // 清理临时文件
        function cleanupTempFiles(dir: string) {
            if (fs.existsSync(dir)) {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        }

        async function waitForM3u8(m3u8Path: string, ctx: any) {
            while (!fs.existsSync(m3u8Path)) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const stream = fs.createReadStream(m3u8Path);
            ctx.body = stream;
        }


        this.router.get('/hls/hello', async (ctx) => {
            ctx.body = 'hello hls',
                ctx.status = 200
        })

        this.router.get('/hls/master.m3u8', async (ctx) => {
            try {
                console.log('error.message')
                // 创建临时目录
                const tempDir = path.join(HLSTransformTask.HLS_TEMP_PATH, this.task.uuid);
                ensureDir(tempDir);

                console.log(tempDir)

                // 设置响应头
                ctx.set('Content-Type', 'application/x-mpegURL');

                console.log('error.message')
                // 使用 FFmpeg 实时转码为 HLS 流
                const ffmpegCommand = [
                    HLSTransformTask.FFMPEG_EXE_PATH,
                    '-i', `"${this.task.filePath}"`, // 输入文件
                    '-hls_time 10', // 切片时长
                    '-hls_list_size 0', // 所有切片都包含在播放列表中
                    // '-hls_segment_filename', `"${path.join(tempDir, '%03d.ts')}"`, // 切片文件命名
                    '-vcodec libx264', // 视频编码
                    '-hls_segment_type none',
                    '-acodec aac', // 音频编码
                    '-preset fast', // 转码速度/质量平衡
                    '-crf 28', // 视频质量 (0-51, 越低质量越高)
                    '-f hls', // 输出格式
                    `"${path.join(tempDir, 'master.m3u8')}"` // 输出的m3u8文件
                ].join(' ');

                console.log(this.task.filePath)

                console.log('error.message')
                // 执行FFmpeg命令
                const ffmpegProcess = exec(ffmpegCommand);

                ffmpegProcess.on('error',(e:any)=>{
                    console.error(e)
                })

                console.log('error.message')
                // 当请求结束时清理资源
                // ctx.res.on('close', () => {
                //     ffmpegProcess.kill();
                //     cleanupTempFiles(tempDir);
                // });

                // 读取并流式传输m3u8文件
                const m3u8Path = path.join(tempDir, 'master.m3u8');

                // 等待m3u8文件生成
                await waitForM3u8(m3u8Path, ctx);

                await new Promise(res=>{
                    setTimeout(res,10000)
                })

            } catch (error: any) {
                console.log(error.message)
                ctx.status = 500;
                ctx.body = { success: false, error: error.message };
            }
        }
        )

        // 提供TS切片文件
        this.router.get('/hls/:segment.ts', async (ctx) => {
            try {
                const { videoId, segment } = ctx.params;
                // 创建临时目录
                const tempDir = path.join(HLSTransformTask.HLS_TEMP_PATH, this.task.uuid);
                const tsPath = path.join(tempDir, `${segment}.ts`);
                console.log(tsPath)

                if (!fs.existsSync(tsPath)) {
                    ctx.status = 404;
                    return;
                }

                ctx.set('Content-Type', 'video/MP2T');
                ctx.body = fs.createReadStream(tsPath);
            } catch (error: any) {
                ctx.status = 500;
                ctx.body = { success: false, error: error.message };
            }
        });

    }

    listen(port: number) {
        console.log(port)
        this.app.use(cors({
            // origin: '*', // 允许所有域名访问（生产环境不推荐） 
            // methods: '*'
            // origin: 'http://localhost:5173', // 允许前端的 origin 访问
            // methods: ['GET', 'POST', 'OPTIONS'], // 允许的请求方法
            // headers: ['Content-Type', 'Authorization'], // 允许的请求头
            // credentials: true // 允许携带 Cookie（如果需要）
        } as any));
        this.app.use(this.router.routes())
        this.app.use(this.router.allowedMethods());
        this.app.listen(port)
    }
}

