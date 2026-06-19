// src/parser.ts
import { parse } from "@crafter/mermaid-parser";

// src/error-collector.ts
var ErrorCollector = class {
  errors = [];
  add(error) {
    this.errors.push(error);
  }
  addError(line, column, message, context) {
    this.errors.push({ line, column, message, severity: "error", context });
  }
  addWarning(line, column, message, context) {
    this.errors.push({ line, column, message, severity: "warning", context });
  }
  getErrors() {
    return [...this.errors];
  }
  hasErrors() {
    return this.errors.some((e) => e.severity === "error");
  }
  hasWarnings() {
    return this.errors.some((e) => e.severity === "warning");
  }
  clear() {
    this.errors = [];
  }
  getSummary() {
    const errors = this.errors.filter((e) => e.severity === "error").length;
    const warnings = this.errors.filter((e) => e.severity === "warning").length;
    return { errors, warnings, total: this.errors.length };
  }
};

// src/id-generator.ts
var IdGenerator = class {
  counter = 0;
  usedIds = /* @__PURE__ */ new Set();
  /**
   * 生成新的唯一短 ID
   * 规则：A, B, C, ... Z, AA, AB, ... AZ, BA, ... ZZ, AAA, ...
   */
  generate() {
    let id = this.indexToId(this.counter);
    while (this.usedIds.has(id)) {
      this.counter++;
      id = this.indexToId(this.counter);
    }
    this.counter++;
    this.usedIds.add(id);
    return id;
  }
  /**
   * 注册已存在的 ID，避免后续 generate() 生成重复
   */
  register(id) {
    this.usedIds.add(id);
  }
  /**
   * 批量注册已存在的 ID
   */
  registerMany(ids) {
    for (const id of ids) {
      this.usedIds.add(id);
    }
  }
  /**
   * 检查 ID 是否已被使用
   */
  isUsed(id) {
    return this.usedIds.has(id);
  }
  /**
   * 重置生成器（清空已用 ID 集合和计数器）
   */
  reset() {
    this.counter = 0;
    this.usedIds.clear();
  }
  /**
   * 获取所有已注册 ID（只读视图，返回副本避免外部修改）
   */
  getUsedIds() {
    return new Set(this.usedIds);
  }
  /**
   * 序号 → 字母 ID
   * 0→A, 1→B, ... 25→Z, 26→AA, 27→AB, ...
   * 算法：26 进制，但无"0"位，所以是双射计数（bijective base-26）
   */
  indexToId(index) {
    if (index < 0) return "A";
    let result = "";
    let n = index + 1;
    while (n > 0) {
      n--;
      result = String.fromCharCode(65 + n % 26) + result;
      n = Math.floor(n / 26);
    }
    return result;
  }
};
var idGenerator = new IdGenerator();

