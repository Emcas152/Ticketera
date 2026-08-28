import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { SystemSettingsService } from '../../core/services/system-settings.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';

@Component({
  selector: 'app-system-settings',
  standalone: true,
  imports: [CommonModule, ...MATERIAL_IMPORTS],
  template: `
    <section class="admin-shell settings-admin">
      <div class="admin-header">
        <div>
          <p class="eyebrow">Configuración</p>
          <h1>Ajustes del sistema</h1>
          <p class="admin-subtitle">Controla funciones globales de la tienda pública.</p>
        </div>
      </div>

      <article class="panel-surface setting-card">
        <div class="setting-icon" [class.enabled]="enabled()">
          <mat-icon>{{ enabled() ? 'construction' : 'credit_card' }}</mat-icon>
        </div>
        <div class="setting-copy">
          <div class="setting-title">
            <strong>Mantenimiento de la pasarela de pago</strong>
            <span class="status-pill" [class.enabled]="enabled()">
              {{ enabled() ? 'Habilitado' : 'Deshabilitado' }}
            </span>
          </div>
          <p>
            Al habilitarlo, el checkout muestra el aviso de mantenimiento, ofrece contacto por WhatsApp
            y no permite procesar pagos. Deshabilitado, la compra funciona normalmente.
          </p>
        </div>
        <mat-slide-toggle
          color="primary"
          [checked]="enabled()"
          [disabled]="loading() || saving()"
          (change)="save($event.checked)"
          aria-label="Activar mantenimiento de pagos"
        />
      </article>

      @if (message()) {
        <p class="feedback" [class.error]="hasError()">{{ message() }}</p>
      }
    </section>
  `,
  styles: [`
    .settings-admin{display:grid;gap:20px}.setting-card{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:18px;padding:24px}.setting-icon{display:grid;place-items:center;width:56px;height:56px;border-radius:16px;background:#e8f5ee;color:#177245}.setting-icon.enabled{background:#fff1e6;color:#b45309}.setting-copy{min-width:0}.setting-title{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.setting-copy p{max-width:760px;margin:8px 0 0;color:var(--text-muted);line-height:1.55}.status-pill{padding:5px 10px;border-radius:999px;background:#dcfce7;color:#166534;font-size:.72rem;font-weight:800;text-transform:uppercase}.status-pill.enabled{background:#ffedd5;color:#9a3412}.feedback{margin:0;padding:12px 16px;border-radius:12px;background:#dcfce7;color:#166534}.feedback.error{background:#fee2e2;color:#991b1b}@media(max-width:720px){.setting-card{grid-template-columns:auto 1fr}.setting-card mat-slide-toggle{grid-column:1/-1}.setting-title{align-items:flex-start}}
  `]
})
export class SystemSettingsComponent implements OnInit {
  private readonly settings = inject(SystemSettingsService);

  readonly enabled = signal(false);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly message = signal('');
  readonly hasError = signal(false);

  ngOnInit(): void {
    this.settings.getPaymentMaintenance()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (setting) => this.enabled.set(setting.enabled),
        error: () => this.showMessage('No fue posible cargar el estado de mantenimiento.', true)
      });
  }

  save(enabled: boolean): void {
    const previousValue = this.enabled();
    this.enabled.set(enabled);
    this.saving.set(true);
    this.message.set('');

    this.settings.updatePaymentMaintenance(enabled)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (setting) => {
          this.enabled.set(setting.enabled);
          this.showMessage(setting.enabled ? 'Mantenimiento habilitado.' : 'Mantenimiento deshabilitado.');
        },
        error: () => {
          this.enabled.set(previousValue);
          this.showMessage('No fue posible guardar el cambio.', true);
        }
      });
  }

  private showMessage(message: string, error = false): void {
    this.message.set(message);
    this.hasError.set(error);
  }
}
