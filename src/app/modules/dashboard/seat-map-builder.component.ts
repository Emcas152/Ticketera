import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, forkJoin, of } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Venue } from '../../core/models/venue.model';
import { VenueService } from '../../core/services/venue.service';
import { ApiService } from '../../core/services/api.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';

type ElementKind = 'stage' | 'bathrooms' | 'entrance' | 'zone';

interface SectionDef {
  id: string;
  name: string;
  price: number;
  tableCount: number;
  color: string;
  tableNumbers?: number[];
  seatsPerTable?: Record<number, number>;
}

interface PlanElement {
  id: string;
  kind: ElementKind;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  textColor: string;
  rotation: number;
}

interface PreviewTable {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sectionId: string;
  sectionName: string;
  color: string;
  rotation: number;
}

interface PreviewSeat {
  cx: number;
  cy: number;
  color: string;
  tableId: string;
  number: number;
}

const CANVAS_W = 1900;
const CANVAS_H = 2120;
const FLOOR_W = 1900;
const TABLE_W = 32;
const TABLE_H = 78;
const SEAT_OFFSET = 10;
const SEAT_SPACING = 14;
const SEAT_RADIUS = 6.5;

function calculateReferenceTablePosition(tableNumber: number): { x: number; y: number; rotation: number } {
  let sectionIndex: number;
  let globalRow: number;

  if (tableNumber <= 100) {
    sectionIndex = tableNumber - 1;
    globalRow = Math.floor(sectionIndex / 20);
  } else if (tableNumber <= 180) {
    sectionIndex = tableNumber - 101;
    globalRow = Math.floor(sectionIndex / 20) + 5;
  } else {
    sectionIndex = tableNumber - 181;
    globalRow = Math.floor(sectionIndex / 20) + 9;
  }

  const centerX = 150 + (sectionIndex % 20) * 84;
  const centerY = globalRow < 5
    ? 170 + globalRow * 145
    : globalRow < 9
      ? 980 + (globalRow - 5) * 145
      : 1660 + (globalRow - 9) * 145;

  return {
    x: centerX - TABLE_W / 2,
    y: centerY - TABLE_H / 2,
    rotation: 0
  };
}

