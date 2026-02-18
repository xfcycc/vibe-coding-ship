import type { TableItem, TableField } from '../types';

type Dialect = 'postgresql' | 'mysql' | 'oracle';

const TYPE_MAP: Record<string, Record<Dialect, string>> = {
  VARCHAR:  { postgresql: 'VARCHAR(255)', mysql: 'VARCHAR(255)', oracle: 'VARCHAR2(255)' },
  INT:      { postgresql: 'INTEGER', mysql: 'INT', oracle: 'NUMBER(10)' },
  BIGINT:   { postgresql: 'BIGINT', mysql: 'BIGINT', oracle: 'NUMBER(19)' },
  TEXT:     { postgresql: 'TEXT', mysql: 'TEXT', oracle: 'CLOB' },
  BOOLEAN:  { postgresql: 'BOOLEAN', mysql: 'TINYINT(1)', oracle: 'NUMBER(1)' },
  DATETIME: { postgresql: 'TIMESTAMP', mysql: 'DATETIME', oracle: 'TIMESTAMP' },
  JSON:     { postgresql: 'JSONB', mysql: 'JSON', oracle: 'CLOB' },
  DECIMAL:  { postgresql: 'NUMERIC(12,2)', mysql: 'DECIMAL(12,2)', oracle: 'NUMBER(12,2)' },
};

function mapType(fieldType: string, dialect: Dialect): string {
  const upper = fieldType.toUpperCase().replace(/[()（）\d,\s]/g, '');
  return TYPE_MAP[upper]?.[dialect] || fieldType;
}

function quoteIdentifier(name: string, dialect: Dialect): string {
  const cleaned = name.replace(/[^a-zA-Z0-9_\u4e00-\u9fff]/g, '_');
  if (dialect === 'mysql') return `\`${cleaned}\``;
  return `"${cleaned}"`;
}

function buildColumnDef(field: TableField, dialect: Dialect): string {
  const name = quoteIdentifier(field.fieldName, dialect);
  const type = mapType(field.fieldType, dialect);
  const nullable = field.isRequired ? 'NOT NULL' : '';
  const pk = field.isPrimaryKey ? 'PRIMARY KEY' : '';
  const comment = field.description ? `-- ${field.description}` : '';
  return `  ${name} ${type}${nullable ? ' ' + nullable : ''}${pk ? ' ' + pk : ''}${comment ? '  ' + comment : ''}`;
}

export function generateDDL(table: TableItem, dialect: Dialect): string {
  const tableName = quoteIdentifier(table.tableName, dialect);
  const lines: string[] = [];

  if (table.description) {
    lines.push(`-- ${table.description}`);
  }

  if (dialect === 'oracle') {
    lines.push(`CREATE TABLE ${tableName} (`);
  } else {
    lines.push(`CREATE TABLE ${tableName} (`);
  }

  const fieldDefs = table.fields.map(f => buildColumnDef(f, dialect));
  lines.push(fieldDefs.join(',\n'));
  lines.push(');');

  if (dialect === 'mysql') {
    const engine = `ALTER TABLE ${tableName} ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
    lines.push(engine);
  }

  if (dialect === 'postgresql' || dialect === 'oracle') {
    for (const f of table.fields) {
      if (f.description) {
        const colName = quoteIdentifier(f.fieldName, dialect);
        lines.push(`COMMENT ON COLUMN ${tableName}.${colName} IS '${f.description.replace(/'/g, "''")}';`);
      }
    }
    if (table.description) {
      lines.push(`COMMENT ON TABLE ${tableName} IS '${table.description.replace(/'/g, "''")}';`);
    }
  }

  return lines.join('\n');
}
