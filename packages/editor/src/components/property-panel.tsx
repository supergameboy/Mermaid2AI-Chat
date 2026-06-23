/**
 * 属性面板 — 按 diagramType 动态显示节点/边属性编辑（v4 修订）
 *
 * v4 修订（决策 12）:
 *   - 选中状态改为联合类型 selectedId: { type: 'node'|'group'|'edge'; id: string } | null
 *   - 移除 selectedGroup prop，由 selectedId.type === 'group' 判断
 *   - 消除 selectedNodeId/selectedGroupId 同时存在的混乱
 *
 * 单一职责：根据图表类型显示对应的属性字段
 * - flowchart: 形状选择 + 边样式 + 通用样式
 * - classDiagram: 成员编辑 + 关系类型
 * - erDiagram: 实体编辑 + 属性编辑 + 关系编辑（M4 新组件）
 * - stateDiagram: 状态类型
 * - sequenceDiagram: 参与者类型 + 消息线型
 * - mindmap/architecture: 通用字段
 * - 数据图表类型: 显示提示信息
 */
import type {
  ClassRelationType,
  DiagramType,
  MermaidEdge,
  MermaidNode,
  NodeMember,
  NodeStyle,
  SequenceArrowType,
  ArchitectureGroupInfo,
} from '@mermaid2aichat/serializer';
import { EntityEditor, AttributeEditor, RelationshipEditor } from './er/index.js';
import { StatePropertyEditor, StateRelationEditor } from './state/index.js';
import { MindmapPropertyEditor } from './mindmap/index.js';
import {
  ArchitectureServicePanel,
  ArchitectureJunctionPanel,
  ArchitectureGroupPanel,
  ArchitectureEdgePanel,
} from './architecture/index.js';
import { ShapeSwitcher, EdgeStyleEditor, SubgraphEditor } from './flowchart/index.js';

/** v4：选中状态联合类型（替代 selectedNodeId + selectedGroupId） */
export type SelectedId =
  | { type: 'node'; id: string }
  | { type: 'group'; id: string }
  | { type: 'edge'; id: string }
  | null;

interface PropertyPanelProps {
  /** 当前图表类型（决定显示哪些字段） */
  diagramType: DiagramType;
  selectedNode: MermaidNode | null;
  selectedEdge: MermaidEdge | null;
  onUpdateNode: (id: string, data: Partial<MermaidNode['data']>) => void;
  onUpdateEdge: (id: string, data: Partial<MermaidEdge['data']>) => void;
  /** architecture: 所有节点（供 Group 面板显示成员详情） */
  nodes?: MermaidNode[];
  /** architecture: 所有 groups（供 Service 面板选择所属 group） */
  groups?: ArchitectureGroupInfo[];
  /** v4：选中状态联合类型（architecture 专用，替代 selectedGroup） */
  selectedId?: SelectedId;
  /** architecture: 节点更新回调（完整 MermaidNode 更新，含 parentId 等） */
  onUpdateNodeFull?: (id: string, updates: Partial<MermaidNode>) => void;
  /** architecture: 边更新回调（完整 MermaidEdge 更新，含 sourceHandle 等） */
  onUpdateEdgeFull?: (id: string, updates: Partial<MermaidEdge>) => void;
  /** architecture: 节点删除回调（v4：支持 options.recursive） */
  onDeleteNode?: (id: string, options?: { recursive?: boolean }) => void;
  /** architecture: 边删除回调 */
  onDeleteEdge?: (id: string) => void;
  /** v4：移动节点到其他 group（targetGroupId 为 null 表示移出 group） */
  onMoveToGroup?: (nodeId: string, targetGroupId: string | null) => void;
  /** flowchart: 移动节点到 subgraph（subgraphId 为 null 表示移出到顶层） */
  onMoveToSubgraph?: (nodeId: string, subgraphId: string | null) => void;
  /** flowchart: 删除 subgraph 节点 */
  onDeleteSubgraph?: (id: string) => void;
}

const CLASS_RELATION_OPTIONS: { value: ClassRelationType; label: string }[] = [
  { value: 'extension', label: '继承 (<|--)' },
  { value: 'composition', label: '组合 (*--)' },
  { value: 'aggregation', label: '聚合 (o--)' },
  { value: 'association', label: '关联 (-->)' },
  { value: 'dependency', label: '依赖 (<..)' },
  { value: 'realization', label: '实现 (<|..)' },
  { value: 'lollipop', label: '棒棒糖 (--o)' },
];