@Component({
  selector: 'app-seat-map-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ...MATERIAL_IMPORTS],
  template: `
    <section class="builder-root">
      <div class="builder-header">
        <div>
          <p class="eyebrow">Herramientas - Administracion</p>
          <h1>Crear mapa de asientos</h1>
          <p class="header-desc">Edita escenario, zonas, mesas, poster, banos e ingreso desde el plano.</p>
        </div>
        <a mat-stroked-button routerLink="/dashboard" class="back-btn">
          <mat-icon>arrow_back</mat-icon>
          Volver al panel
        </a>
      </div>

      <div class="builder-layout">
        <aside class="config-panel panel-surface">
          <div class="config-top">
            <strong class="config-title">Secciones</strong>
            <button mat-stroked-button type="button" (click)="addSection()" [disabled]="sections.length >= 5">
              <mat-icon>add</mat-icon>
              Seccion
            </button>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>Venue</mat-label>
            <mat-select [(ngModel)]="selectedVenueId" (selectionChange)="onVenueSelectionChange()">
              @for (venue of venues; track venue.id) {
              <mat-option [value]="venue.id">{{ venue.name }}</mat-option>
              }
            </mat-select>
            <mat-icon matSuffix>location_on</mat-icon>
          </mat-form-field>

          <div class="sections-list">
            @for (section of sections; track section.id; let i = $index) {
            <div class="section-item">
              <div class="section-item-header">
                <span class="color-dot" [style.background]="section.color"></span>
                <span class="section-index">Seccion {{ i + 1 }}</span>
                <button mat-icon-button type="button" (click)="removeSection(i)" [disabled]="sections.length <= 1">
                  <mat-icon>delete_outline</mat-icon>
                </button>
              </div>
              <mat-form-field appearance="outline">
                <mat-label>Nombre</mat-label>
                <input matInput [(ngModel)]="section.name">
              </mat-form-field>
              <div class="two-col">
                <mat-form-field appearance="outline">
                  <mat-label>Precio Q</mat-label>
                  <input matInput type="number" [(ngModel)]="section.price" min="0">
                </mat-form-field>
                <div class="table-counter">
                  <span>Mesas</span>
                  <strong>{{ section.tableCount }}</strong>
                </div>
              </div>
              <div class="section-actions">
                <button mat-stroked-button type="button" (click)="addTableToSection(section, i)" [disabled]="section.tableCount >= 20">
                  <mat-icon>add_circle_outline</mat-icon>
                  Agregar mesa
                </button>
                <button mat-icon-button type="button" (click)="removeTableFromSection(section)" [disabled]="section.tableCount <= 0">
                  <mat-icon>remove_circle_outline</mat-icon>
                </button>
              </div>
              <div class="color-swatches">
                @for (color of colorOptions; track color.value) {
                <button
                  class="swatch"
                  type="button"
                  [style.background]="color.value"
                  [class.swatch-active]="section.color === color.value"
                  (click)="section.color = color.value"
                  [matTooltip]="color.label"
                ></button>
                }
              </div>
            </div>
            }
          </div>

          <div class="tool-panel">
            <strong class="config-title">Elementos del plano</strong>
            <div class="tool-grid">
              <button mat-stroked-button type="button" (click)="addZone('Zona VIP', '#dbeafe')">
                <mat-icon>layers</mat-icon>
                Zona VIP
              </button>
              <button mat-stroked-button type="button" (click)="addZone('Zona General', '#dcfce7')">
                <mat-icon>layers</mat-icon>
                Zona General
              </button>
              <button mat-stroked-button type="button" (click)="addPlanElement('entrance')">
                <mat-icon>login</mat-icon>
                Ingreso
              </button>
              <button mat-stroked-button type="button" (click)="addPlanElement('bathrooms')">
                <mat-icon>wc</mat-icon>
                Banos
              </button>
            </div>
            <div class="element-list">
              @for (element of planElements; track element.id) {
              <button
                type="button"
                class="element-chip"
                [class.is-active]="selectedElementId === element.id"
                (click)="selectElement(element.id)"
              >
                <span [style.background]="element.color"></span>
                {{ element.label }}
              </button>
              }
            </div>
          </div>

          @if (selectedTable) {
          <div class="edit-panel">
            <strong>Mesa {{ selectedTable.label }}</strong>
            <p>{{ selectedTable.sectionName }}</p>
            <div class="two-col">
              <mat-form-field appearance="outline">
                <mat-label>X</mat-label>
                <input matInput type="number" [ngModel]="selectedTable.x" (ngModelChange)="updateSelectedTablePosition('x', $event)">
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Y</mat-label>
                <input matInput type="number" [ngModel]="selectedTable.y" (ngModelChange)="updateSelectedTablePosition('y', $event)">
              </mat-form-field>
            </div>
            <div class="orientation-row">
              <button mat-icon-button type="button" (click)="rotateSelectedTable(-15)">
                <mat-icon>rotate_left</mat-icon>
              </button>
              <button mat-stroked-button type="button" (click)="setSelectedTableRotation(0)">
                {{ selectedTable.rotation }}&deg;
              </button>
              <button mat-icon-button type="button" (click)="rotateSelectedTable(15)">
                <mat-icon>rotate_right</mat-icon>
              </button>
            </div>
          </div>
          }

          @if (selectedElement) {
          <div class="edit-panel">
            <div class="panel-title-row">
              <strong>{{ selectedElement.label }}</strong>
              @if (selectedElement.kind !== 'stage') {
              <button mat-icon-button type="button" (click)="deleteSelectedElement()">
                <mat-icon>delete_outline</mat-icon>
              </button>
              }
            </div>
            <mat-form-field appearance="outline">
              <mat-label>Etiqueta</mat-label>
              <input matInput [(ngModel)]="selectedElement.label">
            </mat-form-field>
            <div class="two-col">
              <mat-form-field appearance="outline">
                <mat-label>X</mat-label>
                <input matInput type="number" [(ngModel)]="selectedElement.x">
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Y</mat-label>
                <input matInput type="number" [(ngModel)]="selectedElement.y">
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Ancho</mat-label>
                <input matInput type="number" [(ngModel)]="selectedElement.w" min="20">
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Alto</mat-label>
                <input matInput type="number" [(ngModel)]="selectedElement.h" min="20">
              </mat-form-field>
            </div>
            <div class="orientation-row">
              <button mat-icon-button type="button" (click)="rotateSelectedElement(-15)">
                <mat-icon>rotate_left</mat-icon>
              </button>
              <button mat-stroked-button type="button" (click)="setSelectedElementRotation(0)">
                {{ selectedElement.rotation }}&deg;
              </button>
              <button mat-icon-button type="button" (click)="rotateSelectedElement(15)">
                <mat-icon>rotate_right</mat-icon>
              </button>
            </div>
          </div>
          }

          <div class="config-summary">
            <div class="summary-row"><span>Total mesas</span><strong>{{ totalTables }}</strong></div>
            <div class="summary-row"><span>Total asientos</span><strong>{{ totalSeats }}</strong></div>
            <div class="summary-row"><span>Zonas</span><strong>{{ zoneCount }}</strong></div>
          </div>

          <button mat-flat-button type="button" class="save-btn" (click)="saveMap()">
            <mat-icon>save</mat-icon>
            Guardar mapa
          </button>
        </aside>

        <div class="preview-panel panel-surface">
          <div class="preview-top">
            <div>
              <strong class="config-title">Editor visual</strong>
              <p class="preview-subtitle">{{ venueName || 'Venue sin nombre' }} - {{ totalSeats }} asientos</p>
            </div>
            <button mat-stroked-button type="button" (click)="resetLayout()">
              <mat-icon>restart_alt</mat-icon>
              Reiniciar plano
            </button>
          </div>

          <div class="svg-wrapper">
            <svg
              #venueSvg
              [attr.viewBox]="viewBoxX + ' ' + viewBoxY + ' ' + viewBoxW + ' ' + viewBoxH"
              preserveAspectRatio="xMidYMid meet"
              width="100%"
              height="100%"
              [class.is-panning]="isPanning"
              (wheel)="onCanvasWheel($event, venueSvg)"
              (pointerdown)="startCanvasPan($event, venueSvg)"
              (pointermove)="onCanvasPointerMove($event, venueSvg)"
              (pointerup)="endDrag($event, venueSvg)"
              (pointerleave)="endDrag()"
            >
              <rect x="0" y="0" [attr.width]="CANVAS_W" [attr.height]="CANVAS_H" fill="#a7a7a7" />

              @for (element of sortedElements; track element.id) {
              <g
                class="plan-element"
                [class.is-selected]="selectedElementId === element.id"
                [attr.transform]="elementTransform(element)"
                (pointerdown)="startElementDrag(element, $event, venueSvg)"
              >
                @switch (element.kind) {
                  @case ('stage') {
                    <rect [attr.width]="element.w" [attr.height]="element.h" rx="6" [attr.fill]="element.color" />
                    <rect x="45" y="0" width="24" [attr.height]="element.h" fill="#f8fafc" opacity="0.92" />
                    <rect [attr.x]="element.w - 70" y="0" width="24" [attr.height]="element.h" fill="#f8fafc" opacity="0.92" />
                    <text [attr.x]="element.w / 2" [attr.y]="element.h / 2 + 13" text-anchor="middle" class="stage-label">{{ element.label }}</text>
                  }
                  @case ('bathrooms') {
                    <rect [attr.width]="element.w" [attr.height]="element.h" rx="5" [attr.fill]="element.color" />
                    <text [attr.x]="element.w / 2" y="42" text-anchor="middle" class="bathroom-title">{{ element.label }}</text>
                    <text [attr.x]="element.w * 0.36" [attr.y]="element.h - 44" text-anchor="middle" class="bathroom-icon">W</text>
                    <text [attr.x]="element.w * 0.68" [attr.y]="element.h - 44" text-anchor="middle" class="bathroom-icon">M</text>
                  }
                  @case ('entrance') {
                    <path [attr.d]="entryArrowPath(element.w, element.h)" [attr.fill]="element.color" />
                    <text [attr.x]="element.w / 2" [attr.y]="element.h + 54" text-anchor="middle" class="entry-label">{{ element.label }}</text>
                  }
                  @default {
                    <rect
                      [attr.width]="element.w"
                      [attr.height]="element.h"
                      rx="8"
                      ry="8"
                      class="map-zone-vip-outline"
                      [ngClass]="getZoneClass(element.label)"
                    />
                    <text
                      class="map-zone-section-label"
                      [ngClass]="getSectionLabelClass(element.label)"
                      x="-42"
                      [attr.y]="element.h / 2"
                      [attr.transform]="'rotate(-90 -42 ' + (element.h / 2) + ')'"
                      font-size="27"
                      letter-spacing="0.11em"
                      text-anchor="middle"
                      dominant-baseline="middle"
                      pointer-events="none"
                    >
                      {{ element.label }}
                    </text>
                  }
              }
                @if (selectedElementId === element.id) {
                <g
                  class="resize-handle"
                  [attr.transform]="'translate(' + element.w + ' ' + element.h + ')'"
                  (pointerdown)="startElementResize(element, $event, venueSvg)"
                >
                  <rect x="-13" y="-13" width="26" height="26" rx="5" />
                  <path d="M-5 7 L7 -5 M2 8 L8 2" />
                </g>
                }
              </g>
              }

              @for (t of previewData.tables; track t.id) {
              <g
                class="svg-table-group"
                [class.selected]="selectedTableId === t.id"
                [attr.transform]="'rotate(' + t.rotation + ' ' + (t.x + t.w / 2) + ' ' + (t.y + t.h / 2) + ')'"
                (pointerdown)="startTableDrag(t, $event, venueSvg)"
              >
                <rect
                  [attr.x]="t.x"
                  [attr.y]="t.y"
                  [attr.width]="t.w"
                  [attr.height]="t.h"
                  rx="4"
                  ry="4"
                  class="map-table"
                  [ngClass]="getTableClass(t.sectionName)"
                />
                <text [attr.x]="t.x + t.w / 2" [attr.y]="t.y + t.h / 2" text-anchor="middle" dominant-baseline="middle" class="map-table-label">{{ t.label }}</text>
                
                @if (isRowStart(t.label)) {
                <g class="map-row-marker" [attr.transform]="'translate(' + (t.x - 62) + ' ' + (t.y + t.h / 2) + ')'" pointer-events="none">
                  <circle r="15" fill="#0f172a" stroke="rgba(255, 255, 255, 0.78)" stroke-width="1.5" />
                  <text x="0" y="1" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-size="11" font-weight="800">{{ getRowNumber(t.label) }}</text>
                </g>
                }

                @if (selectedTableId === t.id) {
                <g
                  class="table-rotate-handle"
                  (pointerdown)="startTableRotation(t, $event, venueSvg)"
                >
                  <line
                    [attr.x1]="t.x + t.w / 2"
                    [attr.y1]="t.y"
                    [attr.x2]="t.x + t.w / 2"
                    [attr.y2]="t.y - 22"
                  />
                  <circle [attr.cx]="t.x + t.w / 2" [attr.cy]="t.y - 22" r="8" />
                  <path
                    [attr.d]="'M ' + (t.x + t.w / 2 - 3) + ' ' + (t.y - 25) + ' A 5 5 0 1 1 ' + (t.x + t.w / 2 + 4) + ' ' + (t.y - 18)"
                  />
                </g>
                }
              </g>
              }

              @for (s of previewData.seats; track $index) {
              <circle
                [class.selected-seat]="selectedTableId === s.tableId"
                [attr.cx]="s.cx"
                [attr.cy]="s.cy"
                [attr.r]="SEAT_RADIUS"
                [ngClass]="getSeatClass(s.color, s.tableId)"
              />
              <text [attr.x]="s.cx" [attr.y]="s.cy + 1" text-anchor="middle" dominant-baseline="middle" class="seat-number">{{ s.number }}</text>
              }
            </svg>

            <!-- Floating Controls matching alconProducciones -->
            <div class="map-controls-bar">
              <button type="button" class="control-btn center-btn" (click)="resetViewport()">Centrar</button>
              <button type="button" class="control-btn zoom-icon-btn" (click)="zoomIn()">+</button>
              <button type="button" class="control-btn zoom-icon-btn" (click)="zoomOut()">&minus;</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .builder-root{display:grid;gap:24px}.builder-header{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:20px 24px;border-radius:var(--radius-lg);background:#142238;color:#fff}.eyebrow{margin:0;color:#78b7ff;font-size:.72rem;text-transform:uppercase;letter-spacing:.08em}.builder-header h1{margin:0;color:#fff;font-size:1.5rem}.header-desc,.preview-subtitle,.edit-panel p{margin:4px 0 0;color:var(--text-muted);font-size:.84rem}.back-btn{color:#fff!important;border-color:rgba(255,255,255,.28)!important}.builder-layout{display:grid;grid-template-columns:380px minmax(0,1fr);gap:24px;align-items:start}.config-panel,.preview-panel{display:grid;gap:18px}.config-top,.preview-top,.section-item-header,.panel-title-row,.section-actions{display:flex;align-items:center;justify-content:space-between;gap:12px}.preview-top{flex-wrap:wrap}.config-title{font-weight:800}.sections-list{display:grid;gap:14px;max-height:460px;overflow:auto;padding-right:4px}.section-item,.tool-panel,.edit-panel,.config-summary{display:grid;gap:12px;padding:14px;border:1px solid var(--surface-border);border-radius:12px;background:#f8fafc}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:10px}.table-counter{display:flex;align-items:center;justify-content:space-between}.color-dot{width:14px;height:14px;border-radius:50%;border:2px solid rgba(0,0,0,.12)}.section-index{flex:1;font-size:.74rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted)}.color-swatches{display:flex;gap:8px;flex-wrap:wrap}.swatch{width:28px;height:28px;border-radius:50%;border:2px solid transparent;cursor:pointer}.swatch-active{border-color:#111827}.tool-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.element-list{display:flex;flex-wrap:wrap;gap:8px}.element-chip{display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--surface-border);border-radius:8px;background:#fff;color:#111827;font-weight:700;cursor:pointer}.element-chip span{width:12px;height:12px;border-radius:50%}.element-chip.is-active{border-color:#111827;box-shadow:0 0 0 2px rgba(17,24,39,.08)}.orientation-row{display:grid;grid-template-columns:44px 1fr 44px;gap:8px;align-items:center}.summary-row{display:flex;justify-content:space-between;font-size:.86rem}.summary-row span{color:var(--text-muted)}.save-btn{height:48px;border-radius:10px!important;font-weight:800}.svg-wrapper{position:relative;display:grid;place-items:center;height:clamp(520px,68vh,820px);background:#a8a8a8!important;border:1px solid var(--surface-border);border-radius:12px;overflow:hidden;padding:0}.svg-wrapper svg{display:block;width:100%;height:100%;min-width:0;cursor:grab;touch-action:none;user-select:none}.svg-wrapper svg.is-panning{cursor:grabbing}.plan-element,.svg-table-group{cursor:grab}.plan-element.is-selected>rect,.svg-table-group.selected rect{stroke:#111827;stroke-width:3}.table-rotate-handle line{stroke:#111827;stroke-width:2}.table-rotate-handle circle{fill:#111827;stroke:#fff;stroke-width:2}.resize-handle{cursor:nwse-resize}.resize-handle rect{fill:#111827;stroke:#fff;stroke-width:2}.resize-handle path{stroke:#fff;stroke-width:2;stroke-linecap:round;fill:none}.selected-seat{stroke:#111827;stroke-width:2.5}.stage-label,.entry-label,.bathroom-title{font-family:Bahnschrift,'Arial Narrow',Arial,sans-serif;font-weight:900;letter-spacing:.06em}.stage-label{font-size:34px;fill:#fff7ed}.entry-label{font-size:42px;fill:#020617}.bathroom-title{font-size:30px;fill:#fff}.bathroom-icon{font-size:44px;font-weight:900;fill:#fff}
    
    /* alconProducciones Zone Styles */
    .map-zone-vip-outline{fill:rgba(69,255,25,.04);stroke:rgba(69,255,25,.42);stroke-width:2.5px;stroke-dasharray:12 8}
    .zone-diamante{fill:rgba(9,31,73,.07);stroke:rgba(9,31,73,.72)}
    .zone-vip{fill:rgba(204,82,0,.06);stroke:rgba(204,82,0,.68)}
    .zone-general{fill:rgba(0,120,120,.06);stroke:rgba(0,150,140,.64)}
    .zone-default{fill:rgba(69,255,25,.04);stroke:rgba(69,255,25,.42);stroke-width:2.5px;stroke-dasharray:12 8}

    /* alconProducciones Section Label Styles */
    .map-zone-section-label{font-weight:900;paint-order:stroke fill;stroke-width:4px;stroke-linejoin:round;filter:drop-shadow(0 3px 3px rgba(0,0,0,.28));letter-spacing:.11em;font-family:Bahnschrift,'Arial Narrow',Arial,sans-serif}
    .section-label-diamante{fill:#ffffff;stroke:#0b2c6b}
    .section-label-vip{fill:#ffffff;stroke:#c94e00}
    .section-label-general{fill:#ffffff;stroke:#007b82}
    .section-label-default{fill:#ffffff;stroke:#1e293b}

    /* Table Styles */
    .map-table{rx:4px;ry:4px;stroke:rgba(255,255,255,.58);stroke-width:1.5px;filter:drop-shadow(0 3px 6px rgba(0,0,0,.22))}
    .map-table-diamante{fill:#0b2c6b}
    .map-table-vip{fill:#e85d04}
    .map-table-general{fill:#008c95}
    .map-table-default{fill:#008c95}
    .map-table-label{fill:#ffffff;font-size:11px;font-weight:800;font-family:sans-serif}

    /* Row Marker */
    .map-row-marker circle{fill:#0f172a;stroke:rgba(255,255,255,.78);stroke-width:1.5px}
    .map-row-marker text{fill:#ffffff;font-size:11px;font-weight:800;font-family:sans-serif}

    /* Seat Styles */
    .seat-number{fill:#ffffff;font-size:8px;font-weight:800;pointer-events:none;font-family:sans-serif}
    .seat-fill-diamante{fill:#091f49;stroke:rgba(255,255,255,.24);stroke-width:1}
    .seat-fill-vip{fill:#e06000;stroke:rgba(255,255,255,.24);stroke-width:1}
    .seat-fill-general{fill:#008080;stroke:rgba(255,255,255,.24);stroke-width:1}

    /* Floating Controls */
    .map-controls-bar{position:absolute;bottom:16px;right:16px;z-index:20;display:flex;border-radius:6px;overflow:hidden;background:#18181b;box-shadow:0 4px 12px rgba(0,0,0,.35)}
    .control-btn{height:36px;border:none;background:#18181b;color:#ffffff;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s}
    .control-btn:hover{background:#27272a}
    .center-btn{padding:0 16px;font-size:12px;text-transform:uppercase;letter-spacing:.14em;border-right:1px solid rgba(255,255,255,.15)}
    .zoom-icon-btn{width:36px;font-size:18px}
    .zoom-icon-btn:first-of-type{border-right:1px solid rgba(255,255,255,.15)}

    @media(max-width:1100px){.builder-layout{grid-template-columns:1fr}.sections-list,.svg-wrapper,.svg-wrapper svg{max-height:none}}@media(max-width:720px){.builder-header{align-items:flex-start;flex-direction:column}.two-col,.tool-grid{grid-template-columns:1fr}.svg-wrapper{padding:10px;min-height:320px}}
    .builder-header{background:var(--brand-gradient)}
  `]
})
export class SeatMapBuilderComponent implements OnInit {
  private readonly snackBar = inject(MatSnackBar);
  private readonly venueService = inject(VenueService);
  private readonly apiService = inject(ApiService);

