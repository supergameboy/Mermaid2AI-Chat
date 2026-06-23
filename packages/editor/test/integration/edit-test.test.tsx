/**
 * 编辑功能集成测试 — M13 集成验证
 *
 * 单一职责：验证所有 12 种图表类型的编辑面板组件存在且可导入
 *
 * 验证要点:
 *   - 每种图表类型都有对应的编辑面板
 *   - 所有编辑面板组件可正确导入
 *   - 编辑面板组件是有效的 React 组件（函数类型）
 *
 * 编辑面板清单（对齐 M1-M12 设计文档）:
 *   - flowchart: SubgraphEditor, ClassDefManager, StyleEditor, ClickEditor, AccEditor
 *   - sequenceDiagram: ParticipantEditor, MessageEditor, NoteEditor, BlockEditor, BoxEditor
 *   - classDiagram: ClassEditor, MemberEditor, RelationEditor, NamespaceEditor, NoteEditor
 *   - erDiagram: EntityEditor, AttributeEditor, RelationshipEditor
 *   - stateDiagram: StatePropertyEditor, StateRelationEditor
 *   - mindmap: MindmapPropertyEditor, MindmapTreePanel
 *   - architecture: ArchitectureServicePanel, ArchitectureJunctionPanel, ArchitectureGroupPanel, ArchitectureEdgePanel
 *   - gantt: GanttTaskPanel, GanttSectionPanel, GanttConfigPanel
 *   - pie: PieConfigPanel, PieSlicePanel
 *   - timeline: TimelineEventPanel, TimelinePeriodPanel, TimelineSectionPanel
 *   - quadrantChart: QuadrantConfigPanel, QuadrantPointPanel
 *   - xychart: XYChartConfigPanel, XYChartSeriesPanel
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ============================================================
// 编辑面板导入（按图表类型分组）
// ============================================================

// flowchart 编辑面板
import {
  SubgraphEditor,
  ClassDefManager,
  StyleEditor,
  ClickEditor,
  AccEditor,
} from '@/components/flowchart/index';

// sequence 编辑面板
import {
  ParticipantEditor,
  MessageEditor,
  NoteEditor as SequenceNoteEditor,
  BlockEditor,
  BoxEditor,
} from '@/components/sequence/index';

// class 编辑面板
import {
  ClassEditor,
  MemberEditor,
  RelationEditor,
  NamespaceEditor,
  NoteEditor as ClassNoteEditor,
} from '@/components/class/index';

// er 编辑面板
import {
  EntityEditor,
  AttributeEditor,
  RelationshipEditor,
} from '@/components/er/index';

// state 编辑面板
import {
  StatePropertyEditor,
  StateRelationEditor,
} from '@/components/state/index';

// mindmap 编辑面板
import {
  MindmapPropertyEditor,
  MindmapTreePanel,
} from '@/components/mindmap/index';

// architecture 编辑面板
import {
  ArchitectureServicePanel,
  ArchitectureJunctionPanel,
  ArchitectureGroupPanel,
  ArchitectureEdgePanel,
} from '@/components/architecture/index';

// gantt 编辑面板
import {
  GanttTaskPanel,
  GanttSectionPanel,
  GanttConfigPanel,
} from '@/components/gantt/index';

// pie 编辑面板（无 index.ts，直接导入）
import { PieConfigPanel } from '@/components/pie/pie-config-panel';
import { PieSlicePanel } from '@/components/pie/pie-slice-panel';

// timeline 编辑面板（无 index.ts，直接导入）
import { TimelineEventPanel } from '@/components/timeline/timeline-event-panel';
import { TimelinePeriodPanel } from '@/components/timeline/timeline-period-panel';
import { TimelineSectionPanel } from '@/components/timeline/timeline-section-panel';

// quadrant 编辑面板（无 index.ts，直接导入）
import { QuadrantConfigPanel } from '@/components/quadrant/quadrant-config-panel';
import { QuadrantPointPanel } from '@/components/quadrant/quadrant-point-panel';

// xychart 编辑面板（无 index.ts，直接导入）
import { XYChartConfigPanel } from '@/components/xychart/xychart-config-panel';
import { XYChartSeriesPanel } from '@/components/xychart/xychart-series-panel';

const EDITOR_SRC = resolve(__dirname, '../../src');

/** 验证组件是有效的 React 组件（函数组件或 React.memo/forwardRef 包装组件） */
function expectReactComponent(comp: unknown, name: string): void {
  expect(comp, `${name} 应已定义`).toBeDefined();
  // React.memo/forwardRef 包装的组件 typeof 返回 'object'，原生函数组件返回 'function'
  const validTypes = ['function', 'object'];
  expect(
    validTypes.includes(typeof comp),
    `${name} 应是函数或对象（React 组件），实际为 ${typeof comp}`
  ).toBe(true);
}

