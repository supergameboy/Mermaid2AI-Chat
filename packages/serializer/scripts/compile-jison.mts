/**
 * jison 编译脚本
 * 单一职责：将 packages/serializer/jison/*.jison 编译为 ESM 解析器
 *
 * 用法：pnpm compile:jison
 *
 * jison 模块导出 `Parser` 类（不是 `JisonParser`），实测：
 *   { Jison, version, print, LR0Generator, LALRGenerator, SLRGenerator,
 *     LR1Generator, LLGenerator, Generator, Parser }
 *
 * 使用 createRequire 加载 CommonJS jison 模块（jison ^0.4.18 无 ESM 导出）
 *
 * 输出文件为 `.js` 扩展名（ESM）：
 *   - jison 0.4.18 的 `moduleType: 'es'` 选项无效，仍生成 CommonJS 代码
 *   - 本脚本对生成的 CJS 代码做后处理，转换为 ESM：
 *     1. 将 `exports.X = Y` 转换为 `export const X = Y`
 *     2. 移除 `if (typeof require ...)` 包装块和 `exports.main`/`require.main` 逻辑
 *   - 生成 ESM 后，解析器可通过静态 `import` 加载，浏览器兼容
 *
 * 已知 bug 修复:
 *   jison 0.4.18 根据 moduleName 生成顶层变量名（如 `var class = (function(){...})()`），
 *   当 moduleName 是 JavaScript 保留字（如 `class`）时，生成的代码无法解析。
 *   修复策略：编译后对源代码做后处理，将保留字变量名替换为 `${moduleName}Parser`。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Parser: JisonParser } = require('jison') as {
  Parser: new (grammar: string | object) => {
    generate(options?: {
      moduleType?: 'es' | 'cjs' | 'amd' | 'umd';
      moduleName?: string;
      parserType?: string;
    }): string;
  };
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const JISON_DIR = join(__dirname, '../jison');
const OUTPUT_DIR = join(__dirname, '../src/parser/jison');

/** JavaScript 保留字集合（用于检测 jison 生成的变量名是否冲突） */
const JS_RESERVED_WORDS = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function',
  'if', 'import', 'in', 'instanceof', 'new', 'return', 'super', 'switch',
  'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
  'enum', 'implements', 'interface', 'let', 'package', 'private', 'protected',
  'public', 'static', 'await', 'abstract', 'boolean', 'byte', 'char', 'double',
  'final', 'float', 'goto', 'int', 'long', 'native', 'short', 'synchronized',
  'throws', 'transient', 'volatile',
]);

const JISON_FILES = [
  'flow.jison',
  'sequence.jison',
  'class.jison',
  'er.jison',
  'state.jison',
  'mindmap.jison',
  'gantt.jison',
  'timeline.jison',
  'quadrant.jison',
  'xychart.jison',
];

/**
 * 修复 jison 0.4.18 生成的代码中保留字变量名冲突
 *
 * jison 根据 moduleName 生成顶层变量名（如 `var class = (function(){...})()`），
 * 当 moduleName 是 JavaScript 保留字时，生成的代码无法解析。
 *
 * 修复策略：将 `var ${moduleName} = ` 替换为 `var ${moduleName}Parser = `，
 * 并将所有 `${moduleName}.` 引用替换为 `${moduleName}Parser.`
 */
function fixReservedWordVarName(source: string, moduleName: string): string {
  if (!JS_RESERVED_WORDS.has(moduleName)) {
    return source;
  }

  const safeName = `${moduleName}Parser`;
  // 替换变量声明: `var class = ` → `var classParser = `
  const varDeclRegex = new RegExp(`\\bvar\\s+${moduleName}\\s*=`, 'g');
  // 替换变量引用: `class.X` → `classParser.X`
  const refRegex = new RegExp(`\\b${moduleName}\\b\\.`, 'g');
  // 替换裸露变量引用: `= class;` / `(class,` / `(class)` / `, class)` 等
  // 仅匹配后面跟 `;`、`,`、`)` 的裸露引用（前面是 `=`、`(`、`,` 等非标识符字符）
  const bareRefRegex = new RegExp(
    `(?<=[=(,])\\s*\\b${moduleName}\\b(?=\\s*[;,)])`,
    'g',
  );
  // 替换 `apply(class, ...)` 中的 class（前面是 `apply(` ）
  const applyRefRegex = new RegExp(
    `\\bapply\\(\\s*\\b${moduleName}\\b\\s*,`,
    'g',
  );

  return source
    .replace(varDeclRegex, `var ${safeName} =`)
    .replace(refRegex, `${safeName}.`)
    .replace(bareRefRegex, safeName)
    .replace(applyRefRegex, `apply(${safeName},`);
}

