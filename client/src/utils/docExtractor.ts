import type { StateItem, TableItem, TableField } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Extract state definitions from markdown document content.
 *
 * Looks for patterns:
 * - Headings or bold text containing "状态", followed by list items or comma-separated values
 * - Markdown tables describing states/enums
 * - Inline patterns like "XXX状态：值1、值2、值3"
 */
export function extractStates(content: string): StateItem[] {
  const states: StateItem[] = [];
  const seen = new Set<string>();

  // Pattern 1: "XXX状态" followed by values in a list or inline
  // Match heading or bold text containing "状态", then capture subsequent content
  const sectionRegex = /(?:^#{1,4}\s+.*?状态.*|[\*]{2}.*?状态.*?[\*]{2})[：:\s]*\n?([\s\S]*?)(?=\n#{1,4}\s|\n\*{2}[^*]|\n---|\n\n\n|$)/gim;
  let match: RegExpExecArray | null;

  while ((match = sectionRegex.exec(content)) !== null) {
    const heading = match[0].split('\n')[0].replace(/^#+\s*/, '').replace(/\*+/g, '').trim();
    const body = match[1] || '';

    // Extract state name from heading
    const nameMatch = heading.match(/([\u4e00-\u9fff\w]+状态)/);
    const stateName = nameMatch ? nameMatch[1] : heading.replace(/[：:]/g, '').trim();
    if (!stateName || seen.has(stateName)) continue;

    // Extract values from list items or inline
    const values: string[] = [];

    // List items: - 值1 / * 值1
    const listItems = body.match(/^[\s]*[-*]\s+(.+)$/gm);
    if (listItems) {
      for (const item of listItems) {
        const val = item.replace(/^[\s]*[-*]\s+/, '').trim();
        if (val && val.length < 30) {
          values.push(val);
        }
      }
    }

    // Inline comma/chinese-comma separated: 值1、值2、值3 or 值1，值2，值3 or 值1, 值2
    if (values.length === 0) {
      const inlineMatch = body.match(/[：:]\s*(.+)/);
      const valStr = inlineMatch ? inlineMatch[1] : body.trim().split('\n')[0];
      if (valStr) {
        const parts = valStr.split(/[、，,；;|／/]\s*/).map(v => v.trim()).filter(v => v && v.length < 30);
        values.push(...parts);
      }
    }

    if (stateName) {
      seen.add(stateName);
      states.push({
        id: uuidv4(),
        stateName,
        stateValues: values.slice(0, 20),
        description: '',
        relatedDocs: [],
        relatedTables: [],
      });
    }
  }

  // Pattern 2: Inline state definitions "XX状态：A、B、C"
  const inlineRegex = /([\u4e00-\u9fff\w]{2,10}状态)[：:]\s*([^\n]+)/g;
  while ((match = inlineRegex.exec(content)) !== null) {
    const stateName = match[1].trim();
    if (seen.has(stateName)) continue;
    seen.add(stateName);

    const valStr = match[2].trim();
    const values = valStr
      .split(/[、，,；;|／/]\s*/)
      .map(v => v.replace(/[。.`*]/g, '').trim())
      .filter(v => v && v.length < 30);

    if (values.length > 0) {
      states.push({
        id: uuidv4(),
        stateName,
        stateValues: values.slice(0, 20),
        description: '',
        relatedDocs: [],
        relatedTables: [],
      });
    }
  }

  // Pattern 3: Look for "状态" column in markdown tables
  const tableBlocks = extractMarkdownTables(content);
  for (const table of tableBlocks) {
    const headers = table.headers.map(h => h.toLowerCase());
    const stateColIdx = headers.findIndex(h => h.includes('状态') && (h.includes('名') || h.includes('类型') || h.includes('name')));
    const valueColIdx = headers.findIndex(h => h.includes('值') || h.includes('value') || h.includes('枚举'));

    if (stateColIdx >= 0 && valueColIdx >= 0) {
      for (const row of table.rows) {
        const name = row[stateColIdx]?.trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);

        const vals = (row[valueColIdx] || '')
          .split(/[、，,；;|／/]\s*/)
          .map(v => v.trim())
          .filter(v => v && v.length < 30);

        states.push({
          id: uuidv4(),
          stateName: name,
          stateValues: vals,
          description: '',
          relatedDocs: [],
          relatedTables: [],
        });
      }
    }
  }

  return states;
}

/**
 * Extract table/database definitions from markdown document content.
 *
 * Looks for markdown tables describing database schemas, with headers
 * containing keywords like "字段名", "类型", "描述" etc.
 */
export function extractTables(content: string): TableItem[] {
  const tables: TableItem[] = [];
  const seen = new Set<string>();

  const tableBlocks = extractMarkdownTables(content);

  for (const table of tableBlocks) {
    const headers = table.headers.map(h => h.toLowerCase());

    // Check if this looks like a database table definition
    const hasFieldCol = headers.some(h =>
      h.includes('字段') || h.includes('field') || h.includes('列名') || h.includes('column')
    );
    const hasTypeCol = headers.some(h =>
      h.includes('类型') || h.includes('type') || h.includes('数据类型')
    );

    if (!hasFieldCol || !hasTypeCol) continue;

    const fieldColIdx = headers.findIndex(h =>
      h.includes('字段') || h.includes('field') || h.includes('列名') || h.includes('column')
    );
    const typeColIdx = headers.findIndex(h =>
      h.includes('类型') || h.includes('type') || h.includes('数据类型')
    );
    const descColIdx = headers.findIndex(h =>
      h.includes('描述') || h.includes('说明') || h.includes('备注') || h.includes('description') || h.includes('comment')
    );
    const requiredColIdx = headers.findIndex(h =>
      h.includes('必填') || h.includes('required') || h.includes('是否为空') || h.includes('nullable') || h.includes('约束')
    );

    // Try to get table name from the heading above
    const tableName = table.contextHeading || `表${tables.length + 1}`;
    if (seen.has(tableName)) continue;
    seen.add(tableName);

    const fields: TableField[] = [];
    for (const row of table.rows) {
      const fieldName = row[fieldColIdx]?.replace(/`/g, '').trim();
      if (!fieldName) continue;

      const fieldType = row[typeColIdx]?.replace(/`/g, '').trim() || 'VARCHAR';
      const description = descColIdx >= 0 ? (row[descColIdx]?.trim() || '') : '';
      const requiredStr = requiredColIdx >= 0 ? (row[requiredColIdx]?.trim() || '') : '';
      const isRequired = /是|yes|true|必填|not null/i.test(requiredStr);

      fields.push({
        id: uuidv4(),
        fieldName,
        fieldType: normalizeFieldType(fieldType),
        description,
        isRequired,
        relatedState: '',
      });
    }

    if (fields.length > 0) {
      tables.push({
        id: uuidv4(),
        tableName: cleanTableName(tableName),
        description: '',
        fields,
        relatedDocs: [],
      });
    }
  }

  return tables;
}

// ===== Internal helpers =====

interface MarkdownTable {
  headers: string[];
  rows: string[][];
  contextHeading: string;
}

function extractMarkdownTables(content: string): MarkdownTable[] {
  const tables: MarkdownTable[] = [];
  const lines = content.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Detect table start: a line with |...|...|
    if (line.startsWith('|') && line.includes('|', 1)) {
      // Check next line is separator: |---|---|
      const nextLine = (lines[i + 1] || '').trim();
      if (nextLine.startsWith('|') && /[-:]+/.test(nextLine)) {
        // Parse headers
        const headers = line.split('|').map(c => c.trim()).filter(Boolean);

        // Find context heading (nearest heading above)
        let contextHeading = '';
        for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
          const prev = lines[j].trim();
          if (prev.startsWith('#')) {
            contextHeading = prev.replace(/^#+\s*/, '').trim();
            break;
          }
          if (prev && !prev.startsWith('|') && prev.length > 2) {
            contextHeading = prev.replace(/\*+/g, '').replace(/`+/g, '').trim();
            break;
          }
        }

        // Parse rows
        const rows: string[][] = [];
        let k = i + 2;
        while (k < lines.length) {
          const rowLine = lines[k].trim();
          if (!rowLine.startsWith('|')) break;
          const cells = rowLine.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length);
          if (cells.length > 0 && !cells.every(c => /^[-:]+$/.test(c))) {
            rows.push(cells);
          }
          k++;
        }

        if (rows.length > 0) {
          tables.push({ headers, rows, contextHeading });
        }
        i = k;
        continue;
      }
    }
    i++;
  }

  return tables;
}

