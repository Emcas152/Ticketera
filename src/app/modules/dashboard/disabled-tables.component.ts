import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, map } from 'rxjs';
import { EventItem } from '../../core/models/event.model';
import { SeatMap, SeatTable } from '../../core/models/seat.model';
import { BookingService } from '../../core/services/booking.service';
import { EventService } from '../../core/services/event.service';
import { NotificationService } from '../../core/services/notification.service';
import { TableManagementService } from '../../core/services/table-management.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';

@Component({
  selector: 'app-disabled-tables',
  standalone: true,
  imports: [CommonModule, AsyncPipe, FormsModule, ...MATERIAL_IMPORTS],
  template: `
    <section class="admin-shell tables-admin">
      <div class="admin-header">
        <div>
          <p class="eyebrow">Operación y Control</p>
          <h1>Bloqueo de Mesas</h1>
          <p class="admin-subtitle">
            Deshabilita o habilita mesas por evento. Las mesas deshabilitadas se mostrarán en
            <strong class="text-danger">rojo</strong> en el mapa y sus asientos no podrán ser comprados ni reservados.
          </p>
        </div>
      </div>

      <!-- Barra de selección de evento y estadísticas -->
      <div class="panel-surface top-bar-panel">
        <div class="event-selector-row">
          <mat-form-field appearance="outline" class="event-select-field">
            <mat-label>Selecciona un Evento</mat-label>
            <mat-select [(ngModel)]="selectedEventId" (selectionChange)="onEventChange()">
              @for (event of (events$ | async) ?? []; track event.id) {
                <mat-option [value]="event.id">{{ event.name }} ({{ event.venueName }})</mat-option>
              }
            </mat-select>
            <mat-icon matSuffix>event</mat-icon>
          </mat-form-field>

          @if (seatMap) {
            <div class="stats-row">
              <div class="stat-card">
                <span class="stat-label">Total Mesas</span>
                <strong class="stat-val">{{ allTables.length }}</strong>
              </div>
              <div class="stat-card active-card">
                <span class="stat-label">Habilitadas</span>
                <strong class="stat-val green">{{ enabledCount }}</strong>
              </div>
              <div class="stat-card disabled-card">
                <span class="stat-label">Deshabilitadas</span>
                <strong class="stat-val red">{{ disabledCount }}</strong>
              </div>
            </div>
          }
        </div>

        @if (seatMap) {
          <div class="filters-row">
            <mat-form-field appearance="outline" class="search-field">
              <mat-label>Buscar mesa</mat-label>
              <input matInput [(ngModel)]="searchQuery" placeholder="Ej. 12" />
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="section-field">
              <mat-label>Sección</mat-label>
              <mat-select [(ngModel)]="selectedSection">
                <mat-option value="all">Todas las secciones</mat-option>
                @for (sec of sections; track sec) {
                  <mat-option [value]="sec">{{ sec }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="status-field">
              <mat-label>Estado</mat-label>
              <mat-select [(ngModel)]="selectedStatus">
                <mat-option value="all">Todos los estados</mat-option>
                <mat-option value="enabled">Solo Habilitadas</mat-option>
                <mat-option value="disabled">Solo Deshabilitadas (Rojas)</mat-option>
              </mat-select>
            </mat-form-field>

            <div class="quick-actions">
              <button mat-stroked-button color="primary" type="button" (click)="enableAll()" [disabled]="disabledCount === 0">
                <mat-icon>check_circle</mat-icon>
                Habilitar todas
              </button>
              <button mat-flat-button color="warn" type="button" (click)="disableFiltered()" [disabled]="filteredTables.length === 0">
                <mat-icon>block</mat-icon>
                Deshabilitar filtradas ({{ filteredTables.length }})
              </button>
            </div>
          </div>
        }
      </div>

      @if (loading) {
        <div class="panel-surface loading-state">
          <mat-spinner diameter="36" />
          <p>Cargando mapa de asientos...</p>
        </div>
      }

      @if (!loading && seatMap) {
        <div class="workspace-grid">
          <!-- Panel Izquierdo: Lista interactiva de mesas -->
          <div class="panel-surface tables-list-panel">
            <div class="list-heading">
              <div>
                <strong>Listado de Mesas</strong>
                <p>{{ filteredTables.length }} de {{ allTables.length }} mesas</p>
              </div>
              <span class="click-hint">
                <mat-icon>touch_app</mat-icon> Haz clic en un toggle o directamente en el mapa
              </span>
            </div>

            <div class="tables-grid">
              @for (table of filteredTables; track table.id) {
                <div
                  class="table-item-card"
                  [class.is-disabled]="isTableDisabled(table.label)"
                  (click)="toggleTable(table.label)"
                >
                  <div class="table-card-main">
                    <div class="table-badge" [class.badge-disabled]="isTableDisabled(table.label)">
                      Mesa {{ table.label }}
                    </div>
                    <div class="table-info">
                      <span class="section-tag" [ngClass]="sectionTagClass(table.sectionName)">{{ table.sectionName }}</span>
                      <small>{{ table.seats.length }} asientos</small>
                    </div>
                  </div>

                  <button
                    type="button"
                    class="state-toggle-btn"
                    [class.btn-disabled]="isTableDisabled(table.label)"
                    (click)="$event.stopPropagation(); toggleTable(table.label)"
                  >
                    @if (isTableDisabled(table.label)) {
                      <mat-icon>block</mat-icon> Deshabilitada
                    } @else {
                      <mat-icon>check</mat-icon> Habilitada
                    }
                  </button>
                </div>
              } @empty {
                <div class="empty-list">
                  <mat-icon>info</mat-icon>
                  <p>No se encontraron mesas con los filtros aplicados.</p>
                </div>
              }
            </div>
          </div>

          <!-- Panel Derecho: Plano visual interactivo SVG -->
          <div class="panel-surface map-view-panel">
            <div class="map-view-header">
              <div>
                <strong>Vista del Mapa en Vivo</strong>
                <p>Las mesas rojas están deshabilitadas. Haz clic en cualquier mesa para alternar su estado.</p>
              </div>
              <div class="map-legend">
                <span class="leg-item"><i class="leg-dot green"></i> Habilitada</span>
                <span class="leg-item"><i class="leg-dot red"></i> Deshabilitada (Bloqueada)</span>
              </div>
            </div>

            <div #viewport class="venue-viewport">
              <svg
                #svgContainer
                class="venue-map"
                width="100%"
                height="100%"
                [attr.viewBox]="viewBoxX + ' ' + viewBoxY + ' ' + viewBoxW + ' ' + viewBoxH"
                preserveAspectRatio="xMidYMid meet"
                (wheel)="onWheel($event)"
                (mousedown)="onMouseDown($event)"
                (mousemove)="onMouseMove($event)"
                (mouseup)="onMouseUp()"
                (mouseleave)="onMouseUp()"
              >
                <!-- Fondo del Venue -->
                <rect x="-250" y="-250" [attr.width]="seatMap.width + 500" [attr.height]="seatMap.height + 500" fill="#a8a8a8" />

                <!-- Escenario -->
                @if (seatMap.stage) {
                  <g class="stage-block">
                    <rect
                      [attr.x]="seatMap.stage.x"
                      [attr.y]="seatMap.stage.y"
                      [attr.width]="seatMap.stage.width"
                      [attr.height]="seatMap.stage.height"
                      rx="12"
                      fill="#0f172a"
                    />
                    <text
                      [attr.x]="seatMap.stage.x + seatMap.stage.width / 2"
                      [attr.y]="seatMap.stage.y + seatMap.stage.height / 2"
                      text-anchor="middle"
                      dominant-baseline="middle"
                      fill="#ffffff"
                      font-size="24"
                      font-weight="800"
                    >
                      {{ seatMap.stage.label }}
                    </text>
                  </g>
                }

                <!-- Secciones -->
                @for (section of seatMap.sections; track section.id) {
                  @if (section.polygon) {
                    <polygon [attr.points]="section.polygon" class="map-zone" />
                  }
                }

                <!-- Mesas Interactivas -->
                @for (table of allTables; track table.id) {
                  <g
                    class="interactive-table"
                    [class.disabled-table]="isTableDisabled(table.label)"
                    [attr.transform]="'translate(' + table.x + ' ' + table.y + ')'"
                    (click)="toggleTable(table.label)"
                  >
                    <!-- Mesa Rectángulo -->
                    <rect
                      [attr.width]="table.width"
                      [attr.height]="table.height"
                      rx="5"
                      class="table-rect"
                      [attr.fill]="isTableDisabled(table.label) ? '#ef4444' : '#1e293b'"
                      [attr.stroke]="isTableDisabled(table.label) ? '#b91c1c' : '#475569'"
                      stroke-width="1.5"
                    />
                    <!-- Texto de la Mesa -->
                    <text
                      [attr.x]="table.width / 2"
                      [attr.y]="table.height / 2"
                      text-anchor="middle"
                      dominant-baseline="middle"
                      fill="#ffffff"
                      font-size="12"
                      font-weight="bold"
                    >
                      {{ table.label }}
                    </text>

                    <!-- Asientos de la Mesa -->
                    @for (seat of table.seats; track seat.id) {
                      <circle
                        [attr.cx]="seat.x - table.x"
                        [attr.cy]="seat.y - table.y"
                        [attr.r]="seat.radius || 6.5"
                        [attr.fill]="isTableDisabled(table.label) ? '#dc2626' : (seat.status === 'sold' ? '#ff4b4b' : '#3b82f6')"
                        stroke="#ffffff"
                        stroke-width="0.8"
                      />
                    }
                  </g>
                }
              </svg>

              <!-- Controles de Zoom y Pan -->
              <div class="map-controls-bar">
                <button class="control-btn center-btn" type="button" (click)="resetView()">Centrar</button>
                <button class="control-btn zoom-btn" type="button" (click)="zoomOut()">−</button>
                <button class="control-btn zoom-btn" type="button" (click)="zoomIn()">+</button>
              </div>
            </div>
          </div>
        </div>
      }

      @if (!loading && !seatMap && selectedEventId) {
        <div class="panel-surface empty-state">
          <mat-icon>event_busy</mat-icon>
          <h3>Sin mapa configurado</h3>
          <p>Este evento no cuenta con un plano de mesas activo.</p>
        </div>
      }
    </section>
  `,
  styles: [`
    .tables-admin { display: grid; gap: 16px; }
    .text-danger { color: #ef4444; }

    /* Barra Superior */
    .top-bar-panel { display: grid; gap: 16px; padding: 18px; }
    .event-selector-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
    .event-select-field { min-width: 320px; flex: 1; margin-bottom: -1.25em; }

    .stats-row { display: flex; gap: 12px; }
    .stat-card {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 10px 18px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; min-width: 90px;
    }
    .stat-label { font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase; }
    .stat-val { font-size: 1.4rem; font-weight: 800; color: #0f172a; }
    .stat-val.green { color: #16a34a; }
    .stat-val.red { color: #dc2626; }
    .active-card { background: #f0fdf4; border-color: #bbf7d0; }
    .disabled-card { background: #fef2f2; border-color: #fecaca; }

    .filters-row {
      display: flex; align-items: center; flex-wrap: wrap; gap: 12px; padding-top: 8px; border-top: 1px solid #f1f5f9;
    }
    .search-field { min-width: 160px; flex: 1; margin-bottom: -1.25em; }
    .section-field, .status-field { min-width: 170px; margin-bottom: -1.25em; }
    .quick-actions { display: flex; gap: 8px; margin-left: auto; }

    /* Workspace */
    .workspace-grid {
      display: grid; grid-template-columns: minmax(360px, 420px) minmax(0, 1fr); gap: 16px; align-items: start;
    }

    /* Panel Izquierdo: Lista */
    .tables-list-panel { display: grid; gap: 12px; padding: 18px; max-height: calc(100vh - 270px); overflow: hidden; }
    .list-heading { display: flex; justify-content: space-between; align-items: flex-start; }
    .list-heading p { margin: 2px 0 0; color: var(--text-muted); font-size: 0.82rem; }
    .click-hint { display: flex; align-items: center; gap: 4px; font-size: 0.72rem; color: #3b82f6; font-weight: 600; }
    .click-hint mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .tables-grid {
      display: grid; gap: 8px; overflow-y: auto; max-height: calc(100vh - 350px); padding-right: 4px;
    }
    .table-item-card {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      padding: 10px 14px; border-radius: 10px; background: #ffffff; border: 1px solid #e2e8f0;
      cursor: pointer; transition: all 0.18s ease;
    }
    .table-item-card:hover { border-color: #93c5fd; box-shadow: 0 2px 8px rgba(59,130,246,0.08); }
    .table-item-card.is-disabled {
      background: #fef2f2; border-color: #fca5a5;
    }
    .table-card-main { display: flex; align-items: center; gap: 12px; }
    .table-badge {
      padding: 4px 10px; border-radius: 8px; background: #0f172a; color: #ffffff;
      font-weight: 800; font-size: 0.84rem;
    }
    .table-badge.badge-disabled { background: #dc2626; color: #ffffff; }
    .table-info { display: flex; flex-direction: column; }
    .section-tag { font-size: 0.78rem; font-weight: 800; color: #334155; text-transform: uppercase; }
    .section-tag.tag-diamante { color: #0b2c6b; }
    .section-tag.tag-vip { color: #c2410c; }
    .section-tag.tag-general { color: #0f766e; }
    .table-info small { color: #64748b; font-size: 0.72rem; }

    .state-toggle-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 12px; border-radius: 999px; border: 1px solid #bbf7d0; background: #f0fdf4;
      color: #16a34a; font-size: 0.76rem; font-weight: 700; cursor: pointer; transition: all 0.15s ease;
    }
    .state-toggle-btn.btn-disabled {
      border-color: #fca5a5; background: #dc2626; color: #ffffff;
    }
    .state-toggle-btn mat-icon { font-size: 15px; width: 15px; height: 15px; }

    /* Panel Derecho: Mapa */
    .map-view-panel { display: grid; gap: 10px; padding: 18px; }
    .map-view-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; }
    .map-view-header p { margin: 2px 0 0; color: var(--text-muted); font-size: 0.82rem; }
    .map-legend { display: flex; gap: 14px; font-size: 0.78rem; font-weight: 700; }
    .leg-item { display: flex; align-items: center; gap: 6px; }
    .leg-dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
    .leg-dot.green { background: #1e293b; border: 1px solid #475569; }
    .leg-dot.red { background: #ef4444; box-shadow: 0 0 6px rgba(239,68,68,0.6); }

    .venue-viewport {
      position: relative; width: 100%; height: 600px; background: #0f172a;
      border-radius: 12px; overflow: hidden; border: 1px solid #334155;
    }
    .venue-map { width: 100%; height: 100%; cursor: grab; }
    .venue-map:active { cursor: grabbing; }

    /* Mesas SVG Interactivas */
    .interactive-table { cursor: pointer; transition: transform 0.12s ease; }
    .interactive-table:hover .table-rect {
      filter: drop-shadow(0 0 8px rgba(255,255,255,0.7));
      stroke: #ffffff; stroke-width: 2.5px;
    }
    .interactive-table.disabled-table .table-rect {
      filter: drop-shadow(0 0 10px rgba(239,68,68,0.9));
      stroke: #b91c1c; stroke-width: 2px;
    }

    /* Floating Controls */
    .map-controls-bar {
      position: absolute; right: 14px; bottom: 14px; display: flex; gap: 6px;
      background: rgba(15,23,42,0.85); backdrop-filter: blur(8px);
      padding: 6px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12);
    }
    .control-btn {
      height: 32px; border-radius: 7px; border: 1px solid rgba(255,255,255,0.15);
      background: rgba(255,255,255,0.1); color: #ffffff; font-weight: 700;
      cursor: pointer; display: grid; place-items: center; padding: 0 10px;
    }
    .control-btn:hover { background: rgba(255,255,255,0.22); }
    .zoom-btn { width: 32px; font-size: 1.1rem; }

    .loading-state, .empty-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 12px; padding: 48px; text-align: center; color: var(--text-muted);
    }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; color: #94a3b8; }
    .empty-state h3 { margin: 0; color: #0f172a; }

    @media (max-width: 1024px) {
      .workspace-grid { grid-template-columns: 1fr; }
      .venue-viewport { height: 450px; }
    }
  `]
})
export class DisabledTablesComponent implements OnInit {
  private readonly eventService = inject(EventService);
  private readonly bookingService = inject(BookingService);
  private readonly tableManagement = inject(TableManagementService);
  private readonly notifications = inject(NotificationService);

