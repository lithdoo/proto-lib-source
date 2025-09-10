// 定义节点类型
interface Pos {
    x: number;
    y: number;
    width: number;
    height: number;
}

// 定义候选位置类型
interface Candidate extends Pos {
    refNode: Pos;
    center: { x: number; y: number };
    score: number;
}

/**
 * 检查两个节点是否重叠
 * @param a 第一个节点
 * @param b 第二个节点
 * @returns 是否重叠
 */
function isOverlapping(a: Pos, b: Pos): boolean {
    // 不重叠的条件：a在b左侧、a在b上方、b在a左侧、b在a上方
    const noOverlap = 
        a.x + a.width <= b.x || 
        a.y + a.height <= b.y || 
        b.x + b.width <= a.x || 
        b.y + b.height <= a.y;
    
    return !noOverlap;
}

/**
 * 计算两个点之间的欧氏距离
 * @param p1 第一个点
 * @param p2 第二个点
 * @returns 距离
 */
function distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

/**
 * 为新节点找到最佳位置（在已知节点附近且不重叠）
 * @param existingNodes 已知节点集合
 * @param newNode 新节点（包含width和height）
 * @returns 新节点的最佳位置{x, y}
 */
export function findOptimalPosition(
    existingNodes: Pos[], 
    newNode: Pick<Pos, 'width' | 'height'>
): { x: number; y: number } {
    if (existingNodes.length === 0) {
        // 如果没有已知节点，默认放在(0, 0)
        return { x: 0, y: 0 };
    }

    // 步骤1：生成贴邻候选位置
    const candidates: Candidate[] = [];
    
    for (const node of existingNodes) {
        // 计算参考节点的中心
        const refCenter = {
            x: node.x + node.width / 2,
            y: node.y + node.height / 2
        };

        // 左侧贴邻
        const leftCandidate: Omit<Candidate, 'score'> = {
            x: node.x - newNode.width,
            y: node.y,
            width: newNode.width,
            height: newNode.height,
            refNode: node,
            center: {
                x: (node.x - newNode.width) + newNode.width / 2,
                y: node.y + newNode.height / 2
            }
        };
        
        // 右侧贴邻
        const rightCandidate: Omit<Candidate, 'score'> = {
            x: node.x + node.width,
            y: node.y,
            width: newNode.width,
            height: newNode.height,
            refNode: node,
            center: {
                x: (node.x + node.width) + newNode.width / 2,
                y: node.y + newNode.height / 2
            }
        };
        
        // 上方贴邻
        const topCandidate: Omit<Candidate, 'score'> = {
            x: node.x,
            y: node.y - newNode.height,
            width: newNode.width,
            height: newNode.height,
            refNode: node,
            center: {
                x: node.x + newNode.width / 2,
                y: (node.y - newNode.height) + newNode.height / 2
            }
        };
        
        // 下方贴邻
        const bottomCandidate: Omit<Candidate, 'score'> = {
            x: node.x,
            y: node.y + node.height,
            width: newNode.width,
            height: newNode.height,
            refNode: node,
            center: {
                x: node.x + newNode.width / 2,
                y: (node.y + node.height) + newNode.height / 2
            }
        };
        
        // 添加到候选列表（暂时不计算score）
        candidates.push(
            { ...leftCandidate, score: 0 },
            { ...rightCandidate, score: 0 },
            { ...topCandidate, score: 0 },
            { ...bottomCandidate, score: 0 }
        );
    }

    // 步骤2：过滤重叠候选（保留无重叠的）
    const validCandidates = candidates.filter(candidate => {
        // 检查与所有已知节点是否重叠
        return !existingNodes.some(existing => 
            isOverlapping(candidate, existing)
        );
    });

    // 步骤3：若无有效候选，生成兜底位置
    if (validCandidates.length === 0) {
        // 计算所有已知节点的中心平均值
        const centerMean = existingNodes.reduce((acc, node) => {
            acc.x += node.x + node.width / 2;
            acc.y += node.y + node.height / 2;
            return acc;
        }, { x: 0, y: 0 });
        
        centerMean.x /= existingNodes.length;
        centerMean.y /= existingNodes.length;

        // 从中心开始，逐步扩大范围寻找合适位置
        let offset = 0;
        const step = 10; // 每次扩大的步长
        
        while (true) {
            // 生成8个方向的候选位置（上、下、左、右、四个对角线）
            const fallbackCandidates: Pos[] = [
                { x: centerMean.x - newNode.width / 2, y: centerMean.y - newNode.height / 2 - offset, ...newNode },
                { x: centerMean.x - newNode.width / 2, y: centerMean.y - newNode.height / 2 + offset, ...newNode },
                { x: centerMean.x - newNode.width / 2 - offset, y: centerMean.y - newNode.height / 2, ...newNode },
                { x: centerMean.x - newNode.width / 2 + offset, y: centerMean.y - newNode.height / 2, ...newNode },
                { x: centerMean.x - newNode.width / 2 - offset, y: centerMean.y - newNode.height / 2 - offset, ...newNode },
                { x: centerMean.x - newNode.width / 2 + offset, y: centerMean.y - newNode.height / 2 - offset, ...newNode },
                { x: centerMean.x - newNode.width / 2 - offset, y: centerMean.y - newNode.height / 2 + offset, ...newNode },
                { x: centerMean.x - newNode.width / 2 + offset, y: centerMean.y - newNode.height / 2 + offset, ...newNode }
            ];
            
            // 检查每个兜底候选是否有效
            for (const candidate of fallbackCandidates) {
                const isvalid = !existingNodes.some(existing => 
                    isOverlapping(candidate, existing)
                );
                
                if (isvalid) {
                    return { x: candidate.x, y: candidate.y };
                }
            }
            
            offset += step;
        }
    }

    // 步骤4：对有效候选评分，选最优
    validCandidates.forEach(candidate => {
        const refCenter = {
            x: candidate.refNode.x + candidate.refNode.width / 2,
            y: candidate.refNode.y + candidate.refNode.height / 2
        };
        
        // 距离越小，评分越高（加0.01避免除以0）
        candidate.score = 1 / (distance(candidate.center, refCenter) + 0.01);
    });

    // 按评分降序排序，返回最高分的候选
    validCandidates.sort((a, b) => b.score - a.score);
    return { x: validCandidates[0].x, y: validCandidates[0].y };
}

// // 测试代码
// function test() {
//     // 示例：已知节点集合
//     const existingNodes: Pos[] = [
//         { x: 100, y: 100, width: 50, height: 50 },
//         { x: 200, y: 150, width: 60, height: 40 },
//         { x: 150, y: 250, width: 70, height: 50 }
//     ];
    
//     // 新节点（宽40，高30）
//     const newNode = { width: 40, height: 30 };
    
//     // 查找最佳位置
//     const position = findOptimalPosition(existingNodes, newNode);
    
//     console.log('新节点最佳位置:', position);
//     // 输出示例: { x: 150, y: 100 } (取决于具体计算结果)
// }

// // 运行测试
// test();