function normalizeFieldType(raw: string): string {
  const upper = raw.toUpperCase().replace(/[()（）\d,\s]/g, '');
  const typeMap: Record<string, string> = {
    VARCHAR: 'VARCHAR', STRING: 'VARCHAR', STR: 'VARCHAR', CHAR: 'VARCHAR',
    INT: 'INT', INTEGER: 'INT', SMALLINT: 'INT', TINYINT: 'INT',
    BIGINT: 'BIGINT', LONG: 'BIGINT',
    TEXT: 'TEXT', LONGTEXT: 'TEXT', MEDIUMTEXT: 'TEXT',
    BOOLEAN: 'BOOLEAN', BOOL: 'BOOLEAN', BIT: 'BOOLEAN',
    DATETIME: 'DATETIME', TIMESTAMP: 'DATETIME', DATE: 'DATETIME', TIME: 'DATETIME',
    JSON: 'JSON', JSONB: 'JSON', OBJECT: 'JSON',
    DECIMAL: 'DECIMAL', FLOAT: 'DECIMAL', DOUBLE: 'DECIMAL', NUMERIC: 'DECIMAL', NUMBER: 'DECIMAL',
    ENUM: 'VARCHAR',
  };
  return typeMap[upper] || 'VARCHAR';
}

function cleanTableName(raw: string): string {
  // Remove markdown formatting and common prefixes
  let name = raw
    .replace(/^#+\s*/, '')
    .replace(/\*+/g, '')
    .replace(/`+/g, '')
    .replace(/^[\d.]+\s*/, '')
    .replace(/表[结構构]?[：:]\s*/, '')
    .trim();

  // Try to extract the actual table name (often in backticks or parentheses)
  const backtickMatch = raw.match(/`([^`]+)`/);
  if (backtickMatch) return backtickMatch[1];

  const parenMatch = raw.match(/[（(]([^)）]+)[)）]/);
  if (parenMatch && parenMatch[1].length < 30) {
    name = `${name.replace(/[（(][^)）]+[)）]/, '').trim()} (${parenMatch[1]})`;
  }

  return name || raw;
}
