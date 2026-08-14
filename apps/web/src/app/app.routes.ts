import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/login/login').then((m) => m.LoginComponent) },
  {
    path: '',
    loadComponent: () => import('./shell/app-shell/app-shell').then((m) => m.AppShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', loadComponent: () => import('./features/home/home').then((m) => m.HomeComponent) },
      { path: 'wizard', loadComponent: () => import('./features/wizard/wizard').then((m) => m.WizardComponent) },
      { path: 'missions/:missionId', loadComponent: () => import('./features/mission-detail/mission-detail').then((m) => m.MissionDetailComponent) },
      { path: 'missions/:missionId/architecture', loadComponent: () => import('./features/mission-architecture/mission-architecture').then((m) => m.MissionArchitectureComponent) },
      { path: 'missions/:missionId/team', loadComponent: () => import('./features/mission-team/mission-team').then((m) => m.MissionTeamComponent) },
      { path: 'missions/:missionId/pipeline', loadComponent: () => import('./features/mission-pipeline/mission-pipeline').then((m) => m.MissionPipelineComponent) },
      { path: 'missions/:missionId/tasks', loadComponent: () => import('./features/mission-tasks/mission-tasks').then((m) => m.MissionTasksComponent) },
      { path: 'missions/:missionId/tasks/:taskId', loadComponent: () => import('./features/task-detail/task-detail').then((m) => m.TaskDetailComponent) },
      { path: 'missions/:missionId/execution', loadComponent: () => import('./features/mission-execution/mission-execution').then((m) => m.MissionExecutionComponent) },
      { path: 'missions/:missionId/gates', loadComponent: () => import('./features/mission-gates/mission-gates').then((m) => m.MissionGatesComponent) },
      { path: 'missions/:missionId/repair', loadComponent: () => import('./features/mission-repair/mission-repair').then((m) => m.MissionRepairComponent) },
      { path: 'missions/:missionId/ai-usage', loadComponent: () => import('./features/mission-ai-usage/mission-ai-usage').then((m) => m.MissionAiUsageComponent) },
    ],
  },
  { path: '**', redirectTo: '' },
];
