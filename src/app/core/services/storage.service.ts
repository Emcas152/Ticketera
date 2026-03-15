import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly platformId = inject(PLATFORM_ID);

  getItem<T>(key: string, fallback: T): T {
    if (!isPlatformBrowser(this.platformId)) {
      return fallback;
    }

    const rawValue = localStorage.getItem(key);

    if (!rawValue) {
      return fallback;
    }

    try {
      return JSON.parse(rawValue) as T;
    } catch {
      return fallback;
    }
  }

  setItem<T>(key: string, value: T): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.setItem(key, JSON.stringify(value));
  }

  removeItem(key: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.removeItem(key);
  }
}
