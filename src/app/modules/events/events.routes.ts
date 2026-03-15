import { Routes } from '@angular/router';
import { PublicLayout } from '../../layouts/public-layout/public-layout.component';
import { EventDetailComponent } from './event-detail.component';
import { EventsHomeComponent } from './events-home.component';
import { EventsListComponent } from './events-list.component';

export const routes: Routes = [
  {
    path: '',
    component: PublicLayout,
    children: [
      { path: '', component: EventsHomeComponent },
      { path: 'events', component: EventsListComponent },
      { path: 'events/:id', component: EventDetailComponent }
    ]
  }
];
