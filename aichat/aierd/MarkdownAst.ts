import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { Node, Parent, Literal } from 'unist';
import type { Root } from 'mdast';


// const extra  = new WeakMap<Node,{
//   type: string;
//   children?: Node[];
//   value?: string;
//   depth?: number;
//   lang?: string;
//   url?: string;
//   title?: string;
//   alt?: string;
//   // 其他可能的属性...
// }>()


// 解析 Markdown 并生成 AST
export function parseMarkdownToAST(markdown: string) {
  const processor = unified().use(remarkParse);
  const ast = processor.parse(markdown);
  return ast;
}


export function findNodesByType(ast: Root, type:string) :Node[]{
  const result:Node[] = [];
  
  // 递归遍历AST节点
  function traverse(node:Parent) {
    // 如果当前节点类型匹配，添加到结果
    if (node.type === type) {
      result.push(node);
    }
    
    // 如果有子节点，递归处理
    if (node?.children && Array.isArray(node.children)) {
      node.children.forEach(child => traverse(child as Parent));
    }
  }
  
  // 从根节点开始遍历
  traverse(ast);
  return result;
}




// // 示例使用
// (async () => {
//   // 模拟 AI 生成的 Markdown 响应
//   const aiResponse = `
// # 深度学习简介

// 深度学习是机器学习的一个**子领域**，它使用多层神经网络来学习数据的表示。

// ## 主要特点

// 1. 自动特征提取
// 2. 处理大规模数据
// 3. 需要大量计算资源

// ### 常见架构

// - 卷积神经网络 (CNN) - 用于图像处理
// - 循环神经网络 (RNN) - 用于序列数据
// - Transformer - 用于自然语言处理

// \`\`\`python
// import tensorflow as tf
// model = tf.keras.Sequential([
//     tf.keras.layers.Dense(128, activation='relu'),
//     tf.keras.layers.Dense(10, activation='softmax')
// ])
// \`\`\`

// 更多信息请参考 [深度学习维基百科](https://en.wikipedia.org/wiki/Deep_learning)
//   `;

//   // 解析为 AST
//   const ast = parseMarkdownToAST(aiResponse);
  
//   console.log('原始 AST 结构:');
//   console.log(JSON.stringify(ast, null, 2));
  
// })();





//   console.log('\n格式化 AST 树:');
//   printAST(ast);
  
//   console.log('\n提取所有标题:');
//   const headings = extractNodesByType(ast, 'heading');
//   headings.forEach(heading => {
//     if (isLiteralNode(heading)) {
//       console.log(`H${heading.depth}: ${heading.value}`);
//     }
//   });
  
//   console.log('\n提取所有代码块:');
//   const codeBlocks = extractNodesByType(ast, 'code');
//   codeBlocks.forEach((code, i) => {
//     console.log(`代码块 #${i + 1} (${code.lang || 'no language'}):`);
//     console.log(code.value);
//   });
  
//   console.log('\n结构化数据表示:');
//   const structured = astToStructuredData(ast);
//   console.log(JSON.stringify(structured, null, 2));