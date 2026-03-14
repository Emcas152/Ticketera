import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'auth-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="auth">
      <h2>Ingresar</h2>
      <form (ngSubmit)="submit()">
        <label>Email<input [(ngModel)]="email" name="email" required /></label>
        <label>Contraseña<input [(ngModel)]="password" type="password" name="password" required /></label>
        <button type="submit">Entrar</button>
      </form>
      <p>¿No tienes cuenta? <a routerLink="/auth/register">Regístrate</a></p>
    </section>
  `,
  styles: [`.auth{max-width:420px;margin:40px auto;padding:18px;border:1px solid #eee;border-radius:8px}`]
})
export class LoginComponent {
  email = '';
  password = '';
  constructor(private auth: AuthService, private router: Router) {}
  submit() {
    // For demo: fake token
    const fakeToken = 'fake-jwt-token';
    this.auth.login(fakeToken, { email: this.email, name: 'Usuario' });
    this.router.navigate(['/']);
  }
}
