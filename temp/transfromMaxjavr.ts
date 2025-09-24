import DataBase from 'better-sqlite3'
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import path from 'path'
const oldDB = new DataBase('../../data-store/.maxjavr_data/cache.db')
const newDB = new DataBase('../../data-store/.maxjavr_data/index.new.db')


const insertIntoNewDB = (keyName: string, fields: { name: string, value: any }[]) => {

    console.log(`insert ${keyName} item`)
    const val = {}

    fields.forEach(v => {
        val[v.name] = v.value
    })

    const keys = [...Object.keys(val)]

    const state = newDB.prepare(`
            INSERT INTO ${keyName} (${keys.join(', ')})
            VALUES (${keys.map(v => `@${v}`).join(', ')})
            RETURNING *
        `)

    state.run(val)

}

export const run = (insert: boolean = true) => {

    // const allVrWork: {
    //     code: string
    //     list_html: string,
    //     img_url: string,
    //     link: string,
    //     title: string,
    //     desc: string,
    //     update_data: string,
    //     update_time: string,
    //     detail_html: string,
    //     detail_img_url: string,
    //     detail_update_date: string,
    // }[] = oldDB.prepare(`select * from maxjav_vr_work`).all() as any

    // const allMaxjavImage: {
    //     code: string
    //     img_url: string,
    //     done_or_error: string,
    //     file_name: string,
    // }[] = oldDB.prepare(`select * from maxjav_image`).all() as any

    // const allDownLoadFile: {
    //     download_code: string
    //     file_name: string,
    // }[] = oldDB.prepare(`select * from maxjav_download_file`).all() as any



    const allDownLoad: {
        code: string,
        type: string,
        dir: string,
        maxjav_work_code: string
    }[] = oldDB.prepare(`select * from maxjav_download`).all() as any

    allDownLoad.forEach(item => {
        insertIntoNewDB(`download_file`, [
            {
                "name": "type",
                "value": item.type
            },
            {
                "name": "code_dir",
                "value": item.code
            },
            {
                "name": "keyword_dir",
                "value": item.dir
            }
        ])
    })

    const keywords = [...new Set(
        allDownLoad.map(v => v.dir)
    )]

    keywords.forEach(text => {
        insertIntoNewDB(`keyword`, [
            {
                "name": "text",
                "value": text
            },
            {
                "name": "type",
                "value": 'actor'
            },
            {
                "name": "update_timestamp",
                "value": new Date().getTime()
            }
        ])
    })

    const allMaxjavImage: {
        code: string
        img_url: string,
        done_or_error: string,
        file_name: string,
    }[] = oldDB.prepare(`select * from maxjav_image`).all() as any

    const imageTable = allMaxjavImage.reduce((obj, cur) => {
        obj[cur.code] = cur
        return obj
    }, {} as { [key: string]: typeof allMaxjavImage[0] })

    const allVrWork: {
        code: string
        list_html: string,
        img_url: string,
        link: string,
        title: string,
        desc: string,
        update_date: string,
        update_time: string,
        detail_html: string,
        detail_img_url: string,
        detail_update_date: string,
    }[] = oldDB.prepare(`select * from maxjav_vr_work`).all() as any


    allVrWork.forEach(work => {
        insertIntoNewDB(`video_page`, [
            {
                "name": "url",
                "value": work.link
            },
            {
                "name": "item_html",
                "value": work.list_html
            },
            {
                "name": "code",
                "value": work.code
            },
            {
                "name": "page_update_date",
                "value": work.update_date
            },
            {
                "name": "update_timestamp",
                "value": new Date().getTime()
            }
        ])


        const html_file_dir = path.resolve(__dirname, '../../data-store/.maxjavr_data/maxjavr-info-html')

        if (!existsSync(html_file_dir)) {
            mkdirSync(html_file_dir, { recursive: true })
        }

        const html_filename = work.detail_html ? `${work.code}.html` : null
        if (html_filename) {
            const html_filepath = path.resolve(html_file_dir, html_filename)
            if (!existsSync(html_filepath)) {
                writeFileSync(html_filepath, work.detail_html)
            }
        }


        const img_item = imageTable[work.code]
        let img_filename: string | null = null
        let img_status = img_item?.done_or_error

        const img_file_dir = path.resolve(__dirname, '../../data-store/.maxjavr_data/maxjavr-info-img')

        if (!existsSync(img_file_dir)) {
            mkdirSync(img_file_dir, { recursive: true })
        }


        if (img_item && img_item.file_name) {
            const targetFilePath = path.resolve(
                `\\\\N2\\临时文件\\jav-db-data\\maxjav_imgs`,
                img_item.file_name
            )
            if (existsSync(targetFilePath)) {
                img_filename = img_item.file_name
                const img_filepath = path.resolve(img_file_dir, img_filename)

                if (!existsSync(img_filepath)) {
                    copyFileSync(targetFilePath,img_filepath)
                }
            }
        }




        insertIntoNewDB(`__REF__video_info`, [
            {
                "name": "video_code",
                "value": work.code
            },
            {
                "name": "html",
                "value": html_filename
            },
            {
                "name": "html_update_date",
                "value": work.detail_update_date
            },
            {
                "name": "desc",
                "value": work.desc
            },
            {
                "name": "title",
                "value": work.title
            },
            {
                "name": "img_url",
                "value": work.detail_img_url
            },
            {
                "name": "img_file",
                "value": img_filename
            },
            {
                "name": "img_status",
                "value": img_status ?? null
            }
        ])
    })



    console.log('------ run done --------')
}
