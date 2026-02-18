import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { ProjectData, WorkflowTemplate } from '../types';

/**
 * Export all project documents as a Markdown ZIP file.
 */
export async function exportProjectAsZip(project: ProjectData, template?: WorkflowTemplate): Promise<void> {
  const zip = new JSZip();
  const folderName = project.info.projectName || 'project-docs';
  const folder = zip.folder(folderName)!;

  // Add each document
  project.documents
    .filter(doc => doc.content)
    .forEach(doc => {
      folder.file(doc.docName, doc.content);
    });

  // Add project info as README
  const readme = `# ${project.info.projectName}

## 项目信息
- **项目名称**: ${project.info.projectName}
- **项目愿景**: ${project.info.projectVision || '未填写'}
- **使用模板**: ${project.info.templateName}
- **创建时间**: ${new Date(project.info.createdAt).toLocaleString('zh-CN')}
- **最后更新**: ${new Date(project.info.updatedAt || project.info.createdAt).toLocaleString('zh-CN')}

## 文档列表
${project.documents
  .filter(doc => doc.content)
  .map((doc, i) => `${i + 1}. ${doc.docName}`)
  .join('\n')}

## 状态管理
${project.states.length > 0
  ? project.states.map(s => `- **${s.stateName}**: ${s.stateValues.join(', ')} - ${s.description}`).join('\n')
  : '暂无状态数据'}

## 核心表结构
${project.tables.length > 0
  ? project.tables.map(t => {
      const fields = t.fields.map(f => `  - ${f.fieldName} (${f.fieldType}${f.isRequired ? ', 必填' : ''}) - ${f.description}`).join('\n');
      return `- **${t.tableName}**: ${t.description}\n${fields}`;
    }).join('\n')
  : '暂无表结构数据'}

---
*由 VIBE-CODING-SHIP 生成*
`;
  folder.file('README.md', readme);

  // Add states and tables as JSON for backup
  if (project.states.length > 0) {
    folder.file('_meta/states.json', JSON.stringify(project.states, null, 2));
  }
  if (project.tables.length > 0) {
    folder.file('_meta/tables.json', JSON.stringify(project.tables, null, 2));
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${folderName}-docs.zip`);
}

/**
 * Export a single document as Markdown file.
 */
export function exportSingleDoc(docName: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  saveAs(blob, docName);
}
