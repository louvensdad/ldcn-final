import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MissionClient } from './mission.client';

describe('MissionClient', () => {
  let client: MissionClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(MissionClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list() issues a GET to /missions', () => {
    client.list().subscribe();
    const req = httpMock.expectOne((request) => request.url.endsWith('/missions'));
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getOverview() issues a GET to /missions/:id/overview', () => {
    client.getOverview('m-1').subscribe();
    const req = httpMock.expectOne((request) => request.url.endsWith('/missions/m-1/overview'));
    expect(req.request.method).toBe('GET');
    req.flush({});
  });
});
