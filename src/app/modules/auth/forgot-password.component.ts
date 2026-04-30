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
    <section class="auth-page page-shell">
      <article class="auth-showcase panel-surface">
        <img class="brand" src="/assets/icons/icon-white-ui.png" alt="ALCON Productions" />
        <p class="eyebrow">Recovery flow</p>
        <h1>Restablece el acceso sin salir del ecosistema de venta.</h1>
        <p class="lead">
          Pantalla preparada para integrarse con el endpoint real de recuperacion de contrasena y
          mantener el mismo lenguaje visual del dashboard.
        </p>
      </article>

      <article class="auth-card panel-surface">
        <div>
          <p class="eyebrow">Recovery</p>
          <h1>Recuperar contrasena</h1>
          <p class="admin-subtitle">Te enviaremos un enlace de recuperacion al correo registrado.</p>
        </div>

        <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline">
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" />
            <mat-icon matSuffix>alternate_email</mat-icon>
          </mat-form-field>

          <button mat-flat-button color="primary" type="submit">Enviar enlace</button>
        </form>

        <div class="auth-links">
          <span>Recuerdas tu acceso?</span>
          <a routerLink="/auth/login">Volver al login</a>
        </div>
      </article>
    </section>
  `
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