  isLoadingMap = false;
  isSavingMap = false;

  readonly CANVAS_W = CANVAS_W;
  readonly CANVAS_H = CANVAS_H;
  readonly FLOOR_W = FLOOR_W;
  readonly TABLE_W = TABLE_W;
  readonly TABLE_H = TABLE_H;
  readonly SEAT_RADIUS = SEAT_RADIUS;

  viewBoxX = 0;
  viewBoxY = 0;
  viewBoxW = CANVAS_W;
  viewBoxH = CANVAS_H;
  isPanning = false;

  venueName = '';
  selectedVenueId: number | string | null = null;
  venues: Venue[] = [];
  selectedTableId = '';
  selectedElementId = '';
  private draggingTableId = '';
  private rotatingTableId = '';
  private draggingElementId = '';
  private resizingElementId = '';
  private dragOffset = { x: 0, y: 0 };
  private resizeStart = { x: 0, y: 0, w: 0, h: 0 };
  private rotationStart = { angle: 0, rotation: 0 };
  private tablePositions: Record<string, { x: number; y: number; rotation: number }> = {};
  private panPointerId: number | null = null;
  private panStartClient = { x: 0, y: 0 };
  private panStartView = { x: 0, y: 0 };

  sections: SectionDef[] = [];
  planElements: PlanElement[] = [];