// src/parser.ts
var SHAPE_MAP = {
  rect: "rect",
  round: "rounded",
  stadium: "stadium",
  diamond: "diamond",
  circle: "circle",
  cylinder: "cylinder",
  hexagon: "hexagon",
  parallelogram: "parallelogram",
  subroutine: "subroutine",
  doublecircle: "doublecircle",
  // 扩展形状
  asymmetric: "asymmetric",
  "parallelogram-reverse": "parallelogram-reverse",
  // @crafter/mermaid-parser 使用连字符（trapezoid-alt），同时保留下划线变体兼容
  trapezoid: "trapezoid",
  "trapezoid-reverse": "trapezoid-reverse",
  "trapezoid-alt": "trapezoid-reverse",
  "trapezoid_alt": "trapezoid-reverse",
  // 兼容可能的变体
  rounded: "rounded",
  square: "rect",
  rectangle: "rect"
};
function fixUnsupportedNodeShapes(source, astNodes) {
  const patterns = [
    { regex: /^([\w-]+)\[\/(.+?)\/\]/, shape: "parallelogram", labelGroup: 2 },
    { regex: /^([\w-]+)\[\\(.+?)\\\]/, shape: "parallelogram-reverse", labelGroup: 2 }
  ];
  for (const [originalId, astNode] of astNodes) {
    if (astNode.shape !== "rectangle") continue;
    const lines = source.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith(originalId)) continue;
      for (const { regex, shape, labelGroup } of patterns) {
        const match = trimmed.match(regex);
        if (match && match[1] === originalId) {
          astNode.shape = shape;
          astNode.label = match[labelGroup];
          break;
        }
      }
    }
  }
}
function fixUnsupportedEdgeStyles(source, astEdges, astNodes) {
  const circleRegex = /^([\w-]+)\s+---o\s+([\w-]+)/;
  const crossRegex = /^([\w-]+)\s+---x\s+([\w-]+)/;
  const edgeFixes = /* @__PURE__ */ new Map();
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const circleMatch = trimmed.match(circleRegex);
    if (circleMatch) {
      edgeFixes.set(circleMatch[1], { correctTarget: circleMatch[2], style: "circle", line: i + 1 });
      continue;
    }
    const crossMatch = trimmed.match(crossRegex);
    if (crossMatch) {
      edgeFixes.set(crossMatch[1], { correctTarget: crossMatch[2], style: "cross", line: i + 1 });
    }
  }
  if (edgeFixes.size === 0) return /* @__PURE__ */ new Set();
  const fixedLines = /* @__PURE__ */ new Set();
  for (const [, fix] of edgeFixes) {
    fixedLines.add(fix.line);
  }
  const wrongNodeToCorrect = /* @__PURE__ */ new Map();
  for (const astEdge of astEdges) {
    const fix = edgeFixes.get(astEdge.source);
    if (fix) {
      const wrongTargetId = astEdge.target;
      const correctTargetId = fix.correctTarget;
      if (wrongTargetId !== correctTargetId && astNodes.has(wrongTargetId) && !wrongNodeToCorrect.has(wrongTargetId)) {
        wrongNodeToCorrect.set(wrongTargetId, correctTargetId);
      }
      astEdge.target = correctTargetId;
      astEdge.style = fix.style;
      astEdge.hasArrowEnd = false;
    }
  }
  if (wrongNodeToCorrect.size > 0) {
    const newNodes = /* @__PURE__ */ new Map();
    for (const [originalId, astNode] of astNodes) {
      const correctTargetId = wrongNodeToCorrect.get(originalId);
      if (correctTargetId) {
        if (!astNodes.has(correctTargetId) && !newNodes.has(correctTargetId)) {
          newNodes.set(correctTargetId, {
            id: correctTargetId,
            label: correctTargetId,
            shape: "rectangle"
          });
        }
      } else {
        newNodes.set(originalId, astNode);
      }
    }
    astNodes.clear();
    for (const [id, node] of newNodes) {
      astNodes.set(id, node);
    }
  }
  return fixedLines;
}
var DIRECTION_MAP = {
  TB: "TB",
  TD: "TD",
  BT: "BT",
  RL: "RL",
  LR: "LR"
};
function parseMermaid(source, errorCollector) {
  const errors = errorCollector ?? new ErrorCollector();
  const idGen = new IdGenerator();
  let result;
  try {
    result = parse(source);
  } catch (e) {
    errors.addError(0, 0, `\u89E3\u6790\u5931\u8D25: ${e instanceof Error ? e.message : String(e)}`);
    return {
      success: false,
      canvas: { nodes: [], edges: [], direction: "TD" },
      errors: errors.getErrors()
    };
  }
  if (!result.ast) {
    if (result.diagnostics) {
      for (const diag of result.diagnostics) {
        const line = diag.span?.start?.line ?? 0;
        const column = diag.span?.start?.column ?? 0;
        if (diag.severity === "error") {
          errors.addError(line, column, diag.message);
        } else {
          errors.addWarning(line, column, diag.message);
        }
      }
    }
    return {
      success: false,
      canvas: { nodes: [], edges: [], direction: "TD" },
      errors: errors.getErrors()
    };
  }
  const ast = result.ast;
  const direction = DIRECTION_MAP[ast.direction] ?? "TD";
  const astNodes = ast.nodes;
  const astEdges = ast.edges;
  if (astNodes) {
    fixUnsupportedNodeShapes(source, astNodes);
  }
  const fixedLines = astEdges && astNodes ? fixUnsupportedEdgeStyles(source, astEdges, astNodes) : /* @__PURE__ */ new Set();
  if (result.diagnostics) {
    for (const diag of result.diagnostics) {
      const line = diag.span?.start?.line ?? 0;
      const column = diag.span?.start?.column ?? 0;
      if (fixedLines.has(line) && diag.message.includes("Skipping unrecognized line")) {
        continue;
      }
      if (diag.severity === "error") {
        errors.addError(line, column, diag.message);
      } else {
        errors.addWarning(line, column, diag.message);
      }
    }
  }
  const nodes = [];
  const nodeIdMap = /* @__PURE__ */ new Map();
  if (astNodes) {
    for (const [originalId] of astNodes) {
      idGen.register(originalId);
    }
  }
  let nodeIndex = 0;
  if (astNodes) {
    for (const [originalId, astNode] of astNodes) {
      const shape = SHAPE_MAP[astNode.shape] ?? "rect";
      const canvasId = originalId;
      nodeIdMap.set(originalId, canvasId);
      const col = nodeIndex % 3;
      const row = Math.floor(nodeIndex / 3);
      const position = { x: col * 200, y: row * 120 };
      nodes.push({
        id: canvasId,
        type: shape,
        position,
        data: {
          label: astNode.label || originalId,
          shape
        }
      });
      nodeIndex++;
    }
  }
  const edges = [];
  if (astEdges) {
    let edgeIndex = 0;
    for (const astEdge of astEdges) {
      const sourceId = nodeIdMap.get(astEdge.source);
      const targetId = nodeIdMap.get(astEdge.target);
      if (!sourceId || !targetId) {
        errors.addWarning(0, 0, `\u8FB9\u5F15\u7528\u4E86\u4E0D\u5B58\u5728\u7684\u8282\u70B9: ${astEdge.source} \u2192 ${astEdge.target}`);
        continue;
      }
      const edgeStyle = mapEdgeStyle(astEdge);
      edges.push({
        id: `edge-${edgeIndex}`,
        source: sourceId,
        target: targetId,
        type: "smoothstep",
        data: {
          edgeStyle,
          label: astEdge.label
        },
        markerEnd: astEdge.hasArrowEnd ? { type: "arrowclosed" } : void 0,
        markerStart: astEdge.hasArrowStart ? { type: "arrowclosed" } : void 0
      });
      edgeIndex++;
    }
  }
  return {
    success: !errors.hasErrors(),
    canvas: { nodes, edges, direction },
    errors: errors.getErrors()
  };
}
function mapEdgeStyle(astEdge) {
  const style = astEdge.style;
  const hasArrowStart = astEdge.hasArrowStart;
  const hasArrowEnd = astEdge.hasArrowEnd;
  if (hasArrowStart && hasArrowEnd) {
    return "bidirectional";
  }
  if (!hasArrowStart && !hasArrowEnd) {
    if (style === "dotted" || style === "dashed") {
      return "dotted";
    }
    if (style === "thick" || style === "bold") {
      return "thick";
    }
    if (style === "circle") {
      return "circle";
    }
    if (style === "cross") {
      return "cross";
    }
    return "line";
  }
  if (hasArrowEnd) {
    if (style === "dotted" || style === "dashed") {
      return "dotted-arrow";
    }
    if (style === "thick" || style === "bold") {
      return "thick";
    }
    if (style === "circle") {
      return "circle";
    }
    if (style === "cross") {
      return "cross";
    }
    return "arrow";
  }
  return "arrow";
}

