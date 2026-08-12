import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ...MATERIAL_IMPORTS],
  template: `
    <section class="panel-surface">
      <p class="eyebrow">Administrador</p>
      <h1>Perfil del administrador</h1>

      <p>Los datos del perfil provienen de la cuenta administrada por la API.</p>
      <form class="profile-form" [formGroup]="form">
        <mat-form-field appearance="outline">
          <mat-label>Nombre completo</mat-label>
          <input matInput formControlName="fullName" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput formControlName="email" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Telefono</mat-label>
          <input matInput formControlName="phone" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Ciudad</mat-label>
          <input matInput formControlName="city" />
        </mat-form-field>

      </form>
    </section>
  `,
  styles: [
    `
      .profile-form {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }

      .profile-form button {
        width: fit-content;
      }

      @media (max-width: 768px) {
        .profile-form {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class ProfileComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  readonly form = this.fb.group({
    fullName: [''],
    email: [''],
    phone: [''],
    city: ['']
  });

  constructor() {
    this.auth.user$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((user) => {
      if (user) {
        this.form.patchValue(user);
        this.form.disable();
      }
    });
  }
}
