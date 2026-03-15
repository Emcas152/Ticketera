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
    <section class="auth-shell page-shell">
      <article class="auth-card panel-surface">
        <p class="eyebrow">Access</p>
        <h1>Iniciar sesion</h1>
        <p class="auth-copy">Gestiona tus reservas, tickets y compras desde un solo workspace.</p>

        <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline">
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Contrasena</mat-label>
            <input matInput type="password" formControlName="password" />
          </mat-form-field>

          <button mat-flat-button type="submit">Entrar</button>
        </form>

        <div class="auth-links">
          <a routerLink="/auth/forgot-password">Recuperar contrasena</a>
          <a routerLink="/auth/register">Crear cuenta</a>
        </div>
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
        width: min(100%, 480px);
      }

      .auth-form {
        display: grid;
        gap: 16px;
      }

      .auth-copy,
      .auth-links {
        color: var(--text-muted);
      }

      .auth-links {
        display: flex;
        justify-content: space-between;
        gap: 16px;
      }
    `
  ]
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
