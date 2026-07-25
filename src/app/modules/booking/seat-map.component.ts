import { CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { EventItem } from '../../core/models/event.model';
import { Seat, SeatMap, SeatSection, SeatTable } from '../../core/models/seat.model';
import { BookingService } from '../../core/services/booking.service';
import { EventService } from '../../core/services/event.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';

@Component({
  selector: 'app-seat-map',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, ...MATERIAL_IMPORTS],
  template: `
    <section class="page-shell" *ngIf="event && seatMap">
      <div class="section-header">
        <div>
          <p class="eyebrow">Seat selection</p>
          <h1>{{ event.name }}</h1>
          <p class="section-copy">{{ event.date | date: 'EEEE, d MMM' }} - {{ event.time }} - {{ event.venueName }}</p>
        </div>
        <a mat-stroked-button [routerLink]="['/events', event.id]">Volver al detalle</a>
      </div>

      <div class="seat-layout">
        <div class="panel-surface map-panel">
          <div class="map-topbar">
            <div>
              <strong>Plano del venue</strong>
              <p>{{ seatMap.venueName }} · {{ availableSeatCount }} libres</p>
            </div>
            <div class="legend-card">
              <span><i class="dot vip"></i>VIP</span>
              <span><i class="dot general"></i>General</span>
              <span><i class="dot reserved"></i>Reservado</span>
              <span><i class="dot sold"></i>Vendido</span>
              <span><i class="dot selected"></i>Seleccionado</span>
            </div>
          </div>

          <!-- Section filter chips (outside viewport so they're always visible) -->
          <div class="section-chips">
            <button class="chip" *ngFor="let s of selectableSections"
              [class.active]="activeSectionId === s.id"
              (click)="activeSectionId = (activeSectionId === s.id ? null : s.id)">
              <span class="chip-dot" [style.background]="s.color"></span>
              {{ s.name }}
            </button>
          </div>

          <div #viewport class="map-viewport">
            <svg
              #svgContainer
              class="seat-svg"
              [attr.viewBox]="viewBoxX + ' ' + viewBoxY + ' ' + viewBoxW + ' ' + viewBoxH"
              preserveAspectRatio="xMidYMid meet"
              (wheel)="onWheel($event)"
              (mousedown)="onMouseDown($event)"
              (mousemove)="onMouseMove($event)"
              (mouseup)="onMouseUp()"
              (mouseleave)="onMouseUp()"
            >
              <defs>
                <linearGradient id="tableGlow" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffe893"/><stop offset="100%" stop-color="#ffae42"/></linearGradient>
                <linearGradient id="posterBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#b40d0d"/><stop offset="100%" stop-color="#6f0404"/></linearGradient>
                <linearGradient id="stageBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#070b1a"/><stop offset="100%" stop-color="#283044"/></linearGradient>
                <filter id="glowVip" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <filter id="glowGeneral" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              <g>
                <rect x="-250" y="-250" [attr.width]="(seatMap.width || 1900) + 500" [attr.height]="(seatMap.height || 2120) + 500" fill="#a8a8a8"/>
                <ng-container *ngFor="let lane of seatMap.lanes ?? []">
                  <rect [attr.x]="lane.x" [attr.y]="lane.y" [attr.width]="lane.width" [attr.height]="lane.height" [attr.fill]="lane.fill"/>
                  <text class="lane-label" [attr.x]="lane.x + lane.width / 2" [attr.y]="lane.y + lane.height / 2" [attr.transform]="'rotate(-90 ' + (lane.x + lane.width / 2) + ' ' + (lane.y + lane.height / 2) + ')'" text-anchor="middle">{{ lane.label }}</text>
                </ng-container>
                <g *ngIf="seatMap.stage as stage">
                  <rect [attr.x]="stage.x" [attr.y]="stage.y" [attr.width]="stage.width" [attr.height]="stage.height" fill="url(#stageBg)"/>
                  <text class="stage-title" [attr.x]="stage.x + stage.width / 2" [attr.y]="stage.y + 58" text-anchor="middle">{{ stage.label }}</text>
                </g>
                <g *ngIf="seatMap.poster as poster">
                  <rect [attr.x]="poster.x" [attr.y]="poster.y" [attr.width]="poster.width" [attr.height]="poster.height" fill="url(#posterBg)"/>
                  <text class="poster-title" [attr.x]="poster.x + poster.width / 2" [attr.y]="poster.y + 90" text-anchor="middle">{{ poster.title }}</text>
                  <text class="poster-subtitle" *ngIf="poster.subtitle" [attr.x]="poster.x + poster.width / 2" [attr.y]="poster.y + 124" text-anchor="middle">{{ poster.subtitle }}</text>
                  <text class="poster-line" *ngFor="let line of poster.lines; let i = index" [attr.x]="poster.x + poster.width / 2" [attr.y]="poster.y + 540 + i * 84" text-anchor="middle">{{ line }}</text>
                </g>
                <g *ngFor="let section of seatMap.sections">
                  <rect
                    class="section-band map-zone-vip-outline"
                    [ngClass]="getZoneClass(section.name)"
                    [attr.x]="sectionBounds(section).x"
                    [attr.y]="sectionBounds(section).y"
                    [attr.width]="sectionBounds(section).width"
                    [attr.height]="sectionBounds(section).height"
                    rx="8"
                    ry="8"
                    [attr.opacity]="activeSectionId && activeSectionId !== section.id ? 0.25 : 1"
                  />
                  <text
                    class="map-zone-section-label"
                    [ngClass]="getSectionLabelClass(section.name)"
                    [attr.x]="sectionBounds(section).x - 42"
                    [attr.y]="sectionBounds(section).y + sectionBounds(section).height / 2"
                    [attr.transform]="'rotate(-90 ' + (sectionBounds(section).x - 42) + ' ' + (sectionBounds(section).y + sectionBounds(section).height / 2) + ')'"
                    font-size="27"
                    letter-spacing="0.11em"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    pointer-events="none"
                  >
                    {{ section.name }}
                  </text>
                </g>
                <g *ngFor="let amenity of seatMap.amenities ?? []">
                  <rect [attr.x]="amenity.x" [attr.y]="amenity.y" [attr.width]="amenity.width" [attr.height]="amenity.height" fill="#73757d"/>
                  <text class="amenity-label" [attr.x]="amenity.x + amenity.width / 2" [attr.y]="amenity.y + 54" text-anchor="middle">{{ amenity.label }}</text>
                </g>
                <g *ngFor="let table of seatMap.tables">
                  <rect
                    class="table-plate map-table"
                    [ngClass]="getTableClass(table.sectionName)"
                    [class.inactive]="activeSectionId && activeSectionId !== table.sectionId"
                    [attr.x]="table.x"
                    [attr.y]="table.y"
                    [attr.width]="table.width"
                    [attr.height]="table.height"
                    rx="4"
                    ry="4"
                    (click)="focusTable(table)"
                  />
                  <text class="table-label map-table-label" [class.inactive]="activeSectionId && activeSectionId !== table.sectionId" [attr.x]="table.x + table.width / 2" [attr.y]="table.y + table.height / 2" text-anchor="middle" dominant-baseline="middle">{{ table.label }}</text>
                  
                  <g *ngIf="isRowStart(table.label)" class="map-row-marker" [attr.transform]="'translate(' + (table.x - 62) + ' ' + (table.y + table.height / 2) + ')'" pointer-events="none">
                    <circle r="15" fill="#0f172a" stroke="rgba(255, 255, 255, 0.78)" stroke-width="1.5" />
                    <text x="0" y="1" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-size="11" font-weight="800">{{ getRowNumber(table.label) }}</text>
                  </g>

                  <g *ngFor="let seat of table.seats">
                    <circle class="seat-node" [ngClass]="getSeatClass(seat)" [class.selected]="selectedSeatIds.has(seat.id)" [class.inactive]="activeSectionId && activeSectionId !== table.sectionId && !selectedSeatIds.has(seat.id)" [attr.cx]="seat.x" [attr.cy]="seat.y" [attr.r]="seatRadius(seat)" (click)="openSeatCard(seat, $event)"/>
                    <text class="seat-number" [attr.x]="seat.x" [attr.y]="seat.y + 1" text-anchor="middle" dominant-baseline="middle">{{ seat.number }}</text>
                  </g>
                </g>
                <g *ngFor="let badge of seatMap.badges ?? []" [attr.transform]="'rotate(' + (badge.rotation ?? 0) + ' ' + badge.x + ' ' + badge.y + ')'">
                  <rect [attr.x]="badge.x - 20" [attr.y]="badge.y - 24" width="40" height="48" fill="#ffd56a" stroke="#c28d14" stroke-width="2"/>
                  <text class="badge-label" [attr.x]="badge.x" [attr.y]="badge.y + 8" text-anchor="middle">{{ badge.label }}</text>
                </g>
                <g *ngIf="seatMap.entrance as entrance">
                  <rect x="60" y="1300" width="280" height="18" fill="#060606" rx="9"/>
                  <rect x="720" y="1300" width="520" height="18" fill="#060606" rx="9"/>
                  <rect x="710" y="1410" width="18" height="250" fill="#060606" rx="9"/>
                  <g [attr.transform]="arrowTransform(entrance)"><polygon points="0,0 84,-66 84,-26 186,-26 186,26 84,26 84,66" fill="#060606"/></g>
                  <text class="entrance-label" [attr.x]="entrance.x" [attr.y]="entrance.y" text-anchor="middle">{{ entrance.label }}</text>
                </g>
              </g>
            </svg>

            <!-- Floating Controls matching alconProducciones -->
            <div class="map-controls-bar">
              <button type="button" class="control-btn center-btn" (click)="resetView()">Centrar</button>
              <button type="button" class="control-btn zoom-icon-btn" (click)="zoomIn()">+</button>
              <button type="button" class="control-btn zoom-icon-btn" (click)="zoomOut()">&minus;</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    /* ─── Layout ─────────────────────────────────────────── */
    .section-header { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; }
    .map-topbar { display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px; padding:20px 24px 16px; border-bottom:1px solid rgba(255,255,255,.1); }
    .map-topbar strong { font-size:1rem; color:#f1f5f9 !important; }
    .map-topbar p, .section-copy { color:#94a3b8 !important; margin:2px 0 0; font-size:.85rem; }
    .seat-layout { display:grid; }
    /* Override global .panel-surface padding/bg for map panel */
    .panel-surface.map-panel { padding:0 !important; background:linear-gradient(160deg,#0f1523 0%,#141c2e 100%) !important; border-color:rgba(255,255,255,.08) !important; }

    /* ─── Legend card ────────────────────────────────────── */
    .legend-card {
      display:flex; flex-wrap:wrap; gap:8px 14px;
      padding:10px 16px; border-radius:14px;
      background:rgba(255,255,255,.06);
      backdrop-filter:blur(12px);
      border:1px solid rgba(255,255,255,.1);
      font-size:.78rem; font-weight:700; color:#e2e8f0;
    }
    .legend-card span { display:inline-flex; align-items:center; gap:7px; }
    .dot { width:12px; height:12px; border-radius:50%; box-shadow:0 0 6px currentColor; }
    .dot.vip     { background:#65ff00; box-shadow:0 0 8px #65ff00; }
    .dot.general { background:#49a7ff; box-shadow:0 0 8px #49a7ff; }
    .dot.reserved{ background:#ffb020; box-shadow:0 0 8px #ffb020; }
    .dot.sold    { background:#ff4b4b; box-shadow:0 0 8px #ff4b4b; }
    .dot.selected{ background:#fff;    box-shadow:0 0 8px #fff; }

    /* ─── Map panel ──────────────────────────────────────── */
    .panel-surface.map-panel {
      border-radius:24px;
      background:linear-gradient(160deg, #0f1523 0%, #141c2e 100%);
      border:1px solid rgba(255,255,255,.08);
      overflow:hidden;
    }

    /* ─── Viewport ───────────────────────────────────────── */
    .map-viewport{position:relative;overflow:hidden;min-height:860px;border-radius:0 0 24px 24px;background:#a8a8a8;cursor:grab;touch-action:none;user-select:none}
    .seat-svg{width:100%;height:100%;min-height:860px;display:block;position:relative;z-index:1;background:#a8a8a8}

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
    .seat-node{cursor:pointer;transition:transform .15s}
    .seat-node:hover{filter:brightness(1.15)}
    .seat-number{fill:#ffffff;font-size:8px;font-weight:800;pointer-events:none;font-family:sans-serif}
    .seat-fill-diamante{fill:#091f49;stroke:rgba(255,255,255,.24);stroke-width:1}
    .seat-fill-vip{fill:#e06000;stroke:rgba(255,255,255,.24);stroke-width:1}
    .seat-fill-general{fill:#008080;stroke:rgba(255,255,255,.24);stroke-width:1}
    .seat-fill-reserved,.seat-fill-sold{fill:#9a1c28;stroke:rgba(255,255,255,.22);stroke-width:1}
    .seat-fill-selected{fill:#ffe066;stroke:#111827;stroke-width:2;filter:drop-shadow(0 4px 10px rgba(0,0,0,.4))}

    /* Floating Controls */
    .map-controls-bar{position:absolute;bottom:16px;right:16px;z-index:20;display:flex;border-radius:6px;overflow:hidden;background:#18181b;box-shadow:0 4px 12px rgba(0,0,0,.35)}
    .control-btn{height:36px;border:none;background:#18181b;color:#ffffff;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s}
    .control-btn:hover{background:#27272a}
    .center-btn{padding:0 16px;font-size:12px;text-transform:uppercase;letter-spacing:.14em;border-right:1px solid rgba(255,255,255,.15)}
    .zoom-icon-btn{width:36px;font-size:18px}
    .zoom-icon-btn:first-of-type{border-right:1px solid rgba(255,255,255,.15)}

    /* ─── Section filter chips ───────────────────────────── */
    .section-chips {
      display:flex; flex-wrap:wrap; gap:8px;
      padding:12px 20px 14px;
      border-bottom:1px solid rgba(255,255,255,.07);
    }
    .chip {
      display:inline-flex; align-items:center; gap:8px;
      padding:7px 16px; border-radius:20px; cursor:pointer;
      background:rgba(255,255,255,.07);
      border:1.5px solid rgba(255,255,255,.18);
      color:#e2e8f0 !important; font-size:.82rem; font-weight:700; letter-spacing:.02em;
      transition:all .18s; white-space:nowrap;
    }
    .chip:hover { color:#fff !important; border-color:rgba(255,255,255,.4); background:rgba(255,255,255,.12); }
    .chip.active {
      color:#fff !important;
      background:rgba(255,255,255,.18);
      border-color:rgba(255,255,255,.5);
      box-shadow:0 0 0 2px rgba(255,255,255,.08);
    }
    .chip-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }

    /* ─── Responsive ─────────────────────────────────────── */
    @media (max-width:768px) {
      .section-header { flex-direction:column; align-items:stretch; }
      .map-viewport, .seat-svg { min-height:620px; }
      .section-chips { top:8px; left:8px; }
    }
  `]
})
export class SeatMapComponent {
  private readonly route = inject(ActivatedRoute);

