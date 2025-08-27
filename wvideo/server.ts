
import fs from 'node:fs'
import path from 'node:path'
import { ChildProcess, spawn, exec } from 'node:child_process'
import { v4 } from 'uuid';


const execAsync = (exe: string, args: string, cmd: string) => {
    console.log('cmd: '+ cmd)
    const process = exec(exe + ' ' + args, { cwd: cmd }, (error, stdout, stderr) => {
        if (error) {
            console.error(`执行错误: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`错误输出: ${stderr}`);
            return;
        }
        console.log(`工作目录下的文件:\n${stdout}`);
    });
    if (!process) throw new Error()
    // 启动ffmpeg进程
    const promise = new Promise((resolve, reject) => {

    });

    return {
        process, promise
    }
}


export class WVServer {

}


export abstract class WVTransJob {


    static async dashSlice(ffmpegPath: string, filePath: string, outputDir: string, options: any = {}) {
        // 默认配置，针对普通视频文件优化
        const defaults = {
            segDuration: 4,           // 切片时长(秒)
            streams: [                // 多码率配置
                // { width: 854, height: 480, videoBitrate: '800k', audioBitrate: '128k' },  // 480p
                { width: 1280, height: 720, videoBitrate: '2500k', audioBitrate: '192k' }, // 720p
                // { width: 1920, height: 1080, videoBitrate: '5000k', audioBitrate: '256k' } // 1080p
            ]
        };

        const config: typeof defaults = { ...defaults, ...options };

        try {
            // 检查输入文件是否存在
            if (!fs.existsSync(filePath)) {
                throw new Error(`输入文件不存在: ${filePath}`);
            }

            // 确保输出目录存在
            fs.mkdirSync(outputDir, { recursive: true });

            await new Promise(res => setTimeout(res, 100))



            // DASH参数 - 关键是启用分段更新模式
            const mediaSegTemplate = `"${path.join(outputDir, 'segment_%05d.m4s')}"`;
            const initSegTemplate = `"${path.join(outputDir, 'init.m4s')}"`;
            const mpdPath = `"${path.join(outputDir, 'manifest.mpd')}"`;


            // 构建ffmpeg命令参数
            const ffmpegArgs = ['-hide_banner', '-i', filePath];

            // 添加多码率流配置
            config.streams.forEach(stream => {
                // 视频流配置
                ffmpegArgs.push(
                    '-map', '0:v',
                    '-s', `${stream.width}x${stream.height}`,
                    '-c:v', 'libx264',
                    '-b:v', stream.videoBitrate,
                    '-profile:v', 'main',
                    '-preset', 'medium',

                    // 音频流配置
                    '-map', '0:a',
                    '-c:a', 'aac',
                    '-b:a', stream.audioBitrate
                );
            });

            ffmpegArgs.push(
                '-f', 'dash',
                '-use_template', '1',          // 使用模板
                '-use_timeline', '1',          // 使用时间线
                '-seg_duration', config.segDuration.toString(),  // 切片时长
                '-remove_at_exit', '0',        // 保留所有文件
                '-window_size', '0',           // 不限制窗口大小，保留所有切片
                '-update_period', config.segDuration.toString(), // 每生成一个切片就更新一次MPD
                '-media_seg_name', 'chunk-$RepresentationID$-$Number%05d$.m4s',  // 媒体切片路径（带引号）
                '-init_seg_name', 'init-$RepresentationID$.m4s',    // 初始化切片路径（带引号）
                mpdPath                               // MPD文件路径（带引号）
            );

            console.log('执行FFmpeg命令:', ffmpegPath, ffmpegArgs.join(' '));
            const process = spawn(ffmpegPath, ffmpegArgs);
            // 启动ffmpeg进程
            const promise = new Promise((resolve, reject) => {
                let output = '';
                let isFirstSegment = true;

                // 捕获输出信息，监测切片生成进度
                process.stderr.on('data', (data) => {
                    const outputStr = data.toString();
                    output += outputStr;

                    // 检测到新切片生成时的日志特征
                    if (outputStr.includes('Writing segment')) {
                        if (isFirstSegment) {
                            console.log(`第一个切片生成，MPD索引文件已创建: ${mpdPath}`);
                            isFirstSegment = false;
                        } else {
                            console.log(`新切片生成，MPD索引文件已更新`);
                        }
                    }
                });

                // 处理进程结束
                process.on('close', (code) => {
                    if (code === 0) {
                        console.log(`所有切片处理完成，最终MPD文件: ${mpdPath}`);
                        resolve({
                            success: true,
                            mpdPath,
                            outputDir,
                            output
                        });
                    } else {
                        console.error(`处理失败，退出代码: ${code}`);
                        reject(new Error(`处理失败: ${output}`));
                    }
                });

                // 处理进程错误
                process.on('error', (err) => {
                    console.error('FFmpeg启动失败:', err);
                    reject(err);
                });
            });

            return {
                process, promise
            }

        } catch (error) {
            console.error('DASH切片处理失败:', error);
            throw error;
        }
    }

    static convertToDash(ffmpegPath: string, filePath: string, outputDir: string, segmentDuration: number = 4) {
        const defaults = {
            segDuration: 4,           // 切片时长(秒)
            streams: [                // 多码率配置
                // { width: 854, height: 480, videoBitrate: '800k', audioBitrate: '128k' },  // 480p
                { width: 1280, height: 720, videoBitrate: '2500k', audioBitrate: '192k' }, // 720p
                // { width: 1920, height: 1080, videoBitrate: '5000k', audioBitrate: '256k' } // 1080p
            ]
        };

        const ffmpegArgs: string[] = []

        // 添加多码率流配置
        defaults.streams.forEach(stream => {
            // 视频流配置
            ffmpegArgs.push(
                '-map', '0:v',
                '-s', `${stream.width}x${stream.height}`,
                '-c:v', 'libx264',
                '-b:v', stream.videoBitrate,
                '-profile:v', 'main',
                '-preset', 'medium',

                // 音频流配置
                '-map', '0:a',
                '-c:a', 'aac',
                '-b:a', stream.audioBitrate
            );
        });


        try {
            // 确保输出目录存在
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // 验证输入文件是否存在
            if (!fs.existsSync(filePath)) {
                throw new Error(`Input file ${filePath} does not exist`);
            }

            // 构建 FFmpeg 命令
            const outputMpd = path.join(outputDir, 'output.mpd');
            const ffmpegCommand = ` -i "${filePath}" ` +
                ffmpegArgs.join(' ') + ' ' +
                `-f dash ` +
                `-seg_duration ${segmentDuration} ` +
                `-use_template 1 ` +
                `-use_timeline 1 ` +
                `-init_seg_name ${'./init_$RepresentationID$.m4s'} ` +
                `-media_seg_name ${'./chunk_$RepresentationID$_$Number$.m4s'} ` +
                `-adaptation_sets "id=0,streams=v id=1,streams=a" ` +
                `-window_size 0 ` +
                `-update_period  ${segmentDuration} ` +
                `-remove_at_exit 0 ` +
                `"${outputMpd}"`;

            console.log('Executing FFmpeg command:', ffmpegPath + ' ' + ffmpegCommand);

            // 执行 FFmpeg 命令
            return execAsync(ffmpegPath, ffmpegCommand, outputDir);

            // console.log('DASH conversion completed successfully');
            // console.log(`MPD file created at: ${outputMpd}`);
            // console.log(`Segments created in: ${outputDir}`);

        } catch (error) {
            console.error('Error during DASH conversion:', error);
            throw error;
        }
    }


    abstract dirPath: string
    abstract filePath: string
    abstract ffmpegPath: string

    process?: ChildProcess;
    promise?: Promise<unknown>;
    done: boolean = false

    uuid = v4()

    get outputDir() {
        return path.resolve(this.dirPath, this.uuid)
    }

    async start() {
        const res = await WVTransJob.convertToDash(this.ffmpegPath, this.filePath, this.outputDir)
        this.process = res.process
        this.promise = res.promise
        this.promise.finally(() => { this.done = true })
    }

}


;
new class extends WVTransJob {
    ffmpegPath = path.resolve(__dirname, './ffmpeg/bin/ffmpeg.exe')
    dirPath: string = path.resolve(__dirname, './temp')
    filePath = path.resolve(__dirname, './ffmpeg/PSYCHO-PASS.mkv')

    constructor() {
        super()
        this.start()
    }
}

// export class WVPlayTask {



//     constructor(
//         public filePath: string
//     ) {

//     }


// }
