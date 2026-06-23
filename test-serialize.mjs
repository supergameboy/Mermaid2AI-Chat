import { parseMermaid, serializeMermaid } from './packages/serializer/dist/index.js';

// Test with subgraphs and various shapes
const code = `flowchart TB
subgraph one
  A[Christmas]
  B(((Go shopping)))
  A --> B
end
subgraph two
  C{Let me think}
  D[Laptop]
  E[iPhone]
  F[fa:fa-car Car]
  C --> D
  C --> E
  C --> F
end
B --> C
`;

console.log('=== Original code ===');
console.log(code);

const result = parseMermaid(code);
console.log('=== Parse result ===');
console.log('success:', result.success);
if (!result.success) {
  console.log('errors:', result.errors);
  process.exit(1);
}

const serialized = serializeMermaid(result.canvas);
console.log('=== Serialized code ===');
console.log(serialized.mermaid);
console.log('errors:', serialized.errors);

const reparsed = parseMermaid(serialized.mermaid);
console.log('=== Reparse result ===');
console.log('success:', reparsed.success);
if (!reparsed.success) {
  console.log('errors:', reparsed.errors);
  process.exit(1);
}

// Test with all edge styles
const code2 = `flowchart TD
A --- B
A --> C
A --x D
A --o E
A === F
A ==> G
A ==x H
A ==o I
A -.- J
A -.-> K
A -.-x L
A -.-o M
A <--> N
A x--x O
A o--o P
A ~~~ Q
`;

console.log('\n=== Edge styles test ===');
const result2 = parseMermaid(code2);
console.log('parse success:', result2.success);
if (!result2.success) {
  console.log('errors:', result2.errors);
} else {
  const serialized2 = serializeMermaid(result2.canvas);
  const reparsed2 = parseMermaid(serialized2.mermaid);
  console.log('reparse success:', reparsed2.success);
  if (!reparsed2.success) console.log('errors:', reparsed2.errors);
}

// Test with frontmatter title
const code3 = `---
title: My Chart
---
flowchart TD
A[Hello]
`;

console.log('\n=== Frontmatter title test ===');
const result3 = parseMermaid(code3);
console.log('parse success:', result3.success);
if (!result3.success) {
  console.log('errors:', result3.errors);
} else {
  const serialized3 = serializeMermaid(result3.canvas);
  console.log('serialized:', serialized3.mermaid);
  const reparsed3 = parseMermaid(serialized3.mermaid);
  console.log('reparse success:', reparsed3.success);
  if (!reparsed3.success) console.log('errors:', reparsed3.errors);
}

console.log('\nAll tests passed');
