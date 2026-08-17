import { apiClient } from "./client";

/** apps/api OperationsController — async Operation record (doc 42 §3 Operation pattern). */
export interface OperationDto {
  operationId: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  kind?: string;
  createdAt?: string;
  completedAt?: string | null;
  error?: string | null;
}

export const operationClient = {
  get(operationId: string): Promise<OperationDto> {
    return apiClient.get<OperationDto>(`/operations/${operationId}`);
  },
};