  readonly colorOptions = [
    { label: 'VIP verde', value: '#38ff22' },
    { label: 'General azul', value: '#38bdf8' },
    { label: 'Ocupado rojo', value: '#ef4444' },
    { label: 'Dorado', value: '#f3d173' },
    { label: 'Slate', value: '#64748b' },
    { label: 'Navy', value: '#1e3a5f' }
  ];

  getZoneClass(label: string): string {
    const l = (label || '').toLowerCase();
    if (l.includes('diamante')) return 'zone-diamante';
    if (l.includes('vip')) return 'zone-vip';
    if (l.includes('general')) return 'zone-general';
    return 'zone-default';
  }

  getSectionLabelClass(label: string): string {
    const l = (label || '').toLowerCase();
    if (l.includes('diamante')) return 'section-label-diamante';
    if (l.includes('vip')) return 'section-label-vip';
    if (l.includes('general')) return 'section-label-general';
    return 'section-label-default';
  }

  getTableClass(sectionName: string): string {
    const name = (sectionName || '').toLowerCase();
    if (name.includes('diamante')) return 'map-table-diamante';
    if (name.includes('vip')) return 'map-table-vip';
    if (name.includes('general')) return 'map-table-general';
    return 'map-table-default';
  }

  getSeatClass(color: string, tableId?: string): string {
    const table = this.previewData.tables.find(t => t.id === tableId);
    const name = (table?.sectionName || '').toLowerCase();
    if (name.includes('diamante')) return 'seat-fill-diamante';
    if (name.includes('vip')) return 'seat-fill-vip';
    return 'seat-fill-general';
  }

  isRowStart(label: string | number): boolean {
    const num = Number(label);
    return Number.isFinite(num) ? (num - 1) % 10 === 0 : false;
  }

  getRowNumber(label: string | number): number {
    const num = Number(label);
    return Number.isFinite(num) ? Math.floor((num - 1) / 10) + 1 : 1;
  }

  zoomIn(): void {
    this.zoomViewport(0.8);
  }

  zoomOut(): void {
    this.zoomViewport(1.25);
  }

  resetViewport(): void {
    this.viewBoxX = 0;
    this.viewBoxY = 0;
    this.viewBoxW = CANVAS_W;
    this.viewBoxH = CANVAS_H;
  }

  onCanvasWheel(event: WheelEvent, svg: Element): void {
    event.preventDefault();
    const rect = svg.getBoundingClientRect();
    const anchorX = rect.width ? this.clamp((event.clientX - rect.left) / rect.width, 0, 1) : 0.5;
    const anchorY = rect.height ? this.clamp((event.clientY - rect.top) / rect.height, 0, 1) : 0.5;
    this.zoomViewport(event.deltaY < 0 ? 0.88 : 1.14, anchorX, anchorY);
  }

  startCanvasPan(event: PointerEvent, svg: Element): void {
    if (event.button !== 0) return;
    event.preventDefault();
    this.isPanning = true;
    this.panPointerId = event.pointerId;
    this.panStartClient = { x: event.clientX, y: event.clientY };
    this.panStartView = { x: this.viewBoxX, y: this.viewBoxY };
    (svg as SVGSVGElement).setPointerCapture?.(event.pointerId);
  }

  sectionLabelWidth(label: string): number {
    return Math.max(180, (label || '').length * 24 + 36);
  }

  ngOnInit(): void {
    this.venueService.getVenues(true).subscribe((venues) => {
      this.venues = this.deduplicateVenues(venues);
      if (!this.selectedVenueId && this.venues.length > 0) {
        this.selectedVenueId = this.venues[0].id;
        this.onVenueSelectionChange();
      }
    });
  }

  private deduplicateVenues(venues: Venue[]): Venue[] {
    const uniqueVenues = new Map<string, Venue>();
    for (const venue of venues) {
      const key = venue.name.trim().toLocaleLowerCase('es');
      const current = uniqueVenues.get(key);
      if (!current || Number(venue.id) > Number(current.id)) uniqueVenues.set(key, venue);
    }
    return Array.from(uniqueVenues.values());
  }

  get totalTables(): number {
    return this.sections.reduce((sum, section) => sum + Math.max(0, Number(section.tableCount) || 0), 0);
  }

  get totalSeats(): number {
    return this.previewData.seats.length;
  }

  get zoneCount(): number {
    return this.planElements.filter((element) => element.kind === 'zone').length;
  }

  get selectedTable(): PreviewTable | undefined {
    return this.previewData.tables.find((table) => table.id === this.selectedTableId);
  }

  get selectedElement(): PlanElement | undefined {
    return this.planElements.find((element) => element.id === this.selectedElementId);
  }

