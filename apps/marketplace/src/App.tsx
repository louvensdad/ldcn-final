import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./theme/ThemeContext";
import { EngineeringModeProvider } from "./shell/EngineeringModeContext";
import { I18nProvider } from "./i18n/I18nContext";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAuth } from "./auth/RequireAuth";
import { AppShell } from "./shell/AppShell";
import { Login } from "./pages/Login";
import { Onboarding } from "./pages/Onboarding";
import { Workspace } from "./pages/Workspace";
import { Missions } from "./pages/Missions";
import { Wizard } from "./pages/Wizard";
import { MissionDetail } from "./pages/MissionDetail";
import { MissionArchitecture } from "./pages/MissionArchitecture";
import { MissionTeam } from "./pages/MissionTeam";
import { MissionPipeline } from "./pages/MissionPipeline";
import { MissionTasks } from "./pages/MissionTasks";
import { MissionExecution } from "./pages/MissionExecution";
import { TaskDetail } from "./pages/TaskDetail";
import { MissionTaskOperations } from "./pages/MissionTaskOperations";
import { SectionPage } from "./pages/SectionPage";
import { MissionAiUsage } from "./pages/MissionAiUsage";
import { OperationsPage } from "./pages/OperationsPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ProjectCommandCenter } from "./pages/ProjectCommandCenter";
import { AcademyPage } from "./pages/AcademyPage";
import { WorkspaceAdminPage } from "./pages/WorkspaceAdminPage";
import { Settings } from "./pages/Settings";
import { IntelligencePage } from "./pages/IntelligencePage";
import { DecisionsPage } from "./pages/DecisionsPage";
import { ArtifactsPage } from "./pages/ArtifactsPage";
import { Marketplace } from "./Marketplace";
import { SystemDetailPage } from "./pages/SystemDetailPage";
import { SystemCustomizePage } from "./pages/SystemCustomizePage";

export default function App() {
  return (
    <ThemeProvider>
      <EngineeringModeProvider>
        <I18nProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  path="/onboarding"
                  element={
                    <RequireAuth>
                      <Onboarding />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/"
                  element={
                    <RequireAuth>
                      <AppShell />
                    </RequireAuth>
                  }
                >
                  <Route index element={<Workspace />} />
                  <Route path="missions" element={<Missions />} />
                  <Route path="wizard" element={<Wizard />} />
                  <Route path="marketplace" element={<Marketplace />} />
                  <Route path="marketplace/systems/:slug" element={<SystemDetailPage />} />
                  <Route path="marketplace/systems/:slug/customize" element={<SystemCustomizePage />} />
                  <Route path="missions/:missionId" element={<MissionDetail />} />
                  <Route path="missions/:missionId/architecture" element={<MissionArchitecture />} />
                  <Route path="missions/:missionId/team" element={<MissionTeam />} />
                  <Route path="missions/:missionId/pipeline" element={<MissionPipeline />} />
                  <Route path="missions/:missionId/tasks" element={<MissionTasks />} />
                  <Route path="missions/:missionId/tasks/:taskId" element={<TaskDetail />} />
                  <Route path="missions/:missionId/execution" element={<MissionExecution />} />
                  <Route path="missions/:missionId/gates" element={<MissionTaskOperations kind="gates" />} />
                  <Route path="missions/:missionId/repair" element={<MissionTaskOperations kind="repair" />} />
                  <Route path="missions/:missionId/ai-usage" element={<MissionAiUsage />} />
                  <Route path="projects" element={<ProjectsPage />} />
                  <Route path="projects/:projectId" element={<ProjectCommandCenter />} />
                  <Route path="academy" element={<AcademyPage />} />
                  <Route path="ai-decisions" element={<DecisionsPage />} />
                  <Route path="agents" element={<IntelligencePage />} />
                  <Route path="ai-usage" element={<OperationsPage kind="ai-usage" />} />
                  <Route path="tasks" element={<OperationsPage kind="tasks" />} />
                  <Route path="executions" element={<OperationsPage kind="executions" />} />
                  <Route path="artifacts" element={<ArtifactsPage />} />
                  <Route path="reviews" element={<OperationsPage kind="reviews" />} />
                  <Route path="gates" element={<OperationsPage kind="gates" />} />
                  <Route path="organization" element={<WorkspaceAdminPage kind="organization" />} />
                  <Route path="members" element={<WorkspaceAdminPage kind="members" />} />
                  <Route path="billing" element={<WorkspaceAdminPage kind="billing" />} />
                  <Route path="notifications" element={<OperationsPage kind="notifications" />} />
                  <Route path="settings" element={<Settings />} />
                  {/* Roles/Security/Audit moved into Settings (Fase B) — redirect old links instead of keeping a duplicate page. */}
                  <Route path="roles" element={<Navigate to="/settings" replace />} />
                  <Route path="security" element={<Navigate to="/settings" replace />} />
                  <Route path="audit" element={<Navigate to="/settings" replace />} />
                  <Route path="*" element={<SectionPage />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </I18nProvider>
      </EngineeringModeProvider>
    </ThemeProvider>
  );
}