const PARTICIPANT_TYPE_OPTIONS: { value: 'participant' | 'actor'; label: string }[] = [
  { value: 'participant', label: 'Participant' },
  { value: 'actor', label: 'Actor' },
];

const SEQUENCE_MESSAGE_TYPE_OPTIONS: { value: SequenceArrowType; label: string }[] = [
  { value: 'solid-arrow', label: '实线箭头 (->)' },
  { value: 'dotted-arrow', label: '虚线箭头 (-->)' },
  { value: 'solid-open', label: '实线开口 (->>)' },
  { value: 'dotted-open', label: '虚线开口 (-->>)' },
  { value: 'solid-cross', label: '实线十字 (-x)' },
  { value: 'dotted-cross', label: '虚线十字 (--x)' },
  { value: 'solid-point', label: '实线点 (-)' },
  { value: 'dotted-point', label: '虚线点 (--)' },
  { value: 'bidirectional-solid', label: '双向实线 (<->)' },
  { value: 'bidirectional-dotted', label: '双向虚线 (<-->)' },
];

export function PropertyPanel({
  diagramType,
  selectedNode,
  selectedEdge,
  onUpdateNode,
  onUpdateEdge,
  nodes,
  groups,
  selectedId,
  onUpdateNodeFull,
  onUpdateEdgeFull,
  onDeleteNode,
  onDeleteEdge,
  onMoveToGroup,
  onMoveToSubgraph,
  onDeleteSubgraph,
}: PropertyPanelProps) {
  // v4：根据 selectedId 联合类型派生选中对象
  const selectedGroup = selectedId?.type === 'group'
    ? groups?.find((g) => g.id === selectedId.id) ?? null
    : null;

  if (!selectedNode && !selectedEdge && !selectedGroup) {
    return (
      <div className="property-panel">
        <h3 className="panel-title">属性面板</h3>
        <p className="panel-hint">选中节点或边以编辑属性</p>
      </div>
    );
  }

  // architecture: 优先处理 group 选中（v4：使用 selectedId 联合类型）
  if (diagramType === 'architecture' && selectedGroup && onDeleteNode && onMoveToGroup) {
    return (
      <div className="property-panel">
        <ArchitectureGroupPanel
          group={selectedGroup}
          nodes={nodes ?? []}
          groups={groups ?? []}
          onUpdateNode={onUpdateNode}
          onDelete={() => onDeleteNode(selectedGroup.id)}
          onMoveToGroup={onMoveToGroup}
        />
      </div>
    );
  }

  if (selectedNode) {
    return (
      <NodePropertyEditor
        node={selectedNode}
        diagramType={diagramType}
        onUpdate={onUpdateNode}
        nodes={nodes}
        groups={groups}
        onUpdateNodeFull={onUpdateNodeFull}
        onDeleteNode={onDeleteNode}
        onMoveToSubgraph={onMoveToSubgraph}
        onDeleteSubgraph={onDeleteSubgraph}
      />
    );
  }

  if (selectedEdge) {
    return (
      <EdgePropertyEditor
        edge={selectedEdge}
        diagramType={diagramType}
        onUpdate={onUpdateEdge}
        nodes={nodes}
        onUpdateEdgeFull={onUpdateEdgeFull}
        onDeleteEdge={onDeleteEdge}
      />
    );
  }

  return null;
}

// === 节点属性编辑器 ===

interface NodePropertyEditorProps {
  node: MermaidNode;
  diagramType: DiagramType;
  onUpdate: (id: string, data: Partial<MermaidNode['data']>) => void;
  /** architecture: 所有节点 */
  nodes?: MermaidNode[];
  /** architecture: 所有 groups */
  groups?: ArchitectureGroupInfo[];
  /** architecture: 完整节点更新回调 */
  onUpdateNodeFull?: (id: string, updates: Partial<MermaidNode>) => void;
  /** architecture: 节点删除回调（v4：支持 options.recursive） */
  onDeleteNode?: (id: string, options?: { recursive?: boolean }) => void;
  /** flowchart: 移动节点到 subgraph */
  onMoveToSubgraph?: (nodeId: string, subgraphId: string | null) => void;
  /** flowchart: 删除 subgraph 节点 */
  onDeleteSubgraph?: (id: string) => void;
}