  get sortedElements(): PlanElement[] {
    const order: Record<ElementKind, number> = { zone: 0, stage: 1, bathrooms: 2, entrance: 2 };
    return [...this.planElements].sort((a, b) => order[a.kind] - order[b.kind]);
  }

  get previewData(): { tables: PreviewTable[]; seats: PreviewSeat[] } {
    const tables: PreviewTable[] = [];
    const seats: PreviewSeat[] = [];
    let globalIndex = 0;

    for (const [sectionIndex, section] of this.sections.entries()) {
      const count = Math.max(0, Number(section.tableCount) || 0);
      for (let i = 0; i < count; i++) {
        const tableId = `${section.id}-t${i}`;
        const tableNumber = section.tableNumbers?.[i] ?? globalIndex + 1;
        const base = section.tableNumbers?.length
          ? calculateReferenceTablePosition(tableNumber)
          : this.getDefaultTablePosition(sectionIndex, i);
        const current = this.tablePositions[tableId];
        const position = current
          ? section.tableNumbers?.length
            ? current
            : this.keepTableInsideSection(sectionIndex, current.x, current.y, current.rotation)
          : { ...base, rotation: 0 };

        tables.push({
          id: tableId,
          x: position.x,
          y: position.y,
          w: TABLE_W,
          h: TABLE_H,
          label: String(tableNumber),
          sectionId: section.id,
          sectionName: section.name,
          color: section.color,
          rotation: position.rotation
        });

        const seatCount = section.seatsPerTable?.[tableNumber] ?? 10;
        const seatsPerSide = Math.ceil(seatCount / 2);
        for (let seat = 0; seat < seatsPerSide; seat++) {
          const seatY = position.y + 11 + seat * SEAT_SPACING;
          const left = this.rotatePoint(position.x - SEAT_OFFSET, seatY, position.x + TABLE_W / 2, position.y + TABLE_H / 2, position.rotation);
          const right = this.rotatePoint(position.x + TABLE_W + SEAT_OFFSET, seatY, position.x + TABLE_W / 2, position.y + TABLE_H / 2, position.rotation);
          if (seat < seatCount) seats.push({ cx: left.x, cy: left.y, color: section.color, tableId, number: seat + 1 });
          const rightNumber = seat + seatsPerSide + 1;
          if (rightNumber <= seatCount) seats.push({ cx: right.x, cy: right.y, color: section.color, tableId, number: rightNumber });
        }

        globalIndex++;
      }
    }

    return { tables, seats };
  }

  addSection(): void {
    if (this.sections.length >= 5) return;
    const sectionId = String(Date.now());
    this.sections = [...this.sections, { id: sectionId, name: 'NUEVA ZONA', price: 100, tableCount: 0, color: '#38bdf8' }];
    this.planElements = [
      ...this.planElements,
      {
        id: `section-zone-${sectionId}`,
        kind: 'zone',
        label: 'NUEVA ZONA',
        x: 70,
        y: this.clamp(150 + this.zoneCount * 90, 128, CANVAS_H - 180),
        w: 760,
        h: 160,
        color: '#dbeafe',
        textColor: '#0f172a',
        rotation: 0
      }
    ];
  }

  removeSection(index: number): void {
    if (this.sections.length <= 1) return;
    this.sections = this.sections.filter((_, currentIndex) => currentIndex !== index);
    this.pruneTablePositions();
  }

  addTableToSection(section: SectionDef, sectionIndex: number): void {
    if (section.tableCount >= 20) return;
    const nextIndex = Math.max(0, Number(section.tableCount) || 0);
    const tableId = `${section.id}-t${nextIndex}`;
    const position = this.getDefaultTablePosition(sectionIndex, nextIndex);
    section.tableCount = nextIndex + 1;
    this.tablePositions = {
      ...this.tablePositions,
      [tableId]: position
    };
    this.selectedTableId = tableId;
    this.selectedElementId = '';
  }

  removeTableFromSection(section: SectionDef): void {
    if (section.tableCount <= 0) return;
    const nextCount = section.tableCount - 1;
    const tableId = `${section.id}-t${nextCount}`;
    section.tableCount = nextCount;
    const { [tableId]: _removed, ...remainingPositions } = this.tablePositions;
    this.tablePositions = remainingPositions;
    if (this.selectedTableId === tableId) {
      this.selectedTableId = '';
    }
  }

  addZone(label: string, color: string): void {
    const index = this.zoneCount + 1;
    const zone: PlanElement = {
      id: `zone-${Date.now()}`,
      kind: 'zone',
      label: `${label} ${index}`,
      x: 70,
      y: 146 + index * 34,
      w: 680,
      h: 160,
      color,
      textColor: '#0f172a',
      rotation: 0
    };
    this.planElements = [...this.planElements, zone];
    this.selectElement(zone.id);
  }

  addPlanElement(kind: 'bathrooms' | 'entrance'): void {
    const element: PlanElement =
      kind === 'bathrooms'
        ? {
            id: `bathrooms-${Date.now()}`,
            kind,
            label: 'BANOS',
            x: 742,
            y: 286,
            w: 112,
            h: 150,
            color: '#4b5563',
            textColor: '#ffffff',
            rotation: 0
          }
        : {
            id: `entrance-${Date.now()}`,
            kind,
            label: 'INGRESO',
            x: 520,
            y: 612,
            w: 190,
            h: 84,
            color: '#030303',
            textColor: '#030303',
            rotation: 0
          };

    this.planElements = [...this.planElements, element];
    this.selectElement(element.id);
  }

  selectElement(elementId: string): void {
    this.selectedElementId = elementId;
    this.selectedTableId = '';
  }

  deleteSelectedElement(): void {
    const element = this.selectedElement;
    if (!element || element.kind === 'stage') return;
    this.planElements = this.planElements.filter((item) => item.id !== element.id);
    this.selectedElementId = '';
  }

