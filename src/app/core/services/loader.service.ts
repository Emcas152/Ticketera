import { Injectable } from '@angular/core';
import { BehaviorSubject, distinctUntilChanged, map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LoaderService {
  private readonly pendingRequests$ = new BehaviorSubject<number>(0);
  readonly loading$ = this.pendingRequests$.pipe(
    map((pending) => pending > 0),
    distinctUntilChanged()
  );

  show(): void {
    this.pendingRequests$.next(this.pendingRequests$.value + 1);
  }

  hide(): void {
    this.pendingRequests$.next(Math.max(0, this.pendingRequests$.value - 1));
  }
}