  readonly events$: Observable<EventItem[]> = this.eventService.events$;
  selectedEventId = '';
  seatMap: SeatMap | null = null;
  loading = false;

  searchQuery = '';
  selectedSection = 'all';
  selectedStatus = 'all';

  // SVG Pan & Zoom State
  @ViewChild('viewport') viewportRef?: ElementRef<HTMLDivElement>;
  viewBoxX = 0;
  viewBoxY = 0;
  viewBoxW = 1900;
  viewBoxH = 2120;
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private startViewX = 0;
  private startViewY = 0;

  ngOnInit(): void {
    this.eventService.getEvents().subscribe((events) => {
      if (events.length > 0 && !this.selectedEventId) {
        this.selectedEventId = events[0].id;
        this.loadSeatMap();
      }
    });
  }

  onEventChange(): void {
    this.loadSeatMap();
  }

  loadSeatMap(): void {
    if (!this.selectedEventId) return;
    this.loading = true;
    this.seatMap = null;

    this.bookingService.getSeatMap(this.selectedEventId).subscribe({
      next: (mapData) => {
        this.seatMap = mapData ?? null;
        this.loading = false;
        this.resetView();
      },
      error: () => {
        this.seatMap = null;
        this.loading = false;
      }
    });
  }

  get allTables(): SeatTable[] {
    const raw = this.seatMap?.tables ?? [];
    return raw.map((table) => {
      const num = Number(table.label);
      let sectionName = table.sectionName || 'Diamante';
      if (Number.isFinite(num) && num > 0) {
        if (num <= 100) sectionName = 'Diamante';
        else if (num <= 180) sectionName = 'VIP';
        else sectionName = 'General';
      }
      return {
        ...table,
        sectionName
      };
    });
  }

