import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ErrorService } from '../../core/services/error.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ...MATERIAL_IMPORTS],
  template: `
    <section class="auth-page page-shell reset-auth-page">
      <article class="auth-showcase panel-surface">
        <img class="brand brand-ticket" src="/assets/icons/C5952526-EC42-4BC4-8968-7F2270317160.PNG" alt="ALCON Ticket" />
        <p class="eyebrow">Recuperación segura</p>
        <h1>Crea una nueva contraseña para tu cuenta.</h1>
        <p class="lead">Usa una contraseña segura que no hayas utilizado anteriormente.</p>
        <ul class="password-tips">
          <li><mat-icon>check_circle</mat-icon> Al menos 8 caracteres</li>
          <li><mat-icon>check_circle</mat-icon> Una letra mayúscula y una minúscula</li>
          <li><mat-icon>check_circle</mat-icon> Al menos un número</li>
        </ul>
      </article>

      <article class="auth-card panel-surface">
        @if (success()) {
          <div class="result-state success-state" role="status">
            <mat-icon>verified</mat-icon>
            <h1>Contraseña actualizada</h1>
            <p>Ya puedes iniciar sesión con tu nueva contraseña.</p>
            <a mat-flat-button color="primary" routerLink="/auth/login">Ir al inicio de sesión</a>
          </div>
        } @else if (invalidLink) {
          <div class="result-state error-state" role="alert">
            <mat-icon>link_off</mat-icon>
            <h1>Enlace no válido</h1>
            <p>El enlace está incompleto, venció o ya fue utilizado. Solicita uno nuevo.</p>
            <a mat-flat-button color="primary" routerLink="/auth/forgot-password">Solicitar otro enlace</a>
          </div>
        } @else {
          <div>
            <p class="eyebrow">Nuevo acceso</p>
            <h1>Restablecer contraseña</h1>
            <p class="admin-subtitle account-email">Actualizando el acceso de <strong>{{ email }}</strong></p>
          </div>

          <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field appearance="outline">
              <mat-label>Nueva contraseña</mat-label>
              <input matInput [type]="showPassword() ? 'text' : 'password'" formControlName="password" autocomplete="new-password" />
              <button mat-icon-button matSuffix type="button" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'">
                <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              @if (form.controls.password.touched && form.controls.password.hasError('required')) { <mat-error>Ingresa una contraseña.</mat-error> }
              @if (form.controls.password.touched && form.controls.password.hasError('minlength')) { <mat-error>Debe contener al menos 8 caracteres.</mat-error> }
              @if (form.controls.password.touched && form.controls.password.hasError('pattern')) { <mat-error>Incluye mayúscula, minúscula y número.</mat-error> }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Confirmar contraseña</mat-label>
              <input matInput [type]="showConfirmation() ? 'text' : 'password'" formControlName="confirmation" autocomplete="new-password" />
              <button mat-icon-button matSuffix type="button" (click)="showConfirmation.set(!showConfirmation())" [attr.aria-label]="showConfirmation() ? 'Ocultar confirmación' : 'Mostrar confirmación'">
                <mat-icon>{{ showConfirmation() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              @if (form.controls.confirmation.touched && form.controls.confirmation.hasError('required')) { <mat-error>Confirma la contraseña.</mat-error> }
              @if (form.controls.confirmation.touched && passwordsDoNotMatch) { <mat-error>Las contraseñas no coinciden.</mat-error> }
            </mat-form-field>

            @if (responseMessage()) {
              <div class="form-response" role="alert"><mat-icon>error_outline</mat-icon><span>{{ responseMessage() }}</span></div>
            }

            <button mat-flat-button color="primary" type="submit" [disabled]="submitting()">
              {{ submitting() ? 'Actualizando contraseña...' : 'Guardar nueva contraseña' }}
            </button>
          </form>
          <div class="auth-links"><a routerLink="/auth/login">Volver al inicio de sesión</a></div>
        }
      </article>
    </section>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .reset-auth-page { grid-template-columns: minmax(0, 1.15fr) minmax(380px, 520px); }
    .reset-auth-page > article, .auth-card, .auth-form { min-width: 0; }
    .auth-card { overflow: hidden; }
    .auth-form mat-form-field, .auth-form > button { width: 100%; min-width: 0; }
    .account-email { max-width: 100%; overflow-wrap: anywhere; }
    .account-email strong { color: var(--text-primary); }
    .password-tips { display: grid; gap: 10px; padding: 0; margin: 24px 0 0; list-style: none; }
    .password-tips li { display: flex; align-items: center; gap: 9px; }
    .password-tips mat-icon { color: #ff007a; font-size: 20px; width: 20px; height: 20px; }
    .result-state { display: grid; justify-items: center; gap: 12px; padding: 28px 10px; text-align: center; }
    .result-state > mat-icon { width: 58px; height: 58px; font-size: 58px; }
    .result-state h1, .result-state p { margin: 0; }
    .result-state p { color: var(--text-muted); }
    .success-state > mat-icon { color: #15803d; }
    .error-state > mat-icon { color: #be123c; }
    .form-response { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border: 1px solid #fecaca; border-radius: 10px; color: #991b1b; background: #fef2f2; font-size: .86rem; }
    .form-response mat-icon { flex: 0 0 auto; width: 20px; height: 20px; font-size: 20px; }
    @media (max-width: 960px) {
      .reset-auth-page { grid-template-columns: minmax(0, 1fr); }
    }
    @media (max-width: 520px) {
      .reset-auth-page { padding-top: 16px; }
      .auth-showcase, .auth-card { padding: 24px 20px; }
      .auth-card h1 { font-size: 1.55rem; }
    }
  `]
})
export class ResetPasswordComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly errors = inject(ErrorService);
  readonly submitting = signal(false);
  readonly success = signal(false);
  readonly responseMessage = signal('');
  readonly showPassword = signal(false);
  readonly showConfirmation = signal(false);
  readonly token = this.extractToken(this.route.snapshot.queryParamMap.get('token') ?? '');
  readonly email = this.extractEmail(this.route.snapshot.queryParamMap.get('email') ?? '');
  readonly invalidLink = !this.token || !this.email;

  readonly form = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)]],
    confirmation: ['', [Validators.required, Validators.minLength(8)]]
  });

  get passwordsDoNotMatch(): boolean {
    const { password, confirmation } = this.form.getRawValue();
    return Boolean(confirmation && password !== confirmation);
  }

  submit(): void {
    this.responseMessage.set('');
    if (this.form.invalid || this.passwordsDoNotMatch || this.invalidLink) { this.form.markAllAsTouched(); return; }
    const { password, confirmation } = this.form.getRawValue();

    this.submitting.set(true);
    this.auth.resetPassword({ token: this.token, email: this.email, password, password_confirmation: confirmation })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => this.success.set(true),
        error: (error: HttpErrorResponse) => this.responseMessage.set(this.errors.getMessage(error))
      });
  }

  private extractEmail(value: string): string {
    const decoded = this.decodeRepeatedly(value);
    return decoded.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() ?? '';
  }

  private extractToken(value: string): string {
    return this.decodeRepeatedly(value).match(/[A-Z0-9._~-]+/i)?.[0] ?? '';
  }

  private decodeRepeatedly(value: string): string {
    let decoded = value.trim();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const next = decodeURIComponent(decoded.replace(/\+/g, ' '));
        if (next === decoded) break;
        decoded = next;
      } catch {
        break;
      }
    }
    return decoded;
  }
}
