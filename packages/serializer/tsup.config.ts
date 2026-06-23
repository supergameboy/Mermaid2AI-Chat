import { defineConfig } from 'tsup';

/**
 * tsup 多入口构建配置
 *
 * 两个入口:
 *   - browser: 浏览器安全入口（无 Node.js 内置模块依赖）
 *   - index: 全量入口（browser + Node.js 专属 jison 解析器）
 *
 * Node.js 内置模块（node:module, node:url, node:path）保持 external，
 * 由运行时（Node.js）提供。browser 入口不引用这些模块，故无需 external。
 */
export default defineConfig({
  entry: {
    browser: 'src/browser.ts',
    index: 'src/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // Node.js 内置模块不打包，保持 external
  // browser 入口不引用这些模块，index 入口引用但由 Node.js 运行时提供
  // dayjs 及其插件保持 external（M8 决策 8：保留 dayjs 日期计算，不打包进产物）
  external: ['node:module', 'node:url', 'node:path', 'dayjs', 'dayjs/plugin/isoWeek.js', 'dayjs/plugin/customParseFormat.js', 'dayjs/plugin/advancedFormat.js'],
});
