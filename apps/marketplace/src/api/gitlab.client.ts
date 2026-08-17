import { apiClient } from "./client";

/** apps/api GitlabController — real, backend-verified GitLab credential status. */
export interface GitlabCredentialDto {
  configured: boolean;
  gitlabUsername: string | null;
  tokenPreview: string | null;
}

export interface GitlabPushDto {
  missionId: string;
  status: "PENDING" | "PUSHED" | "FAILED";
  repoName: string | null;
  repoUrl: string | null;
  errorCode: string | null;
  logsExcerpt: string | null;
}

export const gitlabClient = {
  getCredential(): Promise<GitlabCredentialDto> {
    return apiClient.get<GitlabCredentialDto>("/integrations/gitlab");
  },
  saveCredential(token: string): Promise<GitlabCredentialDto> {
    return apiClient.post<GitlabCredentialDto>("/integrations/gitlab", { token });
  },
  revokeCredential(): Promise<{ revoked: boolean }> {
    return apiClient.delete<{ revoked: boolean }>("/integrations/gitlab");
  },
  push(missionId: string, repoName: string, isPrivate: boolean): Promise<GitlabPushDto> {
    return apiClient.post<GitlabPushDto>(`/missions/${missionId}/generation/gitlab`, { repoName, private: isPrivate });
  },
  getPushStatus(missionId: string): Promise<GitlabPushDto> {
    return apiClient.get<GitlabPushDto>(`/missions/${missionId}/generation/gitlab`);
  },
};
