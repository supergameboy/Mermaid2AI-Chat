import { parseFlowchartCode } from './packages/serializer/dist/index.js';

// Test with 3-level nesting
const code = `flowchart LR
subgraph Outer[Outer Title]
  subgraph Mid[Middle Title]
    subgraph Inner[Inner Title]
      A[A1]
    end
    B[B1]
  end
  C[C1]
end`;

const r = parseFlowchartCode(code);

console.log('=== Subgraph Nodes ===');
for (const n of r.canvas.nodes) {
  if (n.data?.isSubgraph) {
    console.log(`id=${n.id} label="${n.data.label}" parentId=${n.parentId ?? 'NONE'} subgraphNodes=${JSON.stringify(n.data.subgraphNodes)} type=${n.type}`);
  }
}

console.log('\n=== All Nodes ===');
for (const n of r.canvas.nodes) {
  console.log(`id=${n.id} type=${n.type} label="${n.data?.label}" parentId=${n.parentId ?? 'NONE'} isSubgraph=${n.data?.isSubgraph}`);
}

// Also test the exact code from the user's browser
const code2 = `flowchart LR

subgraph FinalValidate[最终批量验证（使用子Agent）]
  U[批量验证子Agent]
  V{全部通过?}
  W[完成✓]
  X[修正+额外验证]
  U --> V
  V -->|是| W
  V -->|否| X
  X --> U
end

subgraph L1[L1 功能模块级]
  subgraph ModuleB[模块B完整流程]
    I2[模块B设计]
    MB1[创建模块文档]
    I2 --> MB1
  end
  subgraph ModuleA[模块A完整流程]
    I1[模块A设计]
    MA1[创建模块文档]
    I1 --> MA1
  end
  I3[模块C设计]
  IN[模块N设计]
  I3 --> IN
end

subgraph L0[L0 初步想法]
  C[识别设计决策点]
  D{提供三套设计方案}
  C --> D
end

subgraph Start[开始]
  A[获取当前时间]
  B[收集用户初步想法]
  A --> B
end

B --> C
H --> I1

style Start fill:#e1f5fe
style L0 fill:#fff3e0`;

const r2 = parseFlowchartCode(code2);

console.log('\n\n=== User Code - Subgraph Nodes ===');
for (const n of r2.canvas.nodes) {
  if (n.data?.isSubgraph) {
    console.log(`id=${n.id} label="${n.data.label}" parentId=${n.parentId ?? 'NONE'} subgraphNodes=${JSON.stringify(n.data.subgraphNodes)}`);
  }
}

console.log('\n=== User Code - All Nodes ===');
for (const n of r2.canvas.nodes) {
  console.log(`id=${n.id} type=${n.type} label="${n.data?.label}" parentId=${n.parentId ?? 'NONE'} isSubgraph=${n.data?.isSubgraph}`);
}
