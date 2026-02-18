import { Routes, Route, Navigate } from 'react-router-dom';
import { ProjectProvider } from './contexts/ProjectContext';
import AppLayout from './components/Layout/AppLayout';
import ApiConfigPage from './pages/ApiConfig';
import TemplateSelectPage from './pages/TemplateSelect';
import WorkflowPage from './pages/Workflow';
import TemplateManagePage from './pages/TemplateManage';

function App() {
  return (
    <ProjectProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/templates" replace />} />
          <Route path="/config" element={<ApiConfigPage />} />
          <Route path="/templates" element={<TemplateSelectPage />} />
          <Route path="/workflow" element={<WorkflowPage />} />
          <Route path="/template-manage" element={<TemplateManagePage />} />
        </Route>
      </Routes>
    </ProjectProvider>
  );
}

export default App;