// src/node-serializer.ts
var SHAPE_SYNTAX_MAP = {
  rect: { open: "[", close: "]" },
  rounded: { open: "(", close: ")" },
  stadium: { open: "([", close: "])" },
  diamond: { open: "{", close: "}" },
  circle: { open: "((", close: "))" },
  cylinder: { open: "[(", close: ")]" },
  hexagon: { open: "{{", close: "}}" },
  parallelogram: { open: "[/", close: "/]" },
  subroutine: { open: "[[", close: "]]" },
  doublecircle: { open: "(((", close: ")))" },
  // 扩展形状
  asymmetric: { open: ">", close: "]" },
  "parallelogram-reverse": { open: "[\\", close: "\\]" },
  trapezoid: { open: "[/", close: "\\]" },
  "trapezoid-reverse": { open: "[\\", close: "/]" }
};
function serializeNode(node) {
  const syntax = SHAPE_SYNTAX_MAP[node.data.shape] ?? SHAPE_SYNTAX_MAP.rect;
  const label = escapeLabel(node.data.label);
  return `${node.id}${syntax.open}${label}${syntax.close}`;
}
function getShapeSyntax(shape) {
  return SHAPE_SYNTAX_MAP[shape] ?? SHAPE_SYNTAX_MAP.rect;
}
function escapeLabel(label) {
  return label.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\[/g, "\\[").replace(/\]/g, "\\]").replace(/\{/g, "\\{").replace(/\}/g, "\\}").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
