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
    <section class="auth-shell page-shell">
      <article class="auth-card panel-surface">
        <p class="eyebrow">New account</p>
        <h1>Crear cuenta</h1>
        <p class="auth-copy">Registra usuarios, inicia sesion con JWT y continua directo al checkout.</p>

        <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline">
            <mat-label>Nombre completo</mat-label>
            <input matInput formControlName="fullName" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Telefono</mat-label>
            <input matInput formControlName="phone" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Contrasena</mat-label>
            <input matInput type="password" formControlName="password" />
          </mat-form-field>

          <button mat-flat-button type="submit">Crear cuenta</button>
        </form>

        <div class="auth-links">
          <span>Ya tienes cuenta?</span>
          <a routerLink="/auth/login">Inicia sesion</a>
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
        width: min(100%, 520px);
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
      }
    `
  ]
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
