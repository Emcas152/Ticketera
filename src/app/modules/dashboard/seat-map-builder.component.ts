import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';

interface SectionDef {
  id: string;
  name: string;
  price: number;
  tableCount: number;
  color: string;
}

interface PreviewTable {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sectionId: string;
  color: string;
}

interface PreviewSeat {
  cx: number;
  cy: number;
  color: string;
}

interface PreviewSectionBand {
  id: string;
  name: string;
  color: string;
  price: number;
  bandY: number;
  bandH: number;
}

const TABLE_W      = 72;
const TABLE_H      = 138;
const SEAT_OFFSET  = 34;
const SEAT_SPACING = 28;
const SEAT_RADIUS  = 12;
const CANVAS_W     = 680;
const COLS         = 3;

// Pre-computed x positions for 1, 2, 3 tables centred in CANVAS_W
const COL_START_X: Record<number, number[]> = {
  1: [304],
  2: [209, 399],
  3: [114, 304, 494]
};

@Component({
  selector: 'app-seat-map-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ...MATERIAL_IMPORTS],
  template: `
    <section class="builder-root">

      <!-- Page header -->
      <div class="builder-header">
        <div class="builder-header-text">
          <p class="eyebrow">Herramientas · Administración</p>
          <h1>Crear Mapa de Asientos</h1>
          <p class="header-desc">Configura secciones, mesas y zonas de capacidad para un evento.</p>
        </div>
        <a mat-stroked-button routerLink="/dashboard" class="back-btn">
          <mat-icon>arrow_back</mat-icon>
          Volver al panel
        </a>
      </div>

      <div class="builder-layout">

        <!-- ── Configuration panel ── -->
        <aside class="config-panel panel-surface">

          <div class="config-top">
            <strong class="config-title">Configuración</strong>
            <button
              mat-stroked-button
              type="button"
              (click)="addSection()"
              [disabled]="sections.length >= 5"
            >
              <mat-icon>add</mat-icon>
              Sección
            </button>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>Nombre del Venue</mat-label>
            <input matInput [(ngModel)]="venueName" placeholder="Ej: Foro Central">
            <mat-icon matSuffix>location_on</mat-icon>
          </mat-form-field>

          <div class="sections-list">
            @for (section of sections; track section.id; let i = $index) {
            <div class="section-item">

              <div class="section-item-header">
                <span class="color-dot" [style.background]="section.color"></span>
                <span class="section-index">Sección {{ i + 1 }}</span>
                <button
                  mat-icon-button
                  type="button"
                  class="delete-btn"
                  (click)="removeSection(i)"
                  [disabled]="sections.length <= 1"
                  matTooltip="Eliminar sección"
                >
                  <mat-icon>delete_outline</mat-icon>
                </button>
              </div>

              <mat-form-field appearance="outline">
                <mat-label>Nombre</mat-label>
                <input matInput [(ngModel)]="section.name" placeholder="Ej: MESAS VIP">
              </mat-form-field>

              <div class="two-col">
                <mat-form-field appearance="outline">
                  <mat-label>Precio base (Q)</mat-label>
                  <input matInput type="number" [(ngModel)]="section.price" min="0">
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Mesas</mat-label>
                  <input matInput type="number" [(ngModel)]="section.tableCount" min="1" max="9">
                  <mat-hint>Máx. 9</mat-hint>
                </mat-form-field>
              </div>

              <div class="color-row">
                <span class="color-row-label">Color de sección</span>
                <div class="color-swatches">
                  @for (c of colorOptions; track c.value) {
                  <button
                    class="swatch"
                    type="button"
                    [style.background]="c.value"
                    [class.swatch-active]="section.color === c.value"
                    (click)="section.color = c.value"
                    [matTooltip]="c.label"
                  ></button>
                  }
                </div>
              </div>

            </div>
            } <!-- /@for sections -->
          </div>

          <div class="config-summary">
            <div class="summary-row">
              <span>Total secciones</span>
              <strong>{{ sections.length }}</strong>
            </div>
            <div class="summary-row">
              <span>Total mesas</span>
              <strong>{{ totalTables }}</strong>
            </div>
            <div class="summary-row">
              <span>Total asientos</span>
              <strong>{{ totalSeats }}</strong>
            </div>
          </div>

          <button mat-flat-button type="button" class="save-btn" (click)="saveMap()">
            <mat-icon>save</mat-icon>
            Guardar Mapa
          </button>

        </aside>

        <!-- ── Preview panel ── -->
        <div class="preview-panel panel-surface">

          <div class="preview-top">
            <div>
              <strong class="config-title">Vista previa del venue</strong>
              <p class="preview-subtitle">{{ venueName || 'Venue sin nombre' }} &mdash; {{ totalSeats }} asientos en {{ totalTables }} mesas</p>
            </div>
            <div class="preview-legend">
              @for (s of sections; track s.id) {
              <div class="legend-item">
                <span class="legend-dot" [style.background]="s.color"></span>
                {{ s.name || 'Sección' }}
              </div>
              }
              <div class="legend-item">
                <span class="legend-dot unavailable"></span>
                No disponible
              </div>
            </div>
          </div>

          <div class="svg-wrapper">
            <svg
              [attr.viewBox]="'0 0 ' + CANVAS_W + ' ' + previewData.totalHeight"
              preserveAspectRatio="xMidYMin meet"
              width="100%"
            >
              <!-- Canvas background -->
              <rect
                x="0" y="0"
                [attr.width]="CANVAS_W"
                [attr.height]="previewData.totalHeight"
                fill="#eef0f4"
              />

              <!-- Stage / header label -->
              <rect x="180" y="12" width="320" height="30" rx="8" fill="rgba(21,34,52,0.08)" />
              <text x="340" y="32" text-anchor="middle" class="svg-stage-label">ESCENARIO / PALCO</text>

              <!-- Section bands -->
              @for (band of previewData.sections; track band.id) {
              <g>
                <rect
                  [attr.x]="16"
                  [attr.y]="band.bandY"
                  [attr.width]="CANVAS_W - 32"
                  [attr.height]="band.bandH"
                  rx="14"
                  [attr.fill]="band.color"
                  opacity="0.07"
                />
                <text
                  [attr.x]="30"
                  [attr.y]="band.bandY + 26"
                  class="svg-section-label"
                  [attr.fill]="band.color"
                >{{ band.name || 'SECCIÓN' }} — Q{{ band.price }}</text>
              </g>
              } <!-- /@for sections -->

              <!-- Tables -->
              @for (t of previewData.tables; track t.id) {
              <g>
                <rect
                  [attr.x]="t.x"
                  [attr.y]="t.y"
                  [attr.width]="t.w"
                  [attr.height]="t.h"
                  rx="16"
                  fill="rgba(210,213,220,0.92)"
                  stroke="rgba(255,255,255,0.7)"
                  stroke-width="7"
                  style="filter: drop-shadow(0 6px 10px rgba(17,24,39,0.08))"
                />
                <text
                  [attr.x]="t.x + t.w / 2"
                  [attr.y]="t.y + t.h / 2 + 10"
                  text-anchor="middle"
                  class="svg-table-label"
                >T{{ t.label }}</text>
              </g>
              } <!-- /@for tables -->

              <!-- Seats -->
              @for (s of previewData.seats; track $index) {
              <circle
                [attr.cx]="s.cx"
                [attr.cy]="s.cy"
                [attr.r]="SEAT_RADIUS"
                [attr.fill]="s.color"
                fill-opacity="0.72"
                stroke="white"
                stroke-width="2.5"
              />
              } <!-- /@for seats -->
            </svg>
          </div>

          <div class="section-stats-row">
            @for (s of sections; track s.id) {
            <div class="section-stat">
              <span class="stat-dot" [style.background]="s.color"></span>
              <div>
                <strong>{{ s.name || 'Sección' }}</strong>
                <p>{{ s.tableCount }} mesas &bull; {{ s.tableCount * 8 }} asientos &bull; Q{{ s.price }}/asiento</p>
              </div>
            </div>
            } <!-- /@for stats -->
          </div>

        </div>
      </div>

    </section>
  `,
  styles: [`
    .builder-root {
      display: grid;
      gap: 24px;
    }

    /* ── Header ── */
    .builder-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 20px 24px;
      border-radius: var(--radius-lg);
      background: linear-gradient(135deg, #0f1c2e 0%, #1a2e4a 100%);
      border: 1px solid rgba(255,255,255,0.06);
      box-shadow: var(--shadow-soft);
      color: #fff;
    }

    .builder-header-text { display: grid; gap: 4px; }

    .builder-header .eyebrow {
      color: rgba(74, 158, 255, 0.85);
      font-size: 0.7rem;
      margin: 0;
    }

    .builder-header h1 {
      color: #fff;
      font-size: 1.5rem;
      margin: 0;
    }

    .header-desc {
      margin: 0;
      color: rgba(255,255,255,0.5);
      font-size: 0.83rem;
    }

    .back-btn {
      flex-shrink: 0;
      color: rgba(255,255,255,0.8) !important;
      border-color: rgba(255,255,255,0.2) !important;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .back-btn:hover {
      background: rgba(255,255,255,0.07) !important;
      color: #fff !important;
    }

    /* ── Layout ── */
    .builder-layout {
      display: grid;
      grid-template-columns: 380px minmax(0, 1fr);
      gap: 24px;
      align-items: start;
    }

    /* ── Config panel ── */
    .config-panel {
      display: grid;
      gap: 18px;
    }

    .config-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .config-title {
      font-size: 1rem;
      font-weight: 700;
    }

    .sections-list {
      display: grid;
      gap: 16px;
    }

    .section-item {
      display: grid;
      gap: 12px;
      padding: 16px;
      border-radius: 12px;
      background: #f8fafc;
      border: 1px solid var(--surface-border);
    }

    .section-item-header {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .color-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      flex-shrink: 0;
      border: 2px solid rgba(0,0,0,0.1);
    }

    .section-index {
      flex: 1;
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--text-muted);
    }

    .delete-btn {
      margin: -8px -8px -8px auto;
      color: var(--text-muted);
    }

    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .color-row {
      display: grid;
      gap: 8px;
    }

    .color-row-label {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
    }

    .color-swatches {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .swatch {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      transition: transform 0.15s ease, border-color 0.15s ease;
    }

    .swatch:hover { transform: scale(1.15); }

    .swatch.swatch-active {
      border-color: var(--text-primary);
      transform: scale(1.18);
    }

    .config-summary {
      display: grid;
      gap: 8px;
      padding: 14px 16px;
      border-radius: 10px;
      background: #f0f4f8;
      border: 1px solid var(--surface-border);
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
    }

    .summary-row span { color: var(--text-muted); }

    .save-btn {
      width: 100%;
      height: 48px;
      font-size: 0.95rem;
      font-weight: 700;
      background: var(--brand-primary) !important;
      color: #fff !important;
      border-radius: 10px !important;
    }

    /* ── Preview panel ── */
    .preview-panel {
      display: grid;
      gap: 20px;
    }

    .preview-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      flex-wrap: wrap;
    }

    .preview-subtitle {
      margin: 4px 0 0;
      font-size: 0.83rem;
      color: var(--text-muted);
    }

    .preview-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 18px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 0.78rem;
      color: var(--text-muted);
      font-weight: 600;
    }

    .legend-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .legend-dot.unavailable {
      background: #c4c9d4;
    }

    .svg-wrapper {
      background: #eef0f4;
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid var(--surface-border);
    }

    /* SVG text styles */
    :host ::ng-deep .svg-stage-label {
      font-size: 11px;
      font-family: 'Bahnschrift', 'Arial Narrow', sans-serif;
      fill: rgba(21, 34, 52, 0.45);
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    :host ::ng-deep .svg-section-label {
      font-size: 13px;
      font-family: 'Bahnschrift', 'Arial Narrow', sans-serif;
      font-weight: 700;
      letter-spacing: 0.08em;
    }

    :host ::ng-deep .svg-table-label {
      font-size: 20px;
      font-family: 'Bahnschrift', 'Arial Narrow', sans-serif;
      font-weight: 700;
      fill: rgba(55, 65, 81, 0.75);
    }

    /* ── Section stats ── */
    .section-stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 12px;
    }

    .section-stat {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 10px;
      background: #f8fafc;
      border: 1px solid var(--surface-border);
    }

    .stat-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
      margin-top: 5px;
    }

    .section-stat strong {
      display: block;
      font-size: 0.85rem;
      margin-bottom: 3px;
    }

    .section-stat p {
      margin: 0;
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    /* ── Responsive ── */
    @media (max-width: 1100px) {
      .builder-layout { grid-template-columns: 1fr; }
    }

    @media (max-width: 768px) {
      .builder-header  { flex-direction: column; align-items: flex-start; }
      .back-btn        { width: 100%; justify-content: center; }
      .two-col         { grid-template-columns: 1fr; }
    }
  `]
})
export class SeatMapBuilderComponent {
  private readonly snackBar = inject(MatSnackBar);