function unescapeLabel(label) {
  return label.replace(/\\(.)/g, "$1");
}

// src/edge-serializer.ts
var EDGE_SYNTAX_MAP = {
  arrow: { line: "--", startMarker: "", endMarker: ">" },
  // -->
  line: { line: "---", startMarker: "", endMarker: "" },
  // ---
  dotted: { line: "-.-", startMarker: "", endMarker: "" },
  // -.-
  "dotted-arrow": { line: "-.-", startMarker: "", endMarker: ">" },
  // -.->
  thick: { line: "==", startMarker: "", endMarker: ">" },
  // ==>
  circle: { line: "---", startMarker: "", endMarker: "o" },
  // ---o
  cross: { line: "---", startMarker: "", endMarker: "x" },
  // ---x
  bidirectional: { line: "---", startMarker: "<", endMarker: ">" }
  // <--->
};
function serializeEdge(edge) {
  const syntax = EDGE_SYNTAX_MAP[edge.data.edgeStyle] ?? EDGE_SYNTAX_MAP.arrow;
  const label = edge.data.label;
  let connection = syntax.line;
  if (syntax.startMarker) {
    connection = syntax.startMarker + connection;
  }
  if (syntax.endMarker) {
    connection = connection + syntax.endMarker;
  }
  if (label && label.trim()) {
    connection = `${connection}|${escapeLabel2(label)}|`;
  }
  return `${edge.source} ${connection} ${edge.target}`;
}
function getEdgeSyntax(style) {
  return EDGE_SYNTAX_MAP[style] ?? EDGE_SYNTAX_MAP.arrow;
}
function escapeLabel2(label) {
  return label.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

// src/serializer.ts
function serializeMermaid(canvas) {
  const lines = [];
  lines.push(`flowchart ${canvas.direction}`);
  if (canvas.nodes.length === 0 && canvas.edges.length === 0) {
    return {
      mermaid: lines.join("\n"),
      errors: []
    };
  }
  const nodeLines = [];
  for (const node of canvas.nodes) {
    nodeLines.push(`  ${serializeNode(node)}`);
  }
  const edgeLines = [];
  for (const edge of canvas.edges) {
    edgeLines.push(`  ${serializeEdge(edge)}`);
  }
  const allLines = [...nodeLines, ...edgeLines];
  lines.push(allLines.join("\n"));
  return {
    mermaid: lines.join("\n"),
    errors: []
  };
}
export {
  ErrorCollector,
  IdGenerator,
  getEdgeSyntax,
  getShapeSyntax,
  idGenerator,
  parseMermaid,
  serializeEdge,
  serializeMermaid,
  serializeNode,
  unescapeLabel
};
