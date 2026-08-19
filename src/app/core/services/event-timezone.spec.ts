import { EventService } from './event.service';

describe('EventService timezone', () => {
  const service = Object.create(EventService.prototype) as EventService;

  it('convierte las 19:00 de Guatemala al instante UTC correcto', () => {
    const iso = (service as unknown as { toEventIso(date: string, time: string): string })
      .toEventIso('2026-08-28', '19:00');
    expect(iso).toBe('2026-08-29T01:00:00.000Z');
  });

  it('recupera el mismo día y hora para editar el evento', () => {
    expect(service.getEventLocalParts('2026-08-29T01:00:00+00:00')).toEqual({
      date: '2026-08-28',
      time: '19:00'
    });
  });
});
