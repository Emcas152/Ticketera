import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventCardComponent } from '../..//shared/components/event-card/event-card.component';
import { ApiService } from '../../core/services/api.service';
import { EventItem } from '../../core/models/event.model';

@Component({
  selector: 'events-list',
  standalone: true,
  imports: [CommonModule, EventCardComponent],
  template: `
    <h1>Próximos eventos</h1>
    <div class="grid">
      <app-event-card *ngFor="let e of events" [event]="e"></app-event-card>
    </div>
  `,
  styles: [`.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}`]
})
export class EventsListComponent implements OnInit {
  events: EventItem[] = [];
  constructor(private api: ApiService) {}
  ngOnInit() {
    // replace with real API call
    this.events = [
      { id: '1', name: 'Concierto Demo', date: new Date().toISOString(), location: 'Auditorio', basePrice: 20, image: '' },
      { id: '2', name: 'Festival Demo', date: new Date().toISOString(), location: 'Plaza', basePrice: 35, image: '' }
    ];
  }
}
