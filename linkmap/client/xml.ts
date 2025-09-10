import { XMLParser } from 'fast-xml-parser'
import type { EntityData, EntityRenderData } from "./base.js";

const xmlText = `
<entity name="Student" id="q1r2s3t4-5678-9012-1314-151617181920">
  <attribute name="StudentID" type="uuid" primaryKey="true" unique="true" nullable="false"/>
  <attribute name="UserID" type="uuid" foreignKey="User" unique="true" nullable="false"/>
  <attribute name="StudentNumber" type="string" unique="true" length="10" nullable="false"/>
  <attribute name="EnrollmentYear" type="integer" minValue="2000" maxValue="2100" nullable="false"/>
  <attribute name="DepartmentID" type="uuid" foreignKey="Department" nullable="false"/>
  <attribute name="MajorID" type="uuid" foreignKey="Major" nullable="false"/>
  <attribute name="ClassID" type="uuid" foreignKey="Class" nullable="false"/>
</entity>
`;


// 配置解析选项
const options = {
    ignoreAttributes: false,       // 不忽略属性
    parseAttributeValue: true,     // 解析属性值为正确类型
    arrayMode: (tagName: any) => {
        // 确保attribute标签始终解析为数组
        return tagName === 'attribute';
    }
};

// 创建解析器并解析XML
const parser = new XMLParser(options);


export const parseXMLToEntity = (xmlText: string): EntityData => {
    const result = parser.parse(xmlText);
    const name = result?.entity?.['@_name']
    const id = result?.entity?.['@_id']
    const fields = (result?.entity?.attribute ?? [])
        .map((attr: any) => ({ name: attr['@_name'], type: attr['@_type'] }))

    if (!name || !id || !fields.length) {
        throw new Error()
    } else {
        return { id, name, desc: '', fields }
    }
}