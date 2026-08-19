import { EventService } from './event.service';

describe('EventService timezone', () => {
  const service = Object.create(EventService.prototype) as EventService;

  it('conserva las 19:00 con el offset explícito de Guatemala', () => {
    const iso = (service as unknown as { toEventIso(date: string, time: string): string })
      .toEventIso('2026-08-28', '19:00');
    expect(iso).toBe('2026-08-28T19:00:00-06:00');
  });

  it('recupera el mismo día y hora para editar el evento', () => {
    expect(service.getEventLocalParts('2026-08-29T01:00:00+00:00')).toEqual({
      date: '2026-08-28',
      time: '19:00'
    });
  });
});
