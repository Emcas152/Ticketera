import { Directive, HostListener, Input } from '@angular/core';

@Directive({
  selector: 'img[appImageFallback]',
  standalone: true
})
export class ImageFallbackDirective {
  @Input() appImageFallback =
    'data:image/svg+xml;charset=UTF-8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
        <defs>
          <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
            <stop stop-color="#0f62fe" offset="0"/>
            <stop stop-color="#ff7f11" offset="1"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="800" fill="url(#g)"/>
        <text x="50%" y="48%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-size="64" font-family="Arial">Pulse Events</text>
        <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" fill="#dbe9ff" font-size="28" font-family="Arial">Imagen no disponible</text>
      </svg>`
    );

  @HostListener('error', ['$event'])
  onError(event: Event): void {
    const image = event.target as HTMLImageElement | null;

    if (image) {
      image.src = this.appImageFallback;
    }
  }
}
