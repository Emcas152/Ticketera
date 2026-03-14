import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoaderService } from '../../../core/services/loader.service';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule, AsyncPipe],
  template: `
    <div class="overlay" *ngIf="(loader.loading$ | async)">
      <div class="spinner">Cargando...</div>
    </div>
  `,
  styles: [`.overlay{position:fixed;inset:0;background:rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;z-index:9999}.spinner{background:#fff;padding:18px;border-radius:6px}`]
})
export class LoaderComponent { constructor(public loader: LoaderService) {} }
