import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { ProjectData, StepDocument, StateItem, TableItem, WorkflowTemplate, DocSummary, MemorySummary } from '../types';
import { projectStorage } from '../services/storage';
import { idbProjectStorage } from '../services/idbStorage';
import { v4 as uuidv4 } from 'uuid';

interface ProjectState {
  project: ProjectData | null;
  template: WorkflowTemplate | null;
}

type ProjectAction =
  | { type: 'SET_PROJECT'; payload: { project: ProjectData; template: WorkflowTemplate } }
  | { type: 'UPDATE_DOCUMENT'; payload: { nodeId: string; updates: Partial<StepDocument> } }
  | { type: 'SET_CURRENT_STEP'; payload: number }
  | { type: 'SET_STATES'; payload: StateItem[] }
  | { type: 'ADD_STATE'; payload: StateItem }
  | { type: 'UPDATE_STATE'; payload: StateItem }
  | { type: 'DELETE_STATE'; payload: string }
  | { type: 'SET_TABLES'; payload: TableItem[] }
  | { type: 'ADD_TABLE'; payload: TableItem }
  | { type: 'UPDATE_TABLE'; payload: TableItem }
  | { type: 'DELETE_TABLE'; payload: string }
  | { type: 'SET_DOC_SUMMARY'; payload: DocSummary }
  | { type: 'SET_MEMORY_SUMMARY'; payload: MemorySummary }
  | { type: 'MARK_NEEDS_REGENERATION'; payload: { fromStep: number } }
  | { type: 'CLEAR_PROJECT' };

function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    case 'SET_PROJECT':
      return { project: action.payload.project, template: action.payload.template };

    case 'UPDATE_DOCUMENT': {
      if (!state.project) return state;
      const docs = [...state.project.documents];
      const idx = docs.findIndex(d => d.nodeId === action.payload.nodeId);
      if (idx >= 0) {
        docs[idx] = { ...docs[idx], ...action.payload.updates };
      }
      return { ...state, project: { ...state.project, documents: docs } };
    }

    case 'SET_CURRENT_STEP':
      if (!state.project) return state;
      return { ...state, project: { ...state.project, currentStep: action.payload } };

    case 'SET_STATES':
      if (!state.project) return state;
      return { ...state, project: { ...state.project, states: action.payload } };

    case 'ADD_STATE':
      if (!state.project) return state;
      return { ...state, project: { ...state.project, states: [...state.project.states, action.payload] } };

    case 'UPDATE_STATE': {
      if (!state.project) return state;
      const states = state.project.states.map(s => (s.id === action.payload.id ? action.payload : s));
      return { ...state, project: { ...state.project, states } };
    }

    case 'DELETE_STATE': {
      if (!state.project) return state;
      const states = state.project.states.filter(s => s.id !== action.payload);
      return { ...state, project: { ...state.project, states } };
    }

    case 'SET_TABLES':
      if (!state.project) return state;
      return { ...state, project: { ...state.project, tables: action.payload } };

    case 'ADD_TABLE':
      if (!state.project) return state;
      return { ...state, project: { ...state.project, tables: [...state.project.tables, action.payload] } };

    case 'UPDATE_TABLE': {
      if (!state.project) return state;
      const tables = state.project.tables.map(t => (t.id === action.payload.id ? action.payload : t));
      return { ...state, project: { ...state.project, tables } };
    }

    case 'DELETE_TABLE': {
      if (!state.project) return state;
      const tables = state.project.tables.filter(t => t.id !== action.payload);
      return { ...state, project: { ...state.project, tables } };
    }

    case 'SET_DOC_SUMMARY': {
      if (!state.project) return state;
      const summaries = [...(state.project.docSummaries || [])];
      const idx = summaries.findIndex(s => s.nodeId === action.payload.nodeId);
      if (idx >= 0) {
        summaries[idx] = action.payload;
      } else {
        summaries.push(action.payload);
      }
      return { ...state, project: { ...state.project, docSummaries: summaries } };
    }

    case 'SET_MEMORY_SUMMARY': {
      if (!state.project) return state;
      const memories = [...(state.project.memorySummaries || [])];
      const idx = memories.findIndex(m => m.stepIndex === action.payload.stepIndex);
      if (idx >= 0) {
        memories[idx] = action.payload;
      } else {
        memories.push(action.payload);
      }
      return { ...state, project: { ...state.project, memorySummaries: memories } };
    }

    case 'MARK_NEEDS_REGENERATION': {
      if (!state.project) return state;
      const docs = state.project.documents.map((d, i) => {
        if (i > action.payload.fromStep && d.content && d.status !== 'pending') {
          return { ...d, needsRegeneration: true, status: 'needs_update' as const };
        }
        return d;
      });
      return { ...state, project: { ...state.project, documents: docs } };
    }

    case 'CLEAR_PROJECT':
      return { project: null, template: null };

    default:
      return state;
  }
}