  @ViewChild('svgContainer') private svgContainerRef?: ElementRef<SVGSVGElement>;

  viewBoxX = 0;
  viewBoxY = 0;
  viewBoxW = 1900;
  viewBoxH = 2120;

  isPanning = false;
  startPanX = 0;
  startPanY = 0;

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

  getSeatClass(seat: Seat): string {
    if (this.selectedSeatIds.has(seat.id)) return 'seat-fill-selected';
    if (seat.status === 'reserved' || seat.status === 'sold') return 'seat-fill-sold';
    const name = (seat.section || seat.sectionId || '').toLowerCase();
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
  private readonly events = inject(EventService);
  private readonly booking = inject(BookingService);
  private readonly destroyRef = inject(DestroyRef);
  @ViewChild('viewport') private viewportRef?: ElementRef<HTMLDivElement>;

  readonly serviceFee = 175;
  event?: EventItem;
  seatMap?: SeatMap;
  activeSectionId: string | null = null;
  pendingSeat?: Seat;
  selectedSeatIds = new Set<string>();
  selectedSeats: Seat[] = [];
  totals = this.booking.getTotals([]);
  scale = 1;
  panX = 0;
  panY = 0;

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const eventId = params.get('eventId') ?? '';
          this.booking.setActiveEvent(eventId);
          return this.events.getEventById(eventId);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => {
        this.event = event;
        if (!event) return;
        this.booking.setActiveEvent(event.id, event);
        this.booking.getSeatMap(event.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((seatMap) => {
          this.seatMap = seatMap;
          this.activeSectionId = this.selectableSections[0]?.id ?? null;
          this.resetView();
        });
      });

    this.booking.cart$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((cart) => {
      this.selectedSeats = cart.seats;
      this.selectedSeatIds = new Set(cart.seats.map((seat) => seat.id));
      this.totals = this.booking.getTotals(cart.seats);
    });
  }

