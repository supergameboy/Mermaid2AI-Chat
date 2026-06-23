/**
 * 官方示例测试辅助函数
 * 单一职责：加载和管理 mermaid 官方示例用于测试
 *
 * 来源: mermaid-develop/packages/examples/src/examples/*.ts
 *
 * 使用方式:
 *   const examples = getOfficialExamples('flowchart');
 *   for (const example of examples) {
 *     const result = parseFlowchart(example.code);
 *     expect(result.errors).toHaveLength(0);
 *   }
 */

import type { DiagramType } from '../../src/types.js';

/** 官方示例 */
export interface OfficialExample {
  /** 示例标题 */
  title: string;
  /** Mermaid 源代码 */
  code: string;
  /** 图表类型 */
  diagramType: DiagramType;
  /** 来源（mermaid-develop 路径） */
  source?: string;
}

/**
 * 官方示例集合
 *
 * 注意: M0 阶段仅提供少量基础示例，各图表类型模块（M1-M12）负责补充完整示例
 * 示例来源: https://mermaid.js.org/syntax/ 官方文档示例
 */
const OFFICIAL_EXAMPLES: Record<DiagramType, OfficialExample[]> = {
  flowchart: [
    {
      title: 'Basic flowchart',
      code: `flowchart TD
    A[Start] --> B{Is it?}
    B -- Yes --> C[OK]
    B -- No --> D[End]`,
      diagramType: 'flowchart',
      source: 'mermaid-develop/examples/flowchart-basic',
    },
    {
      title: 'LR flowchart',
      code: `flowchart LR
    A[Square Rect] -- Link text --> B((Circle))
    A --> C(Round Rect)
    B --> D{Rhombus}
    C --> D`,
      diagramType: 'flowchart',
      source: 'mermaid-develop/examples/flowchart-lr',
    },
  ],
  sequenceDiagram: [
    {
      title: 'Basic sequence',
      code: `sequenceDiagram
    participant Alice
    participant Bob
    Alice->>John: Hello John, how are you?
    John-->>Alice: Great!
    John->>Bob: How about you?
    Bob-->>John: Good!`,
      diagramType: 'sequenceDiagram',
      source: 'mermaid-develop/examples/sequence-basic',
    },
  ],
  classDiagram: [
    {
      title: 'Basic class',
      code: `classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
    Animal <|-- Zebra
    Animal : +int age
    Animal : +String gender
    Animal: +isMammal()
    Animal: +mate()`,
      diagramType: 'classDiagram',
      source: 'mermaid-develop/examples/class-basic',
    },
  ],
  erDiagram: [
    {
      title: 'Basic ER',
      code: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER }|..|{ DELIVERY-ADDRESS : uses`,
      diagramType: 'erDiagram',
      source: 'mermaid-develop/examples/er-basic',
    },
  ],
  mindmap: [
    {
      title: 'Basic mindmap',
      code: `mindmap
  root((mindmap))
    Origins
      Long history
      ::icon(fa fa-book)
      Popularisation
        British popular psychology author Tony Buzan
    Research
      On effectiveness<br/>and features
      On Automatic creation
        Uses
            Creative techniques
            Strategic planning
            Argument mapping`,
      diagramType: 'mindmap',
      source: 'mermaid-develop/examples/mindmap-basic',
    },
  ],
  stateDiagram: [
    {
      title: 'Basic state',
      code: `stateDiagram-v2
    [*] --> Still
    Still --> [*]
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]`,
      diagramType: 'stateDiagram',
      source: 'mermaid-develop/examples/state-basic',
    },
  ],
  architecture: [
    {
      title: 'Basic architecture',
      code: `architecture-beta
    group api(cloud)[API]
    service db(database)[Database] in api
    service server(server)[Server] in api
    db:R -- L:server`,
      diagramType: 'architecture',
      source: 'mermaid-develop/examples/architecture-basic',
    },
  ],
  gantt: [
    {
      title: 'Basic gantt',
      code: `gantt
    title A Gantt Diagram
    dateFormat YYYY-MM-DD
    section Section
    A task           :a1, 2014-01-01, 30d
    Another task     :after a1, 20d
    section Another
    Task in sec      :2014-01-12, 12d
    another task     :24d`,
      diagramType: 'gantt',
      source: 'mermaid-develop/examples/gantt-basic',
    },
  ],
  pie: [
    {
      title: 'Basic pie',
      code: `pie title Pets adopted by volunteers
    "Dogs" : 386
    "Cats" : 85
    "Rats" : 15`,
      diagramType: 'pie',
      source: 'mermaid-develop/examples/pie-basic',
    },
  ],
  timeline: [
    {
      title: 'Basic timeline',
      code: `timeline
    title History of Social Media Platform
    2002 : LinkedIn
    2004 : Facebook
         : Google
    2005 : Youtube`,
      diagramType: 'timeline',
      source: 'mermaid-develop/examples/timeline-basic',
    },
  ],
  quadrantChart: [
    {
      title: 'Basic quadrant',
      code: `quadrantChart
    title Reach and engagement of campaigns
    x-axis Low Reach --> High Reach
    y-axis Low Engagement --> High Engagement
    quadrant-1 We should expand
    quadrant-2 Need to promote
    quadrant-3 Re-evaluate
    quadrant-4 May be improved
    "Campaign A": [0.3, 0.6]
    "Campaign B": [0.45, 0.23]
    "Campaign C": [0.57, 0.69]
    "Campaign D": [0.78, 0.34]
    "Campaign E": [0.40, 0.34]
    "Campaign F": [0.35, 0.78]
    "Campaign G": [0.20, 0.72]`,
      diagramType: 'quadrantChart',
      source: 'mermaid-develop/examples/quadrant-basic',
    },
  ],
  xychart: [
    {
      title: 'Basic xychart',
      code: `xychart-beta
    title "Sales Revenue"
    x-axis [jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec]
    y-axis "Revenue (in $)" 4000 --> 11000
    bar [5000, 6000, 7500, 8200, 9500, 10500, 11000, 10200, 9200, 8500, 7000, 6000]
    line [5000, 6000, 7500, 8200, 9500, 10500, 11000, 10200, 9200, 8500, 7000, 6000]`,
      diagramType: 'xychart',
      source: 'mermaid-develop/examples/xychart-basic',
    },
  ],
};

/**
 * 获取指定图表类型的官方示例
 */
export function getOfficialExamples(diagramType: DiagramType): OfficialExample[] {
  return OFFICIAL_EXAMPLES[diagramType] ?? [];
}

/**
 * 获取所有官方示例
 */
export function getAllOfficialExamples(): OfficialExample[] {
  return Object.values(OFFICIAL_EXAMPLES).flat();
}

/**
 * 注册自定义示例（各图表类型模块可补充）
 */
const customExamples: Map<DiagramType, OfficialExample[]> = new Map();

export function registerExample(example: OfficialExample): void {
  const existing = customExamples.get(example.diagramType) ?? [];
  existing.push(example);
  customExamples.set(example.diagramType, existing);
}

export function getCustomExamples(diagramType: DiagramType): OfficialExample[] {
  return customExamples.get(diagramType) ?? [];
}
