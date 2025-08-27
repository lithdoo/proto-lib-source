

import { ChildProcess, spawn, exec } from 'node:child_process'
import path from 'node:path';
import fs from 'fs'


export type DASHStream = {
    width: number,
    height: number,
    videoBitrate: string,
    bufsize: string,
    profile: string,
    maxrate: string,
}


const execAsync = (exe: string, args: string, cmd: string) => {
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


export abstract class DASHTask {


    abstract ffmpegEXE: string
    abstract sourceFile: string
    abstract segmentDuration: number
    abstract outputDir: string


    streams: DASHStream[] = [
        { width: 1920, height: 1080, videoBitrate: '5000k', bufsize: '10000k', maxrate: '5000k', profile: 'high' },
        { width: 1280, height: 720, videoBitrate: '5000k', bufsize: '10000k', maxrate: '5000k', profile: 'high' }
    ]



    get outputMpd() {
        return './manifest.mpd'
    }

    get ffmpegArgs() {

        const getStreamArgus = (streams: DASHStream[]) => {

            if (streams.length === 0) {
                throw new Error("至少需要提供一个视频流配置");
            }

            const streamCount = streams.length;

            // 生成视频分割部分的标签（v1, v2, ..., vn）
            const splitLabels = Array.from({ length: streamCount }, (_, i) => `v${i + 1}`);
            const splitCommand = `[0:v]split=${streamCount}[${splitLabels.join("][")}]`;

            // 生成每个流的缩放命令
            const scaleCommands = streams.map((stream, index) => {
                const label = `v${index + 1}`;
                return `[${label}]scale=${stream.width}:${stream.height}[${label}out]`;
            });

            // 组合滤镜部分内容
            const filterParts = [splitCommand, ...scaleCommands];
            const filterContent = filterParts
                .map((part, i) => {
                    // 除了最后一个部分，其他都需要添加分号和续行符
                    return i < filterParts.length - 1 ? `${part};` : part;
                })
                .join("");

            // 构建滤镜复杂选项部分
            const filterSection = `    -filter_complex "${filterContent}" `;

            // 构建每个视频流的映射和编码参数
            const videoSections = streams
                .map((stream, index) => {
                    const outputLabel = `v${index + 1}out`;
                    return `    -map "[${outputLabel}]" -c:v:${index} libx264 -b:v:${index} ${stream.videoBitrate} -maxrate:v:${index} ${stream.maxrate} -bufsize:v:${index} ${stream.bufsize}`;
                })
                .join("");

            // 音频参数部分（固定配置）
            const audioSection = `    -map 0:a -c:a aac -b:a 128k -ac 2 `;

            // 组合所有部分
            return `${filterSection} ${videoSections} ${audioSection} `;
        }

        const streamArgus = getStreamArgus(this.streams)

        const ffmpegs = [
            ' -i', `"${this.sourceFile}"`,
            streamArgus,
            `-f dash `,
            `-seg_duration ${this.segmentDuration} `,
            `-use_template 1 `,
            `-use_timeline 1 `,
            `-init_seg_name ${'"./init_$RepresentationID$.m4s"'} `,
            `-media_seg_name ${'"./chunk_$RepresentationID$_$Number$.m4s"'} `,
            `-adaptation_sets "id=0,streams=v id=1,streams=a" `,
            `-window_size 0 `,
            `-update_period  ${this.segmentDuration} `,
            `-remove_at_exit 0 `,
            `"${this.outputMpd}"`,
        ]

        return ffmpegs.join(' ')
    }

    run() {

        try {
            fs.accessSync(this.outputDir)
        } catch (e) {
            console.error(e)
            fs.mkdirSync(this.outputDir, { recursive: true })
        }

        console.log(`${this.ffmpegEXE} ${this.ffmpegArgs}`)
        // return
        return execAsync(this.ffmpegEXE, this.ffmpegArgs, this.outputDir)
    }

}



(new class extends DASHTask {
    ffmpegEXE: string = path.resolve(__dirname, './ffmpeg/bin/ffmpeg.exe')
    outputDir: string = path.resolve(__dirname, './temp/dash')
    sourceFile: string = path.resolve(__dirname,'./ffmpeg/PSYCHO-PASS.mkv')
    segmentDuration = 4
}).run()



// D:\Coding\other-code\proto-lib-source\wvideo\ffmpeg\bin\ffmpeg.exe -ignore_unknown -i "D:\Coding\other-code\proto-lib-source\wvideo\ffmpeg\PSYCHO-PASS.mkv" `
// -filter_complex "[0:v]split=2[v1][v2];[v1]scale=1920:1080[v1out];[v2]scale=1280:720[v2out]" `
// -map "[v1out]" -c:v:0 libx264 -b:v:0 5000k -maxrate:v:0 5000k -bufsize:v:0 10000k `
// -map "[v2out]" -c:v:1 libx264 -b:v:1 5000k -maxrate:v:1 5000k -bufsize:v:1 10000k `
// -map 0:a -c:a aac -b:a 128k -ac 2 `
// -f dash -seg_duration 4 -use_template 1 -use_timeline 1 `
// -init_seg_name "./init_$RepresentationID$.m4s" `
// -media_seg_name "./chunk_$RepresentationID$_$Number$.m4s" `
// -adaptation_sets "id=0,streams=v id=1,streams=a" `
// -window_size 0 -update_period 4 -remove_at_exit 0 "./manifest.mpd" 