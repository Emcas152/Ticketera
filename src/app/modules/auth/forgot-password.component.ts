import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ...MATERIAL_IMPORTS],
  template: `
    <section class="auth-shell page-shell">
      <article class="auth-card panel-surface">
        <p class="eyebrow">Recovery</p>
        <h1>Recuperar contrasena</h1>
        <p class="auth-copy">Envio de enlace de recuperacion listo para integrarse con tu endpoint real.</p>

        <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline">
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" />
          </mat-form-field>

          <button mat-flat-button type="submit">Enviar enlace</button>
        </form>

        <a routerLink="/auth/login">Volver al login</a>
      </article>
    </section>
  `,
  styles: [
    `
      .auth-shell {
        display: grid;
        place-items: center;
        padding-top: 32px;
      }

      .auth-card {
        width: min(100%, 460px);
      }

      .auth-form {
        display: grid;
        gap: 16px;
      }

      .auth-copy {
        color: var(--text-muted);
      }
    `
  ]
})
export class ForgotPasswordComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.auth.requestPasswordReset(this.form.getRawValue()).subscribe();
  }
}
