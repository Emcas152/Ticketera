import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'auth-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="auth">
      <h2>Registro</h2>
      <form (ngSubmit)="submit()">
        <label>Nombre<input [(ngModel)]="name" name="name" required /></label>
        <label>Email<input [(ngModel)]="email" name="email" required /></label>
        <label>Contraseña<input [(ngModel)]="password" type="password" name="password" required /></label>
        <button type="submit">Crear cuenta</button>
      </form>
    </section>
  `
})
export class RegisterComponent {
  name = '';
  email = '';
  password = '';
  constructor(private router: Router) {}
  submit() {
    // implement registration against API
    this.router.navigate(['/auth/login']);
  }
}
