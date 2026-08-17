import { apiClient } from "./client";

/** apps/api GithubController — real, backend-verified GitHub credential status. */
export interface GithubCredentialDto {
  configured: boolean;
  githubLogin: string | null;
  tokenPreview: string | null;
}

export interface GithubPushDto {
  missionId: string;
  status: "PENDING" | "PUSHED" | "FAILED";
  repoName: string | null;
  repoUrl: string | null;
  errorCode: string | null;
  logsExcerpt: string | null;
}

export const githubClient = {
  getCredential(): Promise<GithubCredentialDto> {
    return apiClient.get<GithubCredentialDto>("/integrations/github");
  },
  saveCredential(token: string): Promise<GithubCredentialDto> {
    return apiClient.post<GithubCredentialDto>("/integrations/github", { token });
  },
  revokeCredential(): Promise<{ revoked: boolean }> {
    return apiClient.delete<{ revoked: boolean }>("/integrations/github");
  },
  push(missionId: string, repoName: string, isPrivate: boolean): Promise<GithubPushDto> {
    return apiClient.post<GithubPushDto>(`/missions/${missionId}/generation/github`, { repoName, private: isPrivate });
  },
  getPushStatus(missionId: string): Promise<GithubPushDto> {
    return apiClient.get<GithubPushDto>(`/missions/${missionId}/generation/github`);
  },
};
