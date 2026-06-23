/**
 * ClassMember — 官方 mermaid `classTypes.ts` ClassMember 类的纯 TypeScript 移植
 *
 * 单一职责：解析和存储类图成员变量/方法的元数据（visibility/classifier/parameters/returnType）
 *
 * 与官方的差异:
 *   - 移除 getConfig 依赖（使用默认配置，不做 securityLevel 相关处理）
 *   - 移除 sanitizeText 依赖（HTML 转义由渲染层负责，解析层保留原始文本）
 *   - 移除 parseGenericTypes 依赖（在本地实现简化版）
 *   - 适配 TypeScript 严格模式（禁止 any，禁止 ! 非空断言，初始化所有字段）
 *
 * 数据流:
 *   ClassDB.addMember(className, memberString) → new ClassMember(memberString, memberType)
 *   → parseMember() 填充 id/visibility/parameters/returnType/classifier
 *   → getDisplayDetails() 返回 { displayText, cssStyle } 供渲染层使用
 */

import { VISIBILITY_VALUES, type Visibility } from './constants.js';

/** 泛型类型占位符正则（匹配 `~Type~` 形式的泛型声明） */
const GENERIC_TYPE_REGEX = /~([^~]+)~/g;

/**
 * 解析泛型类型占位符（简化版，对齐官方 common.parseGenericTypes）
 *
 * 将 `~Type~` 转换为 `<Type>`，用于显示
 */
function parseGenericTypes(text: string): string {
  return text.replace(GENERIC_TYPE_REGEX, '<$1>');
}

/**
 * ClassMember — 类图成员（属性/方法）解析器
 *
 * 解析成员字符串如：
 *   - `+publicAttr: Type` → visibility='+', id='publicAttr', returnType='Type'
 *   - `-privateMethod(): ReturnType` → visibility='-', id='privateMethod', parameters='', returnType='ReturnType'
 *   - `#protectedAttr: Type*` → visibility='#', id='protectedAttr', classifier='*'（static）
 *   - `~packageMethod(): ReturnType$` → visibility='~', classifier='$'（abstract）
 */
export class ClassMember {
  /** 成员 ID（名称） */
  id: string;
  /** CSS 样式（由 parseClassifier 生成） */
  cssStyle: string;
  /** 成员类型（method/attribute） */
  memberType: 'method' | 'attribute';
  /** 可见性符号（+/-/#/~/''） */
  visibility: Visibility;
  /** 显示文本（含 HTML 转义） */
  text: string;
  /**
   * 分类符（'*' 表示 static，'$' 表示 abstract）
   * @defaultValue ''
   */
  classifier: string;
  /**
   * 方法参数（仅 method 类型）
   * @defaultValue ''
   */
  parameters: string;
  /**
   * 方法返回类型（仅 method 类型）
   * @defaultValue ''
   */
  returnType: string;

  constructor(input: string, memberType: 'method' | 'attribute') {
    this.memberType = memberType;
    this.visibility = '';
    this.classifier = '';
    this.text = '';
    this.id = '';
    this.cssStyle = '';
    this.parameters = '';
    this.returnType = '';
    // 解析层不做 sanitizeText（移除 getConfig 依赖），直接解析原始输入
    this.parseMember(input);
  }

  /**
   * 获取显示详情（displayText + cssStyle）
   *
   * displayText 格式：
   *   - attribute: `+attrName`
   *   - method: `+methodName(params) : ReturnType`
   */
  getDisplayDetails(): { displayText: string; cssStyle: string } {
    let displayText = this.visibility + parseGenericTypes(this.id);
    if (this.memberType === 'method') {
      displayText += `(${parseGenericTypes(this.parameters.trim())})`;
      if (this.returnType) {
        displayText += ' : ' + parseGenericTypes(this.returnType);
      }
    }

    displayText = displayText.trim();
    const cssStyle = this.parseClassifier();

    return {
      displayText,
      cssStyle,
    };
  }

  /**
   * 解析成员字符串
   *
   * 方法格式：`[visibility]name(parameters)[classifier][returnType][classifier]`
   * 属性格式：`[visibility]name[type][classifier]`
   *
   * classifier 检测：
   *   - `*` 后缀 → static（font-style:italic）
   *   - `$` 后缀 → abstract（text-decoration:underline）
   */
  parseMember(input: string): void {
    let potentialClassifier = '';

    if (this.memberType === 'method') {
      const methodRegEx = /([#+~-])?(.+)\((.*)\)([\s$*])?(.*)([$*])?/;
      const match = methodRegEx.exec(input);
      if (match) {
        const detectedVisibility = match[1] ? match[1].trim() : '';

        if (isVisibility(detectedVisibility)) {
          this.visibility = detectedVisibility;
        }

        this.id = match[2];
        this.parameters = match[3] ? match[3].trim() : '';
        potentialClassifier = match[4] ? match[4].trim() : '';
        // returnType 可能包含前导冒号和空格（如 `: void`），需要去除
        this.returnType = match[5] ? match[5].trim().replace(/^:\s*/, '') : '';

        if (potentialClassifier === '') {
          const lastChar = this.returnType.substring(this.returnType.length - 1);
          if (/[$*]/.exec(lastChar)) {
            potentialClassifier = lastChar;
            this.returnType = this.returnType.substring(0, this.returnType.length - 1);
          }
        }
      }
    } else {
      const length = input.length;
      const firstChar = input.substring(0, 1);
      const lastChar = input.substring(length - 1);

      if (isVisibility(firstChar)) {
        this.visibility = firstChar;
      }

      if (/[$*]/.exec(lastChar)) {
        potentialClassifier = lastChar;
      }

      this.id = input.substring(
        this.visibility === '' ? 0 : 1,
        potentialClassifier === '' ? length : length - 1,
      );
    }

    this.classifier = potentialClassifier;
    // Preserve one space only
    this.id = this.id.startsWith(' ') ? ' ' + this.id.trim() : this.id.trim();

    const combinedText = `${this.visibility ? '\\' + this.visibility : ''}${parseGenericTypes(this.id)}${this.memberType === 'method' ? `(${parseGenericTypes(this.parameters)})${this.returnType ? ' : ' + parseGenericTypes(this.returnType) : ''}` : ''}`;
    this.text = combinedText.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    if (this.text.startsWith('\\&lt;')) {
      this.text = this.text.replace('\\&lt;', '~');
    }
  }

  /**
   * 解析分类符为 CSS 样式
   *
   * @returns CSS 样式字符串
   *   - `*` → `font-style:italic;`（static）
   *   - `$` → `text-decoration:underline;`（abstract）
   *   - 其他 → `''`
   */
  parseClassifier(): string {
    switch (this.classifier) {
      case '*':
        return 'font-style:italic;';
      case '$':
        return 'text-decoration:underline;';
      default:
        return '';
    }
  }
}

/**
 * 类型守卫：判断字符串是否为合法的可见性符号
 */
function isVisibility(value: string): value is Visibility {
  return (VISIBILITY_VALUES as readonly string[]).includes(value);
}