function NodePropertyEditor({
  node,
  diagramType,
  onUpdate,
  nodes,
  groups,
  onUpdateNodeFull,
  onDeleteNode,
  onMoveToSubgraph,
  onDeleteSubgraph,
}: NodePropertyEditorProps) {
  // erDiagram 使用专用 EntityEditor（含实体名+别名），跳过通用文本字段
  const skipGenericLabel = diagramType === 'erDiagram';

  // stateDiagram 使用专用 StatePropertyEditor（含状态类型+描述+样式），完整替代通用编辑
  if (diagramType === 'stateDiagram') {
    return (
      <div className="property-panel">
        <h3 className="panel-title">状态属性</h3>
        <StatePropertyEditor
          stateNode={node}
          onUpdate={(data) => onUpdate(node.id, data)}
        />
      </div>
    );
  }

  // mindmap 使用专用 MindmapPropertyEditor（含形状+图标+CSS类+样式），完整替代通用编辑
  if (diagramType === 'mindmap') {
    return (
      <div className="property-panel">
        <h3 className="panel-title">思维导图节点属性</h3>
        <MindmapPropertyEditor
          mindmapNode={node}
          onUpdate={(data) => onUpdate(node.id, data)}
        />
      </div>
    );
  }

  // architecture: 根据节点类型使用专用面板
  if (diagramType === 'architecture' && onUpdateNodeFull && onDeleteNode) {
    const isJunction = (node.data as Record<string, unknown>).archIsJunction === true;
    if (isJunction) {
      return (
        <div className="property-panel">
          <ArchitectureJunctionPanel
            node={node}
            onDelete={() => onDeleteNode(node.id)}
          />
        </div>
      );
    }
    return (
      <div className="property-panel">
        <ArchitectureServicePanel
          node={node}
          groups={groups ?? []}
          nodes={nodes}
          onChange={(updates) => onUpdateNodeFull(node.id, updates)}
          onDelete={() => onDeleteNode(node.id)}
        />
      </div>
    );
  }

  // flowchart: subgraph 节点使用专用 SubgraphEditor
  if (diagramType === 'flowchart' && isSubgraphNode(node) && onDeleteSubgraph) {
    return (
      <div className="property-panel">
        <SubgraphEditor
          subgraph={node}
          nodes={nodes ?? []}
          onChange={(updates) => {
            if (onUpdateNodeFull) {
              onUpdateNodeFull(node.id, updates);
            }
          }}
          onDelete={() => onDeleteSubgraph(node.id)}
          onMoveToSubgraph={onMoveToSubgraph}
        />
      </div>
    );
  }

  return (
    <div className="property-panel">
      <h3 className="panel-title">节点属性</h3>
      <div className="panel-content">
        {/* 通用字段：标签（erDiagram 由 EntityEditor 承载） */}
        {!skipGenericLabel && (
          <label className="panel-label">
            文本
            <input
              className="panel-input"
              type="text"
              value={node.data.label}
              onChange={(e) => onUpdate(node.id, { label: e.target.value })}
            />
          </label>
        )}

        {/* flowchart: 形状切换器（M1：使用 ShapeSwitcher 替代 inline select） */}
        {diagramType === 'flowchart' && (
          <ShapeSwitcher
            currentShape={node.data.shape}
            onChange={(shape) => onUpdate(node.id, { shape })}
          />
        )}

        {/* stateDiagram 已在 NodePropertyEditor 入口处由 StatePropertyEditor 完整承载，此处不再处理 */}

        {/* sequenceDiagram: 参与者类型 */}
        {diagramType === 'sequenceDiagram' && (
          <label className="panel-label">
            参与者类型
            <select
              className="panel-select"
              value={node.data.participantType ?? 'participant'}
              onChange={(e) =>
                onUpdate(node.id, {
                  participantType: e.target.value as 'participant' | 'actor',
                })
              }
            >
              {PARTICIPANT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        )}

        {/* classDiagram: 成员编辑 */}
        {diagramType === 'classDiagram' && (
          <MemberEditor
            members={node.data.members ?? []}
            onChange={(members) => onUpdate(node.id, { members })}
          />
        )}

        {/* erDiagram: 实体编辑（名称+别名） + 属性编辑 */}
        {diagramType === 'erDiagram' && (
          <>
            <EntityEditor
              entityNode={node}
              onUpdate={(data) => onUpdate(node.id, data)}
            />
            <AttributeEditor
              attributes={node.data.attributes ?? []}
              onChange={(attributes) => onUpdate(node.id, { attributes })}
            />
          </>
        )}

        {/* 通用字段：样式 */}
        <NodeStyleEditor node={node} onUpdate={onUpdate} />

        <div className="panel-info">
          <span className="info-label">ID:</span>
          <span className="info-value">{node.id}</span>
        </div>
        <div className="panel-info">
          <span className="info-label">位置:</span>
          <span className="info-value">
            ({Math.round(node.position.x)}, {Math.round(node.position.y)})
          </span>
        </div>
      </div>
    </div>
  );
}

// === 边属性编辑器 ===

interface EdgePropertyEditorProps {
  edge: MermaidEdge;
  diagramType: DiagramType;
  onUpdate: (id: string, data: Partial<MermaidEdge['data']>) => void;
  /** architecture: 所有节点（供 Edge 面板显示源/目标） */
  nodes?: MermaidNode[];
  /** architecture: 完整边更新回调（含 sourceHandle 等） */
  onUpdateEdgeFull?: (id: string, updates: Partial<MermaidEdge>) => void;
  /** architecture: 边删除回调 */
  onDeleteEdge?: (id: string) => void;
}

function EdgePropertyEditor({ edge, diagramType, onUpdate, nodes, onUpdateEdgeFull, onDeleteEdge }: EdgePropertyEditorProps) {
  // erDiagram 使用专用 RelationshipEditor（含基数+关系类型+角色），跳过通用标签字段
  const skipGenericLabel = diagramType === 'erDiagram';

  // stateDiagram 使用专用 StateRelationEditor（含转换标签 event[guard]/action），完整替代通用编辑
  if (diagramType === 'stateDiagram') {
    return (
      <div className="property-panel">
        <h3 className="panel-title">转换关系</h3>
        <StateRelationEditor
          relationEdge={edge}
          onUpdate={(data) => onUpdate(edge.id, data)}
        />
      </div>
    );
  }

  // architecture 使用专用 ArchitectureEdgePanel（含 lhsDir/rhsDir/arrow/title）
  if (diagramType === 'architecture' && onUpdateEdgeFull && onDeleteEdge) {
    return (
      <div className="property-panel">
        <ArchitectureEdgePanel
          edge={edge}
          nodes={nodes ?? []}
          onChange={(updates) => onUpdateEdgeFull(edge.id, updates)}
          onDelete={() => onDeleteEdge(edge.id)}
        />
      </div>
    );
  }

  return (
    <div className="property-panel">
      <h3 className="panel-title">边属性</h3>
      <div className="panel-content">
        {/* flowchart: 使用专用 EdgeStyleEditor（M1：替代 inline select） */}
        {diagramType === 'flowchart' && (
          <EdgeStyleEditor
            edge={edge}
            onChange={(updates) => {
              if (updates.data) {
                onUpdate(edge.id, updates.data);
              }
            }}
          />
        )}

        {/* 通用字段：标签（erDiagram 由 RelationshipEditor 承载，flowchart 由 EdgeStyleEditor 承载） */}
        {!skipGenericLabel && diagramType !== 'flowchart' && (
          <label className="panel-label">
            标签
            <input
              className="panel-input"
              type="text"
              value={edge.data.label ?? ''}
              placeholder="（无标签）"
              onChange={(e) => onUpdate(edge.id, { label: e.target.value })}
            />
          </label>
        )}

        {/* classDiagram: 关系类型 */}
        {diagramType === 'classDiagram' && (
          <label className="panel-label">
            关系类型
            <select
              className="panel-select"
              value={edge.data.relationType ?? 'extension'}
              onChange={(e) =>
                onUpdate(edge.id, {
                  relationType: e.target.value as ClassRelationType,
                })
              }
            >
              {CLASS_RELATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        )}

        {/* erDiagram: 关系编辑（基数+关系类型+角色） */}
        {diagramType === 'erDiagram' && (
          <RelationshipEditor
            relationshipEdge={edge}
            onUpdate={(data) => onUpdate(edge.id, data)}
          />
        )}

        {/* sequenceDiagram: 消息线型 */}
        {diagramType === 'sequenceDiagram' && (
          <label className="panel-label">
            消息线型
            <select
              className="panel-select"
              value={edge.data.messageType ?? 'solid-arrow'}
              onChange={(e) =>
                onUpdate(edge.id, {
                  messageType: e.target.value as SequenceArrowType,
                })
              }
            >
              {SEQUENCE_MESSAGE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        )}

        <div className="panel-info">
          <span className="info-label">ID:</span>
          <span className="info-value">{edge.id}</span>
        </div>
        <div className="panel-info">
          <span className="info-label">连接:</span>
          <span className="info-value">{edge.source} → {edge.target}</span>
        </div>
      </div>
    </div>
  );
}

// === 节点样式编辑器（通用）===

interface NodeStyleEditorProps {
  node: MermaidNode;
  onUpdate: (id: string, data: Partial<MermaidNode['data']>) => void;
}

function NodeStyleEditor({ node, onUpdate }: NodeStyleEditorProps) {
  return (
    <>
      <div className="panel-section-title">样式</div>
      <label className="panel-label panel-color-row">
        填充色
        <input
          className="panel-color"
          type="color"
          value={node.data.style?.fill ?? '#ffffff'}
          onChange={(e) =>
            onUpdate(node.id, {
              style: { ...node.data.style, fill: e.target.value } as NodeStyle,
            })
          }
        />
      </label>
      <label className="panel-label panel-color-row">
        边框色
        <input
          className="panel-color"
          type="color"
          value={node.data.style?.stroke ?? '#333333'}
          onChange={(e) =>
            onUpdate(node.id, {
              style: { ...node.data.style, stroke: e.target.value } as NodeStyle,
            })
          }
        />
      </label>
      <label className="panel-label panel-color-row">
        文字色
        <input
          className="panel-color"
          type="color"
          value={node.data.style?.color ?? '#333333'}
          onChange={(e) =>
            onUpdate(node.id, {
              style: { ...node.data.style, color: e.target.value } as NodeStyle,
            })
          }
        />
      </label>
      <button
        className="panel-reset-btn"
        type="button"
        onClick={() => onUpdate(node.id, { style: undefined })}
      >
        重置样式
      </button>
    </>
  );
}

// === classDiagram 成员编辑器 ===

interface MemberEditorProps {
  members: NodeMember[];
  onChange: (members: NodeMember[]) => void;
}

function MemberEditor({ members, onChange }: MemberEditorProps) {
  const updateMember = (index: number, patch: Partial<NodeMember>) => {
    const next = members.map((m, i) => (i === index ? { ...m, ...patch } : m));
    onChange(next);
  };

  const addMember = () => {
    onChange([
      ...members,
      {
        name: 'newMember',
        visibility: '+',
        isStatic: false,
        isAbstract: false,
        isMethod: false,
      },
    ]);
  };

  const removeMember = (index: number) => {
    onChange(members.filter((_, i) => i !== index));
  };

  return (
    <>
      <div className="panel-section-title">类成员</div>
      {members.map((member, index) => (
        <div key={index} className="panel-member">
          <label className="panel-label">
            可见性
            <select
              className="panel-select"
              value={member.visibility}
              onChange={(e) =>
                updateMember(index, {
                  visibility: e.target.value as NodeMember['visibility'],
                })
              }
            >
              <option value="+">+ public</option>
              <option value="-">- private</option>
              <option value="#"># protected</option>
              <option value="~">~ package</option>
              <option value="">（无）</option>
            </select>
          </label>
          <label className="panel-label">
            名称
            <input
              className="panel-input"
              type="text"
              value={member.name}
              onChange={(e) => updateMember(index, { name: e.target.value })}
            />
          </label>
          <label className="panel-label">
            类型
            <input
              className="panel-input"
              type="text"
              value={member.type ?? ''}
              placeholder="（属性类型 / 方法返回类型）"
              onChange={(e) => updateMember(index, { type: e.target.value })}
            />
          </label>
          <label className="panel-label panel-checkbox-row">
            <input
              type="checkbox"
              checked={member.isMethod}
              onChange={(e) => updateMember(index, { isMethod: e.target.checked })}
            />
            方法
          </label>
          <label className="panel-label panel-checkbox-row">
            <input
              type="checkbox"
              checked={member.isStatic}
              onChange={(e) => updateMember(index, { isStatic: e.target.checked })}
            />
            静态
          </label>
          <label className="panel-label panel-checkbox-row">
            <input
              type="checkbox"
              checked={member.isAbstract}
              onChange={(e) => updateMember(index, { isAbstract: e.target.checked })}
            />
            抽象
          </label>
          <button
            type="button"
            className="panel-reset-btn"
            onClick={() => removeMember(index)}
          >
            删除成员
          </button>
        </div>
      ))}
      <button type="button" className="panel-reset-btn" onClick={addMember}>
        添加成员
      </button>
    </>
  );
}

// === 辅助函数 ===

/** 判断节点是否为 subgraph 节点 */
function isSubgraphNode(node: MermaidNode): boolean {
  return (node.data as Record<string, unknown>).isSubgraph === true;
}
