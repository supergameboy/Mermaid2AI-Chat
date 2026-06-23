import { parseMermaid, serializeMermaid } from './packages/serializer/dist/index.js';

const cases = [
  `flowchart TB\nF[flowchart TBA[Chris]]`,
  `flowchart TB\nF[flowchart TB\nA[Chris]]`,
  `flowchart TB\nA --> Bflowchart TB\nC[Chris]`,
  `flowchart TB\nA -->|Three| F\nflowchart TB\nA[Chris]`,
  `flowchart TB\nA -->|Three| Fflowchart TB\nA[Chris]`,
];

for (const code of cases) {
  console.log('\n=== Code ===');
  console.log(code);
  const result = parseMermaid(code);
  console.log('success:', result.success);
  if (!result.success) {
    console.log('errors:', result.errors);
  }
}
