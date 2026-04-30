import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ...MATERIAL_IMPORTS],
  template: `
    <section class="auth-page page-shell">
      <article class="auth-showcase panel-surface">
        <img class="brand" src="/assets/icons/icon-white-ui.png" alt="ALCON Productions" />
        <p class="eyebrow">New customer onboarding</p>
        <h1>Crea tu cuenta y entra directo al flujo de compra.</h1>
        <p class="lead">
          Registro pensado para plataformas de eventos: rapido, claro y listo para integrarse con tu
          API REST de usuarios.
        </p>

        <ul class="surface-list auth-feature-list">
          <li><span>Alta de usuarios con perfil</span><mat-icon>person_add</mat-icon></li>
          <li><span>Sesion automatica tras registro</span><mat-icon>login</mat-icon></li>
          <li><span>Acceso inmediato al dashboard</span><mat-icon>dashboard_customize</mat-icon></li>
        </ul>
      </article>

      <article class="auth-card panel-surface">
        <div>
          <p class="eyebrow">Register</p>
          <h1>Crear cuenta</h1>
          <p class="admin-subtitle">Completa tus datos para administrar tus compras y tickets.</p>
        </div>

        <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline">
            <mat-label>Nombre completo</mat-label>
            <input matInput formControlName="fullName" />
            <mat-icon matSuffix>badge</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" />
            <mat-icon matSuffix>mail</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Telefono</mat-label>
            <input matInput formControlName="phone" />
            <mat-icon matSuffix>call</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Contrasena</mat-label>
            <input matInput type="password" formControlName="password" />
            <mat-icon matSuffix>lock</mat-icon>
          </mat-form-field>

          <button mat-flat-button color="primary" type="submit">Crear cuenta</button>
        </form>

        <div class="auth-links">
          <span>Ya tienes cuenta?</span>
          <a routerLink="/auth/login">Inicia sesion</a>
        </div>
      </article>
    </section>
  `
})
export class RegisterComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly form = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.auth.register(this.form.getRawValue()).subscribe(() => this.router.navigateByUrl('/dashboard'));
  }
}
