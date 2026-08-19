import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, ElementRef, Input, OnInit, ViewChild, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin, map, take } from 'rxjs';
import { BookingRecord } from '../../core/models/booking.model';
import { EventItem } from '../../core/models/event.model';
import { Seat, SeatMap, SeatTable } from '../../core/models/seat.model';
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
      <div class="admin-header"><div><p class="eyebrow">Emisión administrativa</p><h1>{{ courtesyMode ? 'Asignar cortesías' : 'Venta en efectivo' }}</h1>
        <p class="admin-subtitle">{{ courtesyMode ? 'Selecciona asientos individuales o una mesa completa. Cada asiento se reservará individualmente.' : 'Selecciona asientos libres del mapa y emite entradas pagadas en efectivo.' }}</p></div></div>

      <form class="panel-surface controls" [formGroup]="form" (ngSubmit)="issue()">
        <mat-form-field appearance="outline"><mat-label>Evento</mat-label>
          <mat-select formControlName="eventId" (selectionChange)="loadEvent()">
            @for (event of (events$ | async) ?? []; track event.id) { <mat-option [value]="event.id">{{ event.name }}</mat-option> }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline"><mat-label>Sección</mat-label>
          <mat-select formControlName="sectionId" (selectionChange)="onSectionChange($event.value)" [disabled]="!seatMap">
            <mat-option value="">Todas</mat-option>
            <mat-option *ngFor="let s of selectableSections" [value]="s.id">{{ s.name }}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline"><mat-label>Asientos</mat-label>
          <mat-select formControlName="seatIds" multiple (selectionChange)="onSeatIdsChange($event)" [disabled]="!seatMap">
            <mat-option *ngFor="let seat of filteredSeats" [value]="seat.id" [disabled]="!isAvailable(seat)">
              {{ seat.section }} · Mesa {{ seat.tableLabel || 'sin asignar' }} · Asiento {{ seat.number }}
            </mat-option>
          </mat-select>
        </mat-form-field>
        @if (!courtesyMode) {
          <mat-form-field appearance="outline"><mat-label>Método de pago</mat-label><mat-select formControlName="paymentMethod" (selectionChange)="onPaymentMethodChange()">
            <mat-option value="efectivo">Efectivo</mat-option>
            <mat-option value="visalink">VisaLink</mat-option>
            <mat-option value="compraclic">CompraClick</mat-option>
            <mat-option value="transferencia">Transferencia</mat-option>
          </mat-select></mat-form-field>
        }
        <mat-form-field appearance="outline"><mat-label>Cliente / beneficiario</mat-label><input matInput formControlName="customerName" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Número de teléfono</mat-label>
          <input matInput formControlName="customerPhone" type="tel" inputmode="tel" autocomplete="tel" maxlength="30" placeholder="Ej. +502 5555 5555" />
          @if (form.controls.customerPhone.hasError('pattern')) { <mat-error>Ingresa un número de teléfono válido.</mat-error> }
        </mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Correo electrónico</mat-label>
          <input matInput formControlName="customerEmail" type="email" autocomplete="email" placeholder="cliente@correo.com" />
          @if (form.controls.customerEmail.hasError('required')) { <mat-error>El correo es obligatorio para enviar el ticket.</mat-error> }
          @if (form.controls.customerEmail.hasError('email')) { <mat-error>Ingresa un correo válido.</mat-error> }
        </mat-form-field>
        @if (requiresPaymentEvidence) {
          <mat-form-field appearance="outline"><mat-label>Número de autorización</mat-label>
            <input matInput formControlName="authorizationNumber" maxlength="100" autocomplete="off" />
            @if (form.controls.authorizationNumber.hasError('required')) { <mat-error>El número de autorización es obligatorio.</mat-error> }
          </mat-form-field>
          <div class="proof-field">
            <span>Comprobante de pago</span>
            <input #proofInput hidden type="file" accept="image/jpeg,image/png,image/webp,application/pdf" (change)="selectProof($event)" />
            <button mat-stroked-button type="button" (click)="proofInput.click()"><mat-icon>upload_file</mat-icon>{{ proofFile?.name || 'Seleccionar archivo' }}</button>
            <small>JPG, PNG, WEBP o PDF · máximo 5 MB</small>
            @if (proofError) { <small class="field-error">{{ proofError }}</small> }
          </div>
        }
        <div class="summary"><span>{{ selectedSeats.length }} asiento(s)</span><strong>{{ total | currencyGtq }}</strong></div>
        <button mat-flat-button color="primary" type="submit" [disabled]="processing || !seatMap || selectedSeats.length === 0">
          <mat-icon>{{ form.controls.type.value === 'cash' ? 'point_of_sale' : 'card_giftcard' }}</mat-icon>
          {{ processing ? 'Generando...' : (courtesyMode ? 'Asignar cortesías' : 'Generar entrada') }}
        </button>
      </form>

      <article class="panel-surface map-panel">
        <div class="map-heading"><div><strong>Mapa de asientos</strong>
          <p *ngIf="seatMap">{{ availableCount }} disponibles de {{ totalSeatCount }} · {{ totalTableCount }} mesas · {{ selectedSeats.length }} seleccionados</p>
          <p *ngIf="!seatMap">Selecciona un evento para cargar su mapa.</p></div>
          <div class="map-actions" *ngIf="seatMap"><span class="live-status"><i></i> Validación al seleccionar</span>
            <button mat-icon-button type="button" aria-label="Actualizar disponibilidad" matTooltip="Actualizar disponibilidad"
              [disabled]="refreshing" (click)="refreshAvailability()"><mat-icon>refresh</mat-icon></button></div>
        </div>
        <div class="legend"><i></i> Libre <i class="selected"></i> Seleccionado <i class="reserved"></i> Reservado <i class="sold"></i> Vendido</div>

        <div class="section-chips" *ngIf="seatMap">
          @for (section of selectableSections; track section.id) { <button class="chip" type="button" [class.active]="activeSectionId === section.id"
              (click)="toggleSection(section.id)">
              <span class="chip-dot" [style.background]="section.color"></span>{{ section.name }}</button> }
        </div>

        <div #viewport class="venue-viewport" *ngIf="seatMap as map">
          <svg #svgContainer class="venue-map"
            width="100%" height="100%"
            [attr.viewBox]="viewBoxX + ' ' + viewBoxY + ' ' + viewBoxW + ' ' + viewBoxH"
            preserveAspectRatio="xMidYMid meet"
            (wheel)="onWheel($event)" (mousedown)="onMouseDown($event)"
            (mousemove)="onMouseMove($event)" (mouseup)="onMouseUp()" (mouseleave)="onMouseUp()">
            <rect x="0" y="0" [attr.width]="map.width" [attr.height]="map.height" fill="#a8a8a8" />

            @for (section of map.sections; track section.id) {
              @if (section.polygon) { <polygon [attr.points]="section.polygon" class="map-zone" [ngClass]="zoneClass(section.name)" /> }
              <text [attr.x]="section.labelX" [attr.y]="section.labelY" text-anchor="middle" class="zone-label" [ngClass]="zoneLabelClass(section.name)">{{ section.name }}</text>
            }

            @if (layoutElements.length === 0 && map.stage) {
              <g class="stage"><rect [attr.x]="map.stage.x" [attr.y]="map.stage.y" [attr.width]="map.stage.width" [attr.height]="map.stage.height" rx="12" />
                <text [attr.x]="map.stage.x + map.stage.width / 2" [attr.y]="map.stage.y + map.stage.height / 2" text-anchor="middle" dominant-baseline="middle">{{ map.stage.label }}</text></g>
            }
            @for (element of sortedLayoutElements; track element.id) {
              <g [attr.transform]="elementTransform(element)" [ngClass]="element.kind">
                @if (element.kind === 'entrance') { <path [attr.d]="entryArrowPath(element.w, element.h)" [attr.fill]="element.color" /> }
                @else { <rect width="100%" height="100%" [attr.width]="element.w" [attr.height]="element.h" rx="10" [attr.fill]="element.color" /> }
                <text [attr.x]="element.w / 2" [attr.y]="element.h / 2" text-anchor="middle" dominant-baseline="middle" [ngClass]="element.kind === 'zone' ? 'zone-label' : 'stage-label'">{{ element.label }}</text>
              </g>
            }

            @for (table of map.tables; track table.id) {
              <g class="table" [class.table-selectable]="courtesyMode" [class.table-selected]="isTableSelected(table)"
                [attr.transform]="'translate(' + table.x + ' ' + table.y + ') rotate(' + (table.rotation || 0) + ' ' + table.width / 2 + ' ' + table.height / 2 + ')'"
                (click)="selectTable(table, $event)">
                <rect [attr.width]="table.width" [attr.height]="table.height" rx="7" [ngClass]="tableClass(table.sectionName)" />
                <text [attr.x]="table.width / 2" [attr.y]="table.height / 2" text-anchor="middle" dominant-baseline="middle">{{ table.label }}</text>
              </g>
            }

            @for (seat of allSeats; track seat.id) {
              <g class="seat" [ngClass]="[seatSectionClass(seat), seat.status, isSelected(seat) ? 'selected' : '', activeSectionId && seat.sectionId !== activeSectionId ? 'inactive' : '', validatingSeatId === seat.id ? 'validating' : '']"
                [attr.transform]="'translate(' + seat.x + ' ' + seat.y + ')'" [attr.aria-label]="seat.section + ', asiento ' + seat.number"
                role="button" tabindex="0" (click)="$event.stopPropagation(); toggleSeat(seat)" (keydown.enter)="toggleSeat(seat)">
                <circle [attr.r]="seat.radius || 6.5" /><text y="2.8" text-anchor="middle">{{ seat.number }}</text>
              </g>
            }
          </svg>

          <div class="map-controls-bar" aria-label="Controles del mapa">
            <button class="control-btn center-btn" type="button" (click)="resetView()">Centrar</button>
            <button class="control-btn zoom-icon-btn" type="button" aria-label="Alejar" (click)="zoomOut()">−</button>
            <button class="control-btn zoom-icon-btn" type="button" aria-label="Acercar" (click)="zoomIn()">+</button>
          </div>
        </div>

        @if (selectedSeats.length > 0) {
          <div class="selection-strip"><strong>{{ selectedSeats.length }} seleccionado(s) · {{ total | currencyGtq }}</strong>
            <span>{{ selectedSeatSummary }}</span></div>
        }
      </article>

      <article class="panel-surface ticket-result" *ngIf="lastBooking"><div><p class="eyebrow">Entrada generada</p><h2>{{ lastBooking.eventName }}</h2>
        <p>{{ lastBooking.orderNumber }} · {{ seatLabels(lastBooking) }}</p></div>
        <button mat-stroked-button type="button" (click)="download(lastBooking)"><mat-icon>picture_as_pdf</mat-icon> Descargar PDF</button>
      </article>
    </section>
  `,
  styles: [`
    .controls{display:grid;grid-template-columns:repeat(4,minmax(180px,1fr));gap:12px;align-items:center;margin-bottom:18px}mat-form-field{width:100%}.proof-field{display:grid;gap:5px;align-self:stretch;padding:8px 0}.proof-field>span{font-size:.76rem;font-weight:700;color:var(--text-muted)}.proof-field small{font-size:.68rem;color:var(--text-muted)}.proof-field .field-error{color:#b91c1c}
    .summary{display:grid;min-width:120px}.summary span,.map-heading p,.ticket-result p{margin:0;color:var(--text-muted);font-size:.82rem}.summary strong{color:var(--brand-primary);font-size:1.15rem}
    .map-panel{padding:18px}.map-heading,.ticket-result,.map-actions{display:flex;justify-content:space-between;align-items:center;gap:12px}
    .legend{display:flex;align-items:center;gap:6px;margin-top:10px;color:var(--text-muted);font-size:.76rem}.legend i{width:12px;height:12px;border-radius:50%;background:#22c55e}.legend i.selected{background:#7c3aed}.legend i.reserved{background:#f59e0b}.legend i.sold{background:#ef4444}
    .section-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.chip{display:inline-flex;align-items:center;gap:8px;padding:7px 16px;border-radius:20px;cursor:pointer;background:#f8fafc;border:1.5px solid #cbd5e1;color:#334155;font-size:.82rem;font-weight:700}.chip:hover,.chip.active{border-color:#7c3aed;background:#f3e8ff;color:#5b21b6}.chip-dot{width:10px;height:10px;border-radius:50%}
    .venue-viewport{position:relative;margin:16px auto 0;height:min(78vh,900px);aspect-ratio:1900/2120;max-width:100%;overflow:hidden;border:1px solid #d8dee8;border-radius:12px;background:#a8a8a8;cursor:grab;touch-action:none;user-select:none}.venue-map{display:block;width:100%;height:100%;background:#a8a8a8}.venue-viewport:active{cursor:grabbing}
    .stage rect{fill:#111827}.stage text,.stage-label{fill:#fff7ed;font-weight:900;font-size:34px}.table rect{stroke:rgba(255,255,255,.58);stroke-width:1.5;filter:drop-shadow(0 3px 6px rgba(0,0,0,.22))}.table text{fill:#fff;font-size:11px;font-weight:800;pointer-events:none}.table-selectable{cursor:pointer}.table-selectable:hover rect{stroke:#ffe066;stroke-width:3}.table-selected rect{stroke:#ffe066;stroke-width:4;filter:drop-shadow(0 0 10px #ffe066)}.table-diamante{fill:#0b2c6b}.table-vip{fill:#e85d04}.table-general{fill:#008c95}
    .map-zone{fill:rgba(69,255,25,.04);stroke-width:2.5;stroke-dasharray:12 8}.zone-diamante{fill:rgba(9,31,73,.07);stroke:rgba(9,31,73,.72)}.zone-vip{fill:rgba(204,82,0,.06);stroke:rgba(204,82,0,.68)}.zone-general{fill:rgba(0,128,128,.06);stroke:rgba(0,128,128,.68)}.zone-default{stroke:rgba(69,255,25,.42)}.zone-label{fill:#fff;stroke-width:8;paint-order:stroke;font-size:27px;font-weight:900;letter-spacing:.11em}.label-diamante{stroke:#091f49}.label-vip{stroke:#c94e00}.label-general{stroke:#007b82}.label-default{stroke:#1e293b}.row-marker circle{fill:#0f172a;stroke:rgba(255,255,255,.78);stroke-width:1.5}.row-marker text{fill:#fff;font-size:11px;font-weight:800}.entry-label,.bathroom-title{font-weight:900}.entry-label{font-size:42px;fill:#020617}.bathroom-title{font-size:30px;fill:#fff}.bathroom-icon{font-size:44px;font-weight:900;fill:#fff}
    .seat{cursor:pointer;outline:none}.seat circle{stroke:rgba(255,255,255,.24);stroke-width:1;transition:.15s}.seat.seat-diamante circle{fill:#091f49}.seat.seat-vip circle{fill:#e06000}.seat.seat-general circle{fill:#008080}.seat text{fill:#fff;font-size:8px;font-weight:800;pointer-events:none}.seat:hover circle,.seat:focus circle{filter:brightness(1.15);stroke:#fff;stroke-width:2.5}
    .seat.selected circle{fill:#ffe066;stroke:#111827;stroke-width:2}.seat.selected text{fill:#111827}.seat.reserved text,.seat.sold text{fill:white}.seat.reserved,.seat.sold{cursor:not-allowed}.seat.reserved circle{fill:#f59e0b;stroke:#92400e}.seat.sold circle{fill:#ef4444;stroke:#991b1b}.seat.validating{pointer-events:none;opacity:.55}.seat.inactive,.table.inactive{opacity:.25}.seat.selected{opacity:1}
    .map-controls-bar{position:absolute;bottom:16px;right:16px;z-index:20;display:flex;border-radius:6px;overflow:hidden;background:#18181b;box-shadow:0 4px 12px rgba(0,0,0,.35)}.control-btn{height:36px;border:0;background:#18181b;color:#fff;font-weight:700;cursor:pointer}.control-btn:hover{background:#27272a}.center-btn{padding:0 16px;font-size:12px;text-transform:uppercase;letter-spacing:.14em;border-right:1px solid rgba(255,255,255,.15)}.zoom-icon-btn{width:36px;font-size:18px;border-right:1px solid rgba(255,255,255,.15)}
    .selection-strip{display:flex;justify-content:space-between;gap:14px;margin-top:12px;padding:12px 14px;border:1px solid #ddd6fe;border-radius:10px;background:#f5f3ff;color:#4c1d95;font-size:.82rem}.selection-strip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .live-status{display:flex;align-items:center;gap:6px;color:#166534;font-size:.78rem;font-weight:700}.live-status i{width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 4px rgba(34,197,94,.16)}
    .ticket-result{margin-top:18px;padding:20px}.ticket-result h2{margin:4px 0}@media(max-width:1100px){.controls{grid-template-columns:1fr 1fr}.controls mat-form-field:first-child{grid-column:1/-1}}@media(max-width:700px){.controls{grid-template-columns:1fr}.controls mat-form-field:first-child{grid-column:auto}.map-heading,.ticket-result{align-items:flex-start;flex-direction:column}.venue-viewport{width:100%;height:auto;aspect-ratio:1900/2120}}
  `]
})
export class CashSalesComponent implements OnInit {
  @Input() mode: 'cash' | 'courtesy' = 'cash';
  @ViewChild('viewport') private viewportRef?: ElementRef<HTMLDivElement>;
  @ViewChild('svgContainer') private svgContainerRef?: ElementRef<SVGSVGElement>;
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly events = inject(EventService);
  private readonly booking = inject(BookingService);
  private readonly ticketPdf = inject(TicketPdfService);
  private readonly notifications = inject(NotificationService);
  private readonly venues = inject(VenueService);

  readonly events$ = this.events.events$.pipe(map((items) => items.filter((event) => event.status !== 'draft' && event.status !== 'sold-out' && new Date(event.date).getTime() >= new Date().setHours(0, 0, 0, 0))));
  readonly form = this.fb.group({
    eventId: ['', Validators.required],
    sectionId: [''],
    seatIds: [[] as string[]],
    type: ['cash' as 'cash' | 'courtesy', Validators.required],
    paymentMethod: ['efectivo' as ManualPaymentMethod, Validators.required],
    customerName: ['', Validators.required],
    customerPhone: ['', Validators.pattern(/^\+?[0-9][0-9\s()-]{6,29}$/)],
    customerEmail: ['', [Validators.required, Validators.email]],
    authorizationNumber: ['']
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
  activeSectionId: string | null = null;
  viewBoxX = 0;
  viewBoxY = 0;
  viewBoxW = 1900;
  viewBoxH = 2120;
  isPanning = false;
  private startPanX = 0;
  private startPanY = 0;
  proofFile: File | null = null;
  proofError = '';

  ngOnInit(): void {
    this.form.controls.type.setValue(this.courtesyMode ? 'courtesy' : 'cash');
    this.events.getEvents().subscribe();
  }

  get filteredSeats(): Seat[] {
    const sid = this.form.controls.sectionId.value;
    const seats = this.allSeats.slice();
    if (!sid) return seats.sort((a, b) => this.compareSeatsByTable(a, b, true));
    return seats
      .filter((s) => s.sectionId === sid || this.sectionId(s.section) === sid || s.section === sid)
      .sort((a, b) => this.compareSeatsByTable(a, b));
  }

  private compareSeatsByTable(a: Seat, b: Seat, includeSection = false): number {
    if (includeSection) {
      const sectionOrder = a.section.localeCompare(b.section, 'es', { sensitivity: 'base', numeric: true });
      if (sectionOrder !== 0) return sectionOrder;
    }
    const tableOrder = String(a.tableLabel ?? '').localeCompare(String(b.tableLabel ?? ''), 'es', { numeric: true });
    if (tableOrder !== 0) return tableOrder;
    return Number(a.number ?? 0) - Number(b.number ?? 0);
  }

  get courtesyMode(): boolean { return this.mode === 'courtesy'; }
  get requiresPaymentEvidence(): boolean { return !this.courtesyMode && this.form.controls.paymentMethod.value !== 'efectivo'; }

  onPaymentMethodChange(): void {
    const authorization = this.form.controls.authorizationNumber;
    if (this.requiresPaymentEvidence) authorization.setValidators([Validators.required, Validators.maxLength(100)]);
    else {
      authorization.clearValidators();
      authorization.setValue('');
      this.proofFile = null;
      this.proofError = '';
    }
    authorization.updateValueAndValidity();
  }

  selectProof(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.proofError = '';
    if (!file) { this.proofFile = null; return; }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) { this.proofFile = null; this.proofError = 'Formato no permitido.'; input.value = ''; return; }
    if (file.size > 5 * 1024 * 1024) { this.proofFile = null; this.proofError = 'El archivo supera el máximo de 5 MB.'; input.value = ''; return; }
    this.proofFile = file;
  }

  get allSeats(): Seat[] {
    if (!this.seatMap) return [];
    const unique = new Map<string, Seat>();
    [...this.seatMap.sections.flatMap((section) => section.seats), ...this.seatMap.tables.flatMap((table) => table.seats)].forEach((seat) => unique.set(seat.id, seat));
    return [...unique.values()];
  }
  get availableCount(): number { return this.allSeats.filter((seat) => this.isAvailable(seat)).length; }
  get totalSeatCount(): number { return this.allSeats.length; }
  get totalTableCount(): number { return this.seatMap?.tables.length ?? 0; }
  get selectableSections() { return this.seatMap?.sections ?? []; }
  get sortedLayoutElements(): LayoutElement[] {
    const order: Record<LayoutElement['kind'], number> = { zone: 0, stage: 1, bathrooms: 2, entrance: 2 };
    return [...this.layoutElements].sort((a, b) => order[a.kind] - order[b.kind]);
  }
  get total(): number { return this.form.controls.type.value === 'courtesy' ? 0 : this.booking.getTotals(this.selectedSeats).total; }
  get selectedSeatSummary(): string {
    const labels = this.selectedSeats.slice(0, 5).map((seat) => `${seat.section} ${seat.label}`).join(', ');
    return `${labels}${this.selectedSeats.length > 5 ? '…' : ''}`;
  }

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
    if (this.activeSectionId && !this.seatMap.sections.some((section) => section.id === this.activeSectionId)) this.activeSectionId = null;
    const currentSeats = this.allSeats;
    const availableIds = new Set(currentSeats.filter((seat) => this.isAvailable(seat)).map((seat) => seat.id));
    this.selectedSeats = this.selectedSeats.filter((seat) => availableIds.has(seat.id)).map((seat) => currentSeats.find((fresh) => fresh.id === seat.id) ?? seat);
    this.resetView();
  }

  private applySavedLayout(map: SeatMap): SeatMap {
    const config = this.venueMapConfig;
    if (!config) return map;
    this.layoutElements = (config.elements ?? []) as LayoutElement[];
    const configuredSections = (config.sections ?? []) as ConfiguredSection[];
    const configuredTables = (config.tables ?? []) as ConfiguredTable[];
    const tables = configuredTables.map((saved) => {
      const liveTable = map.tables.find((item) => String(item.label) === String(saved.label));
      const sectionName = saved.section || liveTable?.sectionName || 'General';
      const liveSection = map.sections.find((section) => this.sectionId(section.name) === this.sectionId(sectionName));
      const sectionId = liveSection?.id ?? this.sectionId(sectionName);
      const savedSeats = saved.seats ?? [];
      const liveSeats = [...(liveTable?.seats ?? [])].sort((a, b) => this.seatOrder(a) - this.seatOrder(b));
      const seatCount = Math.max(liveSeats.length, savedSeats.length);
      const seats = Array.from({ length: seatCount }, (_, index) => {
        const liveSeat = liveSeats[index];
        const seatNumber = liveSeat ? this.seatOrder(liveSeat) : (savedSeats[index]?.number ?? index + 1);
        const savedSeat = savedSeats.find((seat) => Number(seat.number) === seatNumber) ?? savedSeats[index];
        const fallbackPosition = this.tableSeatPosition(Number(saved.x), Number(saved.y), Number(saved.rotation) || 0, seatNumber, seatCount);
        const position = savedSeat && Number.isFinite(Number(savedSeat.x)) && Number.isFinite(Number(savedSeat.y))
          ? { x: Number(savedSeat.x), y: Number(savedSeat.y) }
          : fallbackPosition;
        return liveSeat
          ? { ...liveSeat, number: seatNumber, tableId: liveTable?.id, tableLabel: String(saved.label), section: sectionName, sectionId, price: this.sectionPrice(sectionName, liveSeat.price), x: position.x, y: position.y, radius: 6.5 }
          : { id: `layout-${saved.label}-${seatNumber}`, row: '', number: seatNumber, label: `${saved.label}-${seatNumber}`,
              tableId: `table-${saved.label}`, tableLabel: String(saved.label), section: sectionName, sectionId, price: 0, status: 'sold' as const, x: position.x, y: position.y, radius: 6.5 };
      });
      return { id: liveTable?.id ?? `table-${saved.label}`, label: String(saved.label), sectionId, sectionName,
        x: Number(saved.x), y: Number(saved.y), width: 32, height: 78, rotation: Number(saved.rotation) || 0, seats };
    });
    const sectionsById = new Map<string, SeatMap['sections'][number]>();
    configuredSections.forEach((configured) => {
      const id = this.sectionId(configured.name);
      if (!id) return;
      const live = map.sections.find((section) => this.sectionId(section.name) === id);
      const seats = tables.filter((table) => this.sectionId(table.sectionName) === id).flatMap((table) => table.seats);
      sectionsById.set(id, {
        id: live?.id ?? id,
        name: configured.name,
        color: configured.color || live?.color || this.sectionColor(configured.name),
        polygon: live?.polygon ?? '',
        labelX: live?.labelX ?? 0,
        labelY: live?.labelY ?? 0,
        seats,
        priceFrom: Number(configured.price) || live?.priceFrom || 0
      });
    });
    map.sections.forEach((section) => {
      const id = this.sectionId(section.name);
      if (!id || sectionsById.has(id)) return;
      sectionsById.set(id, {
        ...section,
        seats: tables.filter((table) => this.sectionId(table.sectionName) === id).flatMap((table) => table.seats)
      });
    });

    return { ...map, width: config.canvas_width || map.width, height: config.canvas_height || map.height, tables,
      sections: [...sectionsById.values()] };
  }

  private seatOrder(seat: Seat): number {
    const labelMatch = String(seat.label ?? '').match(/(\d+)$/);
    const candidates = [Number(seat.number), labelMatch ? Number(labelMatch[1]) : Number.NaN];
    return candidates.find(Number.isFinite) ?? Number.MAX_SAFE_INTEGER;
  }

  private tableSeatPosition(tableX: number, tableY: number, rotation: number, seatNumber: number, seatCount: number): { x: number; y: number } {
    const tableWidth = 32;
    const tableHeight = 78;
    const seatOffset = 10;
    const seatsPerSide = Math.ceil(seatCount / 2);
    const sideIndex = seatNumber <= seatsPerSide ? seatNumber - 1 : seatNumber - seatsPerSide - 1;
    const onLeft = seatNumber <= seatsPerSide;
    const gap = seatsPerSide > 1 ? 14 : 0;
    const unrotatedX = onLeft ? tableX - seatOffset : tableX + tableWidth + seatOffset;
    const unrotatedY = tableY + 11 + sideIndex * gap;
    const centerX = tableX + tableWidth / 2;
    const centerY = tableY + tableHeight / 2;
    const radians = rotation * Math.PI / 180;
    const dx = unrotatedX - centerX;
    const dy = unrotatedY - centerY;
    return { x: centerX + dx * Math.cos(radians) - dy * Math.sin(radians), y: centerY + dx * Math.sin(radians) + dy * Math.cos(radians) };
  }

  elementTransform(element: LayoutElement): string { return `translate(${element.x} ${element.y}) rotate(${element.rotation || 0} ${element.w / 2} ${element.h / 2})`; }
  entryArrowPath(width: number, height: number): string { return `M0 ${height / 2} L${width * .42} 0 L${width * .42} ${height * .32} L${width} ${height * .32} L${width} ${height * .68} L${width * .42} ${height * .68} L${width * .42} ${height} Z`; }
  tableClass(section: string): string { const name = section.toLowerCase(); return name.includes('diamante') ? 'table-diamante' : name.includes('vip') ? 'table-vip' : 'table-general'; }
  seatSectionClass(seat: Seat): string { const name = seat.section.toLowerCase(); return name.includes('diamante') ? 'seat-diamante' : name.includes('vip') ? 'seat-vip' : 'seat-general'; }
  zoneClass(label: string): string { const name = label.toLowerCase(); return name.includes('diamante') ? 'zone-diamante' : name.includes('vip') ? 'zone-vip' : name.includes('general') ? 'zone-general' : 'zone-default'; }
  zoneLabelClass(label: string): string { return this.zoneClass(label).replace('zone-', 'label-'); }
  isRowStart(label: string): boolean { const value = Number(label); return Number.isFinite(value) && (value - 1) % 10 === 0; }
  rowNumber(label: string): number { return Math.floor((Number(label) - 1) / 10) + 1; }
  sectionId(name: string): string { return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  sectionColor(sectionName: string): string {
    const configuredSections = (this.venueMapConfig?.sections ?? []) as ConfiguredSection[];
    return configuredSections.find((section) => this.sectionId(section.name) === this.sectionId(sectionName))?.color
      || (sectionName.toLowerCase().includes('diamante') ? '#091f49' : sectionName.toLowerCase().includes('vip') ? '#e06000' : '#008080');
  }
  private sectionPrice(sectionName: string, seatPrice?: number): number {
    const configuredSections = (this.venueMapConfig?.sections ?? []) as ConfiguredSection[];
    const configured = configuredSections.find((section) => section.name?.trim().toLowerCase() === sectionName.trim().toLowerCase());
    const eventTier = this.selectedEvent?.priceTiers.find((tier) => tier.name.trim().toLowerCase() === sectionName.trim().toLowerCase());
    const candidates = [seatPrice, configured?.price, eventTier?.price, this.selectedEvent?.basePrice].map(Number);
    return candidates.find((price) => Number.isFinite(price) && price > 0) ?? 0;
  }

  isAvailable(seat: Seat): boolean { return seat.status === 'available' || seat.status === 'selected'; }
  isSelected(seat: Seat): boolean { return this.selectedSeats.some((item) => item.id === seat.id); }
  isTableSelected(table: SeatTable): boolean {
    const availableSeats = table.seats.filter((seat) => this.isAvailable(seat));
    return availableSeats.length > 0 && availableSeats.every((seat) => this.isSelected(seat));
  }

  selectTable(table: SeatTable, event: Event): void {
    if (!this.courtesyMode) return;
    event.stopPropagation();
    const selectable = table.seats.filter((seat) => this.isAvailable(seat));
    if (selectable.length === 0) {
      this.notifications.info(`La mesa ${table.label} no tiene asientos disponibles.`);
      return;
    }
    if (selectable.every((seat) => this.isSelected(seat))) {
      const tableSeatIds = new Set(table.seats.map((seat) => seat.id));
      this.selectedSeats = this.selectedSeats.filter((seat) => !tableSeatIds.has(seat.id));
      return;
    }
    if (this.validatingSeatId) return;
    this.validatingSeatId = `table:${table.id}`;
    this.booking.getSeatMap(this.form.controls.eventId.value).pipe(finalize(() => this.validatingSeatId = null)).subscribe((map) => {
      this.applySeatMap(map);
      const freshTable = this.seatMap?.tables.find((item) => item.id === table.id || item.label === table.label);
      const freshAvailable = freshTable?.seats.filter((seat) => this.isAvailable(seat)) ?? [];
      if (freshAvailable.length === 0) {
        this.notifications.info(`La mesa ${table.label} ya no tiene asientos disponibles.`);
        return;
      }
      const selectedIds = new Set(this.selectedSeats.map((seat) => seat.id));
      this.selectedSeats = [...this.selectedSeats, ...freshAvailable.filter((seat) => !selectedIds.has(seat.id))];
      this.activeSectionId = freshTable?.sectionId ?? null;
      if (freshAvailable.length < table.seats.length) {
        this.notifications.info(`Se seleccionaron ${freshAvailable.length} asientos disponibles de la mesa ${table.label}.`);
      }
    });
  }
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
      this.activeSectionId = freshSeat.sectionId;
    });
  }

  onSeatIdsChange(event: any): void {
    const selectedIds: string[] = this.form.controls.seatIds.value ?? [];
    const eventId = this.form.controls.eventId.value;
    if (!eventId) return;
    this.validatingSeatId = 'bulk';
    this.booking.getSeatMap(eventId).pipe(finalize(() => this.validatingSeatId = null)).subscribe((map) => {
      this.applySeatMap(map);
      const freshSelected = this.allSeats.filter((s) => selectedIds.includes(s.id) && this.isAvailable(s));
      const removed = selectedIds.filter((id) => !freshSelected.some((s) => s.id === id));
      if (removed.length) {
        this.notifications.info(`${removed.length} asiento(s) no están disponibles y fueron removidos.`);
      }
      this.selectedSeats = freshSelected;
      // Update form control to reflect only available seats
      this.form.controls.seatIds.setValue(this.selectedSeats.map((s) => s.id), { emitEvent: false });
    });
  }

  onSectionChange(sectionId: string): void {
    this.form.controls.seatIds.setValue([], { emitEvent: false });
    this.selectedSeats = [];
    this.activeSectionId = sectionId || null;
  }

  removeSelectedSeat(seatId: string): void {
    this.selectedSeats = this.selectedSeats.filter((s) => s.id !== seatId);
    // keep form control in sync
    this.form.controls.seatIds.setValue(this.selectedSeats.map((s) => s.id), { emitEvent: false });
  }

  toggleSection(sectionId: string): void { this.activeSectionId = this.activeSectionId === sectionId ? null : sectionId; }

  resetView(): void {
    const map = this.seatMap;
    if (!map) {
      this.viewBoxX = 0; this.viewBoxY = 0; this.viewBoxW = 1900; this.viewBoxH = 2120;
      return;
    }

    this.viewBoxX = 0;
    this.viewBoxY = 0;
    this.viewBoxW = map.width || 1900;
    this.viewBoxH = map.height || 2120;
  }

  zoomIn(): void { this.zoomAt(1); }
  zoomOut(): void { this.zoomAt(-1); }
  onWheel(event: WheelEvent): void { event.preventDefault(); this.zoomAt(event.deltaY < 0 ? 1 : -1, event.clientX, event.clientY); }
  private zoomAt(direction: number, clientX?: number, clientY?: number): void {
    const svg = this.svgContainerRef?.nativeElement;
    if (!svg) return;
    const factor = direction > 0 ? .86 : 1.16;
    const newW = this.viewBoxW * factor;
    const newH = this.viewBoxH * factor;
    if (newW < 320 || newW > 5000) return;
    const rect = svg.getBoundingClientRect();
    const ratioX = clientX == null ? .5 : (clientX - rect.left) / rect.width;
    const ratioY = clientY == null ? .5 : (clientY - rect.top) / rect.height;
    this.viewBoxX += (this.viewBoxW - newW) * ratioX; this.viewBoxY += (this.viewBoxH - newH) * ratioY;
    this.viewBoxW = newW; this.viewBoxH = newH;
  }
  onMouseDown(event: MouseEvent): void {
    if ((event.target as SVGElement | null)?.closest('.seat, .table')) return;
    event.preventDefault(); this.isPanning = true; this.startPanX = event.clientX; this.startPanY = event.clientY;
  }
  onMouseMove(event: MouseEvent): void {
    const svg = this.svgContainerRef?.nativeElement;
    if (!this.isPanning || !svg) return;
    const rect = svg.getBoundingClientRect();
    this.viewBoxX -= (event.clientX - this.startPanX) * this.viewBoxW / rect.width;
    this.viewBoxY -= (event.clientY - this.startPanY) * this.viewBoxH / rect.height;
    this.startPanX = event.clientX; this.startPanY = event.clientY;
  }
  onMouseUp(): void { this.isPanning = false; }

  issue(): void {
    if (this.requiresPaymentEvidence && !this.proofFile) this.proofError = 'Debes adjuntar el comprobante del pago.';
    if (this.form.invalid || (this.requiresPaymentEvidence && !this.proofFile) || !this.selectedEvent || this.selectedSeats.length === 0 || this.processing) {
      this.form.markAllAsTouched();
      return;
    }
    this.processing = true;
    const { type, customerName, customerPhone, customerEmail, paymentMethod, authorizationNumber } = this.form.getRawValue();
    this.booking.issueManualEntry(this.selectedEvent, this.selectedSeats, type, customerName.trim(), customerPhone.trim(), {
      customerEmail: customerEmail.trim(), paymentMethod, authorizationNumber: authorizationNumber.trim(), proofFile: this.proofFile
    }).pipe(finalize(() => {
      this.processing = false;
      this.refreshAvailability();
    })).subscribe((record) => { this.lastBooking = record; this.selectedSeats = []; this.proofFile = null; this.proofError = ''; });
  }

  seatLabels(booking: BookingRecord): string { return booking.seats.map((seat) => `${seat.section} ${seat.label}`).join(', '); }
  async download(booking: BookingRecord): Promise<void> { await this.ticketPdf.downloadTicket(booking); }
}

interface LayoutElement { id: string; kind: 'stage' | 'bathrooms' | 'entrance' | 'zone'; label: string; x: number; y: number; w: number; h: number; color: string; rotation: number; }
interface ConfiguredTable { label: string; section?: string; x: number; y: number; rotation?: number; seats?: Array<{ number: number; x: number; y: number }>; }
interface ConfiguredSection { name: string; price: number; color?: string; }
type ManualPaymentMethod = 'efectivo' | 'visalink' | 'compraclic' | 'transferencia';
