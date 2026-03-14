import { Routes } from '@angular/router';
import { EventsListComponent } from './events-list.component';
import { EventDetailComponent } from './event-detail.component';
import { PublicLayout } from '../../layouts/public-layout/public-layout.component';

export const routes: Routes = [
  {
    path: '',
    component: PublicLayout,
    children: [
      { path: '', component: EventsListComponent },
      { path: 'event', component: EventDetailComponent }
    ]
  }
];

// Provide prerender params for dynamic event routes (used by prerender)
export function getPrerenderParams() {
  return [
    { params: { id: '1' } },
    { params: { id: '2' } }
  ];
}