  get sections(): string[] {
    const list = new Set(this.allTables.map((t) => t.sectionName));
    return ['Diamante', 'VIP', 'General'].filter((s) => list.has(s) || this.allTables.some((t) => t.sectionName === s));
  }

  get disabledCount(): number {
    return this.allTables.filter((t) => this.isTableDisabled(t.label)).length;
  }

  get enabledCount(): number {
    return this.allTables.length - this.disabledCount;
  }

  get filteredTables(): SeatTable[] {
    return this.allTables.filter((t) => {
      const matchSearch = !this.searchQuery.trim() || t.label.toLowerCase().includes(this.searchQuery.trim().toLowerCase());
      const matchSection = this.selectedSection === 'all' || t.sectionName === this.selectedSection;
      const isDisabled = this.isTableDisabled(t.label);
      const matchStatus = this.selectedStatus === 'all'
        || (this.selectedStatus === 'disabled' && isDisabled)
        || (this.selectedStatus === 'enabled' && !isDisabled);

      return matchSearch && matchSection && matchStatus;
    });
  }

  sectionTagClass(sectionName: string): string {
    const s = (sectionName || '').toLowerCase();
    if (s.includes('diamante')) return 'tag-diamante';
    if (s.includes('vip')) return 'tag-vip';
    if (s.includes('general')) return 'tag-general';
    return '';
  }