  startTableDrag(table: PreviewTable, event: PointerEvent, svg: Element): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectedTableId = table.id;
    this.selectedElementId = '';
    this.rotatingTableId = '';
    this.draggingTableId = table.id;
    const point = this.getSvgPoint(event, svg);
    this.dragOffset = { x: point.x - table.x, y: point.y - table.y };
  }

  startTableRotation(table: PreviewTable, event: PointerEvent, svg: Element): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectedTableId = table.id;
    this.selectedElementId = '';
    this.draggingTableId = '';
    this.rotatingTableId = table.id;
    const point = this.getSvgPoint(event, svg);
    const center = this.getTableCenter(table);
    this.rotationStart = {
      angle: this.getAngle(center, point),
      rotation: table.rotation
    };
  }

  startElementDrag(element: PlanElement, event: PointerEvent, svg: Element): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectedElementId = element.id;
    this.selectedTableId = '';
    this.draggingElementId = element.id;
    const point = this.getSvgPoint(event, svg);
    this.dragOffset = { x: point.x - element.x, y: point.y - element.y };
  }

  startElementResize(element: PlanElement, event: PointerEvent, svg: Element): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectedElementId = element.id;
    this.selectedTableId = '';
    this.draggingTableId = '';
    this.draggingElementId = '';
    this.resizingElementId = element.id;
    const point = this.getSvgPoint(event, svg);
    this.resizeStart = { x: point.x, y: point.y, w: element.w, h: element.h };
  }

  onCanvasPointerMove(event: PointerEvent, svg: Element): void {
    if (this.isPanning && this.panPointerId === event.pointerId) {
      const rect = svg.getBoundingClientRect();
      if (rect.width && rect.height) {
        this.viewBoxX = this.panStartView.x - (event.clientX - this.panStartClient.x) * this.viewBoxW / rect.width;
        this.viewBoxY = this.panStartView.y - (event.clientY - this.panStartClient.y) * this.viewBoxH / rect.height;
      }
      return;
    }

    const point = this.getSvgPoint(event, svg);

    if (this.resizingElementId) {
      this.resizeElement(
        this.resizingElementId,
        this.resizeStart.w + point.x - this.resizeStart.x,
        this.resizeStart.h + point.y - this.resizeStart.y
      );
      return;
    }

    if (this.rotatingTableId) {
      this.rotateTableFromPoint(this.rotatingTableId, point);
      return;
    }

    if (this.draggingTableId) {
      this.setTablePosition(this.draggingTableId, point.x - this.dragOffset.x, point.y - this.dragOffset.y);
      return;
    }

    if (this.draggingElementId) {
      this.moveElement(this.draggingElementId, point.x - this.dragOffset.x, point.y - this.dragOffset.y);
    }
  }

  endDrag(event?: PointerEvent, svg?: Element): void {
    this.draggingTableId = '';
    this.rotatingTableId = '';
    this.draggingElementId = '';
    this.resizingElementId = '';
    if (this.panPointerId !== null && event && svg) {
      (svg as SVGSVGElement).releasePointerCapture?.(this.panPointerId);
    }
    this.panPointerId = null;
    this.isPanning = false;
  }

  updateSelectedTablePosition(axis: 'x' | 'y', value: number | string): void {
    if (!this.selectedTable) return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    this.setTablePosition(this.selectedTable.id, axis === 'x' ? parsed : this.selectedTable.x, axis === 'y' ? parsed : this.selectedTable.y);
  }

  rotateSelectedTable(delta: number): void {
    if (!this.selectedTable) return;
    this.setSelectedTableRotation(this.selectedTable.rotation + delta);
  }

  setSelectedTableRotation(value: number): void {
    if (!this.selectedTable) return;
    this.setTablePosition(this.selectedTable.id, this.selectedTable.x, this.selectedTable.y, value);
  }

  rotateSelectedElement(delta: number): void {
    if (!this.selectedElement) return;
    this.selectedElement.rotation = this.normalizeRotation(this.selectedElement.rotation + delta);
  }

  setSelectedElementRotation(value: number): void {
    if (!this.selectedElement) return;
    this.selectedElement.rotation = this.normalizeRotation(value);
  }

  resetLayout(): void {
    this.tablePositions = {};
    this.selectedTableId = '';
    this.selectedElementId = '';
    this.resetViewport();
  }

  saveMap(): void {
    if (!this.selectedVenueId || this.isSavingMap) {
      return;
    }

    const config = {
      canvas_width: CANVAS_W,
      canvas_height: CANVAS_H,
      elements: this.planElements,
      sections: this.sections,
      tables: this.previewData.tables.map((table) => ({
        id: table.id,
        label: table.label,
        section: table.sectionName,
        x: Math.round(table.x),
        y: Math.round(table.y),
        rotation: table.rotation,
        seats: this.previewData.seats
          .filter((seat) => seat.tableId === table.id)
          .map((seat) => ({ number: seat.number, x: Math.round(seat.cx), y: Math.round(seat.cy) }))
      })),
      total_seats: this.totalSeats,
      total_tables: this.totalTables
    };

    this.isSavingMap = true;
    this.venueService.saveSeatMap(this.selectedVenueId, config)
      .pipe(finalize(() => this.isSavingMap = false))
      .subscribe({
        next: (savedMap) => {
          this.snackBar.open(
            `Mapa v${savedMap.version} guardado - ${this.totalSeats} asientos en ${this.totalTables} mesas`,
            'OK',
            { duration: 4000, panelClass: ['success-toast'] }
          );
        },
        error: () => {
          this.snackBar.open('No se pudo guardar el mapa. Revisa la conexión con la API.', 'Cerrar', {
            duration: 5000
          });
        }
      });
  }

  onVenueSelectionChange(): void {
    const selectedVenue = this.venues.find((venue) => String(venue.id) === String(this.selectedVenueId));
    this.venueName = selectedVenue?.name ?? '';

    if (!this.selectedVenueId) {
      return;
    }

    this.isLoadingMap = true;
    this.selectedTableId = '';
    this.selectedElementId = '';
    this.snackBar.open('Cargando mapa de asientos...', '', { duration: 2000 });
    forkJoin({
      savedMap: this.venueService.getSeatMap(this.selectedVenueId).pipe(catchError(() => of(null))),
      sections: this.apiService.get<unknown>(`/sections/venue/${this.selectedVenueId}`).pipe(catchError(() => of([]))),
      seats: this.apiService.get<unknown>(`/seats/venue/${this.selectedVenueId}`).pipe(catchError(() => of([])))
    }).pipe(
      finalize(() => this.isLoadingMap = false)
    ).subscribe({
      next: ({ savedMap, sections: sectionsResponse, seats: seatsResponse }) => {
        const venueConfig = this.asRecord(savedMap ?? selectedVenue?.seatMapConfig);
        const sections = this.extractArray(sectionsResponse, ['sections']);
        const seats = this.extractArray(seatsResponse, ['seats', 'event_seats', 'eventSeats']);
        const configuredTables = this.extractArray(venueConfig?.['tables'], ['tables']);
        const rawSeats = seats.length ? seats : configuredTables.flatMap((table) => {
          const tableRecord = this.asRecord(table);
          const tableNumber = this.toFiniteNumber(tableRecord?.['number'] ?? tableRecord?.['label']);
          return this.extractArray(tableRecord?.['seats'], ['seats']).map((seat) => ({
            ...this.asRecord(seat),
            number_table: tableNumber,
            section_id: tableRecord?.['section_id'] ?? tableRecord?.['sectionId']
          }));
        });
        const normalizedSeats = rawSeats.map((value) => {
          const record = this.asRecord(value) ?? {};
          const nestedSeat = this.asRecord(record['seat']);
          return nestedSeat ? { ...nestedSeat, ...record, seat: undefined } : record;
        });
        const sourceSeats = this.assignFallbackTableNumbers(normalizedSeats);

        const configuredElements = this.extractArray(venueConfig?.['elements'], ['elements']);
        this.planElements = configuredElements.length
          ? configuredElements as unknown as PlanElement[]
          : this.mapConfiguredZones(this.extractArray(venueConfig?.['zones'], ['zones']));

        const sectionTablesByName = new Map<string, Set<number>>();
        const seatsPerTableByName = new Map<string, Record<number, number>>();
        const newTablePositions: Record<string, { x: number; y: number; rotation: number }> = {};

        sourceSeats.forEach((value) => {
          const seat = this.asRecord(value);
          const tableNumber = this.toFiniteNumber(seat?.['number_table']);
          if (tableNumber === null || tableNumber < 1) return;

           const secName = String(
             seat?.['section_name'] ??
             this.asRecord(seat?.['section'])?.['name'] ??
             seat?.['section_id'] ??
            seat?.['sectionId'] ??
            this.referenceSectionId(tableNumber)
          ).trim().toLowerCase();

          if (!sectionTablesByName.has(secName)) sectionTablesByName.set(secName, new Set<number>());
          sectionTablesByName.get(secName)!.add(tableNumber);

          const counts = seatsPerTableByName.get(secName) ?? {};
          counts[tableNumber] = (counts[tableNumber] ?? 0) + 1;
          seatsPerTableByName.set(secName, counts);
        });

        const normalizedSections = sections.length ? sections : this.createReferenceSections(sectionTablesByName);
        this.sections = normalizedSections.map((value, index) => {
          const section = this.asRecord(value);
          const secId = String(section?.['id'] ?? index + 1);
          const secName = String(section?.['name'] ?? `SECCION ${index + 1}`);
          const secNameLower = secName.trim().toLowerCase();
          const secIdLower = secId.trim().toLowerCase();

          let tableNumbersSet = sectionTablesByName.get(secIdLower) ?? sectionTablesByName.get(secNameLower);
          if (!tableNumbersSet) {
            for (const [key, set] of sectionTablesByName.entries()) {
              if (key.includes(secNameLower) || secNameLower.includes(key) || key.includes(secIdLower)) {
                tableNumbersSet = set;
                break;
              }
            }
          }

          const tableNumbers = Array.from(tableNumbersSet ?? Array.from(sectionTablesByName.values())[0] ?? []).sort((a, b) => a - b);
          const seatsMap = seatsPerTableByName.get(secIdLower) ?? seatsPerTableByName.get(secNameLower) ?? {};

          return {
            id: secId,
            name: secName,
            price: this.toFiniteNumber(section?.['price']) ?? 100,
            color: String(section?.['color_hex'] ?? section?.['color'] ?? this.referenceSectionColor(index)),
            tableCount: tableNumbers.length,
            tableNumbers,
            seatsPerTable: seatsMap
          };
        });

        const validSections = this.sections.filter((sec) => sec.tableCount > 0);
        if (validSections.length > 0) {
          this.sections = validSections;
        } else if (sourceSeats.length > 0) {
          this.sections = Array.from(sectionTablesByName.keys()).map((secKey, index) => {
            const tableNumbers = Array.from(sectionTablesByName.get(secKey) ?? []).sort((a, b) => a - b);
            return {
              id: secKey,
              name: secKey.toUpperCase(),
              price: 100,
              color: this.referenceSectionColor(index),
              tableCount: tableNumbers.length,
              tableNumbers,
              seatsPerTable: seatsPerTableByName.get(secKey) ?? {}
            };
          });
        }

        const activeSectionNames = new Set(this.sections.map((s) => s.name.trim().toLowerCase()));
        const activeSectionIds = new Set(this.sections.map((s) => s.id.trim().toLowerCase()));

        this.planElements = this.planElements.filter((element) => {
          if (element.kind !== 'zone') return true;
          const labelLower = element.label.trim().toLowerCase();
          const idLower = element.id.trim().toLowerCase();
          if (idLower.includes('foh')) return true;

          return activeSectionNames.has(labelLower) ||
            Array.from(activeSectionNames).some((name) => labelLower.includes(name) || name.includes(labelLower)) ||
            activeSectionIds.has(idLower.replace('-zone', ''));
        });

        this.sections.forEach(sec => {
          (sec.tableNumbers ?? []).forEach((tableNumber, i) => {
            newTablePositions[`${sec.id}-t${i}`] = calculateReferenceTablePosition(tableNumber);
          });
        });

        this.tablePositions = newTablePositions;

        this.snackBar.open('Mapa cargado exitosamente', 'OK', {
          duration: 3000,
          panelClass: ['success-toast']
        });
      },
      error: (err: unknown) => {
        console.error('Error al cargar la configuracion del mapa', err);
        this.snackBar.open('Error al cargar mapa de asientos', 'OK', {
          duration: 3000,
          panelClass: ['error-toast']
        });
      }
    });
  }

  private assignFallbackTableNumbers(seats: Record<string, unknown>[]): Record<string, unknown>[] {
    if (seats.every((seat) => this.toFiniteNumber(seat['number_table']) !== null)) return seats;

    const grouped = new Map<string, Record<string, unknown>[]>();
    for (const seat of seats) {
      const sectionId = String(seat['section_id'] ?? seat['sectionId'] ?? 'general');
      const row = String(seat['row_label'] ?? seat['row'] ?? 'SIN-FILA');
      const key = `${sectionId}|${row}`;
      grouped.set(key, [...(grouped.get(key) ?? []), seat]);
    }

    let nextTableNumber = 1;
    const normalized: Record<string, unknown>[] = [];
    for (const rowSeats of grouped.values()) {
      rowSeats.sort((left, right) =>
        (this.toFiniteNumber(left['seat_number'] ?? left['number']) ?? 0) -
        (this.toFiniteNumber(right['seat_number'] ?? right['number']) ?? 0)
      );

      for (let index = 0; index < rowSeats.length; index += 10) {
        const tableNumber = nextTableNumber++;
        normalized.push(...rowSeats.slice(index, index + 10).map((seat) => ({
          ...seat,
          number_table: this.toFiniteNumber(seat['number_table']) ?? tableNumber
        })));
      }
    }

    return normalized;
  }

  private createReferencePlanElements(): PlanElement[] {
    return [
      { id: 'stage', kind: 'stage', label: 'ESCENARIO', x: 460, y: 20, w: 980, h: 90, color: '#142238', textColor: '#fff7ed', rotation: 0 },
      { id: 'diamante-zone', kind: 'zone', label: 'DIAMANTE', x: 95, y: 115, w: 1735, h: 700, color: '#fef3c7', textColor: '#0f172a', rotation: 0 },
      { id: 'vip-zone', kind: 'zone', label: 'VIP', x: 95, y: 905, w: 1735, h: 590, color: '#e0f2fe', textColor: '#0f172a', rotation: 0 },
      { id: 'general-zone', kind: 'zone', label: 'GENERAL', x: 95, y: 1585, w: 1735, h: 300, color: '#dcfce7', textColor: '#0f172a', rotation: 0 },
      { id: 'foh-zone', kind: 'zone', label: 'FOH', x: 830, y: 1970, w: 240, h: 80, color: '#e2e8f0', textColor: '#0f172a', rotation: 0 }
    ];
  }

  private mapConfiguredZones(zones: unknown[]): PlanElement[] {
    if (!zones.length) return this.createReferencePlanElements();

    return zones.map((value, index) => {
      const zone = this.asRecord(value);
      const type = String(zone?.['type'] ?? 'generic');
      const kind: ElementKind = type === 'stage'
        ? 'stage'
        : type === 'entrance'
          ? 'entrance'
          : type === 'bathroom'
            ? 'bathrooms'
            : 'zone';
      return {
        id: String(zone?.['id'] ?? `zone-${index}`),
        kind,
        label: String(zone?.['name'] ?? zone?.['label'] ?? `ZONA ${index + 1}`),
        x: this.toFiniteNumber(zone?.['x']) ?? 0,
        y: this.toFiniteNumber(zone?.['y']) ?? 0,
        w: this.toFiniteNumber(zone?.['width'] ?? zone?.['w']) ?? 100,
        h: this.toFiniteNumber(zone?.['height'] ?? zone?.['h']) ?? 100,
        color: String(zone?.['color'] ?? (kind === 'stage' ? '#142238' : '#e2e8f0')),
        textColor: String(zone?.['textColor'] ?? (kind === 'stage' ? '#fff7ed' : '#0f172a')),
        rotation: this.toFiniteNumber(zone?.['rotation']) ?? 0
      };
    });
  }

  private createReferenceSections(sectionTables: Map<string, Set<number>>): Record<string, unknown>[] {
    if (sectionTables.size) {
      return Array.from(sectionTables.keys()).map((id, index) => ({
        id,
        name: id === 'diamante' ? 'DIAMANTE' : id === 'vip' ? 'VIP' : id === 'general' ? 'GENERAL' : `SECCION ${index + 1}`,
        color: this.referenceSectionColor(index)
      }));
    }

    return [];
  }

  private referenceSectionId(tableNumber: number): string {
    return tableNumber <= 100 ? 'diamante' : tableNumber <= 180 ? 'vip' : 'general';
  }

  private referenceSectionColor(index: number): string {
    return ['#f3d173', '#38ff22', '#38bdf8'][index] ?? '#64748b';
  }

  private extractArray(value: unknown, keys: string[]): unknown[] {
    if (Array.isArray(value)) return value;
    const record = this.asRecord(value);
    if (!record) return [];

    for (const key of ['data', ...keys]) {
      const candidate = record[key];
      if (Array.isArray(candidate)) return candidate;
      const nested = this.asRecord(candidate);
      if (nested) {
        for (const nestedKey of keys) {
          if (Array.isArray(nested[nestedKey])) return nested[nestedKey] as unknown[];
        }
      }
    }

    return [];
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
  }

  private toFiniteNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  elementTransform(element: PlanElement): string {
    return `translate(${element.x} ${element.y}) rotate(${element.rotation} ${element.w / 2} ${element.h / 2})`;
  }

  entryArrowPath(width: number, height: number): string {
    return `M0 ${height / 2} L${width * 0.42} 0 L${width * 0.42} ${height * 0.32} L${width} ${height * 0.32} L${width} ${height * 0.68} L${width * 0.42} ${height * 0.68} L${width * 0.42} ${height} Z`;
  }

  private getDefaultTablePosition(sectionIndex: number, tableIndex: number): { x: number; y: number; rotation: number } {
    const bounds = this.getSectionBounds(sectionIndex);
    const minX = bounds.x + SEAT_OFFSET + SEAT_RADIUS + 12;
    const maxX = bounds.x + bounds.w - TABLE_W - SEAT_OFFSET - SEAT_RADIUS - 12;
    const minY = bounds.y + 48;
    const maxY = bounds.y + bounds.h - TABLE_H - 18;
    const availableWidth = Math.max(1, maxX - minX);
    const columns = Math.max(1, Math.min(6, Math.floor(availableWidth / 92) + 1));
    const col = tableIndex % columns;
    const row = Math.floor(tableIndex / columns);
    const gapX = columns > 1 ? availableWidth / (columns - 1) : 0;
    const x = minX + col * gapX;
    const y = minY + row * 104;

    return {
      x: Math.round(this.clamp(x, minX, maxX)),
      y: Math.round(this.clamp(y, minY, maxY)),
      rotation: 0
    };
  }

  private getSectionBounds(sectionIndex: number): { x: number; y: number; w: number; h: number } {
    const zones = this.planElements.filter((element) => element.kind === 'zone');
    const zone = zones[sectionIndex];

    if (zone) {
      return { x: zone.x, y: zone.y, w: zone.w, h: zone.h };
    }

    return { x: 40, y: 128, w: CANVAS_W - 80, h: CANVAS_H - 170 };
  }

  private keepTableInsideSection(sectionIndex: number, x: number, y: number, rotation: number): { x: number; y: number; rotation: number } {
    const bounds = this.getSectionBounds(sectionIndex);
    const minX = bounds.x + SEAT_OFFSET + SEAT_RADIUS + 8;
    const maxX = bounds.x + bounds.w - TABLE_W - SEAT_OFFSET - SEAT_RADIUS - 8;
    const minY = bounds.y + 38;
    const maxY = bounds.y + bounds.h - TABLE_H - 12;

    return {
      x: this.clamp(Math.round(x), minX, Math.max(minX, maxX)),
      y: this.clamp(Math.round(y), minY, Math.max(minY, maxY)),
      rotation: this.normalizeRotation(rotation)
    };
  }

  private getTableSectionIndex(tableId: string): number {
    const sectionId = tableId.split('-t')[0];
    return Math.max(0, this.sections.findIndex((section) => section.id === sectionId));
  }

  private getTableCenter(table: PreviewTable): { x: number; y: number } {
    return { x: table.x + table.w / 2, y: table.y + table.h / 2 };
  }

  private getAngle(origin: { x: number; y: number }, point: { x: number; y: number }): number {
    return (Math.atan2(point.y - origin.y, point.x - origin.x) * 180) / Math.PI;
  }

  private rotateTableFromPoint(tableId: string, point: { x: number; y: number }): void {
    const table = this.previewData.tables.find((item) => item.id === tableId);
    if (!table) return;
    const angle = this.getAngle(this.getTableCenter(table), point);
    const nextRotation = this.rotationStart.rotation + angle - this.rotationStart.angle;
    this.setTablePosition(table.id, table.x, table.y, nextRotation);
  }

  private setTablePosition(tableId: string, x: number, y: number, rotation?: number): void {
    const current = this.tablePositions[tableId];
    const table = this.previewData.tables.find((item) => item.id === tableId);
    const nextRotation = rotation ?? current?.rotation ?? table?.rotation ?? 0;
    const sectionIndex = table ? this.getTableSectionIndex(table.id) : 0;
    const next = this.keepTableInsideSection(sectionIndex, x, y, nextRotation);
    this.tablePositions = {
      ...this.tablePositions,
      [tableId]: next
    };
  }

  private moveElement(elementId: string, x: number, y: number): void {
    this.planElements = this.planElements.map((element) =>
      element.id === elementId
        ? {
            ...element,
            x: this.clamp(Math.round(x), 0, CANVAS_W - element.w),
            y: this.clamp(Math.round(y), 0, CANVAS_H - element.h)
          }
        : element
    );
  }

  private resizeElement(elementId: string, width: number, height: number): void {
    this.planElements = this.planElements.map((element) =>
      element.id === elementId
        ? {
            ...element,
            w: this.clamp(Math.round(width), 48, CANVAS_W - element.x),
            h: this.clamp(Math.round(height), 36, CANVAS_H - element.y)
          }
        : element
    );
  }

  private getSvgPoint(event: PointerEvent, element: Element): { x: number; y: number } {
    const svg = element as SVGSVGElement;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const transformed = point.matrixTransform(svg.getScreenCTM()?.inverse());
    return { x: transformed.x, y: transformed.y };
  }

  private zoomViewport(factor: number, anchorX = 0.5, anchorY = 0.5): void {
    const minWidth = CANVAS_W * 0.18;
    const maxWidth = CANVAS_W * 2.5;
    const nextWidth = this.clamp(this.viewBoxW * factor, minWidth, maxWidth);
    const nextHeight = nextWidth * CANVAS_H / CANVAS_W;
    this.viewBoxX += (this.viewBoxW - nextWidth) * anchorX;
    this.viewBoxY += (this.viewBoxH - nextHeight) * anchorY;
    this.viewBoxW = nextWidth;
    this.viewBoxH = nextHeight;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private normalizeRotation(value: number): number {
    const normalized = ((Math.round(value) % 360) + 360) % 360;
    return normalized > 180 ? normalized - 360 : normalized;
  }

  private rotatePoint(x: number, y: number, centerX: number, centerY: number, degrees: number): { x: number; y: number } {
    const radians = (degrees * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const dx = x - centerX;
    const dy = y - centerY;
    return {
      x: centerX + dx * cos - dy * sin,
      y: centerY + dx * sin + dy * cos
    };
  }

  private pruneTablePositions(): void {
    const validIds = new Set(this.previewData.tables.map((table) => table.id));
    this.tablePositions = Object.fromEntries(Object.entries(this.tablePositions).filter(([tableId]) => validIds.has(tableId)));
  }
}