interface ProjectContextType {
  project: ProjectData | null;
  template: WorkflowTemplate | null;
  dispatch: React.Dispatch<ProjectAction>;
  initProject: (name: string, vision: string, template: WorkflowTemplate) => ProjectData;
  getPrevDocsContent: (currentStep: number) => string;
  getMemorySummary: (currentStep: number) => string;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(projectReducer, { project: null, template: null });

  const initProject = useCallback(
    (name: string, vision: string, template: WorkflowTemplate): ProjectData => {
      const documents: StepDocument[] = template.nodes.map(node => ({
        nodeId: node.nodeId,
        docName: node.docName,
        content: '',
        userInput: '',
        status: 'pending',
        versions: [],
        currentVersionIndex: -1,
      }));

      const project: ProjectData = {
        info: {
          projectId: uuidv4(),
          projectName: name,
          projectVision: vision,
          templateId: template.templateId,
          templateName: template.templateName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        documents,
        states: [],
        tables: [],
        currentStep: 0,
      };

      dispatch({ type: 'SET_PROJECT', payload: { project, template } });
      return project;
    },
    []
  );

  const getPrevDocsContent = useCallback(
    (currentStep: number): string => {
      if (!state.project) return '';
      const docs = state.project.documents;
      const hasMemory = (state.project.memorySummaries || []).some(m => m.stepIndex < currentStep && m.content);

      if (hasMemory && currentStep >= 2) {
        // With memory, only include the most recent completed doc as full text
        const recentDoc = docs
          .filter((_d, i) => i < currentStep && _d.content)
          .slice(-1)[0];
        return recentDoc ? `## ${recentDoc.docName}（上一步文档）\n\n${recentDoc.content}` : '';
      }

      // No memory yet (step 0-1), include all prev docs
      return docs
        .filter((_d, i) => i < currentStep && _d.content)
        .map(d => `## ${d.docName}\n\n${d.content}`)
        .join('\n\n---\n\n');
    },
    [state.project]
  );

  const getMemorySummary = useCallback(
    (currentStep: number): string => {
      if (!state.project?.memorySummaries?.length) return '';
      const sorted = [...state.project.memorySummaries]
        .filter(m => m.stepIndex < currentStep)
        .sort((a, b) => b.stepIndex - a.stepIndex);
      return sorted[0]?.content || '';
    },
    [state.project]
  );

  useEffect(() => {
    if (state.project) {
      projectStorage.save(state.project);
      projectStorage.setCurrentId(state.project.info.projectId);
      idbProjectStorage.save(state.project).catch(() => {});
      idbProjectStorage.setCurrentId(state.project.info.projectId).catch(() => {});
    }
  }, [state.project]);

  return (
    <ProjectContext.Provider value={{ project: state.project, template: state.template, dispatch, initProject, getPrevDocsContent, getMemorySummary }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}
