import type { AIModelConfig, ProjectData, WorkflowTemplate } from '../types';
import { v4 as uuidv4 } from 'uuid';

// ===== API Config Storage =====

const API_CONFIGS_KEY = 'api-configs';

export const configStorage = {
  getAll(): AIModelConfig[] {
    const raw = localStorage.getItem(API_CONFIGS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  save(config: Partial<AIModelConfig>): AIModelConfig {
    const configs = configStorage.getAll();
    const full: AIModelConfig = {
      id: config.id || uuidv4(),
      name: config.name || 'Unnamed',
      provider: config.provider || 'openai',
      apiKey: config.apiKey || '',
      baseUrl: config.baseUrl || '',
      model: config.model || '',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 4096,
      stream: config.stream ?? true,
      isDefault: config.isDefault ?? false,
      createdAt: config.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // If setting as default, unset others
    if (full.isDefault) {
      configs.forEach(c => {
        if (c.id !== full.id) c.isDefault = false;
      });
    }

    const idx = configs.findIndex(c => c.id === full.id);
    if (idx >= 0) {
      configs[idx] = full;
    } else {
      configs.push(full);
    }

    localStorage.setItem(API_CONFIGS_KEY, JSON.stringify(configs));
    return full;
  },

  delete(id: string): void {
    const configs = configStorage.getAll().filter(c => c.id !== id);
    localStorage.setItem(API_CONFIGS_KEY, JSON.stringify(configs));
  },

  getDefault(): AIModelConfig | null {
    const configs = configStorage.getAll();
    return configs.find(c => c.isDefault) || configs[0] || null;
  },

  getById(id: string): AIModelConfig | null {
    return configStorage.getAll().find(c => c.id === id) || null;
  },
};

// ===== Project Storage =====

const PROJECT_KEY_PREFIX = 'project-';
const CURRENT_PROJECT_KEY = 'current-project-id';
const PROJECT_LIST_KEY = 'project-list';

export const projectStorage = {
  save(project: ProjectData): void {
    localStorage.setItem(
      `${PROJECT_KEY_PREFIX}${project.info.projectId}`,
      JSON.stringify(project)
    );

    const list = projectStorage.getList();
    const entry = {
      projectId: project.info.projectId,
      projectName: project.info.projectName,
      templateName: project.info.templateName,
      updatedAt: new Date().toISOString(),
    };
    const idx = list.findIndex(p => p.projectId === project.info.projectId);
    if (idx >= 0) {
      list[idx] = entry;
    } else {
      list.push(entry);
    }
    localStorage.setItem(PROJECT_LIST_KEY, JSON.stringify(list));
  },

  load(projectId: string): ProjectData | null {
    const raw = localStorage.getItem(`${PROJECT_KEY_PREFIX}${projectId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  getList(): {
    projectId: string;
    projectName: string;
    templateName: string;
    updatedAt: string;
  }[] {
    const raw = localStorage.getItem(PROJECT_LIST_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  delete(projectId: string): void {
    localStorage.removeItem(`${PROJECT_KEY_PREFIX}${projectId}`);
    const list = projectStorage.getList().filter(p => p.projectId !== projectId);
    localStorage.setItem(PROJECT_LIST_KEY, JSON.stringify(list));
  },

  getCurrentId(): string | null {
    return localStorage.getItem(CURRENT_PROJECT_KEY);
  },

  setCurrentId(projectId: string): void {
    localStorage.setItem(CURRENT_PROJECT_KEY, projectId);
  },
};

// ===== Custom Template Storage =====

const CUSTOM_TEMPLATES_KEY = 'custom-templates';

export const templateStorage = {
  getAll(): WorkflowTemplate[] {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  save(template: WorkflowTemplate): void {
    const templates = templateStorage.getAll();
    const idx = templates.findIndex(t => t.templateId === template.templateId);
    if (idx >= 0) {
      templates[idx] = template;
    } else {
      templates.push(template);
    }
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates));
  },

  delete(templateId: string): void {
    const templates = templateStorage.getAll().filter(t => t.templateId !== templateId);
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates));
  },
};