  readonly CANVAS_W    = CANVAS_W;
  readonly SEAT_RADIUS = SEAT_RADIUS;
  readonly currentYear = new Date().getFullYear();

  venueName = '';

  sections: SectionDef[] = [
    { id: '1', name: 'MESAS AMEX',     price: 1200, tableCount: 3, color: '#1e3a5f' },
    { id: '2', name: 'MESAS BLACK',    price: 900,  tableCount: 3, color: '#374151' },
    { id: '3', name: 'MESAS PLATINUM', price: 600,  tableCount: 3, color: '#64748b' }
  ];

  readonly colorOptions = [
    { label: 'Navy',     value: '#1e3a5f' },
    { label: 'Charcoal', value: '#374151' },
    { label: 'Slate',    value: '#475569' },
    { label: 'Steel',    value: '#64748b' },
    { label: 'Midnight', value: '#1f2937' },
    { label: 'Graphite', value: '#6b7280' },
    { label: 'Cobalt',   value: '#1d4ed8' },
    { label: 'Forest',   value: '#166534' }
  ];

  get totalTables(): number {
    return this.sections.reduce((sum, s) => sum + Number(s.tableCount || 0), 0);
  }

  get totalSeats(): number {
    return this.totalTables * 8;
  }

  get previewData(): {
    sections: PreviewSectionBand[];
    tables: PreviewTable[];
    seats: PreviewSeat[];
    totalHeight: number;
  } {
    const sections: PreviewSectionBand[] = [];
    const tables: PreviewTable[]         = [];
    const seats: PreviewSeat[]           = [];

    let currentY = 55;

    for (const section of this.sections) {
      const count     = Math.max(1, Math.min(Number(section.tableCount) || 1, 9));
      const rowCount  = Math.ceil(count / COLS);
      const bandH     = rowCount * (TABLE_H + 60) + 50;
      const bandY     = currentY;

      for (let i = 0; i < count; i++) {
        const col           = i % COLS;
        const row           = Math.floor(i / COLS);
        const tablesInRow   = Math.min(COLS, count - row * COLS);
        const colXForRow    = COL_START_X[tablesInRow] ?? COL_START_X[3];
        const tableX        = colXForRow[col];
        const tableY        = currentY + 42 + row * (TABLE_H + 60);

        tables.push({
          id: `${section.id}-t${i}`,
          x: tableX,
          y: tableY,
          w: TABLE_W,
          h: TABLE_H,
          label: String(i + 1),
          sectionId: section.id,
          color: section.color
        });

        for (let s = 0; s < 4; s++) {
          const seatY = tableY + 24 + s * SEAT_SPACING;
          seats.push({ cx: tableX - SEAT_OFFSET, cy: seatY, color: section.color });
          seats.push({ cx: tableX + TABLE_W + SEAT_OFFSET, cy: seatY, color: section.color });
        }
      }

      sections.push({
        id:    section.id,
        name:  section.name,
        color: section.color,
        price: section.price,
        bandY,
        bandH
      });

      currentY += bandH + 20;
    }

    return { sections, tables, seats, totalHeight: currentY + 20 };
  }

  addSection(): void {
    if (this.sections.length >= 5) return;
    const id = String(Date.now());
    this.sections = [
      ...this.sections,
      { id, name: '', price: 500, tableCount: 3, color: '#475569' }
    ];
  }

  removeSection(index: number): void {
    if (this.sections.length <= 1) return;
    this.sections = this.sections.filter((_, i) => i !== index);
  }

  saveMap(): void {
    const config = {
      venue:    this.venueName || 'Sin nombre',
      sections: this.sections.map((s) => ({
        name:       s.name || 'Sección',
        price:      s.price,
        tableCount: s.tableCount,
        seatCount:  s.tableCount * 8,
        color:      s.color
      })),
      totalSeats:  this.totalSeats,
      totalTables: this.totalTables
    };

    console.log('[SeatMapBuilder] Mapa generado:', config);

    this.snackBar.open(
      `Mapa guardado — ${this.totalSeats} asientos en ${this.totalTables} mesas`,
      'OK',
      { duration: 4000, panelClass: ['success-toast'] }
    );
  }
}