  isTableDisabled(tableLabel: string): boolean {
    return this.tableManagement.isTableDisabled(this.selectedEventId, tableLabel);
  }

  toggleTable(tableLabel: string): void {
    if (!this.selectedEventId || !tableLabel) return;
    this.tableManagement.toggleTable(this.selectedEventId, tableLabel).subscribe((isDisabled) => {
      if (isDisabled) {
        this.notifications.warning(`Mesa ${tableLabel} deshabilitada (marcada en rojo).`);
      } else {
        this.notifications.success(`Mesa ${tableLabel} habilitada.`);
      }
    });
  }

  enableAll(): void {
    if (!this.selectedEventId) return;
    this.tableManagement.enableAllTables(this.selectedEventId).subscribe();
  }

  disableFiltered(): void {
    if (!this.selectedEventId || this.filteredTables.length === 0) return;
    const labels = this.filteredTables.map((t) => t.label);
    this.tableManagement.disableMultipleTables(this.selectedEventId, labels).subscribe();
  }

  // Pan & Zoom
  resetView(): void {
    if (!this.seatMap) return;
    this.viewBoxX = 0;
    this.viewBoxY = 0;
    this.viewBoxW = this.seatMap.width || 1900;
    this.viewBoxH = this.seatMap.height || 2120;
  }

