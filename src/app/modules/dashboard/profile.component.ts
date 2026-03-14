import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'dashboard-profile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <h2>Mi perfil</h2>
    <p>Información del usuario y opciones de edición.</p>
  `
})
export class ProfileComponent {}
