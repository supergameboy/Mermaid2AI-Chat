import { jsxs as o, jsx as e, Fragment as be } from "react/jsx-runtime";
import { memo as ee, useState as R, useRef as M, useEffect as I, useCallback as N, useMemo as ve } from "react";
import { Handle as W, Position as _, getSmoothStepPath as ke, BaseEdge as xe, EdgeLabelRenderer as Ne, ReactFlowProvider as we, useReactFlow as $e, useNodesState as Ee, useEdgesState as Ce, addEdge as Se, ReactFlow as Te, Background as Re, Controls as Me, MiniMap as Ie } from "@xyflow/react";
import { serializeMermaid as De } from "@mermaid-editor/serializer";
const A = { width: 8, height: 8 }, k = ee(({ data: a, selected: l }) => {
  const m = a.shape, s = a.style, c = (s == null ? void 0 : s.stroke) ?? "#333", f = (s == null ? void 0 : s.fill) ?? "#fff", $ = (s == null ? void 0 : s.color) ?? "#333";
  return /* @__PURE__ */ o("div", { style: { position: "relative", display: "inline-block" }, children: [
    /* @__PURE__ */ e(W, { type: "target", position: _.Top, style: A }),
    /* @__PURE__ */ e(W, { type: "target", position: _.Left, style: A }),
    /* @__PURE__ */ e(Le, { shape: m, label: a.label, stroke: c, fill: f, color: $, selected: l }),
    /* @__PURE__ */ e(W, { type: "source", position: _.Bottom, style: A }),
    /* @__PURE__ */ e(W, { type: "source", position: _.Right, style: A })
  ] });
});
k.displayName = "MermaidNode";
function Le({
  shape: a,
  label: l,
  stroke: m,
  fill: s,
  color: c,
  selected: f
}) {
  const t = Math.max(l.length * 8, 60) + 24 * 2, n = 48, p = f ? 3 : 2, h = f ? "#1890ff" : m, g = {
    fill: c,
    fontSize: "14px",
    textAnchor: "middle",
    dominantBaseline: "central",
    userSelect: "none",
    pointerEvents: "none"
  };
  switch (a) {
    case "rect":
      return /* @__PURE__ */ o("svg", { width: t, height: n, style: { display: "block" }, children: [
        /* @__PURE__ */ e("rect", { x: 1, y: 1, width: t - 2, height: n - 2, fill: s, stroke: h, strokeWidth: p }),
        /* @__PURE__ */ e("text", { x: t / 2, y: n / 2, style: g, children: l })
      ] });
    case "rounded":
      return /* @__PURE__ */ o("svg", { width: t, height: n, style: { display: "block" }, children: [
        /* @__PURE__ */ e("rect", { x: 1, y: 1, width: t - 2, height: n - 2, rx: 12, ry: 12, fill: s, stroke: h, strokeWidth: p }),
        /* @__PURE__ */ e("text", { x: t / 2, y: n / 2, style: g, children: l })
      ] });
    case "stadium":
      return /* @__PURE__ */ o("svg", { width: t, height: n, style: { display: "block" }, children: [
        /* @__PURE__ */ e("rect", { x: 1, y: 1, width: t - 2, height: n - 2, rx: n / 2, ry: n / 2, fill: s, stroke: h, strokeWidth: p }),
        /* @__PURE__ */ e("text", { x: t / 2, y: n / 2, style: g, children: l })
      ] });
    case "diamond": {
      const i = t / 2, d = n / 2, C = t / 2, w = n / 2, E = `${i},${d - w} ${i + C},${d} ${i},${d + w} ${i - C},${d}`;
      return /* @__PURE__ */ o("svg", { width: t, height: n, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: E, fill: s, stroke: h, strokeWidth: p }),
        /* @__PURE__ */ e("text", { x: i, y: d, style: g, children: l })
      ] });
    }
    case "circle": {
      const i = Math.max(t, n), d = i / 2 - 2;
      return /* @__PURE__ */ o("svg", { width: i, height: i, style: { display: "block" }, children: [
        /* @__PURE__ */ e("circle", { cx: i / 2, cy: i / 2, r: d, fill: s, stroke: h, strokeWidth: p }),
        /* @__PURE__ */ e("text", { x: i / 2, y: i / 2, style: g, children: l })
      ] });
    }
    case "cylinder":
      return /* @__PURE__ */ o("svg", { width: t, height: n, style: { display: "block" }, children: [
        /* @__PURE__ */ e(
          "path",
          {
            d: `M 1 8 L 1 ${n - 8} Q ${t / 2} ${n + 8 - 4} ${t - 1} ${n - 8} L ${t - 1} 8`,
            fill: s,
            stroke: h,
            strokeWidth: p
          }
        ),
        /* @__PURE__ */ e("ellipse", { cx: t / 2, cy: 8, rx: t / 2 - 1, ry: 8, fill: s, stroke: h, strokeWidth: p }),
        /* @__PURE__ */ e("text", { x: t / 2, y: n / 2, style: g, children: l })
      ] });
    case "hexagon": {
      const d = `20,1 ${t - 20},1 ${t - 1},${n / 2} ${t - 20},${n - 1} 20,${n - 1} 1,${n / 2}`;
      return /* @__PURE__ */ o("svg", { width: t, height: n, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: d, fill: s, stroke: h, strokeWidth: p }),
        /* @__PURE__ */ e("text", { x: t / 2, y: n / 2, style: g, children: l })
      ] });
    }
    case "parallelogram": {
      const d = `16,1 ${t - 1},1 ${t - 16},${n - 1} 1,${n - 1}`;
      return /* @__PURE__ */ o("svg", { width: t, height: n, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: d, fill: s, stroke: h, strokeWidth: p }),
        /* @__PURE__ */ e("text", { x: t / 2, y: n / 2, style: g, children: l })
      ] });
    }
    case "subroutine":
      return /* @__PURE__ */ o("svg", { width: t, height: n, style: { display: "block" }, children: [
        /* @__PURE__ */ e("rect", { x: 1, y: 1, width: t - 2, height: n - 2, fill: s, stroke: h, strokeWidth: p }),
        /* @__PURE__ */ e("line", { x1: 10, y1: 1, x2: 10, y2: n - 1, stroke: h, strokeWidth: p }),
        /* @__PURE__ */ e("line", { x1: t - 10, y1: 1, x2: t - 10, y2: n - 1, stroke: h, strokeWidth: p }),
        /* @__PURE__ */ e("text", { x: t / 2, y: n / 2, style: g, children: l })
      ] });
    case "doublecircle": {
      const i = Math.max(t, n), d = i / 2 - 2, C = d - 6;
      return /* @__PURE__ */ o("svg", { width: i, height: i, style: { display: "block" }, children: [
        /* @__PURE__ */ e("circle", { cx: i / 2, cy: i / 2, r: d, fill: s, stroke: h, strokeWidth: p }),
        /* @__PURE__ */ e("circle", { cx: i / 2, cy: i / 2, r: C, fill: "none", stroke: h, strokeWidth: p }),
        /* @__PURE__ */ e("text", { x: i / 2, y: i / 2, style: g, children: l })
      ] });
    }
    case "asymmetric": {
      const d = `1,1 ${t - 20},1 ${t - 1},${n / 2} ${t - 20},${n - 1} 1,${n - 1}`;
      return /* @__PURE__ */ o("svg", { width: t, height: n, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: d, fill: s, stroke: h, strokeWidth: p }),
        /* @__PURE__ */ e("text", { x: t / 2 - 20 / 2, y: n / 2, style: g, children: l })
      ] });
    }
    case "parallelogram-reverse": {
      const d = `1,1 ${t - 16},1 ${t - 1},${n - 1} 16,${n - 1}`;
      return /* @__PURE__ */ o("svg", { width: t, height: n, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: d, fill: s, stroke: h, strokeWidth: p }),
        /* @__PURE__ */ e("text", { x: t / 2, y: n / 2, style: g, children: l })
      ] });
    }
    case "trapezoid": {
      const d = `20,1 ${t - 20},1 ${t - 1},${n - 1} 1,${n - 1}`;
      return /* @__PURE__ */ o("svg", { width: t, height: n, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: d, fill: s, stroke: h, strokeWidth: p }),
        /* @__PURE__ */ e("text", { x: t / 2, y: n / 2, style: g, children: l })
      ] });
    }
    case "trapezoid-reverse": {
      const d = `1,1 ${t - 1},1 ${t - 20},${n - 1} 20,${n - 1}`;
      return /* @__PURE__ */ o("svg", { width: t, height: n, style: { display: "block" }, children: [
        /* @__PURE__ */ e("polygon", { points: d, fill: s, stroke: h, strokeWidth: p }),
        /* @__PURE__ */ e("text", { x: t / 2, y: n / 2, style: g, children: l })
      ] });
    }
    default:
      return /* @__PURE__ */ o("svg", { width: t, height: n, style: { display: "block" }, children: [
        /* @__PURE__ */ e("rect", { x: 1, y: 1, width: t - 2, height: n - 2, fill: s, stroke: h, strokeWidth: p }),
        /* @__PURE__ */ e("text", { x: t / 2, y: n / 2, style: g, children: l })
      ] });
  }
}
const ze = {
  rect: k,
  rounded: k,
  stadium: k,
  diamond: k,
  circle: k,
  cylinder: k,
  hexagon: k,
  parallelogram: k,
  subroutine: k,
  doublecircle: k,
  // 扩展形状
  asymmetric: k,
  "parallelogram-reverse": k,
  trapezoid: k,
  "trapezoid-reverse": k
}, q = {
  arrow: { markerEndType: "custom:arrow" },
  line: {},
  dotted: {},
  "dotted-arrow": { markerEndType: "custom:arrow" },
  thick: { markerEndType: "custom:arrow" },
  circle: { markerEndType: "custom:circle" },
  cross: { markerEndType: "custom:cross" },
  bidirectional: { markerStartType: "custom:arrow", markerEndType: "custom:arrow" }
};
function We(a) {
  return q[a] ?? q.arrow;
}
function _e(a) {
  return (a == null ? void 0 : a.startsWith("custom:")) ?? !1;
}
function Ae(a) {
  return `mermaid-${a.replace("custom:", "")}-marker`;
}
function Q(a) {
  if (!(!a || !_e(a)))
    return `url(#${Ae(a)})`;
}
const Be = {
  arrow: { stroke: "#333", strokeWidth: 2 },
  line: { stroke: "#333", strokeWidth: 2 },
  dotted: { stroke: "#333", strokeWidth: 2, strokeDasharray: "5,5" },
  "dotted-arrow": { stroke: "#333", strokeWidth: 2, strokeDasharray: "5,5" },
  thick: { stroke: "#333", strokeWidth: 4 },
  circle: { stroke: "#333", strokeWidth: 2 },
  cross: { stroke: "#333", strokeWidth: 2 },
  bidirectional: { stroke: "#333", strokeWidth: 2 }
}, O = ee(({
  id: a,
  sourceX: l,
  sourceY: m,
  targetX: s,
  targetY: c,
  sourcePosition: f,
  targetPosition: $,
  data: T,
  selected: x
}) => {
  const t = T, n = (t == null ? void 0 : t.edgeStyle) ?? "arrow", p = Be[n], h = We(n), g = Q(h.markerEndType), i = Q(h.markerStartType), [d, C, w] = ke({
    sourceX: l,
    sourceY: m,
    sourcePosition: f,
    targetX: s,
    targetY: c,
    targetPosition: $
  });
  return /* @__PURE__ */ o(be, { children: [
    /* @__PURE__ */ e(
      xe,
      {
        id: a,
        path: d,
        style: {
          ...p,
          ...x ? { stroke: "#1890ff", strokeWidth: (p.strokeWidth ?? 2) + 1 } : {}
        },
        markerEnd: g,
        markerStart: i
      }
    ),
    (t == null ? void 0 : t.label) && /* @__PURE__ */ e(Ne, { children: /* @__PURE__ */ e(
      "div",
      {
        style: {
          position: "absolute",
          transform: `translate(-50%, -50%) translate(${C}px, ${w}px)`,
          background: "#fff",
          padding: "2px 8px",
          borderRadius: "4px",
          fontSize: "12px",
          border: "1px solid #d9d9d9",
          pointerEvents: "all"
        },
        className: "edge-label",
        children: t.label
      }
    ) })
  ] });
});
O.displayName = "MermaidEdge";
const Pe = {
  default: O,
  smoothstep: O
}, Xe = ["TB", "TD", "BT", "RL", "LR"];
function Ue({ direction: a, onDirectionChange: l }) {
  return /* @__PURE__ */ o("div", { className: "toolbar", children: [
    /* @__PURE__ */ o("div", { className: "toolbar-section", children: [
      /* @__PURE__ */ e("span", { className: "toolbar-label", children: "方向:" }),
      /* @__PURE__ */ e(
        "select",
        {
          value: a,
          onChange: (m) => l(m.target.value),
          className: "toolbar-select",
          children: Xe.map((m) => /* @__PURE__ */ e("option", { value: m, children: m }, m))
        }
      )
    ] }),
    /* @__PURE__ */ e("div", { className: "toolbar-section", children: /* @__PURE__ */ e("h1", { className: "toolbar-title", children: "Mermaid 反向编辑器" }) })
  ] });
}
const Fe = [
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
function He({ onAddNode: a }) {
  return /* @__PURE__ */ o("div", { className: "node-library", children: [
    /* @__PURE__ */ e("h3", { className: "library-title", children: "节点库" }),
    /* @__PURE__ */ e("div", { className: "node-list", children: Fe.map((l) => /* @__PURE__ */ o(
      "button",
      {
        className: "node-item",
        onClick: () => a(l.type),
        title: `添加${l.label}`,
        children: [
          /* @__PURE__ */ e("span", { className: "node-icon", children: l.icon }),
          /* @__PURE__ */ e("span", { className: "node-label", children: l.label })
        ]
      },
      l.type
    )) })
  ] });
}
function Oe({ consumed: a, canvasSource: l, lastConsumedAt: m, onReset: s }) {
  let c = "", f = "";
  l === null ? (c = "空画布", f = "status-empty") : !a && l === "user" ? (c = "待消费（用户绘制）", f = "status-pending") : a && l === "user" ? (c = "已消费", f = "status-consumed") : a && l === "ai" && (c = "AI生成内容（已消费）", f = "status-ai");
  const $ = m ? new Date(m).toLocaleTimeString("zh-CN") : "";
  return /* @__PURE__ */ o("div", { className: `consumed-badge ${f}`, children: [
    /* @__PURE__ */ e("span", { className: "status-text", children: c }),
    $ && /* @__PURE__ */ e("span", { className: "status-time", children: $ }),
    a && /* @__PURE__ */ e("button", { className: "reset-button", onClick: s, children: "重新启用" })
  ] });
}
const Ve = {
  connected: { color: "#52c41a", text: "已连接" },
  reconnecting: { color: "#faad14", text: "重连中..." },
  disconnected: { color: "#ff4d4f", text: "已断开" }
};
function Ye({ status: a }) {
  const l = Ve[a];
  return /* @__PURE__ */ o("div", { className: "connection-status", children: [
    /* @__PURE__ */ e("span", { className: "status-dot", style: { backgroundColor: l.color } }),
    /* @__PURE__ */ e("span", { className: "status-label", children: l.text })
  ] });
}
const Ke = [
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
], Ge = [
  { value: "arrow", label: "实线箭头 (-->)" },
  { value: "line", label: "实线 (---)" },
  { value: "dotted", label: "虚线 (-.-)" },
  { value: "dotted-arrow", label: "虚线箭头 (-.->)" },
  { value: "thick", label: "粗线箭头 (==>)" },
  { value: "circle", label: "圆形端点 (---o)" },
  { value: "cross", label: "交叉端点 (---x)" },
  { value: "bidirectional", label: "双向箭头 (<--->)" }
];
function je({ selectedNode: a, selectedEdge: l, onUpdateNode: m, onUpdateEdge: s }) {
  return !a && !l ? /* @__PURE__ */ o("div", { className: "property-panel", children: [
    /* @__PURE__ */ e("h3", { className: "panel-title", children: "属性面板" }),
    /* @__PURE__ */ e("p", { className: "panel-hint", children: "选中节点或边以编辑属性" })
  ] }) : a ? /* @__PURE__ */ o("div", { className: "property-panel", children: [
    /* @__PURE__ */ e("h3", { className: "panel-title", children: "节点属性" }),
    /* @__PURE__ */ o("div", { className: "panel-content", children: [
      /* @__PURE__ */ o("label", { className: "panel-label", children: [
        "文本",
        /* @__PURE__ */ e(
          "input",
          {
            className: "panel-input",
            type: "text",
            value: a.data.label,
            onChange: (c) => m(a.id, { label: c.target.value })
          }
        )
      ] }),
      /* @__PURE__ */ o("label", { className: "panel-label", children: [
        "形状",
        /* @__PURE__ */ e(
          "select",
          {
            className: "panel-select",
            value: a.data.shape,
            onChange: (c) => {
              const f = c.target.value;
              m(a.id, { shape: f });
            },
            children: Ke.map((c) => /* @__PURE__ */ e("option", { value: c.value, children: c.label }, c.value))
          }
        )
      ] }),
      /* @__PURE__ */ o("div", { className: "panel-info", children: [
        /* @__PURE__ */ e("span", { className: "info-label", children: "ID:" }),
        /* @__PURE__ */ e("span", { className: "info-value", children: a.id })
      ] }),
      /* @__PURE__ */ o("div", { className: "panel-info", children: [
        /* @__PURE__ */ e("span", { className: "info-label", children: "位置:" }),
        /* @__PURE__ */ o("span", { className: "info-value", children: [
          "(",
          Math.round(a.position.x),
          ", ",
          Math.round(a.position.y),
          ")"
        ] })
      ] })
    ] })
  ] }) : l ? /* @__PURE__ */ o("div", { className: "property-panel", children: [
    /* @__PURE__ */ e("h3", { className: "panel-title", children: "边属性" }),
    /* @__PURE__ */ o("div", { className: "panel-content", children: [
      /* @__PURE__ */ o("label", { className: "panel-label", children: [
        "标签",
        /* @__PURE__ */ e(
          "input",
          {
            className: "panel-input",
            type: "text",
            value: l.data.label ?? "",
            placeholder: "（无标签）",
            onChange: (c) => s(l.id, { label: c.target.value })
          }
        )
      ] }),
      /* @__PURE__ */ o("label", { className: "panel-label", children: [
        "样式",
        /* @__PURE__ */ e(
          "select",
          {
            className: "panel-select",
            value: l.data.edgeStyle,
            onChange: (c) => {
              const f = c.target.value;
              s(l.id, { edgeStyle: f });
            },
            children: Ge.map((c) => /* @__PURE__ */ e("option", { value: c.value, children: c.label }, c.value))
          }
        )
      ] }),
      /* @__PURE__ */ o("div", { className: "panel-info", children: [
        /* @__PURE__ */ e("span", { className: "info-label", children: "ID:" }),
        /* @__PURE__ */ e("span", { className: "info-value", children: l.id })
      ] }),
      /* @__PURE__ */ o("div", { className: "panel-info", children: [
        /* @__PURE__ */ e("span", { className: "info-label", children: "连接:" }),
        /* @__PURE__ */ o("span", { className: "info-value", children: [
          l.source,
          " → ",
          l.target
        ] })
      ] })
    ] })
  ] }) : null;
}
function J({ value: a, onConfirm: l, onCancel: m }) {
  const [s, c] = R(a), f = M(null);
  return I(() => {
    var x, t;
    (x = f.current) == null || x.focus(), (t = f.current) == null || t.select();
  }, []), /* @__PURE__ */ e(
    "input",
    {
      ref: f,
      className: "inline-editor",
      value: s,
      onChange: (x) => c(x.target.value),
      onKeyDown: (x) => {
        x.key === "Enter" ? (x.preventDefault(), l(s)) : x.key === "Escape" && (x.preventDefault(), m());
      },
      onBlur: () => {
        l(s);
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
function qe({ code: a }) {
  return /* @__PURE__ */ o("div", { className: "code-editor", children: [
    /* @__PURE__ */ e("div", { className: "code-editor-title", children: "Mermaid 代码" }),
    /* @__PURE__ */ e("pre", { className: "code-editor-content", children: a || "flowchart TD" })
  ] });
}
let Qe = 0;
function Je() {
  return `node_${Date.now()}_${Qe++}`;
}
const Z = /* @__PURE__ */ new Set(["measured", "dimensions"]);
function Ze(a) {
  const {
    syncNodes: l,
    syncEdges: m,
    syncDirection: s,
    syncViewport: c,
    consumed: f,
    canvasSource: $,
    lastConsumedAt: T,
    connectionStatus: x,
    onCanvasEdit: t,
    onDirectionChange: n,
    onResetConsumed: p,
    onViewportChange: h
  } = a, g = $e(), [i, d, C] = Ee(l), [w, E, V] = Ce(m), [Y, te] = R(null), [K, ne] = R(null), [G, D] = R(null), [j, L] = R(null), B = M(i), P = M(w), X = M(s);
  B.current = i, P.current = w, X.current = s;
  const U = M(!1);
  I(() => {
    d(l);
  }, [l, d]), I(() => {
    E(m);
  }, [m, E]), I(() => {
    c !== null && (U.current = !0, g.setViewport({ x: c.x, y: c.y, zoom: c.zoom }), requestAnimationFrame(() => {
      U.current = !1;
    }));
  }, [c, g]);
  const b = N(() => ({
    nodes: B.current,
    edges: P.current,
    direction: X.current
  }), []), le = N(
    (r) => {
      C(r), r.some((v) => !Z.has(v.type)) && setTimeout(() => {
        t(b());
      }, 0);
    },
    [C, t, b]
  ), ae = N(
    (r) => {
      V(r), r.some((v) => !Z.has(v.type)) && setTimeout(() => {
        t(b());
      }, 0);
    },
    [V, t, b]
  ), oe = N(
    (r) => {
      const u = {
        ...r,
        id: `edge_${Date.now()}`,
        type: "smoothstep",
        data: { edgeStyle: "arrow" }
      };
      E((v) => Se(u, v)), setTimeout(() => {
        t(b());
      }, 0);
    },
    [E, t, b]
  ), re = N(
    (r) => {
      const u = {
        id: Je(),
        type: r,
        position: { x: Math.random() * 300 + 100, y: Math.random() * 200 + 100 },
        data: {
          label: "新节点",
          shape: r
        }
      };
      d((v) => [...v, u]), setTimeout(() => {
        t(b());
      }, 0);
    },
    [d, t, b]
  ), se = N((r, u) => {
    D(u.id), L(null);
  }, []), ie = N((r, u) => {
    L(u.id), D(null);
  }, []), ce = N((r, u) => {
    d(
      (v) => v.map((y) => y.id === r ? { ...y, data: { ...y.data, label: u } } : y)
    ), D(null), setTimeout(() => {
      t(b());
    }, 0);
  }, [d, t, b]), de = N((r, u) => {
    E(
      (v) => v.map((y) => y.id === r ? { ...y, data: { ...y.data, label: u || void 0 } } : y)
    ), L(null), setTimeout(() => {
      t(b());
    }, 0);
  }, [E, t, b]), ue = N(({ nodes: r, edges: u }) => {
    te(r.length === 1 ? r[0].id : null), ne(u.length === 1 ? u[0].id : null);
  }, []), he = N(
    (r, u) => {
      U.current || h({ x: u.x, y: u.y, zoom: u.zoom });
    },
    [h]
  ), pe = N((r, u) => {
    d((v) => v.map((y) => {
      if (y.id !== r) return y;
      const z = { ...y.data, ...u }, S = u.shape ?? y.type;
      return { ...y, type: S, data: z };
    })), setTimeout(() => {
      t(b());
    }, 0);
  }, [d, t, b]), me = N((r, u) => {
    E((v) => v.map((y) => y.id === r ? { ...y, data: { ...y.data, ...u } } : y)), setTimeout(() => {
      t(b());
    }, 0);
  }, [E, t, b]);
  I(() => {
    const r = (u) => {
      if (u.key === "Delete" || u.key === "Backspace") {
        const v = u.target;
        if (v.tagName === "INPUT" || v.tagName === "SELECT" || v.tagName === "TEXTAREA")
          return;
        const y = B.current.filter((S) => S.selected), z = P.current.filter((S) => S.selected);
        (y.length > 0 || z.length > 0) && (u.preventDefault(), g.deleteElements({
          nodes: y.map((S) => ({ id: S.id })),
          edges: z.map((S) => ({ id: S.id }))
        }), setTimeout(() => {
          t(b());
        }, 0));
      }
    };
    return window.addEventListener("keydown", r), () => window.removeEventListener("keydown", r);
  }, [g, t, b]);
  const F = G ? i.find((r) => r.id === G) : null, H = j ? w.find((r) => r.id === j) : null, ye = Y ? i.find((r) => r.id === Y) ?? null : null, fe = K ? w.find((r) => r.id === K) ?? null : null, ge = ve(() => De({ nodes: i, edges: w, direction: s }).mermaid, [i, w, s]);
  return /* @__PURE__ */ o("div", { className: "app-container", children: [
    /* @__PURE__ */ e(
      Ue,
      {
        direction: s,
        onDirectionChange: (r) => {
          X.current = r, n(r), t({ ...b(), direction: r });
        }
      }
    ),
    /* @__PURE__ */ o("div", { className: "main-content", children: [
      /* @__PURE__ */ o("div", { className: "left-panel", children: [
        /* @__PURE__ */ e(qe, { code: ge }),
        /* @__PURE__ */ e(He, { onAddNode: re })
      ] }),
      /* @__PURE__ */ o("div", { className: "canvas-container", children: [
        /* @__PURE__ */ e("svg", { width: "0", height: "0", style: { position: "absolute" }, children: /* @__PURE__ */ o("defs", { children: [
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
        /* @__PURE__ */ o(
          Te,
          {
            nodes: i,
            edges: w,
            onNodesChange: le,
            onEdgesChange: ae,
            onConnect: oe,
            onNodeDoubleClick: se,
            onEdgeDoubleClick: ie,
            onSelectionChange: ue,
            onMove: he,
            nodeTypes: ze,
            edgeTypes: Pe,
            deleteKeyCode: null,
            fitView: !0,
            defaultEdgeOptions: {
              type: "smoothstep"
            },
            children: [
              /* @__PURE__ */ e(Re, {}),
              /* @__PURE__ */ e(Me, {}),
              /* @__PURE__ */ e(Ie, {})
            ]
          }
        ),
        F && /* @__PURE__ */ e(
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
              J,
              {
                value: F.data.label,
                onConfirm: (r) => ce(F.id, r),
                onCancel: () => D(null)
              }
            )
          }
        ),
        H && /* @__PURE__ */ e(
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
              J,
              {
                value: H.data.label ?? "",
                onConfirm: (r) => de(H.id, r),
                onCancel: () => L(null)
              }
            )
          }
        ),
        /* @__PURE__ */ e(
          Oe,
          {
            consumed: f,
            canvasSource: $,
            lastConsumedAt: T,
            onReset: p
          }
        ),
        /* @__PURE__ */ e(Ye, { status: x })
      ] }),
      /* @__PURE__ */ e(
        je,
        {
          selectedNode: ye,
          selectedEdge: fe,
          onUpdateNode: pe,
          onUpdateEdge: me
        }
      )
    ] })
  ] });
}
function at(a) {
  return /* @__PURE__ */ e(we, { children: /* @__PURE__ */ e(Ze, { ...a }) });
}
export {
  at as Canvas,
  qe as CodeEditor,
  Ye as ConnectionStatus,
  Oe as ConsumedBadge,
  J as InlineEditor,
  O as MermaidEdgeComponent,
  k as MermaidNodeComponent,
  He as NodeLibrary,
  je as PropertyPanel,
  Ue as Toolbar,
  Pe as edgeTypes,
  ze as nodeTypes
};
