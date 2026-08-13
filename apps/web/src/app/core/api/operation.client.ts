import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from './api-client';

/** Wire shape of infra/prisma/schema.prisma `Operation` (doc 36 §11). */
export interface OperationDto {
  id: string;
  missionId: string;
  type: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  correlationId: string;
  resultJson: unknown;
  errorCode: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class OperationClient {
  private readonly api = inject(ApiClient);

  get(operationId: string): Observable<OperationDto> {
    return this.api.get<OperationDto>(`/operations/${operationId}`);
  }
}
