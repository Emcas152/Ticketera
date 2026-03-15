import { AsyncPipe, CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { LoaderService } from '../../../core/services/loader.service';
import { MATERIAL_IMPORTS } from '../../material/material-imports';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule, AsyncPipe, ...MATERIAL_IMPORTS],
  template: `
    <div class="overlay" *ngIf="loader.loading$ | async">
      <div class="spinner panel-surface">
        <mat-progress-spinner mode="indeterminate" diameter="42"></mat-progress-spinner>
        <span>Procesando solicitud...</span>
      </div>
    </div>
  `,
  styles: [
    `
      .overlay {
        position: fixed;
        inset: 0;
        display: grid;
        place-items: center;
        background: rgba(7, 17, 27, 0.22);
        backdrop-filter: blur(6px);
        z-index: 1200;
      }

      .spinner {
        display: inline-flex;
        align-items: center;
        gap: 16px;
      }
    `
  ]
})
export class LoaderComponent {
  constructor(public loader: LoaderService) {}
}
