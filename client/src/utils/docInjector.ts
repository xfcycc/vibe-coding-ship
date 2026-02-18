import type { StateItem, TableItem } from '../types';

export interface InjectResult {
  newContent: string;
  success: boolean;
  modifiedSections: string[];
}

/**
 * Try to find and replace state definitions in a markdown document.
 * Returns updated content and whether any replacements were made.
 */
export function injectStatesIntoDoc(content: string, states: StateItem[]): InjectResult {
  let result = content;
  const modified: string[] = [];

  for (const state of states) {
    const escapedName = state.stateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Pattern 1: "XXX状态：值1、值2、值3" inline
    const inlineRegex = new RegExp(
      `(${escapedName})[：:\\s]*([^\\n]+)`,
      'g'
    );

    const enumVals = state.enumValues?.length
      ? state.enumValues.map(e => e.value ? `${e.key}(${e.value})` : e.key)
      : state.stateValues;

    const newValStr = enumVals.join('、');
    let found = false;

    result = result.replace(inlineRegex, (match, name) => {
      found = true;
      return `${name}：${newValStr}`;
    });

    // Pattern 2: heading containing state name, followed by list items
    const sectionRegex = new RegExp(
      `((?:^#{1,4}\\s+[^\\n]*${escapedName}[^\\n]*|\\*{2}[^\\n]*${escapedName}[^\\n]*\\*{2})[：:\\s]*\\n)((?:\\s*[-*]\\s+.+\\n?)*)`,
      'gm'
    );

    result = result.replace(sectionRegex, (match, heading, _body) => {
      found = true;
      const listItems = enumVals
        .map(v => `- ${v}`)
        .join('\n');
      return `${heading}${listItems}\n`;
    });

    if (found) {
      modified.push(state.stateName);
    }
  }

  return {
    newContent: result,
    success: modified.length > 0,
    modifiedSections: modified,
  };
}

/**
 * Try to find and replace table definitions in a markdown document.
 * Locates markdown tables by matching table name in nearby headings.
 */
export function injectTablesIntoDoc(content: string, tables: TableItem[]): InjectResult {
  const lines = content.split('\n');
  const modified: string[] = [];

  for (const table of tables) {
    if (table.fields.length === 0) continue;

    const tableNameVariants = buildTableNameVariants(table.tableName);
    let replaced = false;

    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();

      if (line.startsWith('|') && line.includes('|', 1)) {
        const nextLine = (lines[i + 1] || '').trim();
        if (nextLine.startsWith('|') && /[-:]+/.test(nextLine)) {
          // Found a markdown table, check if nearby heading matches
          let contextHeading = '';
          for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
            const prev = lines[j].trim();
            if (prev.startsWith('#') || (prev && !prev.startsWith('|') && prev.length > 2)) {
              contextHeading = prev.replace(/^#+\s*/, '').replace(/\*+/g, '').replace(/`+/g, '').trim();
              break;
            }
          }

          const isMatch = tableNameVariants.some(variant =>
            contextHeading.toLowerCase().includes(variant.toLowerCase())
          );

          if (isMatch) {
            // Find end of table
            let tableEnd = i + 2;
            while (tableEnd < lines.length && lines[tableEnd].trim().startsWith('|')) {
              tableEnd++;
            }

            const newTableLines = generateMarkdownTable(table);
            lines.splice(i, tableEnd - i, ...newTableLines);
            replaced = true;
            modified.push(table.tableName);
            i += newTableLines.length;
            continue;
          }
        }
      }
      i++;
    }

    if (!replaced) {
      // table not found in doc - not an error, just skip
    }
  }

  return {
    newContent: lines.join('\n'),
    success: modified.length > 0,
    modifiedSections: modified,
  };
}

function buildTableNameVariants(tableName: string): string[] {
  const variants = [tableName];
  // "用户表 (users)" -> also match "users" and "用户表"
  const parenMatch = tableName.match(/(.+?)\s*[（(](.+?)[)）]/);
  if (parenMatch) {
    variants.push(parenMatch[1].trim(), parenMatch[2].trim());
  }
  // "users" -> also match "users表"
  variants.push(`${tableName}表`);
  return variants;
}

function generateMarkdownTable(table: TableItem): string[] {
  const lines: string[] = [];
  lines.push('| 字段名 | 类型 | 必填 | 描述 |');
  lines.push('|--------|------|------|------|');
  for (const f of table.fields) {
    const req = f.isRequired ? '是' : '否';
    lines.push(`| ${f.fieldName} | ${f.fieldType} | ${req} | ${f.description || '-'} |`);
  }
  return lines;
}

/**
 * Build an AI prompt to merge waiting area changes into a document.
 * Used as a fallback when regex-based injection fails.
 */
export function buildDocMergePrompt(
  docContent: string,
  states: StateItem[],
  tables: TableItem[]
): string {
  let stateSection = '';
  if (states.length > 0) {
    stateSection = states.map(s => {
      const vals = s.enumValues?.length
        ? s.enumValues.map(e => `${e.key}${e.value ? `(${e.value})` : ''}`).join('、')
        : s.stateValues.join('、');
      return `- ${s.stateName}：${vals}${s.description ? ` — ${s.description}` : ''}`;
    }).join('\n');
  }

  let tableSection = '';
  if (tables.length > 0) {
    tableSection = tables.map(t => {
      const header = `### ${t.tableName}${t.description ? ` (${t.description})` : ''}`;
      const rows = t.fields.map(f =>
        `| ${f.fieldName} | ${f.fieldType} | ${f.isRequired ? '是' : '否'} | ${f.description || '-'} |`
      ).join('\n');
      return `${header}\n| 字段名 | 类型 | 必填 | 描述 |\n|--------|------|------|------|\n${rows}`;
    }).join('\n\n');
  }

  return `# 任务
请将等待区中的状态和表结构信息更新到以下文档中。仅修改文档中对应的状态描述和表结构定义段落，其他内容保持不变。

# 当前文档内容
---
${docContent}
---

${stateSection ? `# 最新状态数据\n${stateSection}\n` : ''}
${tableSection ? `# 最新表结构数据\n${tableSection}\n` : ''}

# 输出要求
- 找到文档中对应的状态和表结构段落，用上面的最新数据替换
- 如果文档中没有对应段落，在合适位置插入
- 其余内容保持不变
- 输出完整的修改后文档（不要只输出修改片段）
- 不要添加多余的解释`;
}
