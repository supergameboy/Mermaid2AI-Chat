import { jsxs as s, jsx as e, Fragment as Te } from "react/jsx-runtime";
import { memo as se, useRef as A, useState as W, useEffect as P, useCallback as C, useMemo as Se } from "react";
import { Handle as K, Position as O, getSmoothStepPath as Re, BaseEdge as De, EdgeLabelRenderer as Me, ReactFlowProvider as Le, useReactFlow as Ie, useNodesState as ze, useEdgesState as Ae, addEdge as We, ReactFlow as Be, Background as _e, Controls as Pe, MiniMap as Xe } from "@xyflow/react";
import { serializeMermaid as Fe, layoutCanvas as Ke } from "@mermaid-editor/serializer";
const Y = { width: 8, height: 8 }, $ = se(({ data: t, selected: c }) => {
  const d = t.shape, r = t.style, m = (r == null ? void 0 : r.stroke) ?? "#333", f = (r == null ? void 0 : r.fill) ?? "#fff", v = (r == null ? void 0 : r.color) ?? "#333";
  return /* @__PURE__ */ s("div", { className: "mermaid-node", style: { position: "relative", display: "inline-block" }, children: [
    /* @__PURE__ */ e(K, { type: "target", position: O.Top, style: Y }),
    /* @__PURE__ */ e(K, { type: "target", position: O.Left, style: Y }),
    /* @__PURE__ */ e(Oe, { shape: d, label: t.label, stroke: m, fill: f, color: v, selected: c }),
    /* @__PURE__ */ e(K, { type: "source", position: O.Bottom, style: Y }),
    /* @__PURE__ */ e(K, { type: "source", position: O.Right, style: Y })
  ] });
});
$.displayName = "MermaidNode";
function Oe({
  shape: t,
  label: c,
  stroke: d,
  fill: r,
  color: m,
  selected: f
}) {
  const v = c.split(/<\/br>|<br\s*\/?>/i), h = v.length, k = 8, l = 24, D = Math.max(...v.map((i) => i.length), 1), n = Math.max(D * k, 60) + l * 2, M = 20, a = Math.max(48, h * M + 12), b = f ? 3 : 2, x = f ? "#1890ff" : d, B = {
    fill: m,
    fontSize: "14px",
    textAnchor: "middle",
    dominantBaseline: "central",
    userSelect: "none",
    pointerEvents: "none"
  }, N = (i, u) => {
    if (h === 1)
      return /* @__PURE__ */ e("text", { x: i, y: u, style: B, children: c });
    const L = u - (h - 1) * M / 2;
    return /* @__PURE__ */ e("text", { x: i, y: L, style: B, children: v.map((S, R) => /* @__PURE__ */ e("tspan", { x: i, dy: R === 0 ? 0 : M, children: S }, R)) });
  };
  switch (t) {
    case "rect":
      return /* @__PURE__ */ s("svg", { width: n, height: a, style: { display: "block" }, children: [
        /* @__PURE__ */ e("rect", { x: 1, y: 1, width: n - 2, height: a - 2, fill: r, stroke: x, strokeWidth: b }),
        N(n / 2, a / 2)
      ] });
    case "rounded":
      return /* @__PURE__ */ s("svg", { width: n, height: a, style: { display: "block" }, children: [
        /* @__PURE__ */ e("rect", { x: 1, y: 1, width: n - 2, height: a - 2, rx: 12, ry: 12, fill: r, stroke: x, strokeWidth: b }),
        N(n / 2, a / 2)
      ] });
    case "stadium":
      return /* @__PURE__ */ s("svg", { width: n, height: a, style: { display: "block" }, children: [
        /* @__PURE__ */ e("rect", { x: 1, y: 1, width: n - 2, height: a - 2, rx: a / 2, ry: a / 2, fill: r, stroke: x, strokeWidth: b }),
        N(n / 2, a / 2)
      ] });
    case "diamond": {
      const i = n / 2, u = a / 2, L = n / 2, S = a / 2, R = `${i},${u - S} ${i + L},${u} ${i},${u + S} ${i - L},${u}`;
      return /* @__PURE__ */ s("svg", { width: n, height: a, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: R, fill: r, stroke: x, strokeWidth: b }),
        N(i, u)
      ] });
    }
    case "circle": {
      const i = Math.max(n, a), u = i / 2 - 2;
      return /* @__PURE__ */ s("svg", { width: i, height: i, style: { display: "block" }, children: [
        /* @__PURE__ */ e("circle", { cx: i / 2, cy: i / 2, r: u, fill: r, stroke: x, strokeWidth: b }),
        N(i / 2, i / 2)
      ] });
    }
    case "cylinder":
      return /* @__PURE__ */ s("svg", { width: n, height: a, style: { display: "block" }, children: [
        /* @__PURE__ */ e(
          "path",
          {
            d: `M 1 8 L 1 ${a - 8} Q ${n / 2} ${a + 8 - 4} ${n - 1} ${a - 8} L ${n - 1} 8`,
            fill: r,
            stroke: x,
            strokeWidth: b
          }
        ),
        /* @__PURE__ */ e("ellipse", { cx: n / 2, cy: 8, rx: n / 2 - 1, ry: 8, fill: r, stroke: x, strokeWidth: b }),
        N(n / 2, a / 2)
      ] });
    case "hexagon": {
      const u = `20,1 ${n - 20},1 ${n - 1},${a / 2} ${n - 20},${a - 1} 20,${a - 1} 1,${a / 2}`;
      return /* @__PURE__ */ s("svg", { width: n, height: a, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: u, fill: r, stroke: x, strokeWidth: b }),
        N(n / 2, a / 2)
      ] });
    }
    case "parallelogram": {
      const u = `16,1 ${n - 1},1 ${n - 16},${a - 1} 1,${a - 1}`;
      return /* @__PURE__ */ s("svg", { width: n, height: a, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: u, fill: r, stroke: x, strokeWidth: b }),
        N(n / 2, a / 2)
      ] });
    }
    case "subroutine":
      return /* @__PURE__ */ s("svg", { width: n, height: a, style: { display: "block" }, children: [
        /* @__PURE__ */ e("rect", { x: 1, y: 1, width: n - 2, height: a - 2, fill: r, stroke: x, strokeWidth: b }),
        /* @__PURE__ */ e("line", { x1: 10, y1: 1, x2: 10, y2: a - 1, stroke: x, strokeWidth: b }),
        /* @__PURE__ */ e("line", { x1: n - 10, y1: 1, x2: n - 10, y2: a - 1, stroke: x, strokeWidth: b }),
        N(n / 2, a / 2)
      ] });
    case "doublecircle": {
      const i = Math.max(n, a), u = i / 2 - 2, L = u - 6;
      return /* @__PURE__ */ s("svg", { width: i, height: i, style: { display: "block" }, children: [
        /* @__PURE__ */ e("circle", { cx: i / 2, cy: i / 2, r: u, fill: r, stroke: x, strokeWidth: b }),
        /* @__PURE__ */ e("circle", { cx: i / 2, cy: i / 2, r: L, fill: "none", stroke: x, strokeWidth: b }),
        N(i / 2, i / 2)
      ] });
    }
    case "asymmetric": {
      const u = `1,1 ${n - 20},1 ${n - 1},${a / 2} ${n - 20},${a - 1} 1,${a - 1}`;
      return /* @__PURE__ */ s("svg", { width: n, height: a, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: u, fill: r, stroke: x, strokeWidth: b }),
        N(n / 2 - 20 / 2, a / 2)
      ] });
    }
    case "parallelogram-reverse": {
      const u = `1,1 ${n - 16},1 ${n - 1},${a - 1} 16,${a - 1}`;
      return /* @__PURE__ */ s("svg", { width: n, height: a, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: u, fill: r, stroke: x, strokeWidth: b }),
        N(n / 2, a / 2)
      ] });
    }
    case "trapezoid": {
      const u = `20,1 ${n - 20},1 ${n - 1},${a - 1} 1,${a - 1}`;
      return /* @__PURE__ */ s("svg", { width: n, height: a, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: u, fill: r, stroke: x, strokeWidth: b }),
        N(n / 2, a / 2)
      ] });
    }
    case "trapezoid-reverse": {
      const u = `1,1 ${n - 1},1 ${n - 20},${a - 1} 20,${a - 1}`;
      return /* @__PURE__ */ s("svg", { width: n, height: a, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: u, fill: r, stroke: x, strokeWidth: b }),
        N(n / 2, a / 2)
      ] });
    }
    default:
      return /* @__PURE__ */ s("svg", { width: n, height: a, style: { display: "block" }, children: [
        /* @__PURE__ */ e("rect", { x: 1, y: 1, width: n - 2, height: a - 2, fill: r, stroke: x, strokeWidth: b }),
        N(n / 2, a / 2)
      ] });
  }
}
const Ye = {
  rect: $,
  rounded: $,
  stadium: $,
  diamond: $,
  circle: $,
  cylinder: $,
  hexagon: $,
  parallelogram: $,
  subroutine: $,
  doublecircle: $,
  // 扩展形状
  asymmetric: $,
  "parallelogram-reverse": $,
  trapezoid: $,
  "trapezoid-reverse": $
}, ae = {
  arrow: { markerEndType: "custom:arrow" },
  line: {},
  dotted: {},
  "dotted-arrow": { markerEndType: "custom:arrow" },
  thick: { markerEndType: "custom:arrow" },
  circle: { markerEndType: "custom:circle" },
  cross: { markerEndType: "custom:cross" },
  bidirectional: { markerStartType: "custom:arrow", markerEndType: "custom:arrow" }
};
function Ue(t) {
  return ae[t] ?? ae.arrow;
}
function He(t) {
  return (t == null ? void 0 : t.startsWith("custom:")) ?? !1;
}
function Ve(t) {
  return `mermaid-${t.replace("custom:", "")}-marker`;
}
function le(t) {
  if (!(!t || !He(t)))
    return `url(#${Ve(t)})`;
}
const Ge = {
  arrow: { stroke: "#333", strokeWidth: 2 },
  line: { stroke: "#333", strokeWidth: 2 },
  dotted: { stroke: "#333", strokeWidth: 2, strokeDasharray: "5,5" },
  "dotted-arrow": { stroke: "#333", strokeWidth: 2, strokeDasharray: "5,5" },
  thick: { stroke: "#333", strokeWidth: 4 },
  circle: { stroke: "#333", strokeWidth: 2 },
  cross: { stroke: "#333", strokeWidth: 2 },
  bidirectional: { stroke: "#333", strokeWidth: 2 }
}, q = se(({
  id: t,
  sourceX: c,
  sourceY: d,
  targetX: r,
  targetY: m,
  sourcePosition: f,
  targetPosition: v,
  data: h,
  selected: k
}) => {
  const l = h, D = (l == null ? void 0 : l.edgeStyle) ?? "arrow", T = Ge[D], n = Ue(D), M = le(n.markerEndType), a = le(n.markerStartType), [b, x, B] = Re({
    sourceX: c,
    sourceY: d,
    sourcePosition: f,
    targetX: r,
    targetY: m,
    targetPosition: v
  });
  return /* @__PURE__ */ s(Te, { children: [
    /* @__PURE__ */ e(
      De,
      {
        id: t,
        path: b,
        style: {
          ...T,
          ...k ? { stroke: "#1890ff", strokeWidth: (T.strokeWidth ?? 2) + 1 } : {}
        },
        markerEnd: M,
        markerStart: a
      }
    ),
    (l == null ? void 0 : l.label) && /* @__PURE__ */ e(Me, { children: /* @__PURE__ */ e(
      "div",
      {
        style: {
          position: "absolute",
          transform: `translate(-50%, -50%) translate(${x}px, ${B}px)`,
          background: "#fff",
          padding: "2px 8px",
          borderRadius: "4px",
          fontSize: "12px",
          border: "1px solid #d9d9d9",
          pointerEvents: "all"
        },
        className: "edge-label",
        children: l.label
      }
    ) })
  ] });
});
q.displayName = "MermaidEdge";
const je = {
  default: q,
  smoothstep: q
}, qe = ["TB", "TD", "BT", "RL", "LR"];
function Qe({ direction: t, onDirectionChange: c, mermaidCode: d, onImport: r }) {
  const m = A(null), f = () => {
    const l = new Blob([d], { type: "text/plain;charset=utf-8" }), D = URL.createObjectURL(l), T = document.createElement("a");
    T.href = D, T.download = `flowchart-${Date.now()}.mmd`, document.body.appendChild(T), T.click(), document.body.removeChild(T), URL.revokeObjectURL(D);
  }, v = async () => {
    try {
      await navigator.clipboard.writeText(d);
    } catch {
    }
  }, h = () => {
    var l;
    (l = m.current) == null || l.click();
  }, k = (l) => {
    var n;
    const D = (n = l.target.files) == null ? void 0 : n[0];
    if (!D) return;
    const T = new FileReader();
    T.onload = (M) => {
      var b;
      const a = (b = M.target) == null ? void 0 : b.result;
      typeof a == "string" && r(a);
    }, T.readAsText(D, "utf-8"), l.target.value = "";
  };
  return /* @__PURE__ */ s("div", { className: "toolbar", children: [
    /* @__PURE__ */ s("div", { className: "toolbar-section", children: [
      /* @__PURE__ */ e("span", { className: "toolbar-label", children: "方向:" }),
      /* @__PURE__ */ e(
        "select",
        {
          value: t,
          onChange: (l) => c(l.target.value),
          className: "toolbar-select",
          children: qe.map((l) => /* @__PURE__ */ e("option", { value: l, children: l }, l))
        }
      )
    ] }),
    /* @__PURE__ */ e("div", { className: "toolbar-section", children: /* @__PURE__ */ e("h1", { className: "toolbar-title", children: "Mermaid 反向编辑器" }) }),
    /* @__PURE__ */ s("div", { className: "toolbar-section toolbar-actions", children: [
      /* @__PURE__ */ e(
        "input",
        {
          ref: m,
          type: "file",
          accept: ".mmd,.txt,.mermaid",
          style: { display: "none" },
          onChange: k
        }
      ),
      /* @__PURE__ */ e("button", { type: "button", className: "toolbar-btn", onClick: h, title: "导入 .mmd 文件", children: "导入" }),
      /* @__PURE__ */ e("button", { type: "button", className: "toolbar-btn", onClick: v, title: "复制 Mermaid 代码到剪贴板", children: "复制代码" }),
      /* @__PURE__ */ e("button", { type: "button", className: "toolbar-btn", onClick: f, title: "导出为 .mmd 文件", children: "导出" })
    ] })
  ] });
}
const Je = [
  // 基础10种
  { type: "rect", label: "矩形", icon: "▭" },
  { type: "rounded", label: "圆角", icon: "▢" },
  { type: "stadium", label: "体育场", icon: "⬭" },
  { type: "diamond", label: "菱形", icon: "◇" },
  { type: "circle", label: "圆形", icon: "○" },
  { type: "cylinder", label: "圆柱", icon: "⌭" },
  { type: "hexagon", label: "六边形", icon: "⬡" },
  { type: "parallelogram", label: "平行四边形", icon: "▱" },
  { type: "subroutine", label: "子程序", icon: "⫼" },
  { type: "doublecircle", label: "双圆", icon: "◎" },
  // 扩展4种
  { type: "asymmetric", label: "不对称", icon: "▶" },
  { type: "parallelogram-reverse", label: "反向平行", icon: " ◢" },
  { type: "trapezoid", label: "梯形", icon: "⏢" },
  { type: "trapezoid-reverse", label: "反向梯形", icon: "⏃" }
];
function Ze({ onAddNode: t }) {
  const c = (d, r) => {
    d.dataTransfer.setData("application/mermaid-shape", r), d.dataTransfer.effectAllowed = "move";
  };
  return /* @__PURE__ */ s("div", { className: "node-library", children: [
    /* @__PURE__ */ e("h3", { className: "library-title", children: "节点库" }),
    /* @__PURE__ */ e("div", { className: "node-list", children: Je.map((d) => /* @__PURE__ */ s(
      "button",
      {
        className: "node-item",
        draggable: !0,
        onDragStart: (r) => c(r, d.type),
        onClick: () => t(d.type),
        title: `点击添加或拖拽到画布：${d.label}`,
        children: [
          /* @__PURE__ */ e("span", { className: "node-icon", children: d.icon }),
          /* @__PURE__ */ e("span", { className: "node-label", children: d.label })
        ]
      },
      d.type
    )) })
  ] });
}
function et({ consumed: t, canvasSource: c, lastConsumedAt: d, onReset: r }) {
  let m = "", f = "";
  c === null ? (m = "空画布", f = "status-empty") : !t && c === "user" ? (m = "待消费（用户绘制）", f = "status-pending") : t && c === "user" ? (m = "已消费", f = "status-consumed") : t && c === "ai" && (m = "AI生成内容（已消费）", f = "status-ai");
  const v = d ? new Date(d).toLocaleTimeString("zh-CN") : "";
  return /* @__PURE__ */ s("div", { className: `consumed-badge ${f}`, children: [
    /* @__PURE__ */ e("span", { className: "status-text", children: m }),
    v && /* @__PURE__ */ e("span", { className: "status-time", children: v }),
    t && /* @__PURE__ */ e("button", { className: "reset-button", onClick: r, children: "重新启用" })
  ] });
}
const tt = {
  connected: { color: "#52c41a", text: "已连接" },
  reconnecting: { color: "#faad14", text: "重连中..." },
  disconnected: { color: "#ff4d4f", text: "已断开" }
};
function nt({ status: t }) {
  const c = tt[t];
  return /* @__PURE__ */ s("div", { className: "connection-status", children: [
    /* @__PURE__ */ e("span", { className: "status-dot", style: { backgroundColor: c.color } }),
    /* @__PURE__ */ e("span", { className: "status-label", children: c.text })
  ] });
}
const at = [
  { value: "rect", label: "矩形" },
  { value: "rounded", label: "圆角" },
  { value: "stadium", label: "体育场" },
  { value: "diamond", label: "菱形" },
  { value: "circle", label: "圆形" },
  { value: "cylinder", label: "圆柱" },
  { value: "hexagon", label: "六边形" },
  { value: "parallelogram", label: "平行四边形" },
  { value: "subroutine", label: "子程序" },
  { value: "doublecircle", label: "双圆" },
  { value: "asymmetric", label: "不对称" },
  { value: "parallelogram-reverse", label: "反向平行四边形" },
  { value: "trapezoid", label: "梯形" },
  { value: "trapezoid-reverse", label: "反向梯形" }
], lt = [
  { value: "arrow", label: "实线箭头 (-->)" },
  { value: "line", label: "实线 (---)" },
  { value: "dotted", label: "虚线 (-.-)" },
  { value: "dotted-arrow", label: "虚线箭头 (-.->)" },
  { value: "thick", label: "粗线箭头 (==>)" },
  { value: "circle", label: "圆形端点 (---o)" },
  { value: "cross", label: "交叉端点 (---x)" },
  { value: "bidirectional", label: "双向箭头 (<--->)" }
];
function ot({ selectedNode: t, selectedEdge: c, onUpdateNode: d, onUpdateEdge: r }) {
  var m, f, v;
  return !t && !c ? /* @__PURE__ */ s("div", { className: "property-panel", children: [
    /* @__PURE__ */ e("h3", { className: "panel-title", children: "属性面板" }),
    /* @__PURE__ */ e("p", { className: "panel-hint", children: "选中节点或边以编辑属性" })
  ] }) : t ? /* @__PURE__ */ s("div", { className: "property-panel", children: [
    /* @__PURE__ */ e("h3", { className: "panel-title", children: "节点属性" }),
    /* @__PURE__ */ s("div", { className: "panel-content", children: [
      /* @__PURE__ */ s("label", { className: "panel-label", children: [
        "文本",
        /* @__PURE__ */ e(
          "input",
          {
            className: "panel-input",
            type: "text",
            value: t.data.label,
            onChange: (h) => d(t.id, { label: h.target.value })
          }
        )
      ] }),
      /* @__PURE__ */ s("label", { className: "panel-label", children: [
        "形状",
        /* @__PURE__ */ e(
          "select",
          {
            className: "panel-select",
            value: t.data.shape,
            onChange: (h) => {
              const k = h.target.value;
              d(t.id, { shape: k });
            },
            children: at.map((h) => /* @__PURE__ */ e("option", { value: h.value, children: h.label }, h.value))
          }
        )
      ] }),
      /* @__PURE__ */ e("div", { className: "panel-section-title", children: "样式" }),
      /* @__PURE__ */ s("label", { className: "panel-label panel-color-row", children: [
        "填充色",
        /* @__PURE__ */ e(
          "input",
          {
            className: "panel-color",
            type: "color",
            value: ((m = t.data.style) == null ? void 0 : m.fill) ?? "#ffffff",
            onChange: (h) => d(t.id, {
              style: { ...t.data.style, fill: h.target.value }
            })
          }
        )
      ] }),
      /* @__PURE__ */ s("label", { className: "panel-label panel-color-row", children: [
        "边框色",
        /* @__PURE__ */ e(
          "input",
          {
            className: "panel-color",
            type: "color",
            value: ((f = t.data.style) == null ? void 0 : f.stroke) ?? "#333333",
            onChange: (h) => d(t.id, {
              style: { ...t.data.style, stroke: h.target.value }
            })
          }
        )
      ] }),
      /* @__PURE__ */ s("label", { className: "panel-label panel-color-row", children: [
        "文字色",
        /* @__PURE__ */ e(
          "input",
          {
            className: "panel-color",
            type: "color",
            value: ((v = t.data.style) == null ? void 0 : v.color) ?? "#333333",
            onChange: (h) => d(t.id, {
              style: { ...t.data.style, color: h.target.value }
            })
          }
        )
      ] }),
      /* @__PURE__ */ e(
        "button",
        {
          className: "panel-reset-btn",
          type: "button",
          onClick: () => d(t.id, { style: void 0 }),
          children: "重置样式"
        }
      ),
      /* @__PURE__ */ s("div", { className: "panel-info", children: [
        /* @__PURE__ */ e("span", { className: "info-label", children: "ID:" }),
        /* @__PURE__ */ e("span", { className: "info-value", children: t.id })
      ] }),
      /* @__PURE__ */ s("div", { className: "panel-info", children: [
        /* @__PURE__ */ e("span", { className: "info-label", children: "位置:" }),
        /* @__PURE__ */ s("span", { className: "info-value", children: [
          "(",
          Math.round(t.position.x),
          ", ",
          Math.round(t.position.y),
          ")"
        ] })
      ] })
    ] })
  ] }) : c ? /* @__PURE__ */ s("div", { className: "property-panel", children: [
    /* @__PURE__ */ e("h3", { className: "panel-title", children: "边属性" }),
    /* @__PURE__ */ s("div", { className: "panel-content", children: [
      /* @__PURE__ */ s("label", { className: "panel-label", children: [
        "标签",
        /* @__PURE__ */ e(
          "input",
          {
            className: "panel-input",
            type: "text",
            value: c.data.label ?? "",
            placeholder: "（无标签）",
            onChange: (h) => r(c.id, { label: h.target.value })
          }
        )
      ] }),
      /* @__PURE__ */ s("label", { className: "panel-label", children: [
        "样式",
        /* @__PURE__ */ e(
          "select",
          {
            className: "panel-select",
            value: c.data.edgeStyle,
            onChange: (h) => {
              const k = h.target.value;
              r(c.id, { edgeStyle: k });
            },
            children: lt.map((h) => /* @__PURE__ */ e("option", { value: h.value, children: h.label }, h.value))
          }
        )
      ] }),
      /* @__PURE__ */ s("div", { className: "panel-info", children: [
        /* @__PURE__ */ e("span", { className: "info-label", children: "ID:" }),
        /* @__PURE__ */ e("span", { className: "info-value", children: c.id })
      ] }),
      /* @__PURE__ */ s("div", { className: "panel-info", children: [
        /* @__PURE__ */ e("span", { className: "info-label", children: "连接:" }),
        /* @__PURE__ */ s("span", { className: "info-value", children: [
          c.source,
          " → ",
          c.target
        ] })
      ] })
    ] })
  ] }) : null;
}
function oe({ value: t, onConfirm: c, onCancel: d }) {
  const [r, m] = W(t), f = A(null);
  return P(() => {
    var k, l;
    (k = f.current) == null || k.focus(), (l = f.current) == null || l.select();
  }, []), /* @__PURE__ */ e(
    "input",
    {
      ref: f,
      className: "inline-editor",
      value: r,
      onChange: (k) => m(k.target.value),
      onKeyDown: (k) => {
        k.key === "Enter" ? (k.preventDefault(), c(r)) : k.key === "Escape" && (k.preventDefault(), d());
      },
      onBlur: () => {
        c(r);
      },
      style: {
        width: "100%",
        padding: "4px 8px",
        fontSize: "14px",
        border: "2px solid #1890ff",
        borderRadius: "4px",
        outline: "none",
        background: "#fff"
      }
    }
  );
}
function rt({ code: t, onApply: c }) {
  const [d, r] = W(t), [m, f] = W(!1), v = A(null);
  P(() => {
    m || r(t);
  }, [t, m]);
  const h = () => {
    var l;
    c(d), f(!1), (l = v.current) == null || l.blur();
  };
  return /* @__PURE__ */ s("div", { className: "code-editor", children: [
    /* @__PURE__ */ s("div", { className: "code-editor-title", children: [
      /* @__PURE__ */ e("span", { children: "Mermaid 代码" }),
      /* @__PURE__ */ e(
        "button",
        {
          type: "button",
          className: "code-editor-apply-btn",
          onClick: h,
          title: "应用代码到画布 (Ctrl+Enter)",
          children: "应用"
        }
      )
    ] }),
    /* @__PURE__ */ e(
      "textarea",
      {
        ref: v,
        className: "code-editor-content",
        value: d,
        onChange: (l) => r(l.target.value),
        onFocus: () => f(!0),
        onKeyDown: (l) => {
          (l.ctrlKey || l.metaKey) && l.key === "Enter" && (l.preventDefault(), h());
        },
        spellCheck: !1,
        placeholder: `flowchart TD
A[节点A] --> B[节点B]`
      }
    )
  ] });
}
function st({ tabs: t, activeTabId: c, onTabSwitch: d, onTabClose: r }) {
  return t.length === 0 ? null : /* @__PURE__ */ e("div", { className: "tab-bar", children: t.map((m) => {
    const f = m.id === c, v = m.title ?? "未命名", h = m.canvasSource === "ai" ? "🤖" : "";
    return /* @__PURE__ */ s(
      "div",
      {
        className: `tab-item ${f ? "tab-item-active" : ""}`,
        onClick: () => d(m.id),
        title: v,
        children: [
          /* @__PURE__ */ s("span", { className: "tab-item-title", children: [
            h && /* @__PURE__ */ e("span", { className: "tab-source-badge", children: h }),
            v
          ] }),
          t.length > 1 && /* @__PURE__ */ e(
            "button",
            {
              type: "button",
              className: "tab-close-btn",
              onClick: (k) => {
                k.stopPropagation(), r(m.id);
              },
              title: "关闭标签页",
              children: "×"
            }
          )
        ]
      },
      m.id
    );
  }) });
}
let it = 0;
function j() {
  return `node_${Date.now()}_${it++}`;
}
const re = /* @__PURE__ */ new Set(["measured", "dimensions"]);
function ct(t) {
  const {
    syncNodes: c,
    syncEdges: d,
    syncDirection: r,
    syncViewport: m,
    consumed: f,
    canvasSource: v,
    lastConsumedAt: h,
    connectionStatus: k,
    onCanvasEdit: l,
    onDirectionChange: D,
    onResetConsumed: T,
    onViewportChange: n,
    onImport: M,
    tabs: a,
    activeTabId: b,
    onTabSwitch: x,
    onTabClose: B
  } = t, N = Ie(), [i, u, L] = ze(c), [S, R, Q] = Ae(d), [J, ie] = W(null), [Z, ce] = W(null), [ee, X] = W(null), [te, F] = W(null), U = A(i), z = A(S), _ = A(r);
  U.current = i, z.current = S, _.current = r;
  const H = A(!1);
  P(() => {
    u(c);
  }, [c, u]), P(() => {
    R(d);
  }, [d, R]), P(() => {
    m !== null && (H.current = !0, N.setViewport({ x: m.x, y: m.y, zoom: m.zoom }), requestAnimationFrame(() => {
      H.current = !1;
    }));
  }, [m, N]);
  const w = C(() => ({
    nodes: U.current,
    edges: z.current,
    direction: _.current
  }), []), de = C(
    (o) => {
      L(o), o.some((g) => !re.has(g.type)) && setTimeout(() => {
        l(w());
      }, 0);
    },
    [L, l, w]
  ), ue = C(
    (o) => {
      Q(o), o.some((g) => !re.has(g.type)) && setTimeout(() => {
        l(w());
      }, 0);
    },
    [Q, l, w]
  ), pe = C(
    (o) => {
      const p = {
        ...o,
        id: `edge_${Date.now()}`,
        type: "smoothstep",
        data: { edgeStyle: "arrow" }
      };
      R((g) => We(p, g)), setTimeout(() => {
        l(w());
      }, 0);
    },
    [R, l, w]
  ), he = C(
    (o) => {
      const p = {
        id: j(),
        type: o,
        position: { x: Math.random() * 300 + 100, y: Math.random() * 200 + 100 },
        data: {
          label: "新节点",
          shape: o
        }
      };
      u((g) => {
        const y = [...g, p];
        return setTimeout(() => {
          l({
            nodes: y,
            edges: z.current,
            direction: _.current
          });
        }, 0), y;
      });
    },
    [u, l]
  ), me = C(
    (o) => {
      o.preventDefault();
      const p = o.dataTransfer.getData("application/mermaid-shape");
      if (!p) return;
      const g = N.screenToFlowPosition({
        x: o.clientX,
        y: o.clientY
      }), y = {
        id: j(),
        type: p,
        position: g,
        data: { label: "新节点", shape: p }
      };
      u((I) => {
        const E = [...I, y];
        return setTimeout(() => {
          l({
            nodes: E,
            edges: z.current,
            direction: _.current
          });
        }, 0), E;
      });
    },
    [N, u, l]
  ), ye = C((o) => {
    o.preventDefault(), o.dataTransfer.dropEffect = "move";
  }, []), fe = C(
    (o) => {
      if (!o.target.classList.contains("react-flow__pane")) return;
      const g = N.screenToFlowPosition({
        x: o.clientX,
        y: o.clientY
      }), y = {
        id: j(),
        type: "rect",
        position: g,
        data: { label: "新节点", shape: "rect" }
      };
      u((I) => {
        const E = [...I, y];
        return setTimeout(() => {
          l({
            nodes: E,
            edges: z.current,
            direction: _.current
          });
        }, 0), E;
      });
    },
    [N, u, l]
  ), be = C((o, p) => {
    X(p.id), F(null);
  }, []), ge = C((o, p) => {
    F(p.id), X(null);
  }, []), ve = C((o, p) => {
    u(
      (g) => g.map((y) => y.id === o ? { ...y, data: { ...y.data, label: p } } : y)
    ), X(null), setTimeout(() => {
      l(w());
    }, 0);
  }, [u, l, w]), ke = C((o, p) => {
    R(
      (g) => g.map((y) => y.id === o ? { ...y, data: { ...y.data, label: p || void 0 } } : y)
    ), F(null), setTimeout(() => {
      l(w());
    }, 0);
  }, [R, l, w]), Ne = C(({ nodes: o, edges: p }) => {
    ie(o.length === 1 ? o[0].id : null), ce(p.length === 1 ? p[0].id : null);
  }, []), xe = C(
    (o, p) => {
      H.current || n({ x: p.x, y: p.y, zoom: p.zoom });
    },
    [n]
  ), we = C((o, p) => {
    u((g) => g.map((y) => {
      if (y.id !== o) return y;
      const I = { ...y.data, ...p }, E = p.shape ?? y.type;
      return { ...y, type: E, data: I };
    })), setTimeout(() => {
      l(w());
    }, 0);
  }, [u, l, w]), Ce = C((o, p) => {
    R((g) => g.map((y) => y.id === o ? { ...y, data: { ...y.data, ...p } } : y)), setTimeout(() => {
      l(w());
    }, 0);
  }, [R, l, w]);
  P(() => {
    const o = (p) => {
      if (p.key === "Delete" || p.key === "Backspace") {
        const g = p.target;
        if (g.tagName === "INPUT" || g.tagName === "SELECT" || g.tagName === "TEXTAREA")
          return;
        const y = U.current.filter((E) => E.selected), I = z.current.filter((E) => E.selected);
        (y.length > 0 || I.length > 0) && (p.preventDefault(), N.deleteElements({
          nodes: y.map((E) => ({ id: E.id })),
          edges: I.map((E) => ({ id: E.id }))
        }), setTimeout(() => {
          l(w());
        }, 0));
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
  }, [N, l, w]);
  const V = ee ? i.find((o) => o.id === ee) : null, G = te ? S.find((o) => o.id === te) : null, Ee = J ? i.find((o) => o.id === J) ?? null : null, $e = Z ? S.find((o) => o.id === Z) ?? null : null, ne = Se(() => Fe({ nodes: i, edges: S, direction: r }).mermaid, [i, S, r]);
  return /* @__PURE__ */ s("div", { className: "app-container", children: [
    /* @__PURE__ */ e(
      Qe,
      {
        direction: r,
        mermaidCode: ne,
        onImport: M,
        onDirectionChange: (o) => {
          const p = i.map((g) => ({ ...g }));
          Ke(p, S, o), u(p), _.current = o, D(o), l({ nodes: p, edges: z.current, direction: o });
        }
      }
    ),
    /* @__PURE__ */ e(
      st,
      {
        tabs: a,
        activeTabId: b,
        onTabSwitch: x,
        onTabClose: B
      }
    ),
    /* @__PURE__ */ s("div", { className: "main-content", children: [
      /* @__PURE__ */ s("div", { className: "left-panel", children: [
        /* @__PURE__ */ e(rt, { code: ne, onApply: M }),
        /* @__PURE__ */ e(Ze, { onAddNode: he })
      ] }),
      /* @__PURE__ */ s("div", { className: "canvas-container", onDoubleClick: fe, children: [
        /* @__PURE__ */ e("svg", { width: "0", height: "0", style: { position: "absolute" }, children: /* @__PURE__ */ s("defs", { children: [
          /* @__PURE__ */ e(
            "marker",
            {
              id: "mermaid-arrow-marker",
              viewBox: "0 0 10 10",
              refX: "9",
              refY: "5",
              markerWidth: "6",
              markerHeight: "6",
              orient: "auto",
              children: /* @__PURE__ */ e("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "#333" })
            }
          ),
          /* @__PURE__ */ e(
            "marker",
            {
              id: "mermaid-circle-marker",
              viewBox: "0 0 10 10",
              refX: "5",
              refY: "5",
              markerWidth: "6",
              markerHeight: "6",
              orient: "auto",
              children: /* @__PURE__ */ e("circle", { cx: "5", cy: "5", r: "4", stroke: "#333", strokeWidth: "1.5", fill: "none" })
            }
          ),
          /* @__PURE__ */ e(
            "marker",
            {
              id: "mermaid-cross-marker",
              viewBox: "0 0 10 10",
              refX: "5",
              refY: "5",
              markerWidth: "6",
              markerHeight: "6",
              orient: "auto",
              children: /* @__PURE__ */ e("path", { d: "M 0 0 L 10 10 M 10 0 L 0 10", stroke: "#333", strokeWidth: "2", fill: "none" })
            }
          )
        ] }) }),
        /* @__PURE__ */ s(
          Be,
          {
            nodes: i,
            edges: S,
            onNodesChange: de,
            onEdgesChange: ue,
            onConnect: pe,
            onNodeDoubleClick: be,
            onEdgeDoubleClick: ge,
            onSelectionChange: Ne,
            onMove: xe,
            onDrop: me,
            onDragOver: ye,
            nodeTypes: Ye,
            edgeTypes: je,
            deleteKeyCode: null,
            fitView: !0,
            defaultEdgeOptions: {
              type: "smoothstep"
            },
            children: [
              /* @__PURE__ */ e(_e, {}),
              /* @__PURE__ */ e(Pe, {}),
              /* @__PURE__ */ e(Xe, {})
            ]
          }
        ),
        V && /* @__PURE__ */ e(
          "div",
          {
            className: "inline-editor-overlay",
            style: {
              position: "absolute",
              top: 50,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1e3,
              background: "#fff",
              padding: "8px",
              borderRadius: "4px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
            },
            children: /* @__PURE__ */ e(
              oe,
              {
                value: V.data.label,
                onConfirm: (o) => ve(V.id, o),
                onCancel: () => X(null)
              }
            )
          }
        ),
        G && /* @__PURE__ */ e(
          "div",
          {
            className: "inline-editor-overlay",
            style: {
              position: "absolute",
              top: 50,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1e3,
              background: "#fff",
              padding: "8px",
              borderRadius: "4px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
            },
            children: /* @__PURE__ */ e(
              oe,
              {
                value: G.data.label ?? "",
                onConfirm: (o) => ke(G.id, o),
                onCancel: () => F(null)
              }
            )
          }
        ),
        /* @__PURE__ */ e(
          et,
          {
            consumed: f,
            canvasSource: v,
            lastConsumedAt: h,
            onReset: T
          }
        ),
        /* @__PURE__ */ e(nt, { status: k })
      ] }),
      /* @__PURE__ */ e(
        ot,
        {
          selectedNode: Ee,
          selectedEdge: $e,
          onUpdateNode: we,
          onUpdateEdge: Ce
        }
      )
    ] })
  ] });
}
function mt(t) {
  return /* @__PURE__ */ e(Le, { children: /* @__PURE__ */ e(ct, { ...t }) });
}
export {
  mt as Canvas,
  rt as CodeEditor,
  nt as ConnectionStatus,
  et as ConsumedBadge,
  oe as InlineEditor,
  q as MermaidEdgeComponent,
  $ as MermaidNodeComponent,
  Ze as NodeLibrary,
  ot as PropertyPanel,
  Qe as Toolbar,
  je as edgeTypes,
  Ye as nodeTypes
};
