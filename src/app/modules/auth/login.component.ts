import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ...MATERIAL_IMPORTS],
  template: `
    <section class="auth-page page-shell">
      <article class="auth-showcase panel-surface">
        <img class="brand" src="/assets/icons/icon-white-ui.png" alt="ALCON Productions" />
        <p class="eyebrow">Administrative access</p>
        <h1>Controla eventos, tickets y operacion interna desde un solo panel.</h1>
        <p class="lead">
          Acceso restringido para administradores con autenticacion JWT, sesiones persistentes y visibilidad
          centralizada de la operacion.
        </p>

        <ul class="surface-list auth-feature-list">
          <li><span>Acceso seguro con JWT</span><mat-icon>verified_user</mat-icon></li>
          <li><span>Seguimiento de tickets emitidos</span><mat-icon>confirmation_number</mat-icon></li>
          <li><span>Panel interno de eventos</span><mat-icon>dashboard_customize</mat-icon></li>
        </ul>
      </article>

      <article class="auth-card panel-surface">
        <div>
          <p class="eyebrow">Access</p>
          <h1>Iniciar sesion</h1>
          <p class="admin-subtitle">Ingresa con tus credenciales de administrador.</p>
        </div>

        <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline">
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" />
            <mat-icon matSuffix>mail</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Contrasena</mat-label>
            <input matInput type="password" formControlName="password" />
            <mat-icon matSuffix>lock</mat-icon>
          </mat-form-field>

          <button mat-flat-button color="primary" type="submit">Entrar al administrador</button>
        </form>

        <div class="auth-links">
          <a routerLink="/auth/forgot-password">Recuperar contrasena</a>
        </div>
      </article>
    </section>
  `
})
export class LoginComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.auth.login(this.form.getRawValue()).subscribe(() => {
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
      this.router.navigateByUrl(returnUrl);
    });
  }
}
