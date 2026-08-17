import { apiClient } from "./client";

/** apps/api ProjectsController — a persistent grouping of missions, owned by the Platform API. */
export interface ProjectDto {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  missionIds: string[];
}

export const projectClient = {
  list(): Promise<ProjectDto[]> {
    return apiClient.get<ProjectDto[]>("/projects");
  },
  get(projectId: string): Promise<ProjectDto> {
    return apiClient.get<ProjectDto>(`/projects/${projectId}`);
  },
  create(name: string): Promise<ProjectDto> {
    return apiClient.post<ProjectDto>("/projects", { name });
  },
  assignMission(projectId: string, missionId: string): Promise<ProjectDto> {
    return apiClient.post<ProjectDto>(`/projects/${projectId}/missions`, { missionId });
  },
};
