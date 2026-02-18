import { openDB, type IDBPDatabase } from 'idb';
import type { AIModelConfig, ProjectData, WorkflowTemplate } from '../types';

const DB_NAME = 'vibe-coding-ship';
const DB_VERSION = 1;

interface VibeDB {
  apiConfigs: { key: string; value: AIModelConfig };
  projects: { key: string; value: ProjectData };
  projectList: { key: string; value: { projectId: string; projectName: string; templateName: string; updatedAt: string } };
  customTemplates: { key: string; value: WorkflowTemplate };
  meta: { key: string; value: string };
}

let dbPromise: Promise<IDBPDatabase<VibeDB>> | null = null;

function getDB(): Promise<IDBPDatabase<VibeDB>> {
  if (!dbPromise) {
    dbPromise = openDB<VibeDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('apiConfigs')) {
          db.createObjectStore('apiConfigs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects');
        }
        if (!db.objectStoreNames.contains('projectList')) {
          db.createObjectStore('projectList', { keyPath: 'projectId' });
        }
        if (!db.objectStoreNames.contains('customTemplates')) {
          db.createObjectStore('customTemplates', { keyPath: 'templateId' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta');
        }
      },
    });
  }
  return dbPromise;
}

// === Migration: Copy localStorage data to IndexedDB on first run ===

export async function migrateFromLocalStorage(): Promise<void> {
  const db = await getDB();
  const migrated = await db.get('meta', 'migrated');
  if (migrated) return;

  try {
    const apiRaw = localStorage.getItem('api-configs');
    if (apiRaw) {
      const configs: AIModelConfig[] = JSON.parse(apiRaw);
      const tx = db.transaction('apiConfigs', 'readwrite');
      for (const c of configs) await tx.store.put(c);
      await tx.done;
    }

    const listRaw = localStorage.getItem('project-list');
    if (listRaw) {
      const list = JSON.parse(listRaw);
      const tx = db.transaction('projectList', 'readwrite');
      for (const entry of list) await tx.store.put(entry);
      await tx.done;

      const ptx = db.transaction('projects', 'readwrite');
      for (const entry of list) {
        const projRaw = localStorage.getItem(`project-${entry.projectId}`);
        if (projRaw) {
          await ptx.store.put(JSON.parse(projRaw), entry.projectId);
        }
      }
      await ptx.done;
    }

    const templatesRaw = localStorage.getItem('custom-templates');
    if (templatesRaw) {
      const templates: WorkflowTemplate[] = JSON.parse(templatesRaw);
      const tx = db.transaction('customTemplates', 'readwrite');
      for (const t of templates) await tx.store.put(t);
      await tx.done;
    }

    const currentId = localStorage.getItem('current-project-id');
    if (currentId) {
      await db.put('meta', currentId, 'current-project-id');
    }

    await db.put('meta', 'true', 'migrated');
  } catch (e) {
    console.warn('Migration from localStorage failed, will retry next time:', e);
  }
}

// === API Config Storage (IndexedDB) ===

export const idbConfigStorage = {
  async getAll(): Promise<AIModelConfig[]> {
    const db = await getDB();
    return db.getAll('apiConfigs');
  },

  async save(config: AIModelConfig): Promise<void> {
    const db = await getDB();
    if (config.isDefault) {
      const all = await db.getAll('apiConfigs');
      const tx = db.transaction('apiConfigs', 'readwrite');
      for (const c of all) {
        if (c.id !== config.id && c.isDefault) {
          await tx.store.put({ ...c, isDefault: false });
        }
      }
      await tx.store.put(config);
      await tx.done;
    } else {
      await db.put('apiConfigs', config);
    }
    syncConfigToLocalStorage(config);
  },

  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('apiConfigs', id);
  },

  async getDefault(): Promise<AIModelConfig | null> {
    const all = await this.getAll();
    return all.find(c => c.isDefault) || all[0] || null;
  },

  async getById(id: string): Promise<AIModelConfig | null> {
    const db = await getDB();
    return (await db.get('apiConfigs', id)) || null;
  },
};

function syncConfigToLocalStorage(config: AIModelConfig) {
  try {
    const raw = localStorage.getItem('api-configs');
    const configs: AIModelConfig[] = raw ? JSON.parse(raw) : [];
    if (config.isDefault) {
      configs.forEach(c => { if (c.id !== config.id) c.isDefault = false; });
    }
    const idx = configs.findIndex(c => c.id === config.id);
    if (idx >= 0) configs[idx] = config;
    else configs.push(config);
    localStorage.setItem('api-configs', JSON.stringify(configs));
  } catch { /* ignore */ }
}

// === Project Storage (IndexedDB) ===

export const idbProjectStorage = {
  async save(project: ProjectData): Promise<void> {
    const db = await getDB();
    await db.put('projects', project, project.info.projectId);

    const entry = {
      projectId: project.info.projectId,
      projectName: project.info.projectName,
      templateName: project.info.templateName,
      updatedAt: new Date().toISOString(),
    };
    await db.put('projectList', entry);

    // Also sync to localStorage as backup
    try {
      localStorage.setItem(`project-${project.info.projectId}`, JSON.stringify(project));
    } catch { /* quota exceeded - that's OK, we have IndexedDB */ }
  },

  async load(projectId: string): Promise<ProjectData | null> {
    const db = await getDB();
    return (await db.get('projects', projectId)) || null;
  },

  async getList(): Promise<{ projectId: string; projectName: string; templateName: string; updatedAt: string }[]> {
    const db = await getDB();
    return db.getAll('projectList');
  },

  async delete(projectId: string): Promise<void> {
    const db = await getDB();
    await db.delete('projects', projectId);
    await db.delete('projectList', projectId);
    try { localStorage.removeItem(`project-${projectId}`); } catch { /* ok */ }
  },

  async getCurrentId(): Promise<string | null> {
    const db = await getDB();
    return (await db.get('meta', 'current-project-id')) || null;
  },

  async setCurrentId(projectId: string): Promise<void> {
    const db = await getDB();
    await db.put('meta', projectId, 'current-project-id');
    try { localStorage.setItem('current-project-id', projectId); } catch { /* ok */ }
  },
};

// === Custom Template Storage (IndexedDB) ===

export const idbTemplateStorage = {
  async getAll(): Promise<WorkflowTemplate[]> {
    const db = await getDB();
    return db.getAll('customTemplates');
  },

  async save(template: WorkflowTemplate): Promise<void> {
    const db = await getDB();
    await db.put('customTemplates', template);
  },

  async delete(templateId: string): Promise<void> {
    const db = await getDB();
    await db.delete('customTemplates', templateId);
  },
};
