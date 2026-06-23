import { parseMermaid, serializeMermaid } from './packages/serializer/dist/index.js';

const cases = [
  // title 后紧跟 flowchart
  { title: 'My Chart', nodes: [{ id: 'A', type: 'rect', position: { x: 0, y: 0 }, data: { label: 'A', shape: 'rect' } }], edges: [], direction: 'TD' },
  // 无 title
  { nodes: [{ id: 'A', type: 'rect', position: { x: 0, y: 0 }, data: { label: 'A', shape: 'rect' } }], edges: [], direction: 'TD' },
  // 多行 label
  { nodes: [{ id: 'A', type: 'rect', position: { x: 0, y: 0 }, data: { label: 'Line1<br>Line2', shape: 'rect' } }], edges: [], direction: 'TD' },
  // 边标签包含特殊字符
  { nodes: [{ id: 'A', type: 'rect', position: { x: 0, y: 0 }, data: { label: 'A', shape: 'rect' } }, { id: 'B', type: 'rect', position: { x: 0, y: 0 }, data: { label: 'B', shape: 'rect' } }], edges: [{ id: 'e1', source: 'A', target: 'B', data: { edgeStyle: 'arrow', label: 'Three' } }], direction: 'TD' },
];

for (const canvas of cases) {
  const fullCanvas = { diagramType: 'flowchart', ...canvas };
  const result = serializeMermaid(fullCanvas);
  console.log('\n=== Serialized ===');
  console.log(result.mermaid);
  const reparsed = parseMermaid(result.mermaid);
  console.log('reparse success:', reparsed.success);
  if (!reparsed.success) console.log('errors:', reparsed.errors);
}
