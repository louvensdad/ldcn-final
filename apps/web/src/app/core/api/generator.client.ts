import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from './api-client';

export interface StartMissionRequest {
  rawUserIdea: string;
  technologyPreferences?: string[];
  forbiddenDeliveryTargets?: string[];
  constraints?: string[];
}

/** apps/api GeneratorController#start response (doc 42 §3 Operation pattern). */
export interface StartMissionAcceptedDto {
  operationId: string;
  missionId: string;
  status: 'SUCCEEDED' | 'FAILED';
}

@Injectable({ providedIn: 'root' })
export class GeneratorClient {
  private readonly api = inject(ApiClient);

  start(missionId: string, request: StartMissionRequest): Observable<StartMissionAcceptedDto> {
    return this.api.post<StartMissionAcceptedDto>(`/missions/${missionId}/intelligent-generator/start`, request);
  }
}