/**
 * 将 jison 生成的 CJS 代码转换为 ESM
 *
 * 转换规则:
 *   1. 移除 `if (typeof require !== 'undefined' && typeof exports !== 'undefined') {` 包装块
 *   2. 将 `exports.parser = VARNAME;` → `export const parser = VARNAME;`
 *   3. 将 `exports.Parser = VARNAME.Parser;` → `export const Parser = VARNAME.Parser;`
 *   4. 将 `exports.parse = function () { ... };` → `export const parse = function () { ... };`
 *   5. 移除 `exports.main = ...` 和 `if (typeof module !== 'undefined' && require.main === module) { ... }` 块
 */
function convertCjsToEsm(source: string): string {
  // 匹配整个 CJS 导出块:
  // if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
  //   exports.parser = VARNAME;
  //   exports.Parser = VARNAME.Parser;
  //   exports.parse = function () { return VARNAME.parse.apply(VARNAME, arguments); };
  //   exports.main = function commonjsMain (args) { ... };
  //   if (typeof module !== 'undefined' && require.main === module) { ... }
  // }
  const cjsExportBlockRegex =
    /if\s*\(typeof\s+require\s*!==\s*'undefined'\s*&&\s*typeof\s+exports\s*!==\s*'undefined'\s*\)\s*\{[\s\S]*?\n\}\s*$/;
  const match = source.match(cjsExportBlockRegex);
  if (!match) {
    throw new Error('Failed to find CJS export block in jison-generated code');
  }

  const block = match[0];

  // 提取 exports.parser = VARNAME; 获取变量名
  const parserExportMatch = block.match(/exports\.parser\s*=\s*(\w+)\s*;/);
  if (!parserExportMatch) {
    throw new Error('Failed to find exports.parser in CJS export block');
  }
  const varName = parserExportMatch[1];

  // 提取 exports.parse = function () { return VARNAME.parse.apply(VARNAME, arguments); };
  const parseExportMatch = block.match(
    /exports\.parse\s*=\s*function\s*\(\s*\)\s*\{[^}]*\}\s*;/,
  );

  // 构建 ESM 导出
  const esmExports: string[] = [
    `export const parser = ${varName};`,
    `export const Parser = ${varName}.Parser;`,
  ];
  if (parseExportMatch) {
    const parseBody = parseExportMatch[0].replace('exports.parse', 'const parse');
    esmExports.push(parseBody.replace(/^const\s+parse/, 'export const parse'));
  }

  // 替换整个 CJS 块为 ESM 导出
  return source.replace(cjsExportBlockRegex, esmExports.join('\n') + '\n');
}

function compileJison(filename: string): void {
  const jisonPath = join(JISON_DIR, filename);
  if (!existsSync(jisonPath)) {
    console.warn(`⚠ Jison file not found, skipping: ${filename}`);
    return;
  }
  const grammar = readFileSync(jisonPath, 'utf-8');
  const parser = new JisonParser(grammar);
  const parserName = filename.replace('.jison', '');
  // 输出 .js 文件（ESM，浏览器兼容）
  const outputName = `${parserName}-parser.js`;
  const outputPath = join(OUTPUT_DIR, outputName);

  // 生成解析器源代码（jison 0.4.18 忽略 moduleType，仍生成 CJS）
  const rawSource = parser.generate({ moduleName: parserName });
  // 修复保留字变量名冲突
  const fixedSource = fixReservedWordVarName(rawSource, parserName);
  // 转换 CJS 为 ESM
  const esmSource = convertCjsToEsm(fixedSource);
  writeFileSync(outputPath, esmSource);

  // 生成类型声明
  const dtsPath = join(OUTPUT_DIR, `${parserName}-parser.d.ts`);
  writeFileSync(
    dtsPath,
    `export const parser: { parse(input: string): unknown };\nexport const Parser: { parse(input: string): unknown };\nexport const parse: (input: string) => unknown;\n`,
  );

  console.log(`✓ Compiled ${filename} → ESM`);
}

mkdirSync(OUTPUT_DIR, { recursive: true });

// 清理旧的 .cjs 文件
for (const file of readdirSync(OUTPUT_DIR)) {
  if (file.endsWith('.cjs')) {
    unlinkSync(join(OUTPUT_DIR, file));
    console.log(`✓ Removed old CJS file: ${file}`);
  }
}

let compiledCount = 0;
for (const file of JISON_FILES) {
  compileJison(file);
  compiledCount++;
}

if (compiledCount === 0) {
  console.warn('⚠ No jison files were compiled. Ensure jison/*.jison files exist.');
} else {
  console.log(`✓ Compiled ${compiledCount} jison files.`);
}
