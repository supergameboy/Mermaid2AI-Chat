import { jsxs as r, jsx as e, Fragment as $e } from "react/jsx-runtime";
import { memo as oe, useState as L, useRef as _, useEffect as A, useCallback as $, useMemo as Ce } from "react";
import { Handle as O, Position as H, getSmoothStepPath as Te, BaseEdge as Se, EdgeLabelRenderer as De, ReactFlowProvider as Re, useReactFlow as Me, useNodesState as Le, useEdgesState as Ie, addEdge as ze, ReactFlow as We, Background as Be, Controls as _e, MiniMap as Ae } from "@xyflow/react";
import { parseMermaid as Pe, serializeMermaid as Fe } from "@mermaid-editor/serializer";
const U = { width: 8, height: 8 }, T = oe(({ data: n, selected: i }) => {
  const p = n.shape, o = n.style, y = (o == null ? void 0 : o.stroke) ?? "#333", h = (o == null ? void 0 : o.fill) ?? "#fff", x = (o == null ? void 0 : o.color) ?? "#333";
  return /* @__PURE__ */ r("div", { className: "mermaid-node", style: { position: "relative", display: "inline-block" }, children: [
    /* @__PURE__ */ e(O, { type: "target", position: H.Top, style: U }),
    /* @__PURE__ */ e(O, { type: "target", position: H.Left, style: U }),
    /* @__PURE__ */ e(Xe, { shape: p, label: n.label, stroke: y, fill: h, color: x, selected: i }),
    /* @__PURE__ */ e(O, { type: "source", position: H.Bottom, style: U }),
    /* @__PURE__ */ e(O, { type: "source", position: H.Right, style: U })
  ] });
});
T.displayName = "MermaidNode";
function Xe({
  shape: n,
  label: i,
  stroke: p,
  fill: o,
  color: y,
  selected: h
}) {
  const x = i.split(/<br\s*\/?>|\n/i), c = x.length, k = 18, d = 48, I = 8, z = 24, R = Math.max(...x.map((u) => u.length)), t = Math.max(R * I, 60) + z * 2, a = d + (c - 1) * k, v = h ? 3 : 2, f = h ? "#1890ff" : p, S = {
    fill: y,
    fontSize: "14px",
    textAnchor: "middle",
    dominantBaseline: "central",
    userSelect: "none",
    pointerEvents: "none"
  }, w = (u, g = a / 2) => /* @__PURE__ */ e("text", { x: u, y: g, style: S, children: x.map((D, W) => /* @__PURE__ */ e(
    "tspan",
    {
      x: u,
      dy: W === 0 ? -(c - 1) * k / 2 : k,
      children: D
    },
    W
  )) });
  switch (n) {
    case "rect":
      return /* @__PURE__ */ r("svg", { width: t, height: a, style: { display: "block" }, children: [
        /* @__PURE__ */ e("rect", { x: 1, y: 1, width: t - 2, height: a - 2, fill: o, stroke: f, strokeWidth: v }),
        w(t / 2)
      ] });
    case "rounded":
      return /* @__PURE__ */ r("svg", { width: t, height: a, style: { display: "block" }, children: [
        /* @__PURE__ */ e("rect", { x: 1, y: 1, width: t - 2, height: a - 2, rx: 12, ry: 12, fill: o, stroke: f, strokeWidth: v }),
        w(t / 2)
      ] });
    case "stadium":
      return /* @__PURE__ */ r("svg", { width: t, height: a, style: { display: "block" }, children: [
        /* @__PURE__ */ e("rect", { x: 1, y: 1, width: t - 2, height: a - 2, rx: a / 2, ry: a / 2, fill: o, stroke: f, strokeWidth: v }),
        w(t / 2)
      ] });
    case "diamond": {
      const u = t / 2, g = a / 2, D = t / 2, W = a / 2, F = `${u},${g - W} ${u + D},${g} ${u},${g + W} ${u - D},${g}`;
      return /* @__PURE__ */ r("svg", { width: t, height: a, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: F, fill: o, stroke: f, strokeWidth: v }),
        w(u)
      ] });
    }
    case "circle": {
      const u = Math.max(t, a), g = u / 2 - 2;
      return /* @__PURE__ */ r("svg", { width: u, height: u, style: { display: "block" }, children: [
        /* @__PURE__ */ e("circle", { cx: u / 2, cy: u / 2, r: g, fill: o, stroke: f, strokeWidth: v }),
        w(u / 2, u / 2)
      ] });
    }
    case "cylinder":
      return /* @__PURE__ */ r("svg", { width: t, height: a, style: { display: "block" }, children: [
        /* @__PURE__ */ e(
          "path",
          {
            d: `M 1 8 L 1 ${a - 8} Q ${t / 2} ${a + 8 - 4} ${t - 1} ${a - 8} L ${t - 1} 8`,
            fill: o,
            stroke: f,
            strokeWidth: v
          }
        ),
        /* @__PURE__ */ e("ellipse", { cx: t / 2, cy: 8, rx: t / 2 - 1, ry: 8, fill: o, stroke: f, strokeWidth: v }),
        w(t / 2)
      ] });
    case "hexagon": {
      const g = `20,1 ${t - 20},1 ${t - 1},${a / 2} ${t - 20},${a - 1} 20,${a - 1} 1,${a / 2}`;
      return /* @__PURE__ */ r("svg", { width: t, height: a, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: g, fill: o, stroke: f, strokeWidth: v }),
        w(t / 2)
      ] });
    }
    case "parallelogram": {
      const g = `16,1 ${t - 1},1 ${t - 16},${a - 1} 1,${a - 1}`;
      return /* @__PURE__ */ r("svg", { width: t, height: a, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: g, fill: o, stroke: f, strokeWidth: v }),
        w(t / 2)
      ] });
    }
    case "subroutine":
      return /* @__PURE__ */ r("svg", { width: t, height: a, style: { display: "block" }, children: [
        /* @__PURE__ */ e("rect", { x: 1, y: 1, width: t - 2, height: a - 2, fill: o, stroke: f, strokeWidth: v }),
        /* @__PURE__ */ e("line", { x1: 10, y1: 1, x2: 10, y2: a - 1, stroke: f, strokeWidth: v }),
        /* @__PURE__ */ e("line", { x1: t - 10, y1: 1, x2: t - 10, y2: a - 1, stroke: f, strokeWidth: v }),
        w(t / 2)
      ] });
    case "doublecircle": {
      const u = Math.max(t, a), g = u / 2 - 2, D = g - 6;
      return /* @__PURE__ */ r("svg", { width: u, height: u, style: { display: "block" }, children: [
        /* @__PURE__ */ e("circle", { cx: u / 2, cy: u / 2, r: g, fill: o, stroke: f, strokeWidth: v }),
        /* @__PURE__ */ e("circle", { cx: u / 2, cy: u / 2, r: D, fill: "none", stroke: f, strokeWidth: v }),
        w(u / 2, u / 2)
      ] });
    }
    case "asymmetric": {
      const g = `1,1 ${t - 20},1 ${t - 1},${a / 2} ${t - 20},${a - 1} 1,${a - 1}`;
      return /* @__PURE__ */ r("svg", { width: t, height: a, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: g, fill: o, stroke: f, strokeWidth: v }),
        w(t / 2 - 20 / 2)
      ] });
    }
    case "parallelogram-reverse": {
      const g = `1,1 ${t - 16},1 ${t - 1},${a - 1} 16,${a - 1}`;
      return /* @__PURE__ */ r("svg", { width: t, height: a, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: g, fill: o, stroke: f, strokeWidth: v }),
        w(t / 2)
      ] });
    }
    case "trapezoid": {
      const g = `20,1 ${t - 20},1 ${t - 1},${a - 1} 1,${a - 1}`;
      return /* @__PURE__ */ r("svg", { width: t, height: a, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: g, fill: o, stroke: f, strokeWidth: v }),
        w(t / 2)
      ] });
    }
    case "trapezoid-reverse": {
      const g = `1,1 ${t - 1},1 ${t - 20},${a - 1} 20,${a - 1}`;
      return /* @__PURE__ */ r("svg", { width: t, height: a, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: g, fill: o, stroke: f, strokeWidth: v }),
        w(t / 2)
      ] });
    }
    default:
      return /* @__PURE__ */ r("svg", { width: t, height: a, style: { display: "block" }, children: [
        /* @__PURE__ */ e("rect", { x: 1, y: 1, width: t - 2, height: a - 2, fill: o, stroke: f, strokeWidth: v }),
        w(t / 2)
      ] });
  }
}
const Ke = {
  rect: T,
  rounded: T,
  stadium: T,
  diamond: T,
  circle: T,
  cylinder: T,
  hexagon: T,
  parallelogram: T,
  subroutine: T,
  doublecircle: T,
  // 扩展形状
  asymmetric: T,
  "parallelogram-reverse": T,
  trapezoid: T,
  "trapezoid-reverse": T
}, te = {
  arrow: { markerEndType: "custom:arrow" },
  line: {},
  dotted: {},
  "dotted-arrow": { markerEndType: "custom:arrow" },
  thick: { markerEndType: "custom:arrow" },
  circle: { markerEndType: "custom:circle" },
  cross: { markerEndType: "custom:cross" },
  bidirectional: { markerStartType: "custom:arrow", markerEndType: "custom:arrow" }
};
function Oe(n) {
  return te[n] ?? te.arrow;
}
function He(n) {
  return (n == null ? void 0 : n.startsWith("custom:")) ?? !1;
}
function Ue(n) {
  return `mermaid-${n.replace("custom:", "")}-marker`;
}
function ne(n) {
  if (!(!n || !He(n)))
    return `url(#${Ue(n)})`;
}
const Ye = {
  arrow: { stroke: "#333", strokeWidth: 2 },
  line: { stroke: "#333", strokeWidth: 2 },
  dotted: { stroke: "#333", strokeWidth: 2, strokeDasharray: "5,5" },
  "dotted-arrow": { stroke: "#333", strokeWidth: 2, strokeDasharray: "5,5" },
  thick: { stroke: "#333", strokeWidth: 4 },
  circle: { stroke: "#333", strokeWidth: 2 },
  cross: { stroke: "#333", strokeWidth: 2 },
  bidirectional: { stroke: "#333", strokeWidth: 2 }
}, Q = oe(({
  id: n,
  sourceX: i,
  sourceY: p,
  targetX: o,
  targetY: y,
  sourcePosition: h,
  targetPosition: x,
  data: c,
  selected: k
}) => {
  const d = c, I = (d == null ? void 0 : d.edgeStyle) ?? "arrow", z = Ye[I], R = Oe(I), N = ne(R.markerEndType), t = ne(R.markerStartType), [a, v, f] = Te({
    sourceX: i,
    sourceY: p,
    sourcePosition: h,
    targetX: o,
    targetY: y,
    targetPosition: x
  });
  return /* @__PURE__ */ r($e, { children: [
    /* @__PURE__ */ e(
      Se,
      {
        id: n,
        path: a,
        style: {
          ...z,
          ...k ? { stroke: "#1890ff", strokeWidth: (z.strokeWidth ?? 2) + 1 } : {}
        },
        markerEnd: N,
        markerStart: t
      }
    ),
    (d == null ? void 0 : d.label) && /* @__PURE__ */ e(De, { children: /* @__PURE__ */ e(
      "div",
      {
        style: {
          position: "absolute",
          transform: `translate(-50%, -50%) translate(${v}px, ${f}px)`,
          background: "#fff",
          padding: "2px 8px",
          borderRadius: "4px",
          fontSize: "12px",
          border: "1px solid #d9d9d9",
          pointerEvents: "all"
        },
        className: "edge-label",
        children: d.label
      }
    ) })
  ] });
});
Q.displayName = "MermaidEdge";
const Ve = {
  default: Q,
  smoothstep: Q
}, je = ["TB", "TD", "BT", "RL", "LR"];
function Ge({ direction: n, onDirectionChange: i, mermaidCode: p }) {
  const o = () => {
    const h = new Blob([p], { type: "text/plain;charset=utf-8" }), x = URL.createObjectURL(h), c = document.createElement("a");
    c.href = x, c.download = `flowchart-${Date.now()}.mmd`, document.body.appendChild(c), c.click(), document.body.removeChild(c), URL.revokeObjectURL(x);
  }, y = async () => {
    try {
      await navigator.clipboard.writeText(p);
    } catch {
    }
  };
  return /* @__PURE__ */ r("div", { className: "toolbar", children: [
    /* @__PURE__ */ r("div", { className: "toolbar-section", children: [
      /* @__PURE__ */ e("span", { className: "toolbar-label", children: "方向:" }),
      /* @__PURE__ */ e(
        "select",
        {
          value: n,
          onChange: (h) => i(h.target.value),
          className: "toolbar-select",
          title: "切换流程图方向并重新布局",
          children: je.map((h) => /* @__PURE__ */ e("option", { value: h, children: h }, h))
        }
      )
    ] }),
    /* @__PURE__ */ e("div", { className: "toolbar-section", children: /* @__PURE__ */ e("h1", { className: "toolbar-title", children: "Mermaid 反向编辑器" }) }),
    /* @__PURE__ */ r("div", { className: "toolbar-section toolbar-actions", children: [
      /* @__PURE__ */ e("button", { type: "button", className: "toolbar-btn", onClick: y, title: "复制 Mermaid 代码到剪贴板", children: "复制代码" }),
      /* @__PURE__ */ e("button", { type: "button", className: "toolbar-btn", onClick: o, title: "导出为 .mmd 文件", children: "导出" })
    ] })
  ] });
}
const qe = [
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
function Qe({ onAddNode: n }) {
  const i = (p, o) => {
    p.dataTransfer.setData("application/mermaid-shape", o), p.dataTransfer.effectAllowed = "move";
  };
  return /* @__PURE__ */ r("div", { className: "node-library", children: [
    /* @__PURE__ */ e("h3", { className: "library-title", children: "节点库" }),
    /* @__PURE__ */ e("div", { className: "node-list", children: qe.map((p) => /* @__PURE__ */ r(
      "button",
      {
        className: "node-item",
        draggable: !0,
        onDragStart: (o) => i(o, p.type),
        onClick: () => n(p.type),
        title: `点击添加或拖拽到画布：${p.label}`,
        children: [
          /* @__PURE__ */ e("span", { className: "node-icon", children: p.icon }),
          /* @__PURE__ */ e("span", { className: "node-label", children: p.label })
        ]
      },
      p.type
    )) })
  ] });
}
function Je({ consumed: n, canvasSource: i, lastConsumedAt: p, onReset: o }) {
  let y = "", h = "";
  i === null ? (y = "空画布", h = "status-empty") : !n && i === "user" ? (y = "待消费（用户绘制）", h = "status-pending") : n && i === "user" ? (y = "已消费", h = "status-consumed") : n && i === "ai" && (y = "AI生成内容（已消费）", h = "status-ai");
  const x = p ? new Date(p).toLocaleTimeString("zh-CN") : "";
  return /* @__PURE__ */ r("div", { className: `consumed-badge ${h}`, children: [
    /* @__PURE__ */ e("span", { className: "status-text", children: y }),
    x && /* @__PURE__ */ e("span", { className: "status-time", children: x }),
    n && /* @__PURE__ */ e("button", { className: "reset-button", onClick: o, children: "重新启用" })
  ] });
}
const Ze = {
  connected: { color: "#52c41a", text: "已连接" },
  reconnecting: { color: "#faad14", text: "重连中..." },
  disconnected: { color: "#ff4d4f", text: "已断开" }
};
function et({ status: n }) {
  const i = Ze[n];
  return /* @__PURE__ */ r("div", { className: "connection-status", children: [
    /* @__PURE__ */ e("span", { className: "status-dot", style: { backgroundColor: i.color } }),
    /* @__PURE__ */ e("span", { className: "status-label", children: i.text })
  ] });
}
const tt = [
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
], nt = [
  { value: "arrow", label: "实线箭头 (-->)" },
  { value: "line", label: "实线 (---)" },
  { value: "dotted", label: "虚线 (-.-)" },
  { value: "dotted-arrow", label: "虚线箭头 (-.->)" },
  { value: "thick", label: "粗线箭头 (==>)" },
  { value: "circle", label: "圆形端点 (---o)" },
  { value: "cross", label: "交叉端点 (---x)" },
  { value: "bidirectional", label: "双向箭头 (<--->)" }
];
function at({ selectedNode: n, selectedEdge: i, onUpdateNode: p, onUpdateEdge: o }) {
  var y, h, x;
  return !n && !i ? /* @__PURE__ */ r("div", { className: "property-panel", children: [
    /* @__PURE__ */ e("h3", { className: "panel-title", children: "属性面板" }),
    /* @__PURE__ */ e("p", { className: "panel-hint", children: "选中节点或边以编辑属性" })
  ] }) : n ? /* @__PURE__ */ r("div", { className: "property-panel", children: [
    /* @__PURE__ */ e("h3", { className: "panel-title", children: "节点属性" }),
    /* @__PURE__ */ r("div", { className: "panel-content", children: [
      /* @__PURE__ */ r("label", { className: "panel-label", children: [
        "文本",
        /* @__PURE__ */ e(
          "input",
          {
            className: "panel-input",
            type: "text",
            value: n.data.label,
            onChange: (c) => p(n.id, { label: c.target.value })
          }
        )
      ] }),
      /* @__PURE__ */ r("label", { className: "panel-label", children: [
        "形状",
        /* @__PURE__ */ e(
          "select",
          {
            className: "panel-select",
            value: n.data.shape,
            onChange: (c) => {
              const k = c.target.value;
              p(n.id, { shape: k });
            },
            children: tt.map((c) => /* @__PURE__ */ e("option", { value: c.value, children: c.label }, c.value))
          }
        )
      ] }),
      /* @__PURE__ */ e("div", { className: "panel-section-title", children: "样式" }),
      /* @__PURE__ */ r("label", { className: "panel-label panel-color-row", children: [
        "填充色",
        /* @__PURE__ */ e(
          "input",
          {
            className: "panel-color",
            type: "color",
            value: ((y = n.data.style) == null ? void 0 : y.fill) ?? "#ffffff",
            onChange: (c) => p(n.id, {
              style: { ...n.data.style, fill: c.target.value }
            })
          }
        )
      ] }),
      /* @__PURE__ */ r("label", { className: "panel-label panel-color-row", children: [
        "边框色",
        /* @__PURE__ */ e(
          "input",
          {
            className: "panel-color",
            type: "color",
            value: ((h = n.data.style) == null ? void 0 : h.stroke) ?? "#333333",
            onChange: (c) => p(n.id, {
              style: { ...n.data.style, stroke: c.target.value }
            })
          }
        )
      ] }),
      /* @__PURE__ */ r("label", { className: "panel-label panel-color-row", children: [
        "文字色",
        /* @__PURE__ */ e(
          "input",
          {
            className: "panel-color",
            type: "color",
            value: ((x = n.data.style) == null ? void 0 : x.color) ?? "#333333",
            onChange: (c) => p(n.id, {
              style: { ...n.data.style, color: c.target.value }
            })
          }
        )
      ] }),
      /* @__PURE__ */ e(
        "button",
        {
          className: "panel-reset-btn",
          type: "button",
          onClick: () => p(n.id, { style: void 0 }),
          children: "重置样式"
        }
      ),
      /* @__PURE__ */ r("div", { className: "panel-info", children: [
        /* @__PURE__ */ e("span", { className: "info-label", children: "ID:" }),
        /* @__PURE__ */ e("span", { className: "info-value", children: n.id })
      ] }),
      /* @__PURE__ */ r("div", { className: "panel-info", children: [
        /* @__PURE__ */ e("span", { className: "info-label", children: "位置:" }),
        /* @__PURE__ */ r("span", { className: "info-value", children: [
          "(",
          Math.round(n.position.x),
          ", ",
          Math.round(n.position.y),
          ")"
        ] })
      ] })
    ] })
  ] }) : i ? /* @__PURE__ */ r("div", { className: "property-panel", children: [
    /* @__PURE__ */ e("h3", { className: "panel-title", children: "边属性" }),
    /* @__PURE__ */ r("div", { className: "panel-content", children: [
      /* @__PURE__ */ r("label", { className: "panel-label", children: [
        "标签",
        /* @__PURE__ */ e(
          "input",
          {
            className: "panel-input",
            type: "text",
            value: i.data.label ?? "",
            placeholder: "（无标签）",
            onChange: (c) => o(i.id, { label: c.target.value })
          }
        )
      ] }),
      /* @__PURE__ */ r("label", { className: "panel-label", children: [
        "样式",
        /* @__PURE__ */ e(
          "select",
          {
            className: "panel-select",
            value: i.data.edgeStyle,
            onChange: (c) => {
              const k = c.target.value;
              o(i.id, { edgeStyle: k });
            },
            children: nt.map((c) => /* @__PURE__ */ e("option", { value: c.value, children: c.label }, c.value))
          }
        )
      ] }),
      /* @__PURE__ */ r("div", { className: "panel-info", children: [
        /* @__PURE__ */ e("span", { className: "info-label", children: "ID:" }),
        /* @__PURE__ */ e("span", { className: "info-value", children: i.id })
      ] }),
      /* @__PURE__ */ r("div", { className: "panel-info", children: [
        /* @__PURE__ */ e("span", { className: "info-label", children: "连接:" }),
        /* @__PURE__ */ r("span", { className: "info-value", children: [
          i.source,
          " → ",
          i.target
        ] })
      ] })
    ] })
  ] }) : null;
}
function ae({ value: n, onConfirm: i, onCancel: p }) {
  const [o, y] = L(n), h = _(null);
  return A(() => {
    var k, d;
    (k = h.current) == null || k.focus(), (d = h.current) == null || d.select();
  }, []), /* @__PURE__ */ e(
    "input",
    {
      ref: h,
      className: "inline-editor",
      value: o,
      onChange: (k) => y(k.target.value),
      onKeyDown: (k) => {
        k.key === "Enter" ? (k.preventDefault(), i(o)) : k.key === "Escape" && (k.preventDefault(), p());
      },
      onBlur: () => {
        i(o);
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
function lt({ code: n, onCodeChange: i, error: p }) {
  const [o, y] = L(n || "flowchart TD"), [h, x] = L(!1), c = _(!1), k = _(null);
  return A(() => {
    !h && !c.current && y(n || "flowchart TD");
  }, [n, h]), A(() => {
    n === o && c.current && (c.current = !1);
  }, [n, o]), /* @__PURE__ */ r("div", { className: "code-editor", children: [
    /* @__PURE__ */ e("div", { className: "code-editor-title", children: "Mermaid 代码" }),
    /* @__PURE__ */ e(
      "textarea",
      {
        ref: k,
        className: "code-editor-content",
        value: o,
        onChange: (N) => {
          c.current = !0, y(N.target.value);
        },
        onFocus: () => x(!0),
        onBlur: () => {
          x(!1), c.current && o !== n && (i == null || i(o));
        },
        onKeyDown: (N) => {
          (N.ctrlKey || N.metaKey) && N.key === "Enter" && (N.preventDefault(), c.current && o !== n && (i == null || i(o)));
        },
        spellCheck: !1,
        placeholder: "flowchart TD"
      }
    ),
    p && /* @__PURE__ */ e("div", { className: "code-editor-error", children: p })
  ] });
}
let ot = 0;
function q() {
  return `node_${Date.now()}_${ot++}`;
}
const le = /* @__PURE__ */ new Set(["measured", "dimensions"]);
function rt(n) {
  const {
    syncNodes: i,
    syncEdges: p,
    syncDirection: o,
    syncViewport: y,
    consumed: h,
    canvasSource: x,
    lastConsumedAt: c,
    connectionStatus: k,
    onCanvasEdit: d,
    onDirectionChange: I,
    onResetConsumed: z,
    onViewportChange: R
  } = n, N = Me(), [t, a, v] = Le(i), [f, S, w] = Ie(p), [u, g] = L(null), [D, W] = L(null), [F, X] = L(null), [J, K] = L(null), [re, Z] = L(null), Y = _(t), P = _(f), B = _(o);
  Y.current = t, P.current = f, B.current = o;
  const V = _(!1);
  A(() => {
    a(i);
  }, [i, a]), A(() => {
    S(p);
  }, [p, S]), A(() => {
    y !== null && (V.current = !0, N.setViewport({ x: y.x, y: y.y, zoom: y.zoom }), requestAnimationFrame(() => {
      V.current = !1;
    }));
  }, [y, N]);
  const E = $(() => ({
    nodes: Y.current,
    edges: P.current,
    direction: B.current
  }), []), se = $(
    (l) => {
      v(l), l.some((b) => !le.has(b.type)) && setTimeout(() => {
        d(E());
      }, 0);
    },
    [v, d, E]
  ), ie = $(
    (l) => {
      w(l), l.some((b) => !le.has(b.type)) && setTimeout(() => {
        d(E());
      }, 0);
    },
    [w, d, E]
  ), ce = $(
    (l) => {
      const s = {
        ...l,
        id: `edge_${Date.now()}`,
        type: "smoothstep",
        data: { edgeStyle: "arrow" }
      };
      S((b) => ze(s, b)), setTimeout(() => {
        d(E());
      }, 0);
    },
    [S, d, E]
  ), de = $(
    (l) => {
      const s = {
        id: q(),
        type: l,
        position: { x: Math.random() * 300 + 100, y: Math.random() * 200 + 100 },
        data: {
          label: "新节点",
          shape: l
        }
      };
      a((b) => {
        const m = [...b, s];
        return setTimeout(() => {
          d({
            nodes: m,
            edges: P.current,
            direction: B.current
          });
        }, 0), m;
      });
    },
    [a, d]
  ), ue = $(
    (l) => {
      l.preventDefault();
      const s = l.dataTransfer.getData("application/mermaid-shape");
      if (!s) return;
      const b = N.screenToFlowPosition({
        x: l.clientX,
        y: l.clientY
      });
      b.x -= 70, b.y -= 25;
      const m = {
        id: q(),
        type: s,
        position: b,
        data: { label: "新节点", shape: s }
      };
      a((M) => {
        const C = [...M, m];
        return setTimeout(() => {
          d({
            nodes: C,
            edges: P.current,
            direction: B.current
          });
        }, 0), C;
      });
    },
    [N, a, d]
  ), pe = $((l) => {
    l.preventDefault(), l.dataTransfer.dropEffect = "move";
  }, []), he = $(
    (l) => {
      if (!l.target.classList.contains("react-flow__pane")) return;
      const b = N.screenToFlowPosition({
        x: l.clientX,
        y: l.clientY
      }), m = {
        id: q(),
        type: "rect",
        position: b,
        data: { label: "新节点", shape: "rect" }
      };
      a((M) => {
        const C = [...M, m];
        return setTimeout(() => {
          d({
            nodes: C,
            edges: P.current,
            direction: B.current
          });
        }, 0), C;
      });
    },
    [N, a, d]
  ), me = $((l, s) => {
    X(s.id), K(null);
  }, []), fe = $((l, s) => {
    K(s.id), X(null);
  }, []), ye = $((l, s) => {
    a(
      (b) => b.map((m) => m.id === l ? { ...m, data: { ...m.data, label: s } } : m)
    ), X(null), setTimeout(() => {
      d(E());
    }, 0);
  }, [a, d, E]), be = $((l, s) => {
    S(
      (b) => b.map((m) => m.id === l ? { ...m, data: { ...m.data, label: s || void 0 } } : m)
    ), K(null), setTimeout(() => {
      d(E());
    }, 0);
  }, [S, d, E]), ge = $((l) => {
    const s = Pe(l);
    s.success ? (a(s.canvas.nodes), S(s.canvas.edges), B.current = s.canvas.direction, Z(null), setTimeout(() => {
      d({
        nodes: s.canvas.nodes,
        edges: s.canvas.edges,
        direction: s.canvas.direction
      });
    }, 0)) : Z(s.errors.map((b) => b.message).join("; "));
  }, [a, S, d]), ve = $(({ nodes: l, edges: s }) => {
    g(l.length === 1 ? l[0].id : null), W(s.length === 1 ? s[0].id : null);
  }, []), ke = $(
    (l, s) => {
      V.current || R({ x: s.x, y: s.y, zoom: s.zoom });
    },
    [R]
  ), xe = $((l, s) => {
    a((b) => b.map((m) => {
      if (m.id !== l) return m;
      const M = { ...m.data, ...s }, C = s.shape ?? m.type;
      return { ...m, type: C, data: M };
    })), setTimeout(() => {
      d(E());
    }, 0);
  }, [a, d, E]), Ne = $((l, s) => {
    S((b) => b.map((m) => m.id === l ? { ...m, data: { ...m.data, ...s } } : m)), setTimeout(() => {
      d(E());
    }, 0);
  }, [S, d, E]);
  A(() => {
    const l = (s) => {
      if (s.key === "Delete" || s.key === "Backspace") {
        const b = s.target;
        if (b.tagName === "INPUT" || b.tagName === "SELECT" || b.tagName === "TEXTAREA")
          return;
        const m = Y.current.filter((C) => C.selected), M = P.current.filter((C) => C.selected);
        (m.length > 0 || M.length > 0) && (s.preventDefault(), N.deleteElements({
          nodes: m.map((C) => ({ id: C.id })),
          edges: M.map((C) => ({ id: C.id }))
        }), setTimeout(() => {
          d(E());
        }, 0));
      }
    };
    return window.addEventListener("keydown", l), () => window.removeEventListener("keydown", l);
  }, [N, d, E]);
  const j = F ? t.find((l) => l.id === F) : null, G = J ? f.find((l) => l.id === J) : null, we = u ? t.find((l) => l.id === u) ?? null : null, Ee = D ? f.find((l) => l.id === D) ?? null : null, ee = Ce(() => Fe({ nodes: t, edges: f, direction: o }).mermaid, [t, f, o]);
  return /* @__PURE__ */ r("div", { className: "app-container", children: [
    /* @__PURE__ */ e(
      Ge,
      {
        direction: o,
        mermaidCode: ee,
        onDirectionChange: (l) => {
          B.current = l, I(l), d({ ...E(), direction: l });
        }
      }
    ),
    /* @__PURE__ */ r("div", { className: "main-content", children: [
      /* @__PURE__ */ r("div", { className: "left-panel", children: [
        /* @__PURE__ */ e(lt, { code: ee, onCodeChange: ge, error: re }),
        /* @__PURE__ */ e(Qe, { onAddNode: de })
      ] }),
      /* @__PURE__ */ r("div", { className: "canvas-container", onDoubleClick: he, children: [
        /* @__PURE__ */ e("svg", { width: "0", height: "0", style: { position: "absolute" }, children: /* @__PURE__ */ r("defs", { children: [
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
        /* @__PURE__ */ r(
          We,
          {
            nodes: t,
            edges: f,
            onNodesChange: se,
            onEdgesChange: ie,
            onConnect: ce,
            onNodeDoubleClick: me,
            onEdgeDoubleClick: fe,
            onSelectionChange: ve,
            onMove: ke,
            onDrop: ue,
            onDragOver: pe,
            nodeTypes: Ke,
            edgeTypes: Ve,
            deleteKeyCode: null,
            fitView: !0,
            defaultEdgeOptions: {
              type: "smoothstep"
            },
            children: [
              /* @__PURE__ */ e(Be, {}),
              /* @__PURE__ */ e(_e, {}),
              /* @__PURE__ */ e(Ae, {})
            ]
          }
        ),
        j && /* @__PURE__ */ e(
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
              ae,
              {
                value: j.data.label,
                onConfirm: (l) => ye(j.id, l),
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
              ae,
              {
                value: G.data.label ?? "",
                onConfirm: (l) => be(G.id, l),
                onCancel: () => K(null)
              }
            )
          }
        ),
        /* @__PURE__ */ e(
          Je,
          {
            consumed: h,
            canvasSource: x,
            lastConsumedAt: c,
            onReset: z
          }
        ),
        /* @__PURE__ */ e(et, { status: k })
      ] }),
      /* @__PURE__ */ e(
        at,
        {
          selectedNode: we,
          selectedEdge: Ee,
          onUpdateNode: xe,
          onUpdateEdge: Ne
        }
      )
    ] })
  ] });
}
function ut(n) {
  return /* @__PURE__ */ e(Re, { children: /* @__PURE__ */ e(rt, { ...n }) });
}
export {
  ut as Canvas,
  lt as CodeEditor,
  et as ConnectionStatus,
  Je as ConsumedBadge,
  ae as InlineEditor,
  Q as MermaidEdgeComponent,
  T as MermaidNodeComponent,
  Qe as NodeLibrary,
  at as PropertyPanel,
  Ge as Toolbar,
  Ve as edgeTypes,
  Ke as nodeTypes
};
