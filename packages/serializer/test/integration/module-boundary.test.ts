/**
 * 模块边界测试 — M13 集成验证
 *
 * 单一职责：验证各包的模块边界符合 code-standards.md 第7章
 *
 * 检查规则:
 *   - serializer/src 下所有 .ts 不能 import react/react-dom/d3
 *   - editor/src 下所有 .ts/.tsx 不能 import ws/@modelcontextprotocol
 *   - server/src 下所有 .ts 不能 import react/react-dom
 *
 * 实现方式: 使用 Node.js fs 递归扫描源码文件，检查 import 语句
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

// ============================================================
// 工具函数
// ============================================================

/** 递归获取目录下所有 .ts/.tsx 文件 */
function getSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  const result: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      // 跳过 node_modules/dist/test 目录
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'test') continue;
      result.push(...getSourceFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      result.push(fullPath);
    }
  }

  return result;
}

/** 检查文件是否包含禁止的 import/export 语句 */
function checkForbiddenImports(
  filePath: string,
  forbiddenPatterns: RegExp[]
): Array<{ file: string; import: string; line: number }> {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations: Array<{ file: string; import: string; line: number }> = [];

  lines.forEach((line, idx) => {
    // 检查静态 import、dynamic import、export...from re-export
    const isImportLine =
      /^\s*import\s/.test(line) ||
      /^\s*import\s*\(/.test(line) ||
      /^\s*export\s.*\sfrom\s/.test(line);
    if (!isImportLine) return;

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(line)) {
        violations.push({
          file: filePath,
          import: line.trim(),
          line: idx + 1,
        });
      }
    }
  });

  return violations;
}

/** 检查整个包的模块边界 */
function checkPackageBoundary(
  packageSrcDir: string,
  forbiddenPatterns: RegExp[]
): { success: boolean; violations: Array<{ file: string; import: string; line: number }> } {
  const files = getSourceFiles(packageSrcDir);
  const allViolations: Array<{ file: string; import: string; line: number }> = [];

  for (const file of files) {
    const violations = checkForbiddenImports(file, forbiddenPatterns);
    allViolations.push(...violations);
  }

  return {
    success: allViolations.length === 0,
    violations: allViolations,
  };
}

// ============================================================
// 测试
// ============================================================

const PROJECT_ROOT = resolve(__dirname, '../../..');

describe('M13 模块边界测试', () => {
  describe('serializer 包边界', () => {
    it('不应引用 react/react-dom/d3', () => {
      const serializerSrc = join(PROJECT_ROOT, 'packages/serializer/src');
      const forbiddenPatterns = [
        /\bfrom\s+['"]react['"]/,
        /\bfrom\s+['"]react-dom['"]/,
        /\bfrom\s+['"]d3['"]/,
        /\bfrom\s+['"]react\/jsx-runtime['"]/,
      ];

      const result = checkPackageBoundary(serializerSrc, forbiddenPatterns);

      if (!result.success) {
        const details = result.violations
          .map((v) => `${relative(PROJECT_ROOT, v.file)}:${v.line} ${v.import}`)
          .join('\n');
        console.error('serializer 包模块边界违规:\n', details);
      }

      expect(result.success).toBe(true);
    });
  });

  describe('editor 包边界', () => {
    it('不应引用 ws/@modelcontextprotocol', () => {
      const editorSrc = join(PROJECT_ROOT, 'packages/editor/src');
      const forbiddenPatterns = [
        /\bfrom\s+['"]ws['"]/,
        /\bfrom\s+['"]@modelcontextprotocol/,
      ];

      const result = checkPackageBoundary(editorSrc, forbiddenPatterns);

      if (!result.success) {
        const details = result.violations
          .map((v) => `${relative(PROJECT_ROOT, v.file)}:${v.line} ${v.import}`)
          .join('\n');
        console.error('editor 包模块边界违规:\n', details);
      }

      expect(result.success).toBe(true);
    });
  });

  describe('server 包边界', () => {
    it('不应引用 react/react-dom', () => {
      const serverSrc = join(PROJECT_ROOT, 'packages/server/src');
      const forbiddenPatterns = [
        /\bfrom\s+['"]react['"]/,
        /\bfrom\s+['"]react-dom['"]/,
        /\bfrom\s+['"]react\/jsx-runtime['"]/,
      ];

      const result = checkPackageBoundary(serverSrc, forbiddenPatterns);

      if (!result.success) {
        const details = result.violations
          .map((v) => `${relative(PROJECT_ROOT, v.file)}:${v.line} ${v.import}`)
          .join('\n');
        console.error('server 包模块边界违规:\n', details);
      }

      expect(result.success).toBe(true);
    });
  });
});
