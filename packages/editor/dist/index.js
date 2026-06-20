import { jsxs as u, jsx as e, Fragment as le } from "react/jsx-runtime";
import { createContext as be, memo as ie, useContext as de, useState as W, useRef as H, useEffect as Y, useCallback as w, useMemo as He } from "react";
import { Position as M, Handle as ue, useInternalNode as pe, getSmoothStepPath as ve, BaseEdge as ke, EdgeLabelRenderer as xe, ReactFlowProvider as Ge, useReactFlow as je, useUpdateNodeInternals as qe, useNodesState as Qe, useEdgesState as Je, addEdge as Ze, ReactFlow as et, Background as tt, Controls as nt, MiniMap as ot } from "@xyflow/react";
import { parseMermaid as at, serializeMermaid as st, layoutCanvas as rt } from "@mermaid2aichat/serializer";
const he = { width: 8, height: 8 }, Ne = be("TD"), Ce = be("direction");
function lt(t) {
  switch (t) {
    case "TB":
    case "TD":
      return { source: M.Bottom, target: M.Top };
    case "BT":
      return { source: M.Top, target: M.Bottom };
    case "LR":
      return { source: M.Right, target: M.Left };
    case "RL":
      return { source: M.Left, target: M.Right };
  }
}
const z = ie(({ data: t, selected: s }) => {
  const d = t.shape, n = t.style, y = (n == null ? void 0 : n.stroke) ?? "#333", i = (n == null ? void 0 : n.fill) ?? "#fff", h = (n == null ? void 0 : n.color) ?? "#333", o = de(Ne), m = de(Ce), { source: l, target: E } = m === "direction" ? lt(o) : { source: M.Bottom, target: M.Top };
  return /* @__PURE__ */ u("div", { className: "mermaid-node", style: { position: "relative", display: "inline-block" }, children: [
    /* @__PURE__ */ e(ue, { type: "target", position: E, style: he }),
    /* @__PURE__ */ e(it, { shape: d, label: t.label, stroke: y, fill: i, color: h, selected: s }),
    /* @__PURE__ */ e(ue, { type: "source", position: l, style: he })
  ] });
});
z.displayName = "MermaidNode";
function it({
  shape: t,
  label: s,
  stroke: d,
  fill: n,
  color: y,
  selected: i
}) {
  const h = s.split(/<br\s*\/?>|\n/i), o = h.length, m = 18, l = 48, E = 8, S = 24, _ = Math.max(...h.map((f) => f.length)), a = Math.max(_ * E, 60) + S * 2, c = l + (o - 1) * m, g = i ? 3 : 2, N = i ? "#1890ff" : d, V = {
    fill: y,
    fontSize: "14px",
    textAnchor: "middle",
    dominantBaseline: "central",
    userSelect: "none",
    pointerEvents: "none"
  }, x = (f, C = c / 2) => /* @__PURE__ */ e("text", { x: f, y: C, style: V, children: h.map((F, O) => /* @__PURE__ */ e(
    "tspan",
    {
      x: f,
      dy: O === 0 ? -(o - 1) * m / 2 : m,
      children: F
    },
    O
  )) });
  switch (t) {
    case "rect":
      return /* @__PURE__ */ u("svg", { width: a, height: c, style: { display: "block" }, children: [
        /* @__PURE__ */ e("rect", { x: 1, y: 1, width: a - 2, height: c - 2, fill: n, stroke: N, strokeWidth: g }),
        x(a / 2)
      ] });
    case "rounded":
      return /* @__PURE__ */ u("svg", { width: a, height: c, style: { display: "block" }, children: [
        /* @__PURE__ */ e("rect", { x: 1, y: 1, width: a - 2, height: c - 2, rx: 12, ry: 12, fill: n, stroke: N, strokeWidth: g }),
        x(a / 2)
      ] });
    case "stadium":
      return /* @__PURE__ */ u("svg", { width: a, height: c, style: { display: "block" }, children: [
        /* @__PURE__ */ e("rect", { x: 1, y: 1, width: a - 2, height: c - 2, rx: c / 2, ry: c / 2, fill: n, stroke: N, strokeWidth: g }),
        x(a / 2)
      ] });
    case "diamond": {
      const f = a / 2, C = c / 2, F = a / 2, O = c / 2, G = `${f},${C - O} ${f + F},${C} ${f},${C + O} ${f - F},${C}`;
      return /* @__PURE__ */ u("svg", { width: a, height: c, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: G, fill: n, stroke: N, strokeWidth: g }),
        x(f)
      ] });
    }
    case "circle": {
      const f = Math.max(a, c), C = f / 2 - 2;
      return /* @__PURE__ */ u("svg", { width: f, height: f, style: { display: "block" }, children: [
        /* @__PURE__ */ e("circle", { cx: f / 2, cy: f / 2, r: C, fill: n, stroke: N, strokeWidth: g }),
        x(f / 2, f / 2)
      ] });
    }
    case "cylinder":
      return /* @__PURE__ */ u("svg", { width: a, height: c, style: { display: "block" }, children: [
        /* @__PURE__ */ e(
          "path",
          {
            d: `M 1 8 L 1 ${c - 8} Q ${a / 2} ${c + 8 - 4} ${a - 1} ${c - 8} L ${a - 1} 8`,
            fill: n,
            stroke: N,
            strokeWidth: g
          }
        ),
        /* @__PURE__ */ e("ellipse", { cx: a / 2, cy: 8, rx: a / 2 - 1, ry: 8, fill: n, stroke: N, strokeWidth: g }),
        x(a / 2)
      ] });
    case "hexagon": {
      const C = `20,1 ${a - 20},1 ${a - 1},${c / 2} ${a - 20},${c - 1} 20,${c - 1} 1,${c / 2}`;
      return /* @__PURE__ */ u("svg", { width: a, height: c, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: C, fill: n, stroke: N, strokeWidth: g }),
        x(a / 2)
      ] });
    }
    case "parallelogram": {
      const C = `16,1 ${a - 1},1 ${a - 16},${c - 1} 1,${c - 1}`;
      return /* @__PURE__ */ u("svg", { width: a, height: c, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: C, fill: n, stroke: N, strokeWidth: g }),
        x(a / 2)
      ] });
    }
    case "subroutine":
      return /* @__PURE__ */ u("svg", { width: a, height: c, style: { display: "block" }, children: [
        /* @__PURE__ */ e("rect", { x: 1, y: 1, width: a - 2, height: c - 2, fill: n, stroke: N, strokeWidth: g }),
        /* @__PURE__ */ e("line", { x1: 10, y1: 1, x2: 10, y2: c - 1, stroke: N, strokeWidth: g }),
        /* @__PURE__ */ e("line", { x1: a - 10, y1: 1, x2: a - 10, y2: c - 1, stroke: N, strokeWidth: g }),
        x(a / 2)
      ] });
    case "doublecircle": {
      const f = Math.max(a, c), C = f / 2 - 2, F = C - 6;
      return /* @__PURE__ */ u("svg", { width: f, height: f, style: { display: "block" }, children: [
        /* @__PURE__ */ e("circle", { cx: f / 2, cy: f / 2, r: C, fill: n, stroke: N, strokeWidth: g }),
        /* @__PURE__ */ e("circle", { cx: f / 2, cy: f / 2, r: F, fill: "none", stroke: N, strokeWidth: g }),
        x(f / 2, f / 2)
      ] });
    }
    case "asymmetric": {
      const C = `1,1 ${a - 20},1 ${a - 1},${c / 2} ${a - 20},${c - 1} 1,${c - 1}`;
      return /* @__PURE__ */ u("svg", { width: a, height: c, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: C, fill: n, stroke: N, strokeWidth: g }),
        x(a / 2 - 20 / 2)
      ] });
    }
    case "parallelogram-reverse": {
      const C = `1,1 ${a - 16},1 ${a - 1},${c - 1} 16,${c - 1}`;
      return /* @__PURE__ */ u("svg", { width: a, height: c, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: C, fill: n, stroke: N, strokeWidth: g }),
        x(a / 2)
      ] });
    }
    case "trapezoid": {
      const C = `20,1 ${a - 20},1 ${a - 1},${c - 1} 1,${c - 1}`;
      return /* @__PURE__ */ u("svg", { width: a, height: c, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: C, fill: n, stroke: N, strokeWidth: g }),
        x(a / 2)
      ] });
    }
    case "trapezoid-reverse": {
      const C = `1,1 ${a - 1},1 ${a - 20},${c - 1} 20,${c - 1}`;
      return /* @__PURE__ */ u("svg", { width: a, height: c, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: C, fill: n, stroke: N, strokeWidth: g }),
        x(a / 2)
      ] });
    }
    default:
      return /* @__PURE__ */ u("svg", { width: a, height: c, style: { display: "block" }, children: [
        /* @__PURE__ */ e("rect", { x: 1, y: 1, width: a - 2, height: c - 2, fill: n, stroke: N, strokeWidth: g }),
        x(a / 2)
      ] });
  }
}
const ct = {
  rect: z,
  rounded: z,
  stadium: z,
  diamond: z,
  circle: z,
  cylinder: z,
  hexagon: z,
  parallelogram: z,
  subroutine: z,
  doublecircle: z,
  // 扩展形状
  asymmetric: z,
  "parallelogram-reverse": z,
  trapezoid: z,
  "trapezoid-reverse": z
}, me = {
  arrow: { markerEndType: "custom:arrow" },
  line: {},
  dotted: {},
  "dotted-arrow": { markerEndType: "custom:arrow" },
  thick: { markerEndType: "custom:arrow" },
  circle: { markerEndType: "custom:circle" },
  cross: { markerEndType: "custom:cross" },
  bidirectional: { markerStartType: "custom:arrow", markerEndType: "custom:arrow" }
};
function we(t) {
  return me[t] ?? me.arrow;
}
function dt(t) {
  return (t == null ? void 0 : t.startsWith("custom:")) ?? !1;
}
function ut(t) {
  return `mermaid-${t.replace("custom:", "")}-marker`;
}
function ee(t) {
  if (!(!t || !dt(t)))
    return `url(#${ut(t)})`;
}
function fe(t) {
  const s = t.internals.positionAbsolute, d = t.measured.width ?? 0, n = t.measured.height ?? 0;
  return {
    x: s.x + d / 2,
    y: s.y + n / 2
  };
}
function pt(t, s) {
  const d = fe(t), n = fe(s), y = t.internals.positionAbsolute, i = s.internals.positionAbsolute, h = t.measured.width ?? 0, o = t.measured.height ?? 0, m = s.measured.width ?? 0, l = s.measured.height ?? 0, E = n.x - d.x, S = n.y - d.y;
  return Math.abs(E) > Math.abs(S) ? E > 0 ? {
    sx: y.x + h,
    sy: d.y,
    sourcePos: M.Right,
    tx: i.x,
    ty: n.y,
    targetPos: M.Left
  } : {
    sx: y.x,
    sy: d.y,
    sourcePos: M.Left,
    tx: i.x + m,
    ty: n.y,
    targetPos: M.Right
  } : S > 0 ? {
    sx: d.x,
    sy: y.y + o,
    sourcePos: M.Bottom,
    tx: n.x,
    ty: i.y,
    targetPos: M.Top
  } : {
    sx: d.x,
    sy: y.y,
    sourcePos: M.Top,
    tx: n.x,
    ty: i.y + l,
    targetPos: M.Bottom
  };
}
const Ee = ie(({
  id: t,
  source: s,
  target: d,
  data: n,
  selected: y
}) => {
  const i = pe(s), h = pe(d);
  if (!i || !h) return null;
  const o = n, m = (o == null ? void 0 : o.edgeStyle) ?? "arrow", l = $e[m], E = we(m), S = ee(E.markerEndType), _ = ee(E.markerStartType), { sx: $, sy: a, sourcePos: c, tx: g, ty: N, targetPos: V } = pt(i, h), [x, f, C] = ve({
    sourceX: $,
    sourceY: a,
    sourcePosition: c,
    targetX: g,
    targetY: N,
    targetPosition: V
  });
  return /* @__PURE__ */ u(le, { children: [
    /* @__PURE__ */ e(
      ke,
      {
        id: t,
        path: x,
        style: {
          ...l,
          ...y ? { stroke: "#1890ff", strokeWidth: (l.strokeWidth ?? 2) + 1 } : {}
        },
        markerEnd: S,
        markerStart: _
      }
    ),
    (o == null ? void 0 : o.label) && /* @__PURE__ */ e(xe, { children: /* @__PURE__ */ e(
      "div",
      {
        style: {
          position: "absolute",
          transform: `translate(-50%, -50%) translate(${f}px, ${C}px)`,
          background: "#fff",
          padding: "2px 8px",
          borderRadius: "4px",
          fontSize: "12px",
          border: "1px solid #d9d9d9",
          pointerEvents: "all"
        },
        className: "edge-label",
        children: o.label
      }
    ) })
  ] });
});
Ee.displayName = "FloatingEdge";
const $e = {
  arrow: { stroke: "#333", strokeWidth: 2 },
  line: { stroke: "#333", strokeWidth: 2 },
  dotted: { stroke: "#333", strokeWidth: 2, strokeDasharray: "5,5" },
  "dotted-arrow": { stroke: "#333", strokeWidth: 2, strokeDasharray: "5,5" },
  thick: { stroke: "#333", strokeWidth: 4 },
  circle: { stroke: "#333", strokeWidth: 2 },
  cross: { stroke: "#333", strokeWidth: 2 },
  bidirectional: { stroke: "#333", strokeWidth: 2 }
}, se = ie(({
  id: t,
  sourceX: s,
  sourceY: d,
  targetX: n,
  targetY: y,
  sourcePosition: i,
  targetPosition: h,
  data: o,
  selected: m
}) => {
  const l = o, E = (l == null ? void 0 : l.edgeStyle) ?? "arrow", S = $e[E], _ = we(E), $ = ee(_.markerEndType), a = ee(_.markerStartType), [c, g, N] = ve({
    sourceX: s,
    sourceY: d,
    sourcePosition: i,
    targetX: n,
    targetY: y,
    targetPosition: h
  });
  return /* @__PURE__ */ u(le, { children: [
    /* @__PURE__ */ e(
      ke,
      {
        id: t,
        path: c,
        style: {
          ...S,
          ...m ? { stroke: "#1890ff", strokeWidth: (S.strokeWidth ?? 2) + 1 } : {}
        },
        markerEnd: $,
        markerStart: a
      }
    ),
    (l == null ? void 0 : l.label) && /* @__PURE__ */ e(xe, { children: /* @__PURE__ */ e(
      "div",
      {
        style: {
          position: "absolute",
          transform: `translate(-50%, -50%) translate(${g}px, ${N}px)`,
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
se.displayName = "MermaidEdge";
const ht = {
  default: se,
  smoothstep: se,
  floating: Ee
}, mt = ["TB", "TD", "BT", "RL", "LR"];
function ft({ direction: t, onDirectionChange: s, mermaidCode: d, connectionMode: n, onConnectionModeChange: y }) {
  const i = () => {
    const o = new Blob([d], { type: "text/plain;charset=utf-8" }), m = URL.createObjectURL(o), l = document.createElement("a");
    l.href = m, l.download = `flowchart-${Date.now()}.mmd`, document.body.appendChild(l), l.click(), document.body.removeChild(l), URL.revokeObjectURL(m);
  }, h = async () => {
    try {
      await navigator.clipboard.writeText(d);
    } catch {
    }
  };
  return /* @__PURE__ */ u("div", { className: "toolbar", children: [
    /* @__PURE__ */ u("div", { className: "toolbar-section", children: [
      /* @__PURE__ */ e("span", { className: "toolbar-label", children: "方向:" }),
      /* @__PURE__ */ e(
        "select",
        {
          value: t,
          onChange: (o) => s(o.target.value),
          className: "toolbar-select",
          title: "切换流程图方向并重新布局",
          children: mt.map((o) => /* @__PURE__ */ e("option", { value: o, children: o }, o))
        }
      )
    ] }),
    /* @__PURE__ */ u("div", { className: "toolbar-section", children: [
      /* @__PURE__ */ e("span", { className: "toolbar-label", children: "连线:" }),
      /* @__PURE__ */ u(
        "select",
        {
          value: n,
          onChange: (o) => y(o.target.value),
          className: "toolbar-select",
          title: "选择节点连线模式：按方向连接或就近连接",
          children: [
            /* @__PURE__ */ e("option", { value: "direction", children: "按方向" }),
            /* @__PURE__ */ e("option", { value: "nearest", children: "就近" })
          ]
        }
      )
    ] }),
    /* @__PURE__ */ e("div", { className: "toolbar-section", children: /* @__PURE__ */ e("h1", { className: "toolbar-title", children: "Mermaid2AIChat" }) }),
    /* @__PURE__ */ u("div", { className: "toolbar-section toolbar-actions", children: [
      /* @__PURE__ */ e("button", { type: "button", className: "toolbar-btn", onClick: h, title: "复制 Mermaid 代码到剪贴板", children: "复制代码" }),
      /* @__PURE__ */ e("button", { type: "button", className: "toolbar-btn", onClick: i, title: "导出为 .mmd 文件", children: "导出" })
    ] })
  ] });
}
const gt = [
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
function yt({ onAddNode: t }) {
  const s = (d, n) => {
    d.dataTransfer.setData("application/mermaid-shape", n), d.dataTransfer.effectAllowed = "move";
  };
  return /* @__PURE__ */ u("div", { className: "node-library", children: [
    /* @__PURE__ */ e("h3", { className: "library-title", children: "节点库" }),
    /* @__PURE__ */ e("div", { className: "node-list", children: gt.map((d) => /* @__PURE__ */ u(
      "button",
      {
        className: "node-item",
        draggable: !0,
        onDragStart: (n) => s(n, d.type),
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
function bt({ consumed: t, canvasSource: s, lastConsumedAt: d, onReset: n }) {
  let y = "", i = "";
  s === null ? (y = "空画布", i = "status-empty") : !t && s === "user" ? (y = "待消费（用户绘制）", i = "status-pending") : t && s === "user" ? (y = "已消费", i = "status-consumed") : t && s === "ai" && (y = "AI生成内容（已消费）", i = "status-ai");
  const h = d ? new Date(d).toLocaleTimeString("zh-CN") : "";
  return /* @__PURE__ */ u("div", { className: `consumed-badge ${i}`, children: [
    /* @__PURE__ */ e("span", { className: "status-text", children: y }),
    h && /* @__PURE__ */ e("span", { className: "status-time", children: h }),
    t && /* @__PURE__ */ e("button", { className: "reset-button", onClick: n, children: "重新启用" })
  ] });
}
const vt = {
  connected: { color: "#52c41a", text: "已连接" },
  reconnecting: { color: "#faad14", text: "重连中..." },
  disconnected: { color: "#ff4d4f", text: "已断开" }
};
function kt({ status: t }) {
  const s = vt[t];
  return /* @__PURE__ */ u("div", { className: "connection-status", children: [
    /* @__PURE__ */ e("span", { className: "status-dot", style: { backgroundColor: s.color } }),
    /* @__PURE__ */ e("span", { className: "status-label", children: s.text })
  ] });
}
const xt = [
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
], Nt = [
  { value: "arrow", label: "实线箭头 (-->)" },
  { value: "line", label: "实线 (---)" },
  { value: "dotted", label: "虚线 (-.-)" },
  { value: "dotted-arrow", label: "虚线箭头 (-.->)" },
  { value: "thick", label: "粗线箭头 (==>)" },
  { value: "circle", label: "圆形端点 (---o)" },
  { value: "cross", label: "交叉端点 (---x)" },
  { value: "bidirectional", label: "双向箭头 (<--->)" }
];
function Ct({ selectedNode: t, selectedEdge: s, onUpdateNode: d, onUpdateEdge: n }) {
  var y, i, h;
  return !t && !s ? /* @__PURE__ */ u("div", { className: "property-panel", children: [
    /* @__PURE__ */ e("h3", { className: "panel-title", children: "属性面板" }),
    /* @__PURE__ */ e("p", { className: "panel-hint", children: "选中节点或边以编辑属性" })
  ] }) : t ? /* @__PURE__ */ u("div", { className: "property-panel", children: [
    /* @__PURE__ */ e("h3", { className: "panel-title", children: "节点属性" }),
    /* @__PURE__ */ u("div", { className: "panel-content", children: [
      /* @__PURE__ */ u("label", { className: "panel-label", children: [
        "文本",
        /* @__PURE__ */ e(
          "input",
          {
            className: "panel-input",
            type: "text",
            value: t.data.label,
            onChange: (o) => d(t.id, { label: o.target.value })
          }
        )
      ] }),
      /* @__PURE__ */ u("label", { className: "panel-label", children: [
        "形状",
        /* @__PURE__ */ e(
          "select",
          {
            className: "panel-select",
            value: t.data.shape,
            onChange: (o) => {
              const m = o.target.value;
              d(t.id, { shape: m });
            },
            children: xt.map((o) => /* @__PURE__ */ e("option", { value: o.value, children: o.label }, o.value))
          }
        )
      ] }),
      /* @__PURE__ */ e("div", { className: "panel-section-title", children: "样式" }),
      /* @__PURE__ */ u("label", { className: "panel-label panel-color-row", children: [
        "填充色",
        /* @__PURE__ */ e(
          "input",
          {
            className: "panel-color",
            type: "color",
            value: ((y = t.data.style) == null ? void 0 : y.fill) ?? "#ffffff",
            onChange: (o) => d(t.id, {
              style: { ...t.data.style, fill: o.target.value }
            })
          }
        )
      ] }),
      /* @__PURE__ */ u("label", { className: "panel-label panel-color-row", children: [
        "边框色",
        /* @__PURE__ */ e(
          "input",
          {
            className: "panel-color",
            type: "color",
            value: ((i = t.data.style) == null ? void 0 : i.stroke) ?? "#333333",
            onChange: (o) => d(t.id, {
              style: { ...t.data.style, stroke: o.target.value }
            })
          }
        )
      ] }),
      /* @__PURE__ */ u("label", { className: "panel-label panel-color-row", children: [
        "文字色",
        /* @__PURE__ */ e(
          "input",
          {
            className: "panel-color",
            type: "color",
            value: ((h = t.data.style) == null ? void 0 : h.color) ?? "#333333",
            onChange: (o) => d(t.id, {
              style: { ...t.data.style, color: o.target.value }
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
      /* @__PURE__ */ u("div", { className: "panel-info", children: [
        /* @__PURE__ */ e("span", { className: "info-label", children: "ID:" }),
        /* @__PURE__ */ e("span", { className: "info-value", children: t.id })
      ] }),
      /* @__PURE__ */ u("div", { className: "panel-info", children: [
        /* @__PURE__ */ e("span", { className: "info-label", children: "位置:" }),
        /* @__PURE__ */ u("span", { className: "info-value", children: [
          "(",
          Math.round(t.position.x),
          ", ",
          Math.round(t.position.y),
          ")"
        ] })
      ] })
    ] })
  ] }) : s ? /* @__PURE__ */ u("div", { className: "property-panel", children: [
    /* @__PURE__ */ e("h3", { className: "panel-title", children: "边属性" }),
    /* @__PURE__ */ u("div", { className: "panel-content", children: [
      /* @__PURE__ */ u("label", { className: "panel-label", children: [
        "标签",
        /* @__PURE__ */ e(
          "input",
          {
            className: "panel-input",
            type: "text",
            value: s.data.label ?? "",
            placeholder: "（无标签）",
            onChange: (o) => n(s.id, { label: o.target.value })
          }
        )
      ] }),
      /* @__PURE__ */ u("label", { className: "panel-label", children: [
        "样式",
        /* @__PURE__ */ e(
          "select",
          {
            className: "panel-select",
            value: s.data.edgeStyle,
            onChange: (o) => {
              const m = o.target.value;
              n(s.id, { edgeStyle: m });
            },
            children: Nt.map((o) => /* @__PURE__ */ e("option", { value: o.value, children: o.label }, o.value))
          }
        )
      ] }),
      /* @__PURE__ */ u("div", { className: "panel-info", children: [
        /* @__PURE__ */ e("span", { className: "info-label", children: "ID:" }),
        /* @__PURE__ */ e("span", { className: "info-value", children: s.id })
      ] }),
      /* @__PURE__ */ u("div", { className: "panel-info", children: [
        /* @__PURE__ */ e("span", { className: "info-label", children: "连接:" }),
        /* @__PURE__ */ u("span", { className: "info-value", children: [
          s.source,
          " → ",
          s.target
        ] })
      ] })
    ] })
  ] }) : null;
}
function ge({ value: t, onConfirm: s, onCancel: d }) {
  const [n, y] = W(t), i = H(null);
  return Y(() => {
    var m, l;
    (m = i.current) == null || m.focus(), (l = i.current) == null || l.select();
  }, []), /* @__PURE__ */ e(
    "input",
    {
      ref: i,
      className: "inline-editor",
      value: n,
      onChange: (m) => y(m.target.value),
      onKeyDown: (m) => {
        m.key === "Enter" ? (m.preventDefault(), s(n)) : m.key === "Escape" && (m.preventDefault(), d());
      },
      onBlur: () => {
        s(n);
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
function wt({ code: t, onCodeChange: s, error: d }) {
  const [n, y] = W(t || "flowchart TD"), [i, h] = W(!1), o = H(!1), m = H(null);
  return Y(() => {
    !i && !o.current && y(t || "flowchart TD");
  }, [t, i]), /* @__PURE__ */ u("div", { className: "code-editor", children: [
    /* @__PURE__ */ e("div", { className: "code-editor-title", children: "Mermaid 代码" }),
    /* @__PURE__ */ e(
      "textarea",
      {
        ref: m,
        className: "code-editor-content",
        value: n,
        onChange: ($) => {
          o.current = !0, y($.target.value);
        },
        onFocus: () => h(!0),
        onBlur: () => {
          h(!1), o.current && n !== t && (s == null || s(n), o.current = !1);
        },
        onKeyDown: ($) => {
          ($.ctrlKey || $.metaKey) && $.key === "Enter" && ($.preventDefault(), o.current && n !== t && (s == null || s(n), o.current = !1));
        },
        spellCheck: !1,
        placeholder: "flowchart TD"
      }
    ),
    d && /* @__PURE__ */ e("div", { className: "code-editor-error", children: d })
  ] });
}
let Et = 0;
function ae() {
  return `node_${Date.now()}_${Et++}`;
}
const ye = /* @__PURE__ */ new Set(["measured", "dimensions"]);
function $t(t) {
  const {
    syncNodes: s,
    syncEdges: d,
    syncDirection: n,
    syncViewport: y,
    consumed: i,
    canvasSource: h,
    lastConsumedAt: o,
    connectionStatus: m,
    onCanvasEdit: l,
    onDirectionChange: E,
    onResetConsumed: S,
    onViewportChange: _
  } = t, $ = je(), a = qe(), [c, g, N] = Qe(s), [V, x, f] = Je(d), [C, F] = W(null), [O, G] = W(null), [J, j] = W(null), [Z, b] = W(null), [P, R] = W(null), T = H(c), I = H(V), B = H(n);
  T.current = c, I.current = V, B.current = n;
  const [X, K] = W(n);
  Y(() => {
    K(n);
  }, [n]);
  const [D, Te] = W("direction"), Se = w(
    (r) => {
      Te(r);
      const p = r === "nearest" ? "floating" : "smoothstep";
      x((v) => v.map((k) => ({ ...k, type: p }))), setTimeout(() => {
        T.current.forEach((v) => a(v.id));
      }, 0);
    },
    [x, a]
  ), te = H(!1);
  Y(() => {
    g(s);
  }, [s, g]), Y(() => {
    x(d);
  }, [d, x]), Y(() => {
    y !== null && (te.current = !0, $.setViewport({ x: y.x, y: y.y, zoom: y.zoom }), requestAnimationFrame(() => {
      te.current = !1;
    }));
  }, [y, $]);
  const L = w(() => ({
    nodes: T.current,
    edges: I.current,
    direction: B.current
  }), []), De = w(
    (r) => {
      N(r), r.some((v) => !ye.has(v.type)) && setTimeout(() => {
        l(L());
      }, 0);
    },
    [N, l, L]
  ), Me = w(
    (r) => {
      f(r), r.some((v) => !ye.has(v.type)) && setTimeout(() => {
        l(L());
      }, 0);
    },
    [f, l, L]
  ), Re = w(
    (r) => {
      const p = {
        ...r,
        id: `edge_${Date.now()}`,
        type: D === "nearest" ? "floating" : "smoothstep",
        data: { edgeStyle: "arrow" }
      };
      x((v) => Ze(p, v)), setTimeout(() => {
        l(L());
      }, 0);
    },
    [x, l, L, D]
  ), Ie = w(
    (r) => {
      const p = {
        id: ae(),
        type: r,
        position: { x: Math.random() * 300 + 100, y: Math.random() * 200 + 100 },
        data: {
          label: "新节点",
          shape: r
        }
      };
      g((v) => {
        const k = [...v, p];
        return setTimeout(() => {
          l({
            nodes: k,
            edges: I.current,
            direction: B.current
          });
        }, 0), k;
      });
    },
    [g, l]
  ), Le = w(
    (r) => {
      r.preventDefault();
      const p = r.dataTransfer.getData("application/mermaid-shape");
      if (!p) return;
      const v = $.screenToFlowPosition({
        x: r.clientX,
        y: r.clientY
      });
      v.x -= 70, v.y -= 25;
      const k = {
        id: ae(),
        type: p,
        position: v,
        data: { label: "新节点", shape: p }
      };
      g((U) => {
        const A = [...U, k];
        return setTimeout(() => {
          l({
            nodes: A,
            edges: I.current,
            direction: B.current
          });
        }, 0), A;
      });
    },
    [$, g, l]
  ), Pe = w((r) => {
    r.preventDefault(), r.dataTransfer.dropEffect = "move";
  }, []), Ae = w(
    (r) => {
      if (!r.target.classList.contains("react-flow__pane")) return;
      const v = $.screenToFlowPosition({
        x: r.clientX,
        y: r.clientY
      }), k = {
        id: ae(),
        type: "rect",
        position: v,
        data: { label: "新节点", shape: "rect" }
      };
      g((U) => {
        const A = [...U, k];
        return setTimeout(() => {
          l({
            nodes: A,
            edges: I.current,
            direction: B.current
          });
        }, 0), A;
      });
    },
    [$, g, l]
  ), ze = w((r, p) => {
    j(p.id), b(null);
  }, []), Be = w((r, p) => {
    b(p.id), j(null);
  }, []), We = w((r, p) => {
    g(
      (v) => v.map((k) => k.id === r ? { ...k, data: { ...k.data, label: p } } : k)
    ), j(null), setTimeout(() => {
      l(L());
    }, 0);
  }, [g, l, L]), Ve = w((r, p) => {
    x(
      (v) => v.map((k) => k.id === r ? { ...k, data: { ...k.data, label: p || void 0 } } : k)
    ), b(null), setTimeout(() => {
      l(L());
    }, 0);
  }, [x, l, L]), _e = w((r) => {
    const p = at(r);
    p.success ? (g(p.canvas.nodes), x(p.canvas.edges), K(p.canvas.direction), B.current = p.canvas.direction, R(null), setTimeout(() => {
      l({
        nodes: p.canvas.nodes,
        edges: p.canvas.edges,
        direction: p.canvas.direction
      });
    }, 0)) : R(p.errors.map((v) => v.message).join("; "));
  }, [g, x, K, l]), Fe = w(({ nodes: r, edges: p }) => {
    F(r.length === 1 ? r[0].id : null), G(p.length === 1 ? p[0].id : null);
  }, []), Oe = w(
    (r, p) => {
      te.current || _({ x: p.x, y: p.y, zoom: p.zoom });
    },
    [_]
  ), Xe = w((r, p) => {
    g((v) => v.map((k) => {
      if (k.id !== r) return k;
      const U = { ...k.data, ...p }, A = p.shape ?? k.type;
      return { ...k, type: A, data: U };
    })), setTimeout(() => {
      l(L());
    }, 0);
  }, [g, l, L]), Ke = w((r, p) => {
    x((v) => v.map((k) => k.id === r ? { ...k, data: { ...k.data, ...p } } : k)), setTimeout(() => {
      l(L());
    }, 0);
  }, [x, l, L]);
  Y(() => {
    const r = (p) => {
      if (p.key === "Delete" || p.key === "Backspace") {
        const v = p.target;
        if (v.tagName === "INPUT" || v.tagName === "SELECT" || v.tagName === "TEXTAREA")
          return;
        const k = T.current.filter((A) => A.selected), U = I.current.filter((A) => A.selected);
        (k.length > 0 || U.length > 0) && (p.preventDefault(), $.deleteElements({
          nodes: k.map((A) => ({ id: A.id })),
          edges: U.map((A) => ({ id: A.id }))
        }), setTimeout(() => {
          l(L());
        }, 0));
      }
    };
    return window.addEventListener("keydown", r), () => window.removeEventListener("keydown", r);
  }, [$, l, L]);
  const ne = J ? c.find((r) => r.id === J) : null, oe = Z ? V.find((r) => r.id === Z) : null, Ue = C ? c.find((r) => r.id === C) ?? null : null, Ye = O ? V.find((r) => r.id === O) ?? null : null, ce = He(() => st({ nodes: c, edges: V, direction: X }).mermaid, [c, V, X]);
  return /* @__PURE__ */ u("div", { className: "app-container", children: [
    /* @__PURE__ */ e(
      ft,
      {
        direction: X,
        mermaidCode: ce,
        connectionMode: D,
        onConnectionModeChange: Se,
        onDirectionChange: (r) => {
          K(r), B.current = r;
          const p = rt(T.current, I.current, r);
          g(p), x((v) => v.map((k) => ({ ...k }))), setTimeout(() => {
            p.forEach((v) => a(v.id));
          }, 0), E(r), setTimeout(() => {
            l({
              nodes: p,
              edges: I.current,
              direction: r
            });
          }, 0);
        }
      }
    ),
    /* @__PURE__ */ u("div", { className: "main-content", children: [
      /* @__PURE__ */ u("div", { className: "left-panel", children: [
        /* @__PURE__ */ e(wt, { code: ce, onCodeChange: _e, error: P }),
        /* @__PURE__ */ e(yt, { onAddNode: Ie })
      ] }),
      /* @__PURE__ */ u("div", { className: "canvas-container", onDoubleClick: Ae, children: [
        /* @__PURE__ */ e("svg", { width: "0", height: "0", style: { position: "absolute" }, children: /* @__PURE__ */ u("defs", { children: [
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
        /* @__PURE__ */ e(Ne.Provider, { value: X, children: /* @__PURE__ */ e(Ce.Provider, { value: D, children: /* @__PURE__ */ u(
          et,
          {
            nodes: c,
            edges: V,
            onNodesChange: De,
            onEdgesChange: Me,
            onConnect: Re,
            onNodeDoubleClick: ze,
            onEdgeDoubleClick: Be,
            onSelectionChange: Fe,
            onMove: Oe,
            onDrop: Le,
            onDragOver: Pe,
            nodeTypes: ct,
            edgeTypes: ht,
            deleteKeyCode: null,
            zoomOnDoubleClick: !1,
            fitView: !0,
            defaultEdgeOptions: {
              type: D === "nearest" ? "floating" : "smoothstep"
            },
            children: [
              /* @__PURE__ */ e(tt, {}),
              /* @__PURE__ */ e(nt, {}),
              /* @__PURE__ */ e(ot, {})
            ]
          }
        ) }) }),
        ne && /* @__PURE__ */ e(
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
              ge,
              {
                value: ne.data.label,
                onConfirm: (r) => We(ne.id, r),
                onCancel: () => j(null)
              }
            )
          }
        ),
        oe && /* @__PURE__ */ e(
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
              ge,
              {
                value: oe.data.label ?? "",
                onConfirm: (r) => Ve(oe.id, r),
                onCancel: () => b(null)
              }
            )
          }
        ),
        /* @__PURE__ */ e(
          bt,
          {
            consumed: i,
            canvasSource: h,
            lastConsumedAt: o,
            onReset: S
          }
        ),
        /* @__PURE__ */ e(kt, { status: m })
      ] }),
      /* @__PURE__ */ e(
        Ct,
        {
          selectedNode: Ue,
          selectedEdge: Ye,
          onUpdateNode: Xe,
          onUpdateEdge: Ke
        }
      )
    ] })
  ] });
}
function Lt(t) {
  return /* @__PURE__ */ e(Ge, { children: /* @__PURE__ */ e($t, { ...t }) });
}
const q = "manual", Q = "ungrouped";
function Tt(t) {
  const s = /* @__PURE__ */ new Map();
  for (const i of t) {
    let h;
    i.source === "user" ? h = q : i.sessionId ? h = i.sessionId : h = Q;
    let o = s.get(h);
    o || (o = [], s.set(h, o)), o.push(i);
  }
  const d = /* @__PURE__ */ new Map();
  for (const i of t)
    if (i.source === "ai" && i.sessionId) {
      const h = d.get(i.sessionId) ?? 0;
      d.set(i.sessionId, Math.max(h, i.createdAt));
    }
  const n = d.size > 0 ? Array.from(d.entries()).sort(([, i], [, h]) => h - i)[0][0] : null, y = [];
  for (const [i, h] of s.entries()) {
    const o = [...h].sort((E, S) => S.createdAt - E.createdAt);
    let m, l = !1;
    i === q ? m = "手动创建" : i === Q ? m = "未分组" : (m = `AI 会话 ${i.slice(0, 8)}`, l = i === n), y.push({ key: i, label: m, views: o, isLatest: l });
  }
  return y.sort((i, h) => {
    var l, E;
    if (i.key === q) return -1;
    if (h.key === q) return 1;
    if (i.isLatest) return -1;
    if (h.isLatest || i.key === Q) return 1;
    if (h.key === Q) return -1;
    const o = ((l = i.views[0]) == null ? void 0 : l.createdAt) ?? 0;
    return (((E = h.views[0]) == null ? void 0 : E.createdAt) ?? 0) - o;
  }), y;
}
function re(t) {
  if (t.title) return t.title;
  const s = new Date(t.createdAt), d = `${s.getMonth() + 1}-${s.getDate()} ${s.getHours()}:${String(s.getMinutes()).padStart(2, "0")}`;
  return t.source === "ai" ? `AI输出 ${d}` : `新建视图 ${d}`;
}
function St(t) {
  const s = new Date(t.createdAt).toLocaleString("zh-CN"), d = new Date(t.updatedAt).toLocaleString("zh-CN"), n = t.source === "ai" ? "AI" : "用户", y = t.sessionId ? `
会话: ${t.sessionId.slice(0, 8)}` : "";
  return `标题: ${re(t)}
创建: ${s}
更新: ${d}
来源: ${n}${y}`;
}
function Pt(t) {
  const { views: s, activeViewId: d, onSwitchView: n, onCreateView: y, onCloseView: i, onRenameView: h, onReorderViews: o } = t, [m, l] = W(null), [E, S] = W(""), [_, $] = W(/* @__PURE__ */ new Set()), [a, c] = W(null), g = H(null), N = Tt(s);
  Y(() => {
    $((b) => {
      if (b.size > 0) return b;
      const P = /* @__PURE__ */ new Set();
      for (const R of N)
        R.key !== q && R.key !== Q && !R.isLatest && P.add(R.key);
      return P;
    });
  }, [N]);
  const V = w((b) => {
    $((P) => {
      const R = new Set(P);
      return R.has(b) ? R.delete(b) : R.add(b), R;
    });
  }, []), x = w((b) => {
    l(b.id), S(b.title ?? "");
  }, []), f = w(() => {
    if (m) {
      const b = E.trim();
      b && h(m, b), l(null), S("");
    }
  }, [m, E, h]), C = w(() => {
    l(null), S("");
  }, []), F = w((b) => {
    c(b);
  }, []), O = w(() => {
    a && (i(a.id), c(null));
  }, [a, i]), G = w(() => {
    c(null);
  }, []), J = w((b, P) => {
    g.current = P, b.dataTransfer.effectAllowed = "move";
  }, []), j = w((b) => {
    b.preventDefault(), b.dataTransfer.dropEffect = "move";
  }, []), Z = w((b, P, R) => {
    b.preventDefault();
    const T = g.current;
    if (g.current = null, !T || T === P) return;
    const I = R.map((K) => K.id), B = I.indexOf(T), X = I.indexOf(P);
    B === -1 || X === -1 || (I.splice(B, 1), I.splice(X, 0, T), o(I));
  }, [o]);
  return /* @__PURE__ */ u("div", { className: "tab-bar", children: [
    N.map((b) => {
      const P = _.has(b.key), R = b.key === q || b.key === Q;
      return /* @__PURE__ */ u("div", { className: "tab-group", children: [
        !R && /* @__PURE__ */ u(
          "div",
          {
            className: "tab-group-header",
            onClick: () => V(b.key),
            title: P ? "点击展开" : "点击折叠",
            children: [
              /* @__PURE__ */ e("span", { className: "tab-group-toggle", children: P ? "▶" : "▼" }),
              /* @__PURE__ */ e("span", { className: "tab-group-label", children: b.label }),
              /* @__PURE__ */ u("span", { className: "tab-group-count", children: [
                "(",
                b.views.length,
                ")"
              ] })
            ]
          }
        ),
        !P && b.views.map((T) => {
          const I = T.id === d, B = T.id === m, X = re(T), K = St(T);
          return /* @__PURE__ */ e(
            "div",
            {
              className: `tab-item ${I ? "tab-item-active" : ""}`,
              draggable: !B,
              onDragStart: (D) => J(D, T.id),
              onDragOver: j,
              onDrop: (D) => Z(D, T.id, b.views),
              onClick: () => !B && n(T.id),
              onDoubleClick: () => x(T),
              title: K,
              children: B ? /* @__PURE__ */ e(
                "input",
                {
                  className: "tab-edit-input",
                  type: "text",
                  value: E,
                  autoFocus: !0,
                  onChange: (D) => S(D.target.value),
                  onBlur: f,
                  onKeyDown: (D) => {
                    D.key === "Enter" && f(), D.key === "Escape" && C();
                  },
                  onClick: (D) => D.stopPropagation()
                }
              ) : /* @__PURE__ */ u(le, { children: [
                /* @__PURE__ */ e("span", { className: "tab-item-title", children: X }),
                /* @__PURE__ */ e(
                  "button",
                  {
                    className: "tab-item-close",
                    title: "关闭",
                    onClick: (D) => {
                      D.stopPropagation(), F(T);
                    },
                    children: "×"
                  }
                )
              ] })
            },
            T.id
          );
        })
      ] }, b.key);
    }),
    /* @__PURE__ */ e(
      "button",
      {
        className: "tab-new",
        onClick: y,
        title: "新建空白视图",
        children: "+"
      }
    ),
    a && /* @__PURE__ */ e("div", { className: "tab-modal-overlay", onClick: G, children: /* @__PURE__ */ u("div", { className: "tab-modal", onClick: (b) => b.stopPropagation(), children: [
      /* @__PURE__ */ u("div", { className: "tab-modal-message", children: [
        "确定关闭标签页「",
        re(a),
        "」？关闭后无法恢复。"
      ] }),
      /* @__PURE__ */ u("div", { className: "tab-modal-actions", children: [
        /* @__PURE__ */ e("button", { className: "tab-modal-btn tab-modal-cancel", onClick: G, children: "取消" }),
        /* @__PURE__ */ e("button", { className: "tab-modal-btn tab-modal-confirm", onClick: O, children: "确认关闭" })
      ] })
    ] }) })
  ] });
}
export {
  Lt as Canvas,
  wt as CodeEditor,
  kt as ConnectionStatus,
  bt as ConsumedBadge,
  ge as InlineEditor,
  se as MermaidEdgeComponent,
  z as MermaidNodeComponent,
  yt as NodeLibrary,
  Ct as PropertyPanel,
  Pt as TabBar,
  ft as Toolbar,
  ht as edgeTypes,
  ct as nodeTypes
};
