import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, map, of } from 'rxjs';
import { StorageService } from './storage.service';
import { NotificationService } from './notification.service';

const STORAGE_PREFIX = 'pulse-disabled-tables:';
export const DEFAULT_DISABLED_TABLES: string[] = ['161', '162', '163', '164', '165', '176', '177', '178', '179', '180'];

@Injectable({ providedIn: 'root' })
export class TableManagementService {
  private readonly storage = inject(StorageService);
  private readonly notifications = inject(NotificationService);

  private readonly stateSubject = new BehaviorSubject<Record<string, string[]>>({});
  readonly state$ = this.stateSubject.asObservable();

  constructor() {}

  /**
   * Obtiene la lista de identificadores/labels de mesas deshabilitadas para un evento.
   */
  getDisabledTables(eventId: string): string[] {
    if (!eventId) return [...DEFAULT_DISABLED_TABLES];
    const cached = this.stateSubject.value[eventId];
    if (cached) return cached;

    const stored = this.storage.getItem<string[] | null>(`${STORAGE_PREFIX}${eventId}`, null);
    const result = stored !== null ? stored : [...DEFAULT_DISABLED_TABLES];
    this.updateEventCache(eventId, result);
    return result;
  }

  /**
   * Observable reactivo para escuchar cambios en las mesas deshabilitadas de un evento.
   */
  disabledTables$(eventId: string): Observable<string[]> {
    return this.state$.pipe(
      map((state) => state[eventId] ?? this.getDisabledTables(eventId))
    );
  }

  /**
   * Verifica si una mesa específica está deshabilitada en un evento.
   */
  isTableDisabled(eventId: string, tableLabel: string): boolean {
    if (!eventId || !tableLabel) return false;
    const list = this.getDisabledTables(eventId);
    const normalized = String(tableLabel).trim();
    return list.includes(normalized);
  }

  /**
   * Deshabilita o habilita una mesa individual.
   */
  setTableDisabled(eventId: string, tableLabel: string, disabled: boolean): Observable<string[]> {
    if (!eventId || !tableLabel) return of([]);

    const normalized = String(tableLabel).trim();
    const current = new Set(this.getDisabledTables(eventId));

    if (disabled) {
      current.add(normalized);
    } else {
      current.delete(normalized);
    }

    const next = Array.from(current);
    this.persist(eventId, next);
    return of(next);
  }

  /**
   * Alterna el estado (toggle) de una mesa.
   */
  toggleTable(eventId: string, tableLabel: string): Observable<boolean> {
    const isCurrentlyDisabled = this.isTableDisabled(eventId, tableLabel);
    const newDisabledState = !isCurrentlyDisabled;
    this.setTableDisabled(eventId, tableLabel, newDisabledState);
    return of(newDisabledState);
  }

  /**
   * Deshabilita múltiples mesas a la vez.
   */
  disableMultipleTables(eventId: string, tableLabels: string[]): Observable<string[]> {
    const current = new Set(this.getDisabledTables(eventId));
    tableLabels.forEach((lbl) => current.add(String(lbl).trim()));
    const next = Array.from(current);
    this.persist(eventId, next);
    this.notifications.success(`${tableLabels.length} mesa(s) deshabilitada(s).`);
    return of(next);
  }

  /**
   * Habilita múltiples mesas a la vez.
   */
  enableMultipleTables(eventId: string, tableLabels: string[]): Observable<string[]> {
    const current = new Set(this.getDisabledTables(eventId));
    tableLabels.forEach((lbl) => current.delete(String(lbl).trim()));
    const next = Array.from(current);
    this.persist(eventId, next);
    this.notifications.success(`${tableLabels.length} mesa(s) habilitada(s).`);
    return of(next);
  }

  /**
   * Habilita todas las mesas de un evento.
   */
  enableAllTables(eventId: string): Observable<string[]> {
    this.persist(eventId, []);
    this.notifications.success('Todas las mesas fueron habilitadas.');
    return of([]);
  }

  private persist(eventId: string, list: string[]): void {
    this.storage.setItem(`${STORAGE_PREFIX}${eventId}`, list);
    this.updateEventCache(eventId, list);
  }

  private updateEventCache(eventId: string, list: string[]): void {
    const current = { ...this.stateSubject.value };
    current[eventId] = list;
    this.stateSubject.next(current);
  }
}
