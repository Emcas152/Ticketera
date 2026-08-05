import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin, map, take } from 'rxjs';
import { BookingRecord } from '../../core/models/booking.model';
import { EventItem } from '../../core/models/event.model';
import { Seat, SeatMap } from '../../core/models/seat.model';
import { BookingService } from '../../core/services/booking.service';
import { EventService } from '../../core/services/event.service';
import { NotificationService } from '../../core/services/notification.service';
import { TicketPdfService } from '../../core/services/ticket-pdf.service';
import { VenueSeatMap, VenueService } from '../../core/services/venue.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';
import { CurrencyGtqPipe } from '../../shared/pipes/currency-gtq.pipe';

@Component({
  selector: 'app-cash-sales',
  standalone: true,
  imports: [CommonModule, AsyncPipe, ReactiveFormsModule, CurrencyGtqPipe, ...MATERIAL_IMPORTS],
  template: `
    <section class="admin-shell">
      <div class="admin-header"><div><p class="eyebrow">Emisión administrativa</p><h1>Crear entradas</h1>
        <p class="admin-subtitle">Selecciona asientos libres del mapa y emite entradas en efectivo o de cortesía.</p></div></div>

      <form class="panel-surface controls" [formGroup]="form" (ngSubmit)="issue()">
        <mat-form-field appearance="outline"><mat-label>Evento</mat-label>
          <mat-select formControlName="eventId" (selectionChange)="loadEvent()">
            @for (event of (events$ | async) ?? []; track event.id) { <mat-option [value]="event.id">{{ event.name }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Tipo de entrada</mat-label><mat-select formControlName="type">
          <mat-option value="cash">Entrada en efectivo</mat-option><mat-option value="courtesy">Entrada de cortesía</mat-option>
        </mat-select></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Cliente / beneficiario</mat-label><input matInput formControlName="customerName" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Número de teléfono</mat-label>
          <input matInput formControlName="customerPhone" type="tel" inputmode="tel" autocomplete="tel" maxlength="30" placeholder="Ej. +502 5555 5555" />
          @if (form.controls.customerPhone.hasError('pattern')) { <mat-error>Ingresa un número de teléfono válido.</mat-error> }
        </mat-form-field>
        <div class="summary"><span>{{ selectedSeats.length }} asiento(s)</span><strong>{{ total | currencyGtq }}</strong></div>
        <button mat-flat-button color="primary" type="submit" [disabled]="processing || !seatMap || selectedSeats.length === 0">
          <mat-icon>{{ form.controls.type.value === 'cash' ? 'point_of_sale' : 'card_giftcard' }}</mat-icon>
          {{ processing ? 'Generando...' : 'Generar entrada' }}
        </button>
      </form>

      <article class="panel-surface map-panel">
        <div class="map-heading"><div><strong>Mapa de asientos</strong>
          <p *ngIf="seatMap">{{ availableCount }} disponibles · {{ selectedSeats.length }} seleccionados</p>
          <p *ngIf="!seatMap">Selecciona un evento para cargar su mapa.</p></div>
          <div class="map-actions" *ngIf="seatMap"><span class="live-status"><i></i> Validación al seleccionar</span>
            <button mat-icon-button type="button" aria-label="Actualizar disponibilidad" matTooltip="Actualizar disponibilidad"
              [disabled]="refreshing" (click)="refreshAvailability()"><mat-icon>refresh</mat-icon></button></div>
        </div>
        <div class="legend"><i></i> Libre <i class="selected"></i> Seleccionado <i class="reserved"></i> Reservado <i class="sold"></i> Vendido</div>

        <div class="venue-viewport" *ngIf="seatMap as map"><div class="venue-map" [style.aspect-ratio]="map.width + ' / ' + map.height">
          <svg [attr.viewBox]="'0 0 ' + map.width + ' ' + map.height" role="group" [attr.aria-label]="'Mapa de asientos de ' + map.venueName">
            @for (lane of map.lanes ?? []; track lane.id) { <rect [attr.x]="lane.x" [attr.y]="lane.y" [attr.width]="lane.width" [attr.height]="lane.height" [attr.fill]="lane.fill" /> }
            @for (element of layoutElements; track element.id) {
              <g [attr.transform]="elementTransform(element)" class="plan-element">
                @switch (element.kind) {
                  @case ('stage') { <rect [attr.width]="element.w" [attr.height]="element.h" rx="6" [attr.fill]="element.color" /><rect x="45" y="0" width="24" [attr.height]="element.h" fill="#f8fafc" opacity=".92" /><rect [attr.x]="element.w - 70" y="0" width="24" [attr.height]="element.h" fill="#f8fafc" opacity=".92" /><text [attr.x]="element.w / 2" [attr.y]="element.h / 2 + 13" text-anchor="middle" class="stage-label">{{ element.label }}</text> }
                  @case ('bathrooms') { <rect [attr.width]="element.w" [attr.height]="element.h" rx="5" [attr.fill]="element.color" /><text [attr.x]="element.w / 2" y="42" text-anchor="middle" class="bathroom-title">{{ element.label }}</text><text [attr.x]="element.w * .36" [attr.y]="element.h - 44" text-anchor="middle" class="bathroom-icon">W</text><text [attr.x]="element.w * .68" [attr.y]="element.h - 44" text-anchor="middle" class="bathroom-icon">M</text> }
                  @case ('entrance') { <path [attr.d]="entryArrowPath(element.w, element.h)" [attr.fill]="element.color" /><text [attr.x]="element.w / 2" [attr.y]="element.h + 54" text-anchor="middle" class="entry-label">{{ element.label }}</text> }
                  @default { <rect [attr.width]="element.w" [attr.height]="element.h" rx="8" class="map-zone" [ngClass]="zoneClass(element.label)" /><text class="zone-label" [ngClass]="zoneLabelClass(element.label)" x="-42" [attr.y]="element.h / 2" [attr.transform]="'rotate(-90 -42 ' + element.h / 2 + ')'" text-anchor="middle" dominant-baseline="middle">{{ element.label }}</text> }
                }
              </g>
            }
            <g class="stage" *ngIf="layoutElements.length === 0"><rect [attr.x]="map.stage.x" [attr.y]="map.stage.y" [attr.width]="map.stage.width" [attr.height]="map.stage.height" rx="8" />
              <text [attr.x]="map.stage.x + map.stage.width / 2" [attr.y]="map.stage.y + map.stage.height / 2" text-anchor="middle" dominant-baseline="middle">{{ map.stage.label }}</text></g>
            @for (table of map.tables; track table.id) { <g class="table" [attr.transform]="'rotate(' + (table.rotation ?? 0) + ' ' + (table.x + table.width / 2) + ' ' + (table.y + table.height / 2) + ')'"> <rect [attr.x]="table.x" [attr.y]="table.y" [attr.width]="table.width" [attr.height]="table.height" rx="4" [ngClass]="tableClass(table.sectionName)" />
              <text [attr.x]="table.x + table.width / 2" [attr.y]="table.y + table.height / 2" text-anchor="middle" dominant-baseline="middle">{{ table.label }}</text></g>
              @if (isRowStart(table.label)) { <g class="row-marker" [attr.transform]="'translate(' + (table.x - 62) + ' ' + (table.y + table.height / 2) + ')'" pointer-events="none"><circle r="15"/><text x="0" y="1" text-anchor="middle" dominant-baseline="middle">{{ rowNumber(table.label) }}</text></g> }
            }
            @for (seat of allSeats; track seat.id) {
              <g class="seat" [class.selected]="isSelected(seat)" [class.reserved]="seat.status === 'reserved'"
                [class.sold]="seat.status === 'sold'" [class.validating]="validatingSeatId === seat.id" [ngClass]="seatSectionClass(seat)"
                [attr.role]="isAvailable(seat) || isSelected(seat) ? 'button' : 'img'" [attr.tabindex]="isAvailable(seat) || isSelected(seat) ? 0 : null"
                [attr.aria-label]="seat.section + ', asiento ' + seat.label + ', ' + (isSelected(seat) ? 'seleccionado' : isAvailable(seat) ? 'disponible' : 'no disponible')"
                (click)="toggleSeat(seat)" (keydown.enter)="toggleSeat(seat)" (keydown.space)="toggleSeat(seat); $event.preventDefault()">
                <circle [attr.cx]="seat.x" [attr.cy]="seat.y" [attr.r]="seat.radius || 12"><title>{{ seat.section }} · {{ seat.label }}</title></circle>
                <text [attr.x]="seat.x" [attr.y]="seat.y + 1" text-anchor="middle" dominant-baseline="middle">{{ seat.number }}</text>
              </g>
            }
          </svg>
        </div></div>
      </article>

      <article class="panel-surface ticket-result" *ngIf="lastBooking"><div><p class="eyebrow">Entrada generada</p><h2>{{ lastBooking.eventName }}</h2>
        <p>{{ lastBooking.orderNumber }} · {{ seatLabels(lastBooking) }}</p></div>
        <button mat-stroked-button type="button" (click)="download(lastBooking)"><mat-icon>picture_as_pdf</mat-icon> Descargar PDF</button>
      </article>
    </section>
  `,
  styles: [`
    .controls{display:grid;grid-template-columns:repeat(4,minmax(180px,1fr)) auto auto;gap:12px;align-items:center;margin-bottom:18px}mat-form-field{width:100%}
    .summary{display:grid;min-width:120px}.summary span,.map-heading p,.ticket-result p{margin:0;color:var(--text-muted);font-size:.82rem}.summary strong{color:var(--brand-primary);font-size:1.15rem}
    .map-panel{padding:18px}.map-heading,.ticket-result,.map-actions{display:flex;justify-content:space-between;align-items:center;gap:12px}
    .legend{display:flex;align-items:center;gap:6px;margin-top:10px;color:var(--text-muted);font-size:.76rem}.legend i{width:12px;height:12px;border-radius:50%;background:#22c55e}.legend i.selected{background:#7c3aed}.legend i.reserved{background:#f59e0b}.legend i.sold{background:#ef4444}
    .venue-viewport{margin-top:16px;height:620px;overflow:auto;border:1px solid #d8dee8;border-radius:14px;background:#d4d4d8}.venue-map{width:min(100%,900px);min-width:680px;margin:auto;background:#a8a8a8}svg{display:block;width:100%;height:100%}
    .stage rect{fill:#111827}.stage text,.stage-label{fill:#fff7ed;font-weight:900;font-size:34px}.table rect{stroke:rgba(255,255,255,.58);stroke-width:1.5;filter:drop-shadow(0 3px 6px rgba(0,0,0,.22))}.table text{fill:#fff;font-size:11px;font-weight:800;pointer-events:none}.table-diamante{fill:#0b2c6b}.table-vip{fill:#e85d04}.table-general{fill:#008c95}
    .map-zone{fill:rgba(69,255,25,.04);stroke-width:2.5;stroke-dasharray:12 8}.zone-diamante{fill:rgba(9,31,73,.07);stroke:rgba(9,31,73,.72)}.zone-vip{fill:rgba(204,82,0,.06);stroke:rgba(204,82,0,.68)}.zone-general{fill:rgba(0,128,128,.06);stroke:rgba(0,128,128,.68)}.zone-default{stroke:rgba(69,255,25,.42)}.zone-label{fill:#fff;stroke-width:8;paint-order:stroke;font-size:27px;font-weight:900;letter-spacing:.11em}.label-diamante{stroke:#091f49}.label-vip{stroke:#c94e00}.label-general{stroke:#007b82}.label-default{stroke:#1e293b}.row-marker circle{fill:#0f172a;stroke:rgba(255,255,255,.78);stroke-width:1.5}.row-marker text{fill:#fff;font-size:11px;font-weight:800}.entry-label,.bathroom-title{font-weight:900}.entry-label{font-size:42px;fill:#020617}.bathroom-title{font-size:30px;fill:#fff}.bathroom-icon{font-size:44px;font-weight:900;fill:#fff}
    .seat{cursor:pointer;outline:none}.seat circle{stroke:rgba(255,255,255,.24);stroke-width:1;transition:.15s}.seat.seat-diamante circle{fill:#091f49}.seat.seat-vip circle{fill:#e06000}.seat.seat-general circle{fill:#008080}.seat text{fill:#fff;font-size:8px;font-weight:800;pointer-events:none}.seat:hover circle,.seat:focus circle{filter:brightness(1.15);stroke:#fff;stroke-width:2.5}
    .seat.selected circle{fill:#8b5cf6;stroke:#4c1d95}.seat.selected text,.seat.reserved text,.seat.sold text{fill:white}.seat.reserved,.seat.sold{cursor:not-allowed}.seat.reserved circle{fill:#f59e0b;stroke:#92400e}.seat.sold circle{fill:#ef4444;stroke:#991b1b}.seat.validating{pointer-events:none;opacity:.55}
    .live-status{display:flex;align-items:center;gap:6px;color:#166534;font-size:.78rem;font-weight:700}.live-status i{width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 4px rgba(34,197,94,.16)}
    .ticket-result{margin-top:18px;padding:20px}.ticket-result h2{margin:4px 0}@media(max-width:1100px){.controls{grid-template-columns:1fr 1fr}.controls mat-form-field:first-child{grid-column:1/-1}}@media(max-width:700px){.controls{grid-template-columns:1fr}.controls mat-form-field:first-child{grid-column:auto}.map-heading,.ticket-result{align-items:flex-start;flex-direction:column}.venue-viewport{height:520px}}
  `]
})
export class CashSalesComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly events = inject(EventService);
  private readonly booking = inject(BookingService);
  private readonly ticketPdf = inject(TicketPdfService);
  private readonly notifications = inject(NotificationService);
  private readonly venues = inject(VenueService);

  readonly events$ = this.events.events$.pipe(map((items) => items.filter((event) => event.status !== 'draft' && event.status !== 'sold-out' && new Date(event.date).getTime() >= new Date().setHours(0, 0, 0, 0))));
  readonly form = this.fb.group({
    eventId: ['', Validators.required],
    type: ['cash' as 'cash' | 'courtesy', Validators.required],
    customerName: [''],
    customerPhone: ['', Validators.pattern(/^\+?[0-9][0-9\s()-]{6,29}$/)]
  });
  selectedEvent: EventItem | null = null;
  seatMap: SeatMap | null = null;
  selectedSeats: Seat[] = [];
  lastBooking: BookingRecord | null = null;
  processing = false;
  refreshing = false;
  validatingSeatId: string | null = null;
  layoutElements: LayoutElement[] = [];
  private venueMapConfig: VenueSeatMap | null = null;

  ngOnInit(): void { this.events.getEvents().subscribe(); }

  get allSeats(): Seat[] {
    if (!this.seatMap) return [];
    const unique = new Map<string, Seat>();
    [...this.seatMap.sections.flatMap((section) => section.seats), ...this.seatMap.tables.flatMap((table) => table.seats)].forEach((seat) => unique.set(seat.id, seat));
    return [...unique.values()];
  }
  get availableCount(): number { return this.allSeats.filter((seat) => this.isAvailable(seat)).length; }
  get total(): number { return this.form.controls.type.value === 'courtesy' ? 0 : this.booking.getTotals(this.selectedSeats).total; }

  loadEvent(): void {
    const eventId = this.form.controls.eventId.value;
    this.selectedSeats = []; this.lastBooking = null; this.seatMap = null;
    this.events.events$.pipe(take(1)).subscribe((events) => {
      this.selectedEvent = events.find((event) => event.id === eventId) ?? null;
      if (!this.selectedEvent) return;
      if (!this.selectedEvent.venueId) { this.refreshAvailability(); return; }
      this.refreshing = true;
      forkJoin({ availability: this.booking.getSeatMap(eventId), config: this.venues.getSeatMap(this.selectedEvent.venueId) })
        .pipe(finalize(() => this.refreshing = false))
        .subscribe(({ availability, config }) => { this.venueMapConfig = config; this.applySeatMap(availability); });
    });
  }

  refreshAvailability(): void {
    const eventId = this.form.controls.eventId.value;
    if (!eventId || this.refreshing) return;
    this.refreshing = true;
    this.booking.getSeatMap(eventId).pipe(finalize(() => this.refreshing = false)).subscribe((map) => this.applySeatMap(map));
  }

  private applySeatMap(map: SeatMap | undefined): void {
    if (!map || String(map.eventId) !== String(this.form.controls.eventId.value)) return;
    this.seatMap = this.applySavedLayout(map);
    const currentSeats = this.allSeats;
    const availableIds = new Set(currentSeats.filter((seat) => this.isAvailable(seat)).map((seat) => seat.id));
    this.selectedSeats = this.selectedSeats.filter((seat) => availableIds.has(seat.id)).map((seat) => currentSeats.find((fresh) => fresh.id === seat.id) ?? seat);
  }

  private applySavedLayout(map: SeatMap): SeatMap {
    const config = this.venueMapConfig;
    if (!config) return map;
    this.layoutElements = (config.elements ?? []) as LayoutElement[];
    const configuredTables = (config.tables ?? []) as ConfiguredTable[];
    const tables = configuredTables.map((saved) => {
      const liveTable = map.tables.find((item) => String(item.label) === String(saved.label));
      const sectionName = saved.section || liveTable?.sectionName || 'General';
      const sectionId = this.sectionId(sectionName);
      const savedSeats = saved.seats ?? [];
      const liveSeats = liveTable?.seats ?? [];
      const seats = savedSeats.map((position, index) => {
        const liveSeat = liveSeats[index];
        return liveSeat
          ? { ...liveSeat, number: Number(position.number), section: sectionName, sectionId, price: this.sectionPrice(sectionName, liveSeat.price), x: Number(position.x), y: Number(position.y), radius: 6.5 }
          : { id: `layout-${saved.label}-${position.number}`, row: '', number: Number(position.number), label: `${saved.label}-${position.number}`,
              section: sectionName, sectionId, price: 0, status: 'sold' as const, x: Number(position.x), y: Number(position.y), radius: 6.5 };
      });
      return { id: liveTable?.id ?? `table-${saved.label}`, label: String(saved.label), sectionId, sectionName,
        x: Number(saved.x), y: Number(saved.y), width: 32, height: 78, rotation: Number(saved.rotation) || 0, seats };
    });
    return { ...map, width: config.canvas_width || map.width, height: config.canvas_height || map.height, tables,
      sections: map.sections.map((section) => ({ ...section, seats: tables.filter((table) => table.sectionId === section.id).flatMap((table) => table.seats) })) };
  }

  elementTransform(element: LayoutElement): string { return `translate(${element.x} ${element.y}) rotate(${element.rotation || 0} ${element.w / 2} ${element.h / 2})`; }
  entryArrowPath(width: number, height: number): string { return `M0 ${height / 2} L${width * .42} 0 L${width * .42} ${height * .32} L${width} ${height * .32} L${width} ${height * .68} L${width * .42} ${height * .68} L${width * .42} ${height} Z`; }
  tableClass(section: string): string { const name = section.toLowerCase(); return name.includes('diamante') ? 'table-diamante' : name.includes('vip') ? 'table-vip' : 'table-general'; }
  seatSectionClass(seat: Seat): string { const name = seat.section.toLowerCase(); return name.includes('diamante') ? 'seat-diamante' : name.includes('vip') ? 'seat-vip' : 'seat-general'; }
  zoneClass(label: string): string { const name = label.toLowerCase(); return name.includes('diamante') ? 'zone-diamante' : name.includes('vip') ? 'zone-vip' : name.includes('general') ? 'zone-general' : 'zone-default'; }
  zoneLabelClass(label: string): string { return this.zoneClass(label).replace('zone-', 'label-'); }
  isRowStart(label: string): boolean { const value = Number(label); return Number.isFinite(value) && (value - 1) % 10 === 0; }
  rowNumber(label: string): number { return Math.floor((Number(label) - 1) / 10) + 1; }
  private sectionId(name: string): string { return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  private sectionPrice(sectionName: string, seatPrice?: number): number {
    const configuredSections = (this.venueMapConfig?.sections ?? []) as ConfiguredSection[];
    const configured = configuredSections.find((section) => section.name?.trim().toLowerCase() === sectionName.trim().toLowerCase());
    const eventTier = this.selectedEvent?.priceTiers.find((tier) => tier.name.trim().toLowerCase() === sectionName.trim().toLowerCase());
    const candidates = [seatPrice, configured?.price, eventTier?.price, this.selectedEvent?.basePrice].map(Number);
    return candidates.find((price) => Number.isFinite(price) && price > 0) ?? 0;
  }

  isAvailable(seat: Seat): boolean { return seat.status === 'available' || seat.status === 'selected'; }
  isSelected(seat: Seat): boolean { return this.selectedSeats.some((item) => item.id === seat.id); }
  toggleSeat(seat: Seat): void {
    if (this.isSelected(seat)) {
      this.selectedSeats = this.selectedSeats.filter((item) => item.id !== seat.id);
      return;
    }
    if (!this.isAvailable(seat) || this.validatingSeatId) return;

    const eventId = this.form.controls.eventId.value;
    this.validatingSeatId = seat.id;
    this.booking.getSeatMap(eventId).pipe(finalize(() => this.validatingSeatId = null)).subscribe((map) => {
      this.applySeatMap(map);
      const freshSeat = this.allSeats.find((item) => item.id === seat.id);
      if (!freshSeat || !this.isAvailable(freshSeat)) {
        this.notifications.info(`El asiento ${seat.label} está ${freshSeat?.status === 'reserved' ? 'reservado' : 'no disponible'}.`);
        return;
      }
      this.selectedSeats = [...this.selectedSeats, freshSeat];
    });
  }

  issue(): void {
    if (this.form.invalid || !this.selectedEvent || this.selectedSeats.length === 0 || this.processing) return;
    this.processing = true;
    const { type, customerName, customerPhone } = this.form.getRawValue();
    this.booking.issueManualEntry(this.selectedEvent, this.selectedSeats, type, customerName.trim(), customerPhone.trim()).pipe(finalize(() => {
      this.processing = false;
      this.refreshAvailability();
    })).subscribe((record) => { this.lastBooking = record; this.selectedSeats = []; });
  }

  seatLabels(booking: BookingRecord): string { return booking.seats.map((seat) => `${seat.section} ${seat.label}`).join(', '); }
  async download(booking: BookingRecord): Promise<void> { await this.ticketPdf.downloadTicket(booking); }
}

interface LayoutElement { id: string; kind: 'stage' | 'bathrooms' | 'entrance' | 'zone'; label: string; x: number; y: number; w: number; h: number; color: string; rotation: number; }
interface ConfiguredTable { label: string; section?: string; x: number; y: number; rotation?: number; seats?: Array<{ number: number; x: number; y: number }>; }
interface ConfiguredSection { name: string; price: number; }
