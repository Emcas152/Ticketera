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

          <div #viewport class="map-viewport" (wheel)="onWheel($event)" (pointerdown)="onPointerDown($event)" (pointermove)="onPointerMove($event)" (pointerup)="onPointerUp()" (pointerleave)="onPointerUp()">
            <svg class="seat-svg" [attr.viewBox]="'0 0 ' + seatMap.width + ' ' + seatMap.height">
              <defs>
                <linearGradient id="tableGlow" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffe893"/><stop offset="100%" stop-color="#ffae42"/></linearGradient>
                <linearGradient id="posterBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#b40d0d"/><stop offset="100%" stop-color="#6f0404"/></linearGradient>
                <linearGradient id="stageBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#070b1a"/><stop offset="100%" stop-color="#283044"/></linearGradient>
              </defs>
              <g [attr.transform]="transformMatrix">
                <rect x="0" y="0" [attr.width]="seatMap.width" [attr.height]="seatMap.height" fill="#a7a7aa"/>
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
                  <rect class="section-band" [attr.x]="sectionBounds(section).x" [attr.y]="sectionBounds(section).y" [attr.width]="sectionBounds(section).width" [attr.height]="sectionBounds(section).height" rx="28" [attr.fill]="section.color" [attr.opacity]="activeSectionId && activeSectionId !== section.id ? 0.02 : 0.055"/>
                </g>
                <g *ngFor="let amenity of seatMap.amenities ?? []">
                  <rect [attr.x]="amenity.x" [attr.y]="amenity.y" [attr.width]="amenity.width" [attr.height]="amenity.height" fill="#73757d"/>
                  <text class="amenity-label" [attr.x]="amenity.x + amenity.width / 2" [attr.y]="amenity.y + 54" text-anchor="middle">{{ amenity.label }}</text>
                </g>
                <g *ngFor="let table of seatMap.tables">
                  <rect class="table-plate" [class.inactive]="activeSectionId && activeSectionId !== table.sectionId" [attr.x]="table.x" [attr.y]="table.y" [attr.width]="table.width" [attr.height]="table.height" rx="8" (click)="focusTable(table)"/>
                  <text class="table-label" [class.inactive]="activeSectionId && activeSectionId !== table.sectionId" [attr.x]="table.x + table.width / 2" [attr.y]="table.y + table.height / 2 + 12" text-anchor="middle">{{ table.label }}</text>
                  <g *ngFor="let seat of table.seats">
                    <circle class="seat-node" [class.selected]="selectedSeatIds.has(seat.id)" [class.inactive]="activeSectionId && activeSectionId !== table.sectionId && !selectedSeatIds.has(seat.id)" [attr.cx]="seat.x" [attr.cy]="seat.y" [attr.r]="seatRadius(seat)" [attr.fill]="seatFill(seat)" [attr.stroke]="seatStroke(seat)" [attr.stroke-width]="selectedSeatIds.has(seat.id) ? 5 : 2" (click)="openSeatCard(seat, $event)"/>
                    <text class="seat-number" [attr.x]="seat.x" [attr.y]="seat.y + 4" text-anchor="middle">{{ seat.number }}</text>
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
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .section-header,.map-topbar{display:flex;justify-content:space-between;gap:16px}.map-topbar{align-items:flex-start;flex-wrap:wrap}.map-topbar p,.section-copy{color:var(--text-muted)}.seat-layout{display:grid}.legend-card{display:flex;flex-wrap:wrap;gap:10px 16px;padding:12px 16px;border-radius:16px;background:#f8fafc;font-weight:700}.legend-card span{display:inline-flex;align-items:center;gap:8px}.dot{width:14px;height:14px;border-radius:50%}.dot.vip{background:#65ff00}.dot.general{background:#49a7ff}.dot.reserved{background:#ffb020}.dot.sold{background:#ff4b4b}.dot.selected{background:#111827}.map-viewport{position:relative;overflow:hidden;min-height:860px;border-radius:24px;background:#7d7d7d;cursor:grab;touch-action:none}.map-viewport:active{cursor:grabbing}.seat-svg{width:100%;height:100%;min-height:860px}.lane-label,.stage-title,.poster-title,.poster-subtitle,.poster-line,.amenity-label,.table-label,.badge-label,.entrance-label{font-weight:800}.lane-label{font-size:28px}.stage-title{fill:#fff;font-size:46px;letter-spacing:.08em}.poster-title{fill:#fff5dc;font-size:40px;font-style:italic}.poster-subtitle{fill:#fff;font-size:18px}.poster-line{fill:#fff;font-size:40px;letter-spacing:.06em}.amenity-label{fill:#fff;font-size:30px}.table-plate{fill:url(#tableGlow);stroke:rgba(255,245,214,.9);stroke-width:6;cursor:pointer}.table-plate.inactive,.table-label.inactive,.seat-node.inactive{opacity:.4}.table-label{fill:#374151;font-size:34px}.seat-node{cursor:pointer}.seat-number{fill:#0f172a;font-size:11px;font-weight:700;pointer-events:none}.badge-label{fill:#111827;font-size:24px}.entrance-label{fill:#050505;font-size:66px;letter-spacing:.04em}@media (max-width:768px){.section-header{flex-direction:column;align-items:stretch}.map-viewport,.seat-svg{min-height:620px}}
  `]
})
export class SeatMapComponent {
  private readonly route = inject(ActivatedRoute);
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
  private isPanning = false;
  private startX = 0;
  private startY = 0;
  private startPanX = 0;
  private startPanY = 0;

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
    const minX = Math.min(...tables.map((table) => table.x - 54));
    const maxX = Math.max(...tables.map((table) => table.x + table.width + 54));
    const minY = Math.min(...tables.map((table) => table.y - 44));
    const maxY = Math.max(...tables.map((table) => table.y + table.height + 44));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  resetView(): void {
    this.scale = 0.58;
    this.panX = 10;
    this.panY = 6;
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    this.zoomBy(event.deltaY < 0 ? 1.08 : 0.92, event.clientX, event.clientY);
  }

  onPointerDown(event: PointerEvent): void {
    const tagName = (event.target as Element | null)?.tagName.toLowerCase();
    if (tagName === 'circle') return;
    this.isPanning = true;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.startPanX = this.panX;
    this.startPanY = this.panY;
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.isPanning) return;
    this.panX = this.startPanX + (event.clientX - this.startX);
    this.panY = this.startPanY + (event.clientY - this.startY);
  }

  onPointerUp(): void {
    this.isPanning = false;
  }

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
