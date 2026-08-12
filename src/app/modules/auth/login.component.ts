import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ErrorService } from '../../core/services/error.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ...MATERIAL_IMPORTS],
  template: `
    <section class="auth-page page-shell">
      <article class="auth-showcase panel-surface">
        <img class="brand brand-ticket" src="/assets/icons/C5952526-EC42-4BC4-8968-7F2270317160.PNG" alt="ALCON Ticket" />
        <p class="eyebrow">Administrative access</p>
        <h1>Controla eventos, tickets y operacion interna desde un solo panel.</h1>
        <p class="lead">
          Acceso restringido para administradores.
        </p>

        <ul class="surface-list auth-feature-list">
         
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
            @if (form.controls.email.touched && form.controls.email.hasError('required')) { <mat-error>Ingresa tu correo.</mat-error> }
            @if (form.controls.email.touched && form.controls.email.hasError('email')) { <mat-error>Ingresa un correo válido.</mat-error> }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Contrasena</mat-label>
            <input matInput type="password" formControlName="password" />
            <mat-icon matSuffix>lock</mat-icon>
            @if (form.controls.password.touched && form.controls.password.hasError('required')) { <mat-error>Ingresa tu contraseña.</mat-error> }
            @if (form.controls.password.touched && form.controls.password.hasError('minlength')) { <mat-error>La contraseña debe tener al menos 6 caracteres.</mat-error> }
          </mat-form-field>

          @if (responseMessage()) {
            <div class="login-response" role="alert">
              <mat-icon>error_outline</mat-icon>
              <span>{{ responseMessage() }}</span>
            </div>
          }

          <button mat-flat-button color="primary" type="submit" [disabled]="submitting()">
            {{ submitting() ? 'Validando acceso...' : 'Entrar al administrador' }}
          </button>
        </form>

        <div class="auth-links">
          <a routerLink="/auth/forgot-password">Recuperar contrasena</a>
        </div>
      </article>
    </section>
  `,
  styles: [`
    .login-response {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      border: 1px solid #fecaca;
      border-radius: 10px;
      color: #991b1b;
      background: #fef2f2;
      font-size: .86rem;
      line-height: 1.4;
    }
    .login-response mat-icon { flex: 0 0 auto; width: 20px; height: 20px; font-size: 20px; }
  `]
})
export class LoginComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly errors = inject(ErrorService);
  readonly submitting = signal(false);
  readonly responseMessage = signal('');
  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  constructor() {
    if (this.route.snapshot.queryParamMap.get('accessDenied') === 'admin') {
      this.responseMessage.set('Tu usuario no tiene permisos para acceder al panel administrativo.');
    }
  }

  submit(): void {
    this.responseMessage.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.auth.login(this.form.getRawValue()).pipe(
      finalize(() => this.submitting.set(false))
    ).subscribe({
      next: () => {
        if (!this.auth.canAccessDashboard()) {
          this.auth.logout(false);
          this.responseMessage.set('Tu usuario no tiene permisos para acceder al panel administrativo.');
          return;
        }

        const returnUrl =
          this.route.snapshot.queryParamMap.get('returnUrl') ??
          (this.auth.isAutorizadorOnly() ? '/dashboard/validar' : '/dashboard');
        this.router.navigateByUrl(returnUrl);
      },
      error: (error: HttpErrorResponse) => {
        this.responseMessage.set(this.errors.getMessage(error, 'login'));
      }
    });
  }
}
