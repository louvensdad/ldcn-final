import { TestBed } from '@angular/core/testing';
import { SkeletonComponent } from './skeleton';

describe('SkeletonComponent', () => {
  it('renders hidden from assistive tech with the given width/height', () => {
    const fixture = TestBed.createComponent(SkeletonComponent);
    fixture.componentRef.setInput('width', '40%');
    fixture.componentRef.setInput('height', '2rem');
    fixture.detectChanges();

    const el = (fixture.nativeElement as HTMLElement).querySelector('.skeleton') as HTMLElement;
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.style.width).toBe('40%');
    expect(el.style.height).toBe('2rem');
  });

  it('defaults to a full-width single line', () => {
    const fixture = TestBed.createComponent(SkeletonComponent);
    fixture.detectChanges();

    const el = (fixture.nativeElement as HTMLElement).querySelector('.skeleton') as HTMLElement;
    expect(el.style.width).toBe('100%');
    expect(el.style.height).toBe('1rem');
  });
});
