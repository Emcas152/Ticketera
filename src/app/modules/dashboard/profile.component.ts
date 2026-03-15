import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ...MATERIAL_IMPORTS],
  template: `
    <section class="panel-surface">
      <p class="eyebrow">Profile</p>
      <h1>Perfil de usuario</h1>

      <form class="profile-form" [formGroup]="form" (ngSubmit)="submit()">
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

        <mat-form-field appearance="outline">
          <mat-label>Membresia</mat-label>
          <mat-select formControlName="membershipTier">
            <mat-option value="Core">Core</mat-option>
            <mat-option value="Prime">Prime</mat-option>
            <mat-option value="Elite">Elite</mat-option>
          </mat-select>
        </mat-form-field>

        <button mat-flat-button type="submit">Guardar cambios</button>
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
    fullName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    city: [''],
    membershipTier: 'Core' as 'Core' | 'Prime' | 'Elite'
  });

  constructor() {
    this.auth.user$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((user) => {
      if (user) {
        this.form.patchValue(user);
      }
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.auth.updateProfile(this.form.getRawValue()).subscribe();
  }
}