  get transformMatrix(): string {
    return `matrix(${this.scale} 0 0 ${this.scale} ${this.panX} ${this.panY})`;
  }

  get selectableSections(): SeatSection[] {
    return (this.seatMap?.sections ?? []).filter((section) => section.id !== 'occupied');
  }

  get availableSeatCount(): number {
    return (this.seatMap?.tables ?? []).flatMap((table) => table.seats).filter((seat) => seat.status === 'available').length;
  }

  openSeatCard(seat: Seat, event: Event): void {
    event.stopPropagation();
    if (!this.selectedSeatIds.has(seat.id) && (seat.status !== 'available' || seat.sectionId === 'occupied')) return;
    this.booking.toggleSeat(seat);
    this.activeSectionId = seat.sectionId;
  }

  seatFill(seat: Seat): string {
    if (this.selectedSeatIds.has(seat.id)) return '#111827';
    if (seat.status === 'reserved') return '#ffb020';
    if (seat.status === 'sold' || seat.sectionId === 'occupied') return '#ff4b4b';
    return seat.sectionId === 'vip' ? '#65ff00' : '#49a7ff';
  }

  seatStroke(seat: Seat): string {
    if (this.selectedSeatIds.has(seat.id)) return '#f8fafc';
    if (seat.status === 'reserved') return '#9a5b00';
    if (seat.status === 'sold' || seat.sectionId === 'occupied') return '#8b1010';
    return seat.sectionId === 'vip' ? '#2a6b00' : '#0b5394';
  }

