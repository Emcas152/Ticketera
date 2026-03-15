import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoaderComponent } from './shared/components/loader/loader.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LoaderComponent],
  template: `
    <app-loader />
    <router-outlet />
  `,
  styleUrls: ['./app.scss']
})
export class App {}
