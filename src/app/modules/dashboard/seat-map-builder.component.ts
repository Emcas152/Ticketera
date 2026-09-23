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
  sectionId?: string;
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
  rowNumber?: number;
  isRowStart?: boolean;
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

function getLocalSeatPosition(seatNumber: number, totalSeats: number): { relX: number; relY: number } {
  const leftCount = Math.ceil(totalSeats / 2);
  const rightCount = Math.floor(totalSeats / 2);
  const onLeft = seatNumber <= leftCount;

  const countOnSide = onLeft ? leftCount : rightCount;
  const indexOnSide = onLeft ? seatNumber - 1 : seatNumber - leftCount - 1;

  const relX = onLeft ? -SEAT_OFFSET : TABLE_W + SEAT_OFFSET;

  if (countOnSide <= 1) {
    return { relX, relY: Math.round(TABLE_H / 2) };
  }

  // Spacing so 5 seats fit cleanly between y=7 and y=71 (spacing = 16px, 3px visual gap)
  // For fewer seats, maintain pleasant spacing between 16 and 22px, centered vertically
  const spacing = countOnSide > 5 ? 15 : Math.min(22, (TABLE_H - 14) / (countOnSide - 1));
  const totalSpread = (countOnSide - 1) * spacing;
  const startY = (TABLE_H - totalSpread) / 2;

  const relY = Math.round(startY + indexOnSide * spacing);
  return { relX, relY };
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
                <button
                  mat-stroked-button
                  type="button"
                  (click)="addTableToSection(section, i)"
                  [disabled]="venueCapacity > 0 && availableSeats <= 0"
                  [matTooltip]="venueCapacity > 0 && availableSeats <= 0 ? 'No hay asientos disponibles en el cupo. Reduce asientos de otra mesa primero.' : 'Agregar nueva mesa en esta sección'"
                >
                  <mat-icon>add_circle_outline</mat-icon>
                  Agregar mesa
                  @if (hasAvailableSeats) {
                    <span class="seat-badge-small">+{{ getNewTableSeatAllocation() }} as.</span>
                  }
                </button>
                <button mat-icon-button type="button" (click)="removeTableFromSection(section)" [disabled]="section.tableCount <= 0" matTooltip="Eliminar última mesa de esta sección">
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
            <div class="panel-title-row">
              <strong>Mesa {{ selectedTable.label }}</strong>
              <button mat-icon-button type="button" (click)="deleteSelectedTable()" matTooltip="Eliminar esta mesa" class="delete-table-btn">
                <mat-icon>delete_outline</mat-icon>
              </button>
            </div>
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
            <mat-form-field appearance="outline">
              <mat-label>Cantidad de Asientos</mat-label>
              <input matInput type="number" [ngModel]="getSelectedTableSeatCount()" (ngModelChange)="updateSelectedTableSeatCount($event)" min="1" max="50">
              @if (availableSeats > 0) {
                <mat-hint>Disponibles en el venue: +{{ availableSeats }}</mat-hint>
              }
            </mat-form-field>
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

            @if (selectedSeatNumber) {
            <div class="selected-seat-badge">
              <span>Asiento <strong>#{{ selectedSeatNumber }}</strong> seleccionado</span>
              <button mat-stroked-button type="button" class="flip-seat-btn" (click)="flipSelectedSeat()">
                <mat-icon>swap_horiz</mat-icon>
                Pasar este asiento al lado opuesto
              </button>
            </div>
            }

            <div class="seat-actions-group">
              <button mat-stroked-button type="button" class="action-seats-btn" (click)="moveTableSeatsToOppositeStageSide(selectedTable.id)">
                <mat-icon>vertical_align_bottom</mat-icon>
                Lado contrario al escenario
              </button>
              @if (hasCustomSeatOffsets(selectedTable.id)) {
              <button mat-stroked-button type="button" class="reset-seats-btn" (click)="resetTableSeats(selectedTable.id)">
                <mat-icon>restart_alt</mat-icon>
                Restablecer asientos a 2 filas
              </button>
              }
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
                <input matInput type="number" [ngModel]="selectedElement.x" (ngModelChange)="updateSelectedElementPosition('x', $event)">
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Y</mat-label>
                <input matInput type="number" [ngModel]="selectedElement.y" (ngModelChange)="updateSelectedElementPosition('y', $event)">
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
            <div class="summary-row">
              <span>Capacidad venue</span>
              <div class="capacity-field-inline">
                <input type="number" class="capacity-input" [(ngModel)]="venueCapacity" min="0" title="Capacidad total de asientos permitidos en el venue">
              </div>
            </div>
            <div class="summary-row">
              <span>Asientos en pantalla</span>
              <strong [class.seats-over]="isOverCapacity" [class.seats-available]="hasAvailableSeats">{{ totalSeats }}</strong>
            </div>
            @if (venueCapacity > 0) {
            <div class="summary-row">
              <span>Asientos disponibles</span>
              <strong class="available-badge" [class.badge-green]="hasAvailableSeats" [class.badge-blue]="isExactCapacity" [class.badge-red]="isOverCapacity">
                {{ availableSeats >= 0 ? '+' + availableSeats : availableSeats }}
              </strong>
            </div>
            }
            <div class="summary-row"><span>Zonas</span><strong>{{ zoneCount }}</strong></div>

            @if (venueCapacity > 0) {
            <div class="capacity-status-card">
              @if (hasAvailableSeats) {
              <div class="status-indicator status-green">
                <mat-icon>check_circle</mat-icon>
                <span>Quedan <strong>{{ availableSeats }}</strong> asientos disponibles para agregar en nuevas mesas.</span>
              </div>
              }
              @if (isExactCapacity) {
              <div class="status-indicator status-blue">
                <mat-icon>verified</mat-icon>
                <span>Capacidad exacta completada ({{ totalSeats }} asientos).</span>
              </div>
              }
              @if (isOverCapacity) {
              <div class="status-indicator status-red">
                <mat-icon>warning</mat-icon>
                <span>Exceso: <strong>{{ totalSeats - venueCapacity }}</strong> asientos por encima de la capacidad.</span>
              </div>
              }
            </div>
            }
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
              <p class="preview-subtitle">
                {{ venueName || 'Venue sin nombre' }} &bull; {{ totalSeats }} asientos en pantalla
                @if (venueCapacity > 0) {
                  / {{ venueCapacity }} capacidad
                  @if (hasAvailableSeats) {
                    <span class="header-available-pill">+{{ availableSeats }} disponibles</span>
                  }
                }
              </p>
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
                <text
                  [attr.x]="t.x + t.w / 2"
                  [attr.y]="t.y + t.h / 2"
                  [attr.transform]="t.rotation ? 'rotate(' + (-t.rotation) + ' ' + (t.x + t.w / 2) + ' ' + (t.y + t.h / 2) + ')' : null"
                  text-anchor="middle"
                  dominant-baseline="middle"
                  class="map-table-label"
                >{{ t.label }}</text>
                


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

              @for (s of previewData.seats; track s.tableId + '-s' + s.number) {
              <g
                class="svg-seat-group"
                [class.selected-seat-item]="selectedSeatKey === s.tableId + '-s' + s.number"
                (pointerdown)="startSeatDrag(s, $event, venueSvg)"
              >
                <circle
                  [class.selected-seat]="selectedTableId === s.tableId"
                  [attr.cx]="s.cx"
                  [attr.cy]="s.cy"
                  [attr.r]="SEAT_RADIUS"
                  [ngClass]="getSeatClass(s.color, s.tableId)"
                />
                <text [attr.x]="s.cx" [attr.y]="s.cy + 1" text-anchor="middle" dominant-baseline="middle" class="seat-number">{{ s.number }}</text>
              </g>
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
    .svg-seat-group{cursor:grab}
    .svg-seat-group:active{cursor:grabbing}
    .svg-seat-group.selected-seat-item circle{stroke:#ffffff!important;stroke-width:2.5px!important;filter:drop-shadow(0 0 6px rgba(255,255,255,1))}
    .selected-seat-badge{display:grid;gap:6px;padding:8px 10px;background:#e2e8f0;border-radius:8px;font-size:.8rem}
    .selected-seat-badge span{font-weight:700;color:#0f172a}
    .flip-seat-btn,.action-seats-btn,.reset-seats-btn{width:100%;font-size:.76rem!important;height:34px!important;line-height:32px!important}
    .seat-actions-group{display:grid;gap:6px;margin-top:2px}
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

    .capacity-field-inline{display:flex;align-items:center}
    .capacity-input{width:76px;padding:3px 6px;border:1px solid var(--surface-border);border-radius:6px;font-size:.82rem;font-weight:700;text-align:right;background:#fff;color:#0f172a}
    .seats-over{color:#dc2626!important;font-weight:800}
    .seats-available{color:#16a34a!important;font-weight:800}
    .available-badge{padding:2px 8px;border-radius:9999px;font-size:.76rem;font-weight:800}
    .badge-green{background:#dcfce7;color:#15803d}
    .badge-blue{background:#dbeafe;color:#1d4ed8}
    .badge-red{background:#fee2e2;color:#b91c1c}
    .capacity-status-card{margin-top:4px}
    .status-indicator{display:flex;align-items:center;gap:6px;font-size:.74rem;line-height:1.3;padding:8px 10px;border-radius:8px}
    .status-indicator mat-icon{font-size:17px;width:17px;height:17px;flex-shrink:0}
    .status-green{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}
    .status-blue{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe}
    .status-red{background:#fef2f2;color:#991b1b;border:1px solid #fecaca}
    .seat-badge-small{margin-left:5px;font-size:.68rem;background:#16a34a;color:#fff;padding:1px 6px;border-radius:6px;font-weight:800}
    .header-available-pill{display:inline-block;margin-left:6px;padding:2px 8px;border-radius:12px;background:#16a34a;color:#fff;font-size:.72rem;font-weight:800;vertical-align:middle}
    .delete-table-btn{color:#ef4444!important}

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
  selectedSeatKey = '';
  selectedElementId = '';
  private draggingTableId = '';
  private draggingSeatKey = '';
  private rotatingTableId = '';
  private draggingElementId = '';
  private resizingElementId = '';
  private dragOffset = { x: 0, y: 0 };
  private resizeStart = { x: 0, y: 0, w: 0, h: 0 };
  private rotationStart = { angle: 0, rotation: 0 };
  private tablePositions: Record<string, { x: number; y: number; rotation: number }> = {};
  customSeatOffsets: Record<string, { relX: number; relY: number }> = {};
  private panPointerId: number | null = null;
  private seatPointerId: number | null = null;
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

  isRowStart(label: string | number, table?: PreviewTable | { x?: number; isRowStart?: boolean }): boolean {
    if (table?.isRowStart !== undefined) return Boolean(table.isRowStart);
    if (table?.x !== undefined && table.x <= 155) return true;
    const num = Number(label);
    return Number.isFinite(num) && num > 0 ? (num - 1) % 20 === 0 : false;
  }

  getRowNumber(label: string | number, table?: PreviewTable | { rowNumber?: number }): number {
    if (table?.rowNumber !== undefined) return table.rowNumber;
    const num = Number(label);
    return Number.isFinite(num) && num > 0 ? Math.floor((num - 1) / 20) + 1 : 1;
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

  venueCapacity = 0;

  get availableSeats(): number {
    return this.venueCapacity > 0 ? (this.venueCapacity - this.totalSeats) : 0;
  }

  get isOverCapacity(): boolean {
    return this.venueCapacity > 0 && this.totalSeats > this.venueCapacity;
  }

  get hasAvailableSeats(): boolean {
    return this.availableSeats > 0;
  }

  get isExactCapacity(): boolean {
    return this.venueCapacity > 0 && this.totalSeats === this.venueCapacity;
  }

  getNewTableSeatAllocation(): number {
    return this.availableSeats > 0 ? Math.min(this.availableSeats, 10) : 10;
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
      const zone = this.getZoneForSection(section, sectionIndex);
      for (let i = 0; i < count; i++) {
        const tableId = `${section.id}-t${i}`;
        const tableNumber = section.tableNumbers?.[i] ?? globalIndex + 1;
        const base = section.tableNumbers?.length
          ? calculateReferenceTablePosition(tableNumber)
          : this.getDefaultTablePosition(sectionIndex, i);
        const current = this.tablePositions[tableId];
        const position = current
          ? this.keepTableInsideZone(zone, current.x, current.y, current.rotation)
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
        if (seatCount > 0) {
          for (let seat = 0; seat < seatCount; seat++) {
            const seatNumber = seat + 1;
            const seatKey = `${tableId}-s${seatNumber}`;
            const custom = this.customSeatOffsets[seatKey];
            const local = custom ?? getLocalSeatPosition(seatNumber, seatCount);

            const cx = position.x + local.relX;
            const cy = position.y + local.relY;
            const rotated = this.rotatePoint(cx, cy, position.x + TABLE_W / 2, position.y + TABLE_H / 2, position.rotation);

            seats.push({ cx: rotated.x, cy: rotated.y, color: section.color, tableId, number: seatNumber });
          }
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
        rotation: 0,
        sectionId
      }
    ];
  }

  removeSection(index: number): void {
    if (this.sections.length <= 1) return;
    this.sections = this.sections.filter((_, currentIndex) => currentIndex !== index);
    this.pruneTablePositions();
  }

  addTableToSection(section: SectionDef, sectionIndex: number): void {
    if (this.venueCapacity > 0 && this.availableSeats <= 0) {
      this.snackBar.open(
        'No hay asientos disponibles en el cupo. Reduce los asientos de otra mesa primero (ej. de 10 a 2) o amplía la capacidad del venue.',
        'OK',
        { duration: 4500 }
      );
      return;
    }

    // Determine next table number safely across all sections
    const allTableNumbers = this.sections.flatMap((s) => s.tableNumbers ?? []);
    const maxNumber = allTableNumbers.length > 0 ? Math.max(...allTableNumbers) : 0;
    const nextTableNumber = Math.max(maxNumber + 1, this.totalTables + 1);

    if (!section.tableNumbers) {
      section.tableNumbers = [];
    }
    section.tableNumbers.push(nextTableNumber);
    section.tableCount = section.tableNumbers.length;

    // Allocate available seats (default to min(availableSeats, 10) or 10 if unlimited)
    const seatsToAssign = this.availableSeats > 0 ? Math.min(this.availableSeats, 10) : 10;
    if (!section.seatsPerTable) {
      section.seatsPerTable = {};
    }
    section.seatsPerTable[nextTableNumber] = seatsToAssign;

    const nextIndex = section.tableNumbers.length - 1;
    const tableId = `${section.id}-t${nextIndex}`;
    const position = this.getNewTablePosition(section, sectionIndex);

    this.tablePositions = {
      ...this.tablePositions,
      [tableId]: position
    };
    this.selectedTableId = tableId;
    this.selectedElementId = '';

    const remaining = Math.max(0, this.availableSeats);
    this.snackBar.open(
      `Mesa #${nextTableNumber} creada con ${seatsToAssign} asientos en ${section.name}. (${remaining} asientos disponibles restantes).`,
      'OK',
      { duration: 3500, panelClass: ['success-toast'] }
    );
  }

  removeTableFromSection(section: SectionDef): void {
    if (section.tableCount <= 0) return;
    const removedNumber = section.tableNumbers?.pop();
    section.tableCount = section.tableNumbers ? section.tableNumbers.length : Math.max(0, section.tableCount - 1);
    const tableIndex = section.tableCount;
    const tableId = `${section.id}-t${tableIndex}`;

    let freedSeats = 10;
    if (removedNumber !== undefined && section.seatsPerTable) {
      freedSeats = section.seatsPerTable[removedNumber] ?? 10;
      delete section.seatsPerTable[removedNumber];
    }

    const { [tableId]: _removed, ...remainingPositions } = this.tablePositions;
    this.tablePositions = remainingPositions;

    const prefix = `${tableId}-s`;
    const nextOffsets = { ...this.customSeatOffsets };
    for (const k of Object.keys(nextOffsets)) {
      if (k.startsWith(prefix)) delete nextOffsets[k];
    }
    this.customSeatOffsets = nextOffsets;

    if (this.selectedTableId === tableId) {
      this.selectedTableId = '';
    }

    this.snackBar.open(`Mesa eliminada. Se liberaron ${freedSeats} asientos.`, 'OK', { duration: 2500 });
  }

  deleteSelectedTable(): void {
    if (!this.selectedTable) return;
    const table = this.selectedTable;
    const section = this.sections.find((s) => s.id === table.sectionId);
    if (!section) return;

    const tableNumber = Number(table.label);
    const freedSeats = section.seatsPerTable?.[tableNumber] ?? 10;

    if (section.tableNumbers) {
      section.tableNumbers = section.tableNumbers.filter((n) => n !== tableNumber);
    }
    section.tableCount = section.tableNumbers ? section.tableNumbers.length : Math.max(0, section.tableCount - 1);

    if (section.seatsPerTable) {
      delete section.seatsPerTable[tableNumber];
    }

    const { [table.id]: _removed, ...remainingPositions } = this.tablePositions;
    this.tablePositions = remainingPositions;

    const prefix = `${table.id}-s`;
    const nextOffsets = { ...this.customSeatOffsets };
    for (const k of Object.keys(nextOffsets)) {
      if (k.startsWith(prefix)) delete nextOffsets[k];
    }
    this.customSeatOffsets = nextOffsets;

    this.selectedTableId = '';
    this.selectedSeatKey = '';

    this.snackBar.open(`Mesa #${tableNumber} eliminada. Se liberaron ${freedSeats} asientos.`, 'OK', { duration: 3000 });
  }

  private getNewTablePosition(section: SectionDef, sectionIndex: number): { x: number; y: number; rotation: number } {
    const zone = this.getZoneForSection(section, sectionIndex);
    if (zone) {
      const existingInSec = this.previewData.tables.filter((t) => t.sectionId === section.id);
      if (existingInSec.length > 0) {
        const lastTable = existingInSec[existingInSec.length - 1];
        let targetX = lastTable.x + TABLE_W + 56;
        let targetY = lastTable.y;
        if (targetX + TABLE_W + SEAT_OFFSET + SEAT_RADIUS + 8 > zone.x + zone.w) {
          targetX = zone.x + SEAT_OFFSET + SEAT_RADIUS + 14;
          targetY = lastTable.y + TABLE_H + 40;
        }
        return this.keepTableInsideZone(zone, targetX, targetY, 0);
      }
      return this.keepTableInsideZone(zone, zone.x + 40, zone.y + 40, 0);
    }
    return this.getDefaultTablePosition(sectionIndex, section.tableCount);
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

  get selectedSeatNumber(): number | null {
    if (!this.selectedSeatKey) return null;
    const parts = this.selectedSeatKey.split('-s');
    if (parts.length > 1) {
      const num = Number(parts[parts.length - 1]);
      if (Number.isFinite(num)) return num;
    }
    const match = this.selectedSeatKey.match(/-(\d+)$/);
    return match ? Number(match[1]) : null;
  }

  getOppositeStageSide(table: PreviewTable): 'left' | 'right' {
    const center = this.getTableCenter(table);
    const posA = this.rotatePoint(table.x - SEAT_OFFSET, table.y + TABLE_H / 2, center.x, center.y, table.rotation);
    const posB = this.rotatePoint(table.x + TABLE_W + SEAT_OFFSET, table.y + TABLE_H / 2, center.x, center.y, table.rotation);
    return posB.y >= posA.y ? 'right' : 'left';
  }

  moveTableSeatsToOppositeStageSide(tableId: string): void {
    const table = this.previewData.tables.find((t) => t.id === tableId);
    if (!table) return;

    const section = this.sections.find((s) => s.id === table.sectionId);
    const tableNumber = Number(table.label);
    const seatCount = section?.seatsPerTable?.[tableNumber] ?? 10;
    if (seatCount <= 0) return;

    const oppositeSide = this.getOppositeStageSide(table);
    const targetRelX = oppositeSide === 'right' ? TABLE_W + SEAT_OFFSET : -SEAT_OFFSET;

    const spacing = seatCount > 5 ? 15 : Math.min(22, (TABLE_H - 14) / Math.max(1, seatCount - 1));
    const totalSpread = (seatCount - 1) * spacing;
    const startY = (TABLE_H - totalSpread) / 2;

    const nextOffsets = { ...this.customSeatOffsets };
    for (let s = 1; s <= seatCount; s++) {
      const relY = Math.round(seatCount === 1 ? TABLE_H / 2 : startY + (s - 1) * spacing);
      nextOffsets[`${tableId}-s${s}`] = { relX: targetRelX, relY };
    }

    this.customSeatOffsets = nextOffsets;
    this.snackBar.open('Asientos alineados al lado contrario del escenario', 'OK', { duration: 2500 });
  }

  flipSelectedSeat(): void {
    if (!this.selectedSeatKey || !this.selectedTable) return;
    const currentSeat = this.previewData.seats.find((s) => `${s.tableId}-s${s.number}` === this.selectedSeatKey);
    if (!currentSeat) return;

    const center = this.getTableCenter(this.selectedTable);
    const unrotated = this.rotatePoint(currentSeat.cx, currentSeat.cy, center.x, center.y, -this.selectedTable.rotation);
    const currentRelX = unrotated.x - this.selectedTable.x;
    const currentRelY = unrotated.y - this.selectedTable.y;

    const newRelX = currentRelX <= TABLE_W / 2 ? TABLE_W + SEAT_OFFSET : -SEAT_OFFSET;

    this.customSeatOffsets = {
      ...this.customSeatOffsets,
      [this.selectedSeatKey]: { relX: newRelX, relY: Math.round(currentRelY) }
    };
    this.snackBar.open(`Asiento #${this.selectedSeatNumber} movido al lado opuesto`, 'OK', { duration: 2000 });
  }

  startSeatDrag(seat: PreviewSeat, event: PointerEvent, svg: Element): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectedTableId = seat.tableId;
    this.selectedElementId = '';
    this.selectedSeatKey = `${seat.tableId}-s${seat.number}`;
    this.draggingSeatKey = this.selectedSeatKey;
    this.draggingTableId = '';
    this.draggingElementId = '';
    this.rotatingTableId = '';
    this.resizingElementId = '';
    this.seatPointerId = event.pointerId;
    (svg as SVGSVGElement).setPointerCapture?.(event.pointerId);
    const point = this.getSvgPoint(event, svg);
    this.dragOffset = { x: point.x - seat.cx, y: point.y - seat.cy };
  }

  hasCustomSeatOffsets(tableId: string): boolean {
    const prefix = `${tableId}-s`;
    return Object.keys(this.customSeatOffsets).some((k) => k.startsWith(prefix));
  }

  resetTableSeats(tableId: string): void {
    const prefix = `${tableId}-s`;
    const nextOffsets: Record<string, { relX: number; relY: number }> = {};
    for (const [k, v] of Object.entries(this.customSeatOffsets)) {
      if (!k.startsWith(prefix)) {
        nextOffsets[k] = v;
      }
    }
    this.customSeatOffsets = nextOffsets;
    this.selectedSeatKey = '';
  }

  startTableDrag(table: PreviewTable, event: PointerEvent, svg: Element): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectedTableId = table.id;
    this.selectedSeatKey = '';
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

    if (this.draggingSeatKey) {
      const currentSeat = this.previewData.seats.find((st) => `${st.tableId}-s${st.number}` === this.draggingSeatKey);
      const currentTable = currentSeat ? this.previewData.tables.find((tb) => tb.id === currentSeat.tableId) : null;
      if (currentSeat && currentTable) {
        const targetCx = point.x - this.dragOffset.x;
        const targetCy = point.y - this.dragOffset.y;
        const center = this.getTableCenter(currentTable);
        const unrotated = this.rotatePoint(targetCx, targetCy, center.x, center.y, -currentTable.rotation);
        const relX = Math.round(unrotated.x - currentTable.x);
        const relY = Math.round(unrotated.y - currentTable.y);
        this.customSeatOffsets = {
          ...this.customSeatOffsets,
          [this.draggingSeatKey]: { relX, relY }
        };
      }
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
    this.draggingSeatKey = '';
    this.rotatingTableId = '';
    this.draggingElementId = '';
    this.resizingElementId = '';
    if (this.seatPointerId !== null && event && svg) {
      (svg as SVGSVGElement).releasePointerCapture?.(this.seatPointerId);
      this.seatPointerId = null;
    }
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

  getSelectedTableSeatCount(): number {
    if (!this.selectedTable) return 10;
    const section = this.sections.find(s => s.id === this.selectedTable!.sectionId);
    if (!section) return 10;
    const tableNumber = Number(this.selectedTable.label);
    return section.seatsPerTable?.[tableNumber] ?? 10;
  }

  updateSelectedTableSeatCount(count: number): void {
    if (!this.selectedTable) return;
    const parsed = Number(count);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 30) return;
    const section = this.sections.find(s => s.id === this.selectedTable!.sectionId);
    if (section) {
      if (!section.seatsPerTable) {
        section.seatsPerTable = {};
      }
      const tableNumber = Number(this.selectedTable.label);
      section.seatsPerTable[tableNumber] = parsed;
    }
  }

  rotateSelectedElement(delta: number): void {
    if (!this.selectedElement) return;
    this.selectedElement.rotation = this.normalizeRotation(this.selectedElement.rotation + delta);
  }

  setSelectedElementRotation(value: number): void {
    if (!this.selectedElement) return;
    this.selectedElement.rotation = this.normalizeRotation(value);
  }

  updateSelectedElementPosition(axis: 'x' | 'y', value: number | string): void {
    if (!this.selectedElement) return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    this.moveElement(
      this.selectedElement.id,
      axis === 'x' ? parsed : this.selectedElement.x,
      axis === 'y' ? parsed : this.selectedElement.y
    );
  }

  resetLayout(): void {
    this.tablePositions = {};
    this.customSeatOffsets = {};
    this.selectedTableId = '';
    this.selectedSeatKey = '';
    this.selectedElementId = '';
    this.resetViewport();
  }

  saveMap(): void {
    if (!this.selectedVenueId || this.isSavingMap) {
      return;
    }

    if (this.isOverCapacity) {
      this.venueCapacity = this.totalSeats;
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
          .map((seat) => ({
            number: seat.number,
            x: Math.round(seat.cx),
            y: Math.round(seat.cy),
            relX: Math.round(seat.cx - table.x),
            relY: Math.round(seat.cy - table.y)
          }))
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
        const configuredSections = this.extractArray(venueConfig?.['sections'], ['sections']);
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
             seat?.['section_id'] ??
            seat?.['sectionId'] ??
            seat?.['section_name'] ??
            this.asRecord(seat?.['section'])?.['name'] ??
            this.referenceSectionId(tableNumber)
          ).trim().toLowerCase();

          if (!sectionTablesByName.has(secName)) sectionTablesByName.set(secName, new Set<number>());
          sectionTablesByName.get(secName)!.add(tableNumber);

          const counts = seatsPerTableByName.get(secName) ?? {};
          counts[tableNumber] = (counts[tableNumber] ?? 0) + 1;
          seatsPerTableByName.set(secName, counts);
        });

        const normalizedSections = !seats.length && configuredSections.length
          ? configuredSections
          : sections.length ? sections : this.createReferenceSections(sectionTablesByName);
        this.sections = normalizedSections.map((value, index) => {
          const section = this.asRecord(value);
          const secId = String(section?.['id'] ?? index + 1);
          const secName = String(section?.['name'] ?? `SECCION ${index + 1}`);
          const secNameLower = secName.trim().toLowerCase();
          const secIdLower = secId.trim().toLowerCase();

          let tableNumbersSet = sectionTablesByName.get(secIdLower) ?? sectionTablesByName.get(secNameLower);
          const tableNumbers = Array.from(tableNumbersSet ?? []).sort((a, b) => a - b);
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

        const zoneElements = this.planElements.filter((el) => el.kind === 'zone' && !el.id.toLowerCase().includes('foh'));
        zoneElements.forEach((zoneEl, zIdx) => {
          const zLabel = zoneEl.label.trim().toLowerCase();
          const zId = zoneEl.id.trim().toLowerCase();
          const matching = this.sections.find((s) => s.id === zoneEl.sectionId) ?? this.sections[zIdx] ?? this.sections.find((s) => {
            const sName = s.name.trim().toLowerCase();
            const sId = s.id.trim().toLowerCase();
            return (
              sName === zLabel ||
              zLabel.includes(sName) ||
              sName.includes(zLabel) ||
              zId.includes(sId) ||
              sId.includes(zId.replace('zone-', '').replace('-zone', ''))
            );
          }) ?? this.sections[zIdx];

          if (matching) {
            zoneEl.sectionId = matching.id;
          }
        });

        const configuredTableByNum = new Map<number, { x: number; y: number; rotation: number }>();
        const configuredTableById = new Map<string, { x: number; y: number; rotation: number }>();
        const loadedSeatOffsets: Record<string, { relX: number; relY: number }> = {};

        configuredTables.forEach((tableItem) => {
          const t = this.asRecord(tableItem);
          if (!t) return;
          const x = this.toFiniteNumber(t['x']);
          const y = this.toFiniteNumber(t['y']);
          const rotation = this.toFiniteNumber(t['rotation']) ?? 0;
          if (x === null || y === null) return;
          const pos = { x, y, rotation };
          const tableNum = this.toFiniteNumber(t['number'] ?? t['label'] ?? String(t['id']).replace(/\D/g, ''));
          if (tableNum !== null) {
            configuredTableByNum.set(tableNum, pos);
          }
          if (t['id']) {
            configuredTableById.set(String(t['id']), pos);
          }

          const tableSeats = this.extractArray(t['seats'], ['seats']);
          if (tableSeats.length) {
            const center = { x: x + TABLE_W / 2, y: y + TABLE_H / 2 };
            tableSeats.forEach((seatItem) => {
              const s = this.asRecord(seatItem);
              if (!s) return;
              const sNum = this.toFiniteNumber(s['number'] ?? s['seat_number']);
              const sx = this.toFiniteNumber(s['x']);
              const sy = this.toFiniteNumber(s['y']);
              if (sNum !== null && sx !== null && sy !== null) {
                const defaultPos = getLocalSeatPosition(sNum, tableSeats.length);
                const unrotated = this.rotatePoint(sx, sy, center.x, center.y, -rotation);
                const relX = Math.round(unrotated.x - x);
                const relY = Math.round(unrotated.y - y);
                if (Math.abs(relX - defaultPos.relX) > 2 || Math.abs(relY - defaultPos.relY) > 2) {
                  if (t['id']) loadedSeatOffsets[`${t['id']}-s${sNum}`] = { relX, relY };
                  if (tableNum !== null) loadedSeatOffsets[`table-${tableNum}-s${sNum}`] = { relX, relY };
                }
              }
            });
          }
        });

        this.sections.forEach((sec, sIdx) => {
          (sec.tableNumbers ?? []).forEach((tableNumber, i) => {
            const tableId = `${sec.id}-t${i}`;
            const numKey = `table-${tableNumber}`;
            for (const [k, v] of Object.entries(loadedSeatOffsets)) {
              if (k.startsWith(`${numKey}-s`)) {
                const sSuffix = k.replace(`${numKey}-`, '');
                loadedSeatOffsets[`${tableId}-${sSuffix}`] = v;
              }
            }

            const saved = configuredTableByNum.get(tableNumber)
              ?? configuredTableById.get(tableId)
              ?? configuredTableById.get(`table-${tableNumber}`);

            if (saved) {
              newTablePositions[tableId] = {
                x: saved.x,
                y: saved.y,
                rotation: saved.rotation
              };
            } else if (configuredTables.length === 0) {
              newTablePositions[tableId] = calculateReferenceTablePosition(tableNumber);
            } else {
              newTablePositions[tableId] = this.getDefaultTablePosition(sIdx, i);
            }
          });
        });

        this.tablePositions = newTablePositions;
        this.customSeatOffsets = loadedSeatOffsets;

        const savedTotalSeats = this.toFiniteNumber(savedMap?.['total_seats'] ?? venueConfig?.['total_seats']);
        if (savedTotalSeats !== null && savedTotalSeats > 0) {
          this.venueCapacity = savedTotalSeats;
        } else if (sourceSeats.length > 0) {
          this.venueCapacity = sourceSeats.length;
        } else {
          setTimeout(() => {
            if (!this.venueCapacity && this.totalSeats > 0) {
              this.venueCapacity = this.totalSeats;
            }
          });
        }

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

  private clampTableToCanvas(x: number, y: number, rotation: number): { x: number; y: number; rotation: number } {
    const minX = 20;
    const maxX = CANVAS_W - TABLE_W - 20;
    const minY = 120;
    const maxY = CANVAS_H - TABLE_H - 40;

    return {
      x: this.clamp(Math.round(x), minX, maxX),
      y: this.clamp(Math.round(y), minY, maxY),
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

  private getZoneForSection(section: SectionDef, sectionIndex?: number): PlanElement | undefined {
    const sId = (section.id || '').trim().toLowerCase();
    const sName = (section.name || '').trim().toLowerCase();

    const matched = this.planElements.find((el) => {
      if (el.kind !== 'zone' || el.id.toLowerCase().includes('foh')) return false;
      if (el.sectionId && el.sectionId.toLowerCase() === sId) return true;
      const elLabel = (el.label || '').trim().toLowerCase();
      const elId = (el.id || '').trim().toLowerCase();
      return (
        elLabel === sName ||
        elLabel.includes(sName) ||
        sName.includes(elLabel) ||
        (sId && (elId.includes(sId) || sId.includes(elId.replace('zone-', '').replace('-zone', ''))))
      );
    });

    if (matched) return matched;
    if (sectionIndex !== undefined) {
      const zones = this.planElements.filter((el) => el.kind === 'zone' && !el.id.toLowerCase().includes('foh'));
      return zones[sectionIndex];
    }
    return undefined;
  }

  private keepTableInsideZone(zone: PlanElement | undefined, x: number, y: number, rotation: number): { x: number; y: number; rotation: number } {
    if (zone) {
      const minX = zone.x + SEAT_OFFSET + SEAT_RADIUS + 4;
      const maxX = zone.x + zone.w - TABLE_W - SEAT_OFFSET - SEAT_RADIUS - 4;
      const minY = zone.y + 14;
      const maxY = zone.y + zone.h - TABLE_H - 14;

      if (maxX >= minX && maxY >= minY) {
        return {
          x: this.clamp(Math.round(x), minX, maxX),
          y: this.clamp(Math.round(y), minY, maxY),
          rotation: this.normalizeRotation(rotation)
        };
      }
    }

    return this.clampTableToCanvas(x, y, rotation);
  }

  private setTablePosition(tableId: string, x: number, y: number, rotation?: number): void {
    const current = this.tablePositions[tableId];
    const table = this.previewData.tables.find((item) => item.id === tableId);
    const section = table ? this.sections.find((s) => s.id === table.sectionId) : undefined;
    const sectionIndex = section ? this.sections.indexOf(section) : undefined;
    const zone = section ? this.getZoneForSection(section, sectionIndex) : undefined;
    const nextRotation = rotation ?? current?.rotation ?? table?.rotation ?? 0;
    const next = this.keepTableInsideZone(zone, x, y, nextRotation);
    this.tablePositions = {
      ...this.tablePositions,
      [tableId]: next
    };
  }

  private moveElement(elementId: string, x: number, y: number): void {
    const currentElem = this.planElements.find((item) => item.id === elementId);
    if (!currentElem) return;

    const targetX = this.clamp(Math.round(x), 0, CANVAS_W - currentElem.w);
    const targetY = this.clamp(Math.round(y), 0, CANVAS_H - currentElem.h);
    const dx = targetX - currentElem.x;
    const dy = targetY - currentElem.y;

    if (dx === 0 && dy === 0) return;

    if (currentElem.kind === 'zone') {
      const tablesToMove = this.getTablesForZone(currentElem);
      if (tablesToMove.length > 0) {
        const updatedPositions = { ...this.tablePositions };
        tablesToMove.forEach((table) => {
          const currentPos = updatedPositions[table.id] ?? { x: table.x, y: table.y, rotation: table.rotation };
          updatedPositions[table.id] = {
            ...currentPos,
            x: this.clamp(Math.round(currentPos.x + dx), 20, CANVAS_W - TABLE_W - 20),
            y: this.clamp(Math.round(currentPos.y + dy), 120, CANVAS_H - TABLE_H - 40)
          };
        });
        this.tablePositions = updatedPositions;
      }
    }

    this.planElements = this.planElements.map((element) =>
      element.id === elementId
        ? {
            ...element,
            x: targetX,
            y: targetY
          }
        : element
    );
  }

  private getTablesForZone(element: PlanElement): PreviewTable[] {
    if (element.kind !== 'zone') return [];

    const allTables = this.previewData.tables;
    const labelLower = (element.label || '').trim().toLowerCase();
    const idLower = (element.id || '').trim().toLowerCase();
    const targetSectionId = element.sectionId;

    // Strict lookup: find the specific section associated with this zone
    const targetSection = this.sections.find((sec) => {
      if (targetSectionId && sec.id === targetSectionId) return true;
      const secNameLower = sec.name.trim().toLowerCase();
      const secIdLower = sec.id.trim().toLowerCase();
      return (
        secNameLower === labelLower ||
        labelLower.includes(secNameLower) ||
        secNameLower.includes(labelLower) ||
        idLower.includes(secIdLower) ||
        secIdLower.includes(idLower.replace('zone-', '').replace('-zone', ''))
      );
    });

    if (targetSection) {
      // Return ONLY tables belonging strictly to this section
      return allTables.filter((table) =>
        table.sectionId === targetSection.id ||
        table.sectionName.trim().toLowerCase() === targetSection.name.trim().toLowerCase()
      );
    }

    // Direct match against table section properties only
    return allTables.filter((table) => {
      const secName = (table.sectionName || '').trim().toLowerCase();
      const secId = (table.sectionId || '').trim().toLowerCase();
      return (
        Boolean(secName && (labelLower === secName || labelLower.includes(secName) || secName.includes(labelLower))) ||
        Boolean(secId && (idLower.includes(secId) || secId.includes(idLower.replace('zone-', '').replace('-zone', ''))))
      );
    });
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
