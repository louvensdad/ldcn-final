import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ClassifyFailureDialogComponent } from './classify-failure-dialog';
import { RepairClient, ClassifyFailureRequest, FailureSnapshotDto, RepairAdvisoryDto } from '../../../core/api/repair.client';
import { AppError } from '../../../core/errors/error-mapper';

describe('ClassifyFailureDialogComponent', () => {
  function setup(classify: (missionId: string, taskId: string, body: ClassifyFailureRequest) => ReturnType<RepairClient['classify']>) {
    TestBed.configureTestingModule({
      imports: [ClassifyFailureDialogComponent],
      providers: [{ provide: RepairClient, useValue: { classify } }],
    });
    const fixture = TestBed.createComponent(ClassifyFailureDialogComponent);
    fixture.componentRef.setInput('missionId', 'm-1');
    fixture.detectChanges();
    return fixture;
  }

  function fillAndSubmit(fixture: ReturnType<typeof setup>, taskId: string, summary: string) {
    const el = fixture.nativeElement as HTMLElement;
    const taskIdInput = el.querySelector('input') as HTMLInputElement;
    const summaryTextarea = el.querySelector('textarea') as HTMLTextAreaElement;
    taskIdInput.value = taskId;
    taskIdInput.dispatchEvent(new Event('input'));
    summaryTextarea.value = summary;
    summaryTextarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
  }

  it('emits closed(false) on cancel without calling classify', () => {
    const classify = vi.fn((_missionId: string, _taskId: string, _body: ClassifyFailureRequest) => of({} as { snapshot: FailureSnapshotDto; advisory: RepairAdvisoryDto }));
    const fixture = setup(classify);
    const closedSpy = vi.fn();
    fixture.componentInstance.closed.subscribe(closedSpy);

    fixture.componentInstance.cancel();

    expect(closedSpy).toHaveBeenCalledWith(false);
    expect(classify).not.toHaveBeenCalled();
  });

  it('submits taskId + summary and emits closed(true) on success', () => {
    const classify = vi.fn((_missionId: string, _taskId: string, _body: ClassifyFailureRequest) => of({} as { snapshot: FailureSnapshotDto; advisory: RepairAdvisoryDto }));
    const fixture = setup(classify);
    const closedSpy = vi.fn();
    fixture.componentInstance.closed.subscribe(closedSpy);

    fillAndSubmit(fixture, 'task-1', 'critical security vulnerability');
    fixture.detectChanges();

    expect(classify).toHaveBeenCalledWith('m-1', 'task-1', expect.objectContaining({ summary: 'critical security vulnerability' }));
    expect(closedSpy).toHaveBeenCalledWith(true);
  });

  it('keeps the dialog open and shows the mapped error when classify fails', () => {
    const appError: AppError = { category: 'SERVER', status: 500, code: 'INTERNAL', translationKey: 'errors.5xx' };
    const classify = vi.fn((_missionId: string, _taskId: string, _body: ClassifyFailureRequest) => throwError(() => appError));
    const fixture = setup(classify);
    const closedSpy = vi.fn();
    fixture.componentInstance.closed.subscribe(closedSpy);

    fillAndSubmit(fixture, 'task-1', 'build failed');
    fixture.detectChanges();

    expect(closedSpy).not.toHaveBeenCalled();
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('Server error');
  });
});
