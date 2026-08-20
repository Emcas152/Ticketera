import { CommonModule, DatePipe } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import jsQR from 'jsqr';
import { BookingRecord } from '../../core/models/booking.model';
import { BookingService, TicketValidationResult } from '../../core/services/booking.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';

interface MediaDeviceItem {
  deviceId: string;
  label: string;
}

interface ScanHistoryItem {
  timestamp: string;
  result: TicketValidationResult;
  payload: string;
}

@Component({
  selector: 'app-access-validator',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, ...MATERIAL_IMPORTS],
  template: `
    <section class="admin-shell">
      <div class="admin-header">
        <div>
          <p class="eyebrow">Control de acceso</p>
          <h1>Autorizar entrada</h1>
          <p class="admin-subtitle">Escaneo por cámara en tiempo real para autorización de boletos y prevención de copias.</p>
        </div>

        <div class="header-actions">
          <button mat-flat-button [color]="cameraActive() ? 'warn' : 'primary'" (click)="toggleCamera()">
            <mat-icon>{{ cameraActive() ? 'videocam_off' : 'videocam' }}</mat-icon>
            {{ cameraActive() ? 'Detener cámara' : 'Activar cámara' }}
          </button>
        </div>
      </div>

      <article class="validator-grid">

        <!-- ══ SECCIÓN CÁMARA ══════════════════════════════════ -->
        <div class="panel-surface camera-card">

          <div class="camera-toolbar">
            <div class="toolbar-left">
              <span class="status-dot" [class.active]="cameraActive()"></span>
              <strong class="camera-status-text">
                {{ cameraActive() ? 'Cámara activa — Escaneando...' : 'Cámara desactivada' }}
              </strong>
            </div>

            @if (videoDevices().length > 1) {
              <mat-form-field appearance="outline" class="device-select">
                <mat-label>Cámara</mat-label>
                <mat-select [(ngModel)]="selectedDeviceId" (selectionChange)="onDeviceChange()">
                  @for (device of videoDevices(); track device.deviceId) {
                    <mat-option [value]="device.deviceId">{{ device.label || 'Cámara ' + ($index + 1) }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            }
          </div>

          <!-- Video viewport -->
          <div class="viewport-wrap" [class.is-scanning]="cameraActive()">
            <video #videoElement autoplay playsinline muted class="camera-video"></video>
            <canvas #canvasElement style="display: none;"></canvas>

            @if (!cameraActive()) {
              <div class="camera-placeholder">
                <mat-icon class="placeholder-icon">no_photography</mat-icon>
                <p class="placeholder-title">Cámara inactiva</p>
                <p class="placeholder-sub">Haz clic en "Activar cámara" para comenzar la lectura de tickets QR.</p>
                <button mat-raised-button color="primary" (click)="startCamera()">
                  <mat-icon>videocam</mat-icon> Encender cámara
                </button>
              </div>
            } @else {
              <!-- Viewfinder Overlay -->
              <div class="viewfinder">
                <div class="corner top-left"></div>
                <div class="corner top-right"></div>
                <div class="corner bottom-left"></div>
                <div class="corner bottom-right"></div>
                <div class="laser-line"></div>
              </div>
              <div class="viewfinder-hint">
                <mat-icon class="hint-icon">qr_code_scanner</mat-icon>
                <span>Apunta el código QR del ticket hacia la cámara</span>
              </div>
            }
          </div>

          <!-- Input manual opcional -->
          <div class="manual-accordion">
            <button type="button" class="manual-toggle-btn" (click)="showManualInput.set(!showManualInput())">
              <mat-icon>{{ showManualInput() ? 'expand_less' : 'keyboard' }}</mat-icon>
              <span>{{ showManualInput() ? 'Ocultar ingreso manual' : 'Ingreso manual por código / texto' }}</span>
            </button>

            @if (showManualInput()) {
              <form class="manual-form" (ngSubmit)="validateManual()">
                <mat-form-field appearance="outline">
                  <mat-label>Payload / Código QR</mat-label>
                  <input
                    matInput
                    name="qrPayload"
                    [(ngModel)]="qrPayload"
                    placeholder="Ej: ALCON-TICKET:v1:..."
                    autocomplete="off"
                  />
                </mat-form-field>

                <div class="manual-actions">
                  <button mat-flat-button color="primary" type="submit">
                    <mat-icon>verified</mat-icon> Validar
                  </button>
                  <button mat-stroked-button type="button" (click)="clearResult()">
                    <mat-icon>backspace</mat-icon> Limpiar
                  </button>
                </div>
              </form>
            }
          </div>

        </div>

        <!-- ══ SECCIÓN RESULTADO Y DETALLES ════════════════════ -->
        <div class="result-column">

          <article class="panel-surface result-panel" [ngClass]="result()?.status || 'idle'">
            <div class="result-header-badge">
              <mat-icon class="result-icon">{{ iconName }}</mat-icon>
              <div class="result-header-text">
                <span class="result-label">{{ resultLabel }}</span>
                <h2>{{ result()?.message || 'Esperando lectura de ticket...' }}</h2>
              </div>
            </div>

            @if (result()?.booking; as booking) {
              <div class="ticket-summary">
                <div class="summary-row">
                  <span>Nº Orden</span>
                  <strong>{{ booking.orderNumber }}</strong>
                </div>
                <div class="summary-row">
                  <span>Evento</span>
                  <strong>{{ booking.eventName }}</strong>
                </div>
                <div class="summary-row">
                  <span>Fecha evento</span>
                  <strong>{{ booking.eventDate | date: 'EEEE, d MMM y, h:mm a' }}</strong>
                </div>
                <div class="summary-row">
                  <span>Asientos / Ubicación</span>
                  <strong class="seats-highlight">{{ seatLabels(booking) }}</strong>
                </div>
                <div class="summary-row">
                  <span>Lugar</span>
                  <strong>{{ booking.venueName }}</strong>
                </div>
                @if (booking.usedAt) {
                  <div class="summary-row used-row">
                    <span>Último uso</span>
                    <strong>{{ booking.usedAt | date: 'd MMM y, h:mm a' }}</strong>
                  </div>
                }
              </div>
            }

            @if (result()) {
              <div class="result-footer-actions">
                <button mat-stroked-button (click)="clearResult()">
                  <mat-icon>refresh</mat-icon> Preparar siguiente escaneo
                </button>
              </div>
            }
          </article>

          <!-- Historial reciente de la sesión -->
          @if (scanHistory().length > 0) {
            <article class="panel-surface history-card">
              <h3>Historial de escaneos (sesión)</h3>
              <div class="history-list">
                @for (item of scanHistory(); track item.timestamp) {
                  <div class="history-item" [class]="'hist-' + item.result.status">
                    <span class="hist-time">{{ item.timestamp | date: 'HH:mm:ss' }}</span>
                    <span class="hist-status">{{ item.result.status | uppercase }}</span>
                    <span class="hist-msg">{{ item.result.booking?.eventName ?? item.result.message }}</span>
                  </div>
                }
              </div>
            </article>
          }

        </div>

      </article>
    </section>
  `,
  styles: [`
    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .validator-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(340px, 0.9fr);
      gap: 18px;
    }

    .camera-card {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .camera-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--surface-border);
    }

    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #94a3b8;
      transition: background 0.3s;
    }
    .status-dot.active {
      background: #10b981;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.25);
    }

    .camera-status-text {
      font-size: 0.85rem;
      color: var(--text-primary);
    }

    .device-select {
      width: 200px;
      margin-bottom: -1.25em; /* shrink form field line height */
    }

    /* ── Viewport ────────────────────────────────────────── */
    .viewport-wrap {
      position: relative;
      width: 100%;
      aspect-ratio: 4 / 3;
      max-height: 380px;
      background: #09090b;
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid rgba(106, 0, 255, 0.2);
    }

    .camera-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .camera-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 24px;
      color: rgba(255, 255, 255, 0.7);
      gap: 8px;
    }

    .placeholder-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      opacity: 0.5;
    }

    .placeholder-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: #fff;
      margin: 0;
    }

    .placeholder-sub {
      font-size: 0.8rem;
      max-width: 260px;
      margin: 0 0 8px;
      color: rgba(255, 255, 255, 0.5);
    }

    /* ── Viewfinder overlay ──────────────────────────────── */
    .viewfinder {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 210px;
      height: 210px;
      pointer-events: none;
    }

    .corner {
      position: absolute;
      width: 24px;
      height: 24px;
      border-color: #ff007a;
      border-style: solid;
    }
    .top-left     { top: 0; left: 0; border-width: 4px 0 0 4px; border-top-left-radius: 6px; }
    .top-right    { top: 0; right: 0; border-width: 4px 4px 0 0; border-top-right-radius: 6px; }
    .bottom-left  { bottom: 0; left: 0; border-width: 0 0 4px 4px; border-bottom-left-radius: 6px; }
    .bottom-right { bottom: 0; right: 0; border-width: 0 4px 4px 0; border-bottom-right-radius: 6px; }

    .laser-line {
      position: absolute;
      left: 4px;
      right: 4px;
      height: 2px;
      background: linear-gradient(90deg, transparent, #ff007a 50%, transparent);
      box-shadow: 0 0 8px #ff007a;
      animation: scanLaser 2s infinite ease-in-out;
    }

    @keyframes scanLaser {
      0%   { top: 4px; opacity: 0.8; }
      50%  { top: 200px; opacity: 1; }
      100% { top: 4px; opacity: 0.8; }
    }

    .viewfinder-hint {
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      padding: 6px 14px;
      border-radius: 999px;
      color: #fff;
      font-size: 0.74rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .hint-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: var(--brand-secondary);
    }

    /* ── Manual accordion ────────────────────────────────── */
    .manual-accordion {
      margin-top: 4px;
    }

    .manual-toggle-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      padding: 4px 0;
    }

    .manual-toggle-btn:hover {
      color: var(--brand-primary);
    }

    .manual-form {
      margin-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .manual-actions {
      display: flex;
      gap: 8px;
    }

    /* ── Result Panel ────────────────────────────────────── */
    .result-column {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .result-panel {
      padding: 20px;
      border-left: 6px solid #94a3b8;
      transition: border-color 0.3s, background 0.3s;
    }

    .result-panel.valid {
      border-left-color: #10b981;
      background: rgba(16, 185, 129, 0.03);
    }

    .result-panel.used,
    .result-panel.invalid {
      border-left-color: #ef4444;
      background: rgba(239, 68, 68, 0.03);
    }

    .result-panel.unknown {
      border-left-color: #f59e0b;
      background: rgba(245, 158, 11, 0.03);
    }

    .result-header-badge {
      display: flex;
      align-items: flex-start;
      gap: 14px;
    }

    .result-icon {
      width: 44px;
      height: 44px;
      font-size: 44px;
      color: #64748b;
      flex-shrink: 0;
    }

    .valid .result-icon   { color: #10b981; }
    .used .result-icon,
    .invalid .result-icon { color: #ef4444; }
    .unknown .result-icon { color: #f59e0b; }

    .result-label {
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #64748b;
    }

    .valid .result-label   { color: #059669; }
    .used .result-label,
    .invalid .result-label { color: #dc2626; }
    .unknown .result-label { color: #d97706; }

    .result-header-text h2 {
      margin: 4px 0 0;
      font-size: 1.2rem;
      line-height: 1.35;
      color: var(--text-primary);
    }

    /* Summary info */
    .ticket-summary {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid var(--surface-border);
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      font-size: 0.84rem;
    }

    .summary-row span {
      color: var(--text-muted);
    }

    .summary-row strong {
      color: var(--text-primary);
      text-align: right;
    }

    .seats-highlight {
      color: var(--brand-secondary) !important;
      font-size: 0.9rem;
    }

    .used-row strong {
      color: #dc2626;
    }

    .result-footer-actions {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid var(--surface-border);
    }

    /* ── History card ────────────────────────────────────── */
    .history-card {
      padding: 14px 16px;
    }

    .history-card h3 {
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin: 0 0 10px;
    }

    .history-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 200px;
      overflow-y: auto;
    }

    .history-item {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.76rem;
      padding: 6px 10px;
      border-radius: 6px;
      background: #f8fafc;
    }

    .hist-time {
      font-family: monospace;
      color: var(--text-muted);
    }

    .hist-status {
      font-weight: 800;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 0.68rem;
    }

    .hist-valid .hist-status   { background: #d1fae5; color: #065f46; }
    .hist-used .hist-status,
    .hist-invalid .hist-status { background: #fee2e2; color: #991b1b; }
    .hist-unknown .hist-status { background: #fef3c7; color: #92400e; }

    .hist-msg {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--text-primary);
    }

    @media (max-width: 900px) {
      .validator-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class AccessValidatorComponent implements OnInit, OnDestroy {
  private readonly booking = inject(BookingService);

  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

  readonly cameraActive = signal(false);
  readonly showManualInput = signal(false);
  readonly videoDevices = signal<MediaDeviceItem[]>([]);
  readonly result = signal<TicketValidationResult | null>(null);
  readonly scanHistory = signal<ScanHistoryItem[]>([]);

  selectedDeviceId = '';
  qrPayload = '';

  private mediaStream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private lastScannedPayload = '';
  private lastScanTime = 0;
  private audioCtx: AudioContext | null = null;
  private validationInProgress = false;

  ngOnInit(): void {
    this.enumerateVideoDevices();
    // Auto-start camera
    this.startCamera();
  }

  ngOnDestroy(): void {
    this.stopCamera();
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => undefined);
    }
  }

  async enumerateVideoDevices(): Promise<void> {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label }));
      this.videoDevices.set(videoInputs);
    } catch {
      // Permission might be needed first
    }
  }

  toggleCamera(): void {
    if (this.cameraActive()) {
      this.stopCamera();
    } else {
      this.startCamera();
    }
  }

  async startCamera(): Promise<void> {
    this.stopCamera();

    try {
      const constraints: MediaStreamConstraints = {
        video: this.selectedDeviceId
          ? { deviceId: { exact: this.selectedDeviceId } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.cameraActive.set(true);

      // Re-enumerate to get device labels now that permission is granted
      this.enumerateVideoDevices();

      // Wait for video element to be bound in DOM
      setTimeout(() => {
        if (this.videoElement?.nativeElement && this.mediaStream) {
          const video = this.videoElement.nativeElement;
          video.srcObject = this.mediaStream;
          video.setAttribute('playsinline', 'true');
          video.play().then(() => this.scanLoop()).catch(() => undefined);
        }
      }, 100);
    } catch (err) {
      this.cameraActive.set(false);
      console.warn('No se pudo acceder a la cámara:', err);
    }
  }

  stopCamera(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.cameraActive.set(false);
  }

  onDeviceChange(): void {
    if (this.cameraActive()) {
      this.startCamera();
    }
  }

  private scanLoop(): void {
    if (!this.cameraActive()) return;

    const video = this.videoElement?.nativeElement;
    const canvas = this.canvasElement?.nativeElement;

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code && code.data) {
          const now = Date.now();
          const isSameCode = code.data === this.lastScannedPayload;
          const isCooldownActive = now - this.lastScanTime < 2000;

          if (!isSameCode || !isCooldownActive) {
            this.lastScannedPayload = code.data;
            this.lastScanTime = now;
            this.processQrPayload(code.data);
          }
        }
      }
    }

    this.animFrameId = requestAnimationFrame(() => this.scanLoop());
  }

  private processQrPayload(payload: string): void {
    if (this.validationInProgress) return;
    this.validationInProgress = true;
    this.booking.authorizeTicketQr(payload).subscribe((res) => {
      this.validationInProgress = false;
      this.result.set(res);
      this.playAudioFeedback(res.status === 'valid');

      const historyItem: ScanHistoryItem = {
        timestamp: new Date().toISOString(),
        result: res,
        payload
      };
      this.scanHistory.update((prev) => [historyItem, ...prev.slice(0, 19)]);
    });
  }

  validateManual(): void {
    if (!this.qrPayload.trim()) return;
    this.processQrPayload(this.qrPayload);
  }

  clearResult(): void {
    this.result.set(null);
    this.qrPayload = '';
    this.lastScannedPayload = '';
    this.lastScanTime = 0;
  }

  get iconName(): string {
    const s = this.result()?.status;
    if (s === 'valid') return 'check_circle';
    if (s === 'used') return 'block';
    if (s === 'invalid') return 'error';
    if (s === 'unknown') return 'help';
    return 'qr_code_scanner';
  }

  get resultLabel(): string {
    const s = this.result()?.status;
    if (s === 'valid') return 'Acceso Autorizado';
    if (s === 'used') return 'Ticket Ya Usado (Copia)';
    if (s === 'invalid') return 'Ticket Rechazado';
    if (s === 'unknown') return 'QR Desconocido';
    return 'Esperando lectura';
  }

  seatLabels(booking: BookingRecord): string {
    return booking.seats.map((seat) => seat.label).join(', ');
  }

  private playAudioFeedback(isValid: boolean): void {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = isValid ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(isValid ? 880 : 300, this.audioCtx.currentTime); // High pitch for valid, low for error

      if (isValid) {
        osc.frequency.exponentialRampToValueAtTime(1200, this.audioCtx.currentTime + 0.15);
      }

      gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.25);
    } catch {
      // Audio playback ignored if blocked by browser
    }
  }
}
