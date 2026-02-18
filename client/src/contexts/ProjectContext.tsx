import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { ProjectData, StepDocument, StateItem, TableItem, WorkflowTemplate } from '../types';
import { projectStorage } from '../services/storage';
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
      return state.project.documents
        .filter((_d, i) => i < currentStep && _d.content)
        .map(d => `## ${d.docName}\n\n${d.content}`)
        .join('\n\n---\n\n');
    },
    [state.project]
  );

  // Auto-save to localStorage
  useEffect(() => {
    if (state.project) {
      projectStorage.save(state.project);
      projectStorage.setCurrentId(state.project.info.projectId);
    }
  }, [state.project]);

  return (
    <ProjectContext.Provider value={{ project: state.project, template: state.template, dispatch, initProject, getPrevDocsContent }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}
