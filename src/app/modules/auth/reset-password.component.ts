import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ...MATERIAL_IMPORTS],
  template: `
    <section class="auth-page page-shell">
      <article class="auth-showcase panel-surface">
        <img class="brand" src="/assets/icons/icon-white-ui.png" alt="ALCON Productions" />
        <p class="eyebrow">Recovery</p>
        <h1>Crea una nueva contrasena para tu cuenta.</h1>
        <p class="lead">El enlace de recuperacion es valido durante 60 minutos.</p>
      </article>

      <article class="auth-card panel-surface">
        <div><p class="eyebrow">Nuevo acceso</p><h1>Restablecer contrasena</h1></div>
        <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline">
            <mat-label>Nueva contrasena</mat-label>
            <input matInput type="password" formControlName="password" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Confirmar contrasena</mat-label>
            <input matInput type="password" formControlName="confirmation" />
          </mat-form-field>
          <button mat-flat-button color="primary" type="submit" [disabled]="submitting">
            Guardar contrasena
          </button>
        </form>
        <div class="auth-links"><a routerLink="/auth/login">Volver al login</a></div>
      </article>
    </section>
  `
})
export class ResetPasswordComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  submitting = false;

  readonly form = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmation: ['', [Validators.required, Validators.minLength(8)]]
  });

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const token = this.route.snapshot.queryParamMap.get('token');
    const email = this.route.snapshot.queryParamMap.get('email');
    const { password, confirmation } = this.form.getRawValue();

    if (!token || !email || password !== confirmation) { return; }

    this.submitting = true;
    this.auth.resetPassword({ token, email, password, password_confirmation: confirmation })
      .pipe(finalize(() => this.submitting = false))
      .subscribe(() => this.router.navigate(['/auth/login']));
  }
}
