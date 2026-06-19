import { jsxs as r, jsx as e, Fragment as Ce } from "react/jsx-runtime";
import { memo as oe, useState as I, useRef as A, useEffect as P, useCallback as E, useMemo as $e } from "react";
import { Handle as H, Position as U, getSmoothStepPath as Te, BaseEdge as Se, EdgeLabelRenderer as De, ReactFlowProvider as Re, useReactFlow as Me, useNodesState as Le, useEdgesState as Ie, addEdge as ze, ReactFlow as We, Background as Be, Controls as _e, MiniMap as Ae } from "@xyflow/react";
import { parseMermaid as Pe, serializeMermaid as Fe, layoutCanvas as Xe } from "@mermaid-editor/serializer";
const Y = { width: 8, height: 8 }, T = oe(({ data: a, selected: i }) => {
  const p = a.shape, o = a.style, y = (o == null ? void 0 : o.stroke) ?? "#333", h = (o == null ? void 0 : o.fill) ?? "#fff", x = (o == null ? void 0 : o.color) ?? "#333";
  return /* @__PURE__ */ r("div", { className: "mermaid-node", style: { position: "relative", display: "inline-block" }, children: [
    /* @__PURE__ */ e(H, { type: "target", position: U.Top, style: Y }),
    /* @__PURE__ */ e(H, { type: "target", position: U.Left, style: Y }),
    /* @__PURE__ */ e(Ke, { shape: p, label: a.label, stroke: y, fill: h, color: x, selected: i }),
    /* @__PURE__ */ e(H, { type: "source", position: U.Bottom, style: Y }),
    /* @__PURE__ */ e(H, { type: "source", position: U.Right, style: Y })
  ] });
});
T.displayName = "MermaidNode";
function Ke({
  shape: a,
  label: i,
  stroke: p,
  fill: o,
  color: y,
  selected: h
}) {
  const x = i.split(/<br\s*\/?>|\n/i), c = x.length, k = 18, d = 48, z = 8, W = 24, R = Math.max(...x.map((u) => u.length)), t = Math.max(R * z, 60) + W * 2, n = d + (c - 1) * k, v = h ? 3 : 2, f = h ? "#1890ff" : p, S = {
    fill: y,
    fontSize: "14px",
    textAnchor: "middle",
    dominantBaseline: "central",
    userSelect: "none",
    pointerEvents: "none"
  }, w = (u, g = n / 2) => /* @__PURE__ */ e("text", { x: u, y: g, style: S, children: x.map((D, B) => /* @__PURE__ */ e(
    "tspan",
    {
      x: u,
      dy: B === 0 ? -(c - 1) * k / 2 : k,
      children: D
    },
    B
  )) });
  switch (a) {
    case "rect":
      return /* @__PURE__ */ r("svg", { width: t, height: n, style: { display: "block" }, children: [
        /* @__PURE__ */ e("rect", { x: 1, y: 1, width: t - 2, height: n - 2, fill: o, stroke: f, strokeWidth: v }),
        w(t / 2)
      ] });
    case "rounded":
      return /* @__PURE__ */ r("svg", { width: t, height: n, style: { display: "block" }, children: [
        /* @__PURE__ */ e("rect", { x: 1, y: 1, width: t - 2, height: n - 2, rx: 12, ry: 12, fill: o, stroke: f, strokeWidth: v }),
        w(t / 2)
      ] });
    case "stadium":
      return /* @__PURE__ */ r("svg", { width: t, height: n, style: { display: "block" }, children: [
        /* @__PURE__ */ e("rect", { x: 1, y: 1, width: t - 2, height: n - 2, rx: n / 2, ry: n / 2, fill: o, stroke: f, strokeWidth: v }),
        w(t / 2)
      ] });
    case "diamond": {
      const u = t / 2, g = n / 2, D = t / 2, B = n / 2, F = `${u},${g - B} ${u + D},${g} ${u},${g + B} ${u - D},${g}`;
      return /* @__PURE__ */ r("svg", { width: t, height: n, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: F, fill: o, stroke: f, strokeWidth: v }),
        w(u)
      ] });
    }
    case "circle": {
      const u = Math.max(t, n), g = u / 2 - 2;
      return /* @__PURE__ */ r("svg", { width: u, height: u, style: { display: "block" }, children: [
        /* @__PURE__ */ e("circle", { cx: u / 2, cy: u / 2, r: g, fill: o, stroke: f, strokeWidth: v }),
        w(u / 2, u / 2)
      ] });
    }
    case "cylinder":
      return /* @__PURE__ */ r("svg", { width: t, height: n, style: { display: "block" }, children: [
        /* @__PURE__ */ e(
          "path",
          {
            d: `M 1 8 L 1 ${n - 8} Q ${t / 2} ${n + 8 - 4} ${t - 1} ${n - 8} L ${t - 1} 8`,
            fill: o,
            stroke: f,
            strokeWidth: v
          }
        ),
        /* @__PURE__ */ e("ellipse", { cx: t / 2, cy: 8, rx: t / 2 - 1, ry: 8, fill: o, stroke: f, strokeWidth: v }),
        w(t / 2)
      ] });
    case "hexagon": {
      const g = `20,1 ${t - 20},1 ${t - 1},${n / 2} ${t - 20},${n - 1} 20,${n - 1} 1,${n / 2}`;
      return /* @__PURE__ */ r("svg", { width: t, height: n, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: g, fill: o, stroke: f, strokeWidth: v }),
        w(t / 2)
      ] });
    }
    case "parallelogram": {
      const g = `16,1 ${t - 1},1 ${t - 16},${n - 1} 1,${n - 1}`;
      return /* @__PURE__ */ r("svg", { width: t, height: n, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: g, fill: o, stroke: f, strokeWidth: v }),
        w(t / 2)
      ] });
    }
    case "subroutine":
      return /* @__PURE__ */ r("svg", { width: t, height: n, style: { display: "block" }, children: [
        /* @__PURE__ */ e("rect", { x: 1, y: 1, width: t - 2, height: n - 2, fill: o, stroke: f, strokeWidth: v }),
        /* @__PURE__ */ e("line", { x1: 10, y1: 1, x2: 10, y2: n - 1, stroke: f, strokeWidth: v }),
        /* @__PURE__ */ e("line", { x1: t - 10, y1: 1, x2: t - 10, y2: n - 1, stroke: f, strokeWidth: v }),
        w(t / 2)
      ] });
    case "doublecircle": {
      const u = Math.max(t, n), g = u / 2 - 2, D = g - 6;
      return /* @__PURE__ */ r("svg", { width: u, height: u, style: { display: "block" }, children: [
        /* @__PURE__ */ e("circle", { cx: u / 2, cy: u / 2, r: g, fill: o, stroke: f, strokeWidth: v }),
        /* @__PURE__ */ e("circle", { cx: u / 2, cy: u / 2, r: D, fill: "none", stroke: f, strokeWidth: v }),
        w(u / 2, u / 2)
      ] });
    }
    case "asymmetric": {
      const g = `1,1 ${t - 20},1 ${t - 1},${n / 2} ${t - 20},${n - 1} 1,${n - 1}`;
      return /* @__PURE__ */ r("svg", { width: t, height: n, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: g, fill: o, stroke: f, strokeWidth: v }),
        w(t / 2 - 20 / 2)
      ] });
    }
    case "parallelogram-reverse": {
      const g = `1,1 ${t - 16},1 ${t - 1},${n - 1} 16,${n - 1}`;
      return /* @__PURE__ */ r("svg", { width: t, height: n, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: g, fill: o, stroke: f, strokeWidth: v }),
        w(t / 2)
      ] });
    }
    case "trapezoid": {
      const g = `20,1 ${t - 20},1 ${t - 1},${n - 1} 1,${n - 1}`;
      return /* @__PURE__ */ r("svg", { width: t, height: n, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: g, fill: o, stroke: f, strokeWidth: v }),
        w(t / 2)
      ] });
    }
    case "trapezoid-reverse": {
      const g = `1,1 ${t - 1},1 ${t - 20},${n - 1} 20,${n - 1}`;
      return /* @__PURE__ */ r("svg", { width: t, height: n, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: g, fill: o, stroke: f, strokeWidth: v }),
        w(t / 2)
      ] });
    }
    default:
      return /* @__PURE__ */ r("svg", { width: t, height: n, style: { display: "block" }, children: [
        /* @__PURE__ */ e("rect", { x: 1, y: 1, width: t - 2, height: n - 2, fill: o, stroke: f, strokeWidth: v }),
        w(t / 2)
      ] });
  }
}
const Oe = {
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
function He(a) {
  return te[a] ?? te.arrow;
}
function Ue(a) {
  return (a == null ? void 0 : a.startsWith("custom:")) ?? !1;
}
function Ye(a) {
  return `mermaid-${a.replace("custom:", "")}-marker`;
}
function ne(a) {
  if (!(!a || !Ue(a)))
    return `url(#${Ye(a)})`;
}
const Ve = {
  arrow: { stroke: "#333", strokeWidth: 2 },
  line: { stroke: "#333", strokeWidth: 2 },
  dotted: { stroke: "#333", strokeWidth: 2, strokeDasharray: "5,5" },
  "dotted-arrow": { stroke: "#333", strokeWidth: 2, strokeDasharray: "5,5" },
  thick: { stroke: "#333", strokeWidth: 4 },
  circle: { stroke: "#333", strokeWidth: 2 },
  cross: { stroke: "#333", strokeWidth: 2 },
  bidirectional: { stroke: "#333", strokeWidth: 2 }
}, Q = oe(({
  id: a,
  sourceX: i,
  sourceY: p,
  targetX: o,
  targetY: y,
  sourcePosition: h,
  targetPosition: x,
  data: c,
  selected: k
}) => {
  const d = c, z = (d == null ? void 0 : d.edgeStyle) ?? "arrow", W = Ve[z], R = He(z), N = ne(R.markerEndType), t = ne(R.markerStartType), [n, v, f] = Te({
    sourceX: i,
    sourceY: p,
    sourcePosition: h,
    targetX: o,
    targetY: y,
    targetPosition: x
  });
  return /* @__PURE__ */ r(Ce, { children: [
    /* @__PURE__ */ e(
      Se,
      {
        id: a,
        path: n,
        style: {
          ...W,
          ...k ? { stroke: "#1890ff", strokeWidth: (W.strokeWidth ?? 2) + 1 } : {}
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
const je = {
  default: Q,
  smoothstep: Q
}, Ge = ["TB", "TD", "BT", "RL", "LR"];
function qe({ direction: a, onDirectionChange: i, mermaidCode: p }) {
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
          value: a,
          onChange: (h) => i(h.target.value),
          className: "toolbar-select",
          title: "切换流程图方向并重新布局",
          children: Ge.map((h) => /* @__PURE__ */ e("option", { value: h, children: h }, h))
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
const Qe = [
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
function Je({ onAddNode: a }) {
  const i = (p, o) => {
    p.dataTransfer.setData("application/mermaid-shape", o), p.dataTransfer.effectAllowed = "move";
  };
  return /* @__PURE__ */ r("div", { className: "node-library", children: [
    /* @__PURE__ */ e("h3", { className: "library-title", children: "节点库" }),
    /* @__PURE__ */ e("div", { className: "node-list", children: Qe.map((p) => /* @__PURE__ */ r(
      "button",
      {
        className: "node-item",
        draggable: !0,
        onDragStart: (o) => i(o, p.type),
        onClick: () => a(p.type),
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
function Ze({ consumed: a, canvasSource: i, lastConsumedAt: p, onReset: o }) {
  let y = "", h = "";
  i === null ? (y = "空画布", h = "status-empty") : !a && i === "user" ? (y = "待消费（用户绘制）", h = "status-pending") : a && i === "user" ? (y = "已消费", h = "status-consumed") : a && i === "ai" && (y = "AI生成内容（已消费）", h = "status-ai");
  const x = p ? new Date(p).toLocaleTimeString("zh-CN") : "";
  return /* @__PURE__ */ r("div", { className: `consumed-badge ${h}`, children: [
    /* @__PURE__ */ e("span", { className: "status-text", children: y }),
    x && /* @__PURE__ */ e("span", { className: "status-time", children: x }),
    a && /* @__PURE__ */ e("button", { className: "reset-button", onClick: o, children: "重新启用" })
  ] });
}
const et = {
  connected: { color: "#52c41a", text: "已连接" },
  reconnecting: { color: "#faad14", text: "重连中..." },
  disconnected: { color: "#ff4d4f", text: "已断开" }
};
function tt({ status: a }) {
  const i = et[a];
  return /* @__PURE__ */ r("div", { className: "connection-status", children: [
    /* @__PURE__ */ e("span", { className: "status-dot", style: { backgroundColor: i.color } }),
    /* @__PURE__ */ e("span", { className: "status-label", children: i.text })
  ] });
}
const nt = [
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
], at = [
  { value: "arrow", label: "实线箭头 (-->)" },
  { value: "line", label: "实线 (---)" },
  { value: "dotted", label: "虚线 (-.-)" },
  { value: "dotted-arrow", label: "虚线箭头 (-.->)" },
  { value: "thick", label: "粗线箭头 (==>)" },
  { value: "circle", label: "圆形端点 (---o)" },
  { value: "cross", label: "交叉端点 (---x)" },
  { value: "bidirectional", label: "双向箭头 (<--->)" }
];
function lt({ selectedNode: a, selectedEdge: i, onUpdateNode: p, onUpdateEdge: o }) {
  var y, h, x;
  return !a && !i ? /* @__PURE__ */ r("div", { className: "property-panel", children: [
    /* @__PURE__ */ e("h3", { className: "panel-title", children: "属性面板" }),
    /* @__PURE__ */ e("p", { className: "panel-hint", children: "选中节点或边以编辑属性" })
  ] }) : a ? /* @__PURE__ */ r("div", { className: "property-panel", children: [
    /* @__PURE__ */ e("h3", { className: "panel-title", children: "节点属性" }),
    /* @__PURE__ */ r("div", { className: "panel-content", children: [
      /* @__PURE__ */ r("label", { className: "panel-label", children: [
        "文本",
        /* @__PURE__ */ e(
          "input",
          {
            className: "panel-input",
            type: "text",
            value: a.data.label,
            onChange: (c) => p(a.id, { label: c.target.value })
          }
        )
      ] }),
      /* @__PURE__ */ r("label", { className: "panel-label", children: [
        "形状",
        /* @__PURE__ */ e(
          "select",
          {
            className: "panel-select",
            value: a.data.shape,
            onChange: (c) => {
              const k = c.target.value;
              p(a.id, { shape: k });
            },
            children: nt.map((c) => /* @__PURE__ */ e("option", { value: c.value, children: c.label }, c.value))
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
            value: ((y = a.data.style) == null ? void 0 : y.fill) ?? "#ffffff",
            onChange: (c) => p(a.id, {
              style: { ...a.data.style, fill: c.target.value }
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
            value: ((h = a.data.style) == null ? void 0 : h.stroke) ?? "#333333",
            onChange: (c) => p(a.id, {
              style: { ...a.data.style, stroke: c.target.value }
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
            value: ((x = a.data.style) == null ? void 0 : x.color) ?? "#333333",
            onChange: (c) => p(a.id, {
              style: { ...a.data.style, color: c.target.value }
            })
          }
        )
      ] }),
      /* @__PURE__ */ e(
        "button",
        {
          className: "panel-reset-btn",
          type: "button",
          onClick: () => p(a.id, { style: void 0 }),
          children: "重置样式"
        }
      ),
      /* @__PURE__ */ r("div", { className: "panel-info", children: [
        /* @__PURE__ */ e("span", { className: "info-label", children: "ID:" }),
        /* @__PURE__ */ e("span", { className: "info-value", children: a.id })
      ] }),
      /* @__PURE__ */ r("div", { className: "panel-info", children: [
        /* @__PURE__ */ e("span", { className: "info-label", children: "位置:" }),
        /* @__PURE__ */ r("span", { className: "info-value", children: [
          "(",
          Math.round(a.position.x),
          ", ",
          Math.round(a.position.y),
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
            children: at.map((c) => /* @__PURE__ */ e("option", { value: c.value, children: c.label }, c.value))
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
function ae({ value: a, onConfirm: i, onCancel: p }) {
  const [o, y] = I(a), h = A(null);
  return P(() => {
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
function ot({ code: a, onCodeChange: i, error: p }) {
  const [o, y] = I(a || "flowchart TD"), [h, x] = I(!1), c = A(!1), k = A(null);
  return P(() => {
    !h && !c.current && y(a || "flowchart TD");
  }, [a, h]), /* @__PURE__ */ r("div", { className: "code-editor", children: [
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
          x(!1), c.current && o !== a && (i == null || i(o), c.current = !1);
        },
        onKeyDown: (N) => {
          (N.ctrlKey || N.metaKey) && N.key === "Enter" && (N.preventDefault(), c.current && o !== a && (i == null || i(o), c.current = !1));
        },
        spellCheck: !1,
        placeholder: "flowchart TD"
      }
    ),
    p && /* @__PURE__ */ e("div", { className: "code-editor-error", children: p })
  ] });
}
let rt = 0;
function q() {
  return `node_${Date.now()}_${rt++}`;
}
const le = /* @__PURE__ */ new Set(["measured", "dimensions"]);
function st(a) {
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
    onDirectionChange: z,
    onResetConsumed: W,
    onViewportChange: R
  } = a, N = Me(), [t, n, v] = Le(i), [f, S, w] = Ie(p), [u, g] = I(null), [D, B] = I(null), [F, X] = I(null), [J, K] = I(null), [re, Z] = I(null), O = A(t), M = A(f), _ = A(o);
  O.current = t, M.current = f, _.current = o;
  const V = A(!1);
  P(() => {
    n(i);
  }, [i, n]), P(() => {
    S(p);
  }, [p, S]), P(() => {
    y !== null && (V.current = !0, N.setViewport({ x: y.x, y: y.y, zoom: y.zoom }), requestAnimationFrame(() => {
      V.current = !1;
    }));
  }, [y, N]);
  const C = E(() => ({
    nodes: O.current,
    edges: M.current,
    direction: _.current
  }), []), se = E(
    (l) => {
      v(l), l.some((b) => !le.has(b.type)) && setTimeout(() => {
        d(C());
      }, 0);
    },
    [v, d, C]
  ), ie = E(
    (l) => {
      w(l), l.some((b) => !le.has(b.type)) && setTimeout(() => {
        d(C());
      }, 0);
    },
    [w, d, C]
  ), ce = E(
    (l) => {
      const s = {
        ...l,
        id: `edge_${Date.now()}`,
        type: "smoothstep",
        data: { edgeStyle: "arrow" }
      };
      S((b) => ze(s, b)), setTimeout(() => {
        d(C());
      }, 0);
    },
    [S, d, C]
  ), de = E(
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
      n((b) => {
        const m = [...b, s];
        return setTimeout(() => {
          d({
            nodes: m,
            edges: M.current,
            direction: _.current
          });
        }, 0), m;
      });
    },
    [n, d]
  ), ue = E(
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
      n((L) => {
        const $ = [...L, m];
        return setTimeout(() => {
          d({
            nodes: $,
            edges: M.current,
            direction: _.current
          });
        }, 0), $;
      });
    },
    [N, n, d]
  ), pe = E((l) => {
    l.preventDefault(), l.dataTransfer.dropEffect = "move";
  }, []), he = E(
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
      n((L) => {
        const $ = [...L, m];
        return setTimeout(() => {
          d({
            nodes: $,
            edges: M.current,
            direction: _.current
          });
        }, 0), $;
      });
    },
    [N, n, d]
  ), me = E((l, s) => {
    X(s.id), K(null);
  }, []), fe = E((l, s) => {
    K(s.id), X(null);
  }, []), ye = E((l, s) => {
    n(
      (b) => b.map((m) => m.id === l ? { ...m, data: { ...m.data, label: s } } : m)
    ), X(null), setTimeout(() => {
      d(C());
    }, 0);
  }, [n, d, C]), be = E((l, s) => {
    S(
      (b) => b.map((m) => m.id === l ? { ...m, data: { ...m.data, label: s || void 0 } } : m)
    ), K(null), setTimeout(() => {
      d(C());
    }, 0);
  }, [S, d, C]), ge = E((l) => {
    const s = Pe(l);
    s.success ? (n(s.canvas.nodes), S(s.canvas.edges), _.current = s.canvas.direction, Z(null), setTimeout(() => {
      d({
        nodes: s.canvas.nodes,
        edges: s.canvas.edges,
        direction: s.canvas.direction
      });
    }, 0)) : Z(s.errors.map((b) => b.message).join("; "));
  }, [n, S, d]), ve = E(({ nodes: l, edges: s }) => {
    g(l.length === 1 ? l[0].id : null), B(s.length === 1 ? s[0].id : null);
  }, []), ke = E(
    (l, s) => {
      V.current || R({ x: s.x, y: s.y, zoom: s.zoom });
    },
    [R]
  ), xe = E((l, s) => {
    n((b) => b.map((m) => {
      if (m.id !== l) return m;
      const L = { ...m.data, ...s }, $ = s.shape ?? m.type;
      return { ...m, type: $, data: L };
    })), setTimeout(() => {
      d(C());
    }, 0);
  }, [n, d, C]), Ne = E((l, s) => {
    S((b) => b.map((m) => m.id === l ? { ...m, data: { ...m.data, ...s } } : m)), setTimeout(() => {
      d(C());
    }, 0);
  }, [S, d, C]);
  P(() => {
    const l = (s) => {
      if (s.key === "Delete" || s.key === "Backspace") {
        const b = s.target;
        if (b.tagName === "INPUT" || b.tagName === "SELECT" || b.tagName === "TEXTAREA")
          return;
        const m = O.current.filter(($) => $.selected), L = M.current.filter(($) => $.selected);
        (m.length > 0 || L.length > 0) && (s.preventDefault(), N.deleteElements({
          nodes: m.map(($) => ({ id: $.id })),
          edges: L.map(($) => ({ id: $.id }))
        }), setTimeout(() => {
          d(C());
        }, 0));
      }
    };
    return window.addEventListener("keydown", l), () => window.removeEventListener("keydown", l);
  }, [N, d, C]);
  const j = F ? t.find((l) => l.id === F) : null, G = J ? f.find((l) => l.id === J) : null, we = u ? t.find((l) => l.id === u) ?? null : null, Ee = D ? f.find((l) => l.id === D) ?? null : null, ee = $e(() => Fe({ nodes: t, edges: f, direction: o }).mermaid, [t, f, o]);
  return /* @__PURE__ */ r("div", { className: "app-container", children: [
    /* @__PURE__ */ e(
      qe,
      {
        direction: o,
        mermaidCode: ee,
        onDirectionChange: (l) => {
          _.current = l;
          const s = [...O.current];
          Xe(s, M.current, l), n(s), z(l), setTimeout(() => {
            d({
              nodes: s,
              edges: M.current,
              direction: l
            });
          }, 0);
        }
      }
    ),
    /* @__PURE__ */ r("div", { className: "main-content", children: [
      /* @__PURE__ */ r("div", { className: "left-panel", children: [
        /* @__PURE__ */ e(ot, { code: ee, onCodeChange: ge, error: re }),
        /* @__PURE__ */ e(Je, { onAddNode: de })
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
            nodeTypes: Oe,
            edgeTypes: je,
            deleteKeyCode: null,
            zoomOnDoubleClick: !1,
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
          Ze,
          {
            consumed: h,
            canvasSource: x,
            lastConsumedAt: c,
            onReset: W
          }
        ),
        /* @__PURE__ */ e(tt, { status: k })
      ] }),
      /* @__PURE__ */ e(
        lt,
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
function pt(a) {
  return /* @__PURE__ */ e(Re, { children: /* @__PURE__ */ e(st, { ...a }) });
}
export {
  pt as Canvas,
  ot as CodeEditor,
  tt as ConnectionStatus,
  Ze as ConsumedBadge,
  ae as InlineEditor,
  Q as MermaidEdgeComponent,
  T as MermaidNodeComponent,
  Je as NodeLibrary,
  lt as PropertyPanel,
  qe as Toolbar,
  je as edgeTypes,
  Oe as nodeTypes
};
