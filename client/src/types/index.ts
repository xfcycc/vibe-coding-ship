// ===== AI API Configuration =====
export interface AIModelConfig {
  id: string;
  name: string;
  provider: 'openai' | 'claude' | 'doubao' | 'custom';
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  stream: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AIModelPreset {
  provider: AIModelConfig['provider'];
  label: string;
  baseUrl: string;
  models: string[];
  defaultTemperature: number;
  defaultMaxTokens: number;
}

// ===== Workflow Template =====
export interface WorkflowNode {
  nodeId: string;
  step: number;
  docName: string;
  guideText: string;
  relatedWaitAreas: string[];
  promptId: string;
  isFixed: boolean;
  isRequired: boolean;
  exampleText?: string;
  enableReviewPrevDocs: boolean;
}

export interface PromptItem {
  promptId: string;
  promptContent: string;
  variableList: string[];
  relatedNodeId: string;
  editTime: string;
  creator: string;
}

export interface WorkflowTemplate {
  templateId: string;
  templateName: string;
  description: string;
  targetUser: string;
  isPreset: boolean;
  isFixed: boolean;
  nodes: WorkflowNode[];
  prompts: PromptItem[];
  waitAreas: WaitArea[];
  createdAt: string;
  updatedAt: string;
}

// ===== Waiting Area =====
export type SyncRule = 'auto' | 'manual';

export interface WaitArea {
  waitAreaId: string;
  waitAreaName: string;
  description: string;
  isFixed: boolean;
  relatedNodeIds: string[];
  syncRule: SyncRule;
  twoWayBind: boolean;
  type: 'stateManagement' | 'tableManagement' | 'custom';
}

export interface StateItem {
  id: string;
  stateName: string;
  stateValues: string[];
  description: string;
  relatedDocs: string[];
  relatedTables: string[];
}

export interface TableField {
  id: string;
  fieldName: string;
  fieldType: string;
  description: string;
  isRequired: boolean;
  relatedState: string;
}

export interface TableItem {
  id: string;
  tableName: string;
  description: string;
  fields: TableField[];
  relatedDocs: string[];
}

// ===== Project =====
export interface ProjectInfo {
  projectId: string;
  projectName: string;
  projectVision: string;
  templateId: string;
  templateName: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersion {
  versionId: string;
  content: string;
  createdAt: string;
}

export interface StepDocument {
  nodeId: string;
  docName: string;
  content: string;
  userInput: string;
  status: 'pending' | 'generating' | 'completed' | 'confirmed';
  versions: DocumentVersion[];
  currentVersionIndex: number;
}

export interface ProjectData {
  info: ProjectInfo;
  documents: StepDocument[];
  states: StateItem[];
  tables: TableItem[];
  currentStep: number;
}

// ===== AI Streaming =====
export interface StreamingState {
  isStreaming: boolean;
  content: string;
  error: string | null;
  abortController: AbortController | null;
}