  seatRadius(seat: Seat): number {
    return this.selectedSeatIds.has(seat.id) ? seat.radius + 2 : seat.radius;
  }

  focusTable(table: SeatTable): void {
    if (!this.seatMap || !this.viewportRef || table.sectionId === 'occupied') return;
    const viewport = this.viewportRef.nativeElement;
    this.activeSectionId = table.sectionId;
    this.scale = this.clamp(1.85, this.seatMap.minScale, this.seatMap.maxScale);
    this.panX = viewport.clientWidth / 2 - (table.x + table.width / 2) * this.scale;
    this.panY = viewport.clientHeight / 2 - (table.y + table.height / 2) * this.scale;
  }

  sectionBounds(section: SeatSection): { x: number; y: number; width: number; height: number } {
    const tables = this.seatMap?.tables.filter((table) => table.sectionId === section.id) ?? [];
    if (!tables.length) {
      return { x: 95, y: 130, width: 1735, height: 500 };
    }
    const minX = Math.min(...tables.map((table) => table.x - 54));
    const maxX = Math.max(...tables.map((table) => table.x + table.width + 54));
    const minY = Math.min(...tables.map((table) => table.y - 44));
    const maxY = Math.max(...tables.map((table) => table.y + table.height + 44));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  resetView(): void {
    if (!this.seatMap) {
      this.viewBoxX = 0;
      this.viewBoxY = 0;
      this.viewBoxW = 1900;
      this.viewBoxH = 2120;
      return;
    }

    const tables = this.seatMap.tables ?? [];
    if (!tables.length) {
      this.viewBoxX = 0;
      this.viewBoxY = 0;
      this.viewBoxW = 1900;
      this.viewBoxH = 2120;
      return;
    }

    const minX = Math.min(95, ...tables.map((t) => t.x - 60));
    const maxX = Math.max(1830, ...tables.map((t) => t.x + t.width + 60));
    const minY = 20;
    const maxY = Math.max(900, ...tables.map((t) => t.y + t.height + 80));

    const contentW = Math.max(1, maxX - minX);
    const contentH = Math.max(1, maxY - minY);

    this.viewBoxX = minX - 95;
    this.viewBoxY = minY - 95;
    this.viewBoxW = contentW + 190;
    this.viewBoxH = contentH + 190;
  }

  zoomIn(): void { this.applyZoomAtCenter(1); }
  zoomOut(): void { this.applyZoomAtCenter(-1); }

  private applyZoomAtCenter(direction: number): void {
    const zoom = Math.exp(-direction * 0.14);
    const newW = this.viewBoxW * zoom;
    const newH = this.viewBoxH * zoom;
    if (newW < 320 || newW > 4200) return;

    this.viewBoxX += (this.viewBoxW - newW) / 2;
    this.viewBoxY += (this.viewBoxH - newH) / 2;
    this.viewBoxW = newW;
    this.viewBoxH = newH;
  }

  private applyZoomAtCursor(direction: number, clientX: number, clientY: number): void {
    const svgEl = this.svgContainerRef?.nativeElement || this.viewportRef?.nativeElement;
    if (!svgEl) return;
    const zoom = Math.exp(-direction * 0.14);
    const newW = this.viewBoxW * zoom;
    const newH = this.viewBoxH * zoom;
    if (newW < 320 || newW > 4200) return;

    const svgRect = svgEl.getBoundingClientRect();
    if (!svgRect.width || !svgRect.height) return;

    const ratioX = (clientX - svgRect.left) / svgRect.width;
    const ratioY = (clientY - svgRect.top) / svgRect.height;

    this.viewBoxX += (this.viewBoxW - newW) * ratioX;
    this.viewBoxY += (this.viewBoxH - newH) * ratioY;
    this.viewBoxW = newW;
    this.viewBoxH = newH;
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    this.applyZoomAtCursor(event.deltaY < 0 ? 1 : -1, event.clientX, event.clientY);
  }

  onMouseDown(event: MouseEvent): void {
    const target = event.target as SVGElement | null;
    if (target?.tagName.toLowerCase() === 'circle') return;
    event.preventDefault();
    this.isPanning = true;
    this.startPanX = event.clientX;
    this.startPanY = event.clientY;
  }

  onMouseMove(event: MouseEvent): void {
    const svgEl = this.svgContainerRef?.nativeElement || this.viewportRef?.nativeElement;
    if (!this.isPanning || !svgEl) return;
    const svgRect = svgEl.getBoundingClientRect();
    if (!svgRect.width || !svgRect.height) return;

    const dx = event.clientX - this.startPanX;
    const dy = event.clientY - this.startPanY;

    this.viewBoxX -= dx * (this.viewBoxW / svgRect.width);
    this.viewBoxY -= dy * (this.viewBoxH / svgRect.height);

    this.startPanX = event.clientX;
    this.startPanY = event.clientY;
  }

  onMouseUp(): void { this.isPanning = false; }

  arrowTransform(entrance: { x: number; y: number; direction: 'left' | 'right' | 'up' | 'down' }): string {
    const rotation = { left: 0, up: -90, right: 180, down: 90 }[entrance.direction];
    return `translate(${entrance.x - 94} ${entrance.y - 160}) rotate(${rotation} 94 40)`;
  }

  private zoomBy(factor: number, clientX?: number, clientY?: number): void {
    if (!this.seatMap || !this.viewportRef) return;
    const viewport = this.viewportRef.nativeElement;
    const rect = viewport.getBoundingClientRect();
    const localX = clientX ? clientX - rect.left : rect.width / 2;
    const localY = clientY ? clientY - rect.top : rect.height / 2;
    const worldX = (localX - this.panX) / this.scale;
    const worldY = (localY - this.panY) / this.scale;
    this.scale = this.clamp(this.scale * factor, this.seatMap.minScale, this.seatMap.maxScale);
    this.panX = localX - worldX * this.scale;
    this.panY = localY - worldY * this.scale;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