describe('M13 编辑功能集成测试', () => {
  describe('flowchart 编辑面板', () => {
    it('SubgraphEditor 应可导入', () => expectReactComponent(SubgraphEditor, 'SubgraphEditor'));
    it('ClassDefManager 应可导入', () => expectReactComponent(ClassDefManager, 'ClassDefManager'));
    it('StyleEditor 应可导入', () => expectReactComponent(StyleEditor, 'StyleEditor'));
    it('ClickEditor 应可导入', () => expectReactComponent(ClickEditor, 'ClickEditor'));
    it('AccEditor 应可导入', () => expectReactComponent(AccEditor, 'AccEditor'));
  });

  describe('sequenceDiagram 编辑面板', () => {
    it('ParticipantEditor 应可导入', () => expectReactComponent(ParticipantEditor, 'ParticipantEditor'));
    it('MessageEditor 应可导入', () => expectReactComponent(MessageEditor, 'MessageEditor'));
    it('NoteEditor 应可导入', () => expectReactComponent(SequenceNoteEditor, 'SequenceNoteEditor'));
    it('BlockEditor 应可导入', () => expectReactComponent(BlockEditor, 'BlockEditor'));
    it('BoxEditor 应可导入', () => expectReactComponent(BoxEditor, 'BoxEditor'));
  });

  describe('classDiagram 编辑面板', () => {
    it('ClassEditor 应可导入', () => expectReactComponent(ClassEditor, 'ClassEditor'));
    it('MemberEditor 应可导入', () => expectReactComponent(MemberEditor, 'MemberEditor'));
    it('RelationEditor 应可导入', () => expectReactComponent(RelationEditor, 'RelationEditor'));
    it('NamespaceEditor 应可导入', () => expectReactComponent(NamespaceEditor, 'NamespaceEditor'));
    it('NoteEditor 应可导入', () => expectReactComponent(ClassNoteEditor, 'ClassNoteEditor'));
  });

  describe('erDiagram 编辑面板', () => {
    it('EntityEditor 应可导入', () => expectReactComponent(EntityEditor, 'EntityEditor'));
    it('AttributeEditor 应可导入', () => expectReactComponent(AttributeEditor, 'AttributeEditor'));
    it('RelationshipEditor 应可导入', () => expectReactComponent(RelationshipEditor, 'RelationshipEditor'));
  });

  describe('stateDiagram 编辑面板', () => {
    it('StatePropertyEditor 应可导入', () => expectReactComponent(StatePropertyEditor, 'StatePropertyEditor'));
    it('StateRelationEditor 应可导入', () => expectReactComponent(StateRelationEditor, 'StateRelationEditor'));
  });

  describe('mindmap 编辑面板', () => {
    it('MindmapPropertyEditor 应可导入', () => expectReactComponent(MindmapPropertyEditor, 'MindmapPropertyEditor'));
    it('MindmapTreePanel 应可导入', () => expectReactComponent(MindmapTreePanel, 'MindmapTreePanel'));
  });

  describe('architecture 编辑面板', () => {
    it('ArchitectureServicePanel 应可导入', () => expectReactComponent(ArchitectureServicePanel, 'ArchitectureServicePanel'));
    it('ArchitectureJunctionPanel 应可导入', () => expectReactComponent(ArchitectureJunctionPanel, 'ArchitectureJunctionPanel'));
    it('ArchitectureGroupPanel 应可导入', () => expectReactComponent(ArchitectureGroupPanel, 'ArchitectureGroupPanel'));
    it('ArchitectureEdgePanel 应可导入', () => expectReactComponent(ArchitectureEdgePanel, 'ArchitectureEdgePanel'));
  });

  describe('gantt 编辑面板', () => {
    it('GanttTaskPanel 应可导入', () => expectReactComponent(GanttTaskPanel, 'GanttTaskPanel'));
    it('GanttSectionPanel 应可导入', () => expectReactComponent(GanttSectionPanel, 'GanttSectionPanel'));
    it('GanttConfigPanel 应可导入', () => expectReactComponent(GanttConfigPanel, 'GanttConfigPanel'));
  });

  describe('pie 编辑面板', () => {
    it('PieConfigPanel 应可导入', () => expectReactComponent(PieConfigPanel, 'PieConfigPanel'));
    it('PieSlicePanel 应可导入', () => expectReactComponent(PieSlicePanel, 'PieSlicePanel'));
  });

  describe('timeline 编辑面板', () => {
    it('TimelineEventPanel 应可导入', () => expectReactComponent(TimelineEventPanel, 'TimelineEventPanel'));
    it('TimelinePeriodPanel 应可导入', () => expectReactComponent(TimelinePeriodPanel, 'TimelinePeriodPanel'));
    it('TimelineSectionPanel 应可导入', () => expectReactComponent(TimelineSectionPanel, 'TimelineSectionPanel'));
  });

  describe('quadrantChart 编辑面板', () => {
    it('QuadrantConfigPanel 应可导入', () => expectReactComponent(QuadrantConfigPanel, 'QuadrantConfigPanel'));
    it('QuadrantPointPanel 应可导入', () => expectReactComponent(QuadrantPointPanel, 'QuadrantPointPanel'));
  });

  describe('xychart 编辑面板', () => {
    it('XYChartConfigPanel 应可导入', () => expectReactComponent(XYChartConfigPanel, 'XYChartConfigPanel'));
    it('XYChartSeriesPanel 应可导入', () => expectReactComponent(XYChartSeriesPanel, 'XYChartSeriesPanel'));
  });

  describe('编辑面板文件存在性验证', () => {
    const expectedPanels: Array<{ path: string; name: string }> = [
      // flowchart
      { path: 'components/flowchart/subgraph-editor.tsx', name: 'SubgraphEditor' },
      { path: 'components/flowchart/classdef-manager.tsx', name: 'ClassDefManager' },
      { path: 'components/flowchart/style-editor.tsx', name: 'StyleEditor' },
      { path: 'components/flowchart/click-editor.tsx', name: 'ClickEditor' },
      { path: 'components/flowchart/acc-editor.tsx', name: 'AccEditor' },
      // sequence
      { path: 'components/sequence/participant-editor.tsx', name: 'ParticipantEditor' },
      { path: 'components/sequence/message-editor.tsx', name: 'MessageEditor' },
      { path: 'components/sequence/note-editor.tsx', name: 'SequenceNoteEditor' },
      { path: 'components/sequence/block-editor.tsx', name: 'BlockEditor' },
      { path: 'components/sequence/box-editor.tsx', name: 'BoxEditor' },
      // class
      { path: 'components/class/class-editor.tsx', name: 'ClassEditor' },
      { path: 'components/class/member-editor.tsx', name: 'MemberEditor' },
      { path: 'components/class/relation-editor.tsx', name: 'RelationEditor' },
      { path: 'components/class/namespace-editor.tsx', name: 'NamespaceEditor' },
      { path: 'components/class/note-editor.tsx', name: 'ClassNoteEditor' },
      // er
      { path: 'components/er/entity-editor.tsx', name: 'EntityEditor' },
      { path: 'components/er/attribute-editor.tsx', name: 'AttributeEditor' },
      { path: 'components/er/relationship-editor.tsx', name: 'RelationshipEditor' },
      // state
      { path: 'components/state/state-property-editor.tsx', name: 'StatePropertyEditor' },
      { path: 'components/state/state-relation-editor.tsx', name: 'StateRelationEditor' },
      // mindmap
      { path: 'components/mindmap/mindmap-property-editor.tsx', name: 'MindmapPropertyEditor' },
      { path: 'components/mindmap/mindmap-tree-panel.tsx', name: 'MindmapTreePanel' },
      // architecture
      { path: 'components/architecture/service-panel.tsx', name: 'ArchitectureServicePanel' },
      { path: 'components/architecture/junction-panel.tsx', name: 'ArchitectureJunctionPanel' },
      { path: 'components/architecture/group-panel.tsx', name: 'ArchitectureGroupPanel' },
      { path: 'components/architecture/edge-panel.tsx', name: 'ArchitectureEdgePanel' },
      // gantt
      { path: 'components/gantt/gantt-task-panel.tsx', name: 'GanttTaskPanel' },
      { path: 'components/gantt/gantt-section-panel.tsx', name: 'GanttSectionPanel' },
      { path: 'components/gantt/gantt-config-panel.tsx', name: 'GanttConfigPanel' },
      // pie
      { path: 'components/pie/pie-config-panel.tsx', name: 'PieConfigPanel' },
      { path: 'components/pie/pie-slice-panel.tsx', name: 'PieSlicePanel' },
      // timeline
      { path: 'components/timeline/timeline-event-panel.tsx', name: 'TimelineEventPanel' },
      { path: 'components/timeline/timeline-period-panel.tsx', name: 'TimelinePeriodPanel' },
      { path: 'components/timeline/timeline-section-panel.tsx', name: 'TimelineSectionPanel' },
      // quadrant
      { path: 'components/quadrant/quadrant-config-panel.tsx', name: 'QuadrantConfigPanel' },
      { path: 'components/quadrant/quadrant-point-panel.tsx', name: 'QuadrantPointPanel' },
      // xychart
      { path: 'components/xychart/xychart-config-panel.tsx', name: 'XYChartConfigPanel' },
      { path: 'components/xychart/xychart-series-panel.tsx', name: 'XYChartSeriesPanel' },
    ];

    for (const { path, name } of expectedPanels) {
      it(`编辑面板文件 ${path} 应存在`, () => {
        const fullPath = join(EDITOR_SRC, path);
        expect(existsSync(fullPath), `${name} 文件应存在: ${path}`).toBe(true);
      });
    }

    it('应有 38 个编辑面板文件（12 种图表类型全覆盖）', () => {
      expect(expectedPanels.length).toBe(38);
    });
  });

  describe('PropertyPanel 主面板存在性', () => {
    it('PropertyPanel 应可导入', async () => {
      const { PropertyPanel } = await import('@/components/property-panel');
      expectReactComponent(PropertyPanel, 'PropertyPanel');
    });

    it('PropertyPanel 文件应存在', () => {
      const fullPath = join(EDITOR_SRC, 'components/property-panel.tsx');
      expect(existsSync(fullPath)).toBe(true);
    });
  });
});