  zoomIn(): void {
    const factor = 0.8;
    const nextW = this.viewBoxW * factor;
    const nextH = this.viewBoxH * factor;
    this.viewBoxX += (this.viewBoxW - nextW) / 2;
    this.viewBoxY += (this.viewBoxH - nextH) / 2;
    this.viewBoxW = nextW;
    this.viewBoxH = nextH;
  }

  zoomOut(): void {
    const factor = 1.25;
    const nextW = this.viewBoxW * factor;
    const nextH = this.viewBoxH * factor;
    this.viewBoxX += (this.viewBoxW - nextW) / 2;
    this.viewBoxY += (this.viewBoxH - nextH) / 2;
    this.viewBoxW = nextW;
    this.viewBoxH = nextH;
  }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    if (e.deltaY < 0) {
      this.zoomIn();
    } else {
      this.zoomOut();
    }
  }

  onMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    this.isPanning = true;
    this.panStartX = e.clientX;
    this.panStartY = e.clientY;
    this.startViewX = this.viewBoxX;
    this.startViewY = this.viewBoxY;
  }

  onMouseMove(e: MouseEvent): void {
    if (!this.isPanning || !this.viewportRef) return;
    const rect = this.viewportRef.nativeElement.getBoundingClientRect();
    const scaleX = this.viewBoxW / rect.width;
    const scaleY = this.viewBoxH / rect.height;
    this.viewBoxX = this.startViewX - (e.clientX - this.panStartX) * scaleX;
    this.viewBoxY = this.startViewY - (e.clientY - this.panStartY) * scaleY;
  }

  onMouseUp(): void {
    this.isPanning = false;
  }
}
