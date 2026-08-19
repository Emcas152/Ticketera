import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { environment } from '../../../environments/environment';
import { BookingRecord } from '../models/booking.model';

@Injectable({ providedIn: 'root' })
export class TicketPdfService {
  async downloadTicket(booking: BookingRecord): Promise<void> {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const qrImage = await QRCode.toDataURL(booking.qrCode, {
      errorCorrectionLevel: 'M', margin: 1, width: 480,
      color: { dark: '#050505', light: '#ffffff' }
    });
    const [logo, poster] = await Promise.all([
      this.loadImage('/assets/icons/9148A713-E2BD-44C1-BC64-96B2AC3D91AE.PNG'),
      this.loadImage(this.posterUrl(booking))
    ]);

    this.drawTicket(pdf, booking, qrImage, logo, poster);
    pdf.save(`${booking.orderNumber}.pdf`);
  }

  private drawTicket(
    pdf: jsPDF,
    booking: BookingRecord,
    qrImage: string,
    logo: string | null,
    poster: string | null
  ): void {
    const navy: [number, number, number] = [9, 31, 73];
    const red: [number, number, number] = [187, 22, 42];
    const muted: [number, number, number] = [80, 88, 102];
    const pageWidth = 210;
    const left = 10;
    const divider = 106;
    const right = 113;

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, 210, 297, 'F');
    pdf.setDrawColor(185, 190, 198);
    pdf.setLineWidth(0.35);
    pdf.rect(5, 5, 200, 287);

    pdf.setFillColor(245, 246, 248);
    pdf.roundedRect(9, 10, 35, 14, 3, 3, 'F');
    pdf.setTextColor(10, 10, 10);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('1 de 1', 14, 19);

    if (logo) {
      this.drawBrandImage(pdf, logo, 10, 26, 82, 30);
    } else {
      this.drawTicketBrand(pdf, 12, 29, navy, red);
    }

    pdf.setFontSize(6);
    pdf.setTextColor(30, 30, 30);
    pdf.setFont('helvetica', 'bold');
    pdf.text('ENTRADA 1 DE 1', 195, 15, { align: 'right' });

    pdf.setDrawColor(190, 194, 201);
    pdf.setLineDashPattern([1.2, 1.2], 0);
    pdf.line(divider, 14, divider, 282);
    pdf.setLineDashPattern([], 0);

    this.drawEventSummary(pdf, booking, left, 62, navy, muted);
    this.drawPurchaseSummary(pdf, booking, left, 125, navy, muted);
    this.drawAccessDetails(pdf, booking, right, 28, qrImage, navy, muted);
    this.drawTerms(pdf, left, 198, navy, muted);
    this.drawAntiFraudSeal(pdf, booking, 83, 263, navy, red);
    this.drawPoster(pdf, booking, poster, right, 163, 82, 112, navy, red);

    pdf.setTextColor(...muted);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(5.5);
    pdf.text(`Reserva ${booking.id}`, left, 286);
    pdf.text('Documento personal. Prohibida su reventa o duplicacion.', pageWidth - 10, 286, { align: 'right' });
  }

  private drawAntiFraudSeal(
    pdf: jsPDF,
    booking: BookingRecord,
    centerX: number,
    centerY: number,
    navy: [number, number, number],
    red: [number, number, number]
  ): void {
    pdf.setFillColor(250, 251, 253);
    pdf.setDrawColor(...navy);
    pdf.setLineWidth(0.7);
    pdf.circle(centerX, centerY, 16, 'FD');
    pdf.setLineWidth(0.25);
    pdf.circle(centerX, centerY, 13.5, 'S');
    pdf.setDrawColor(...red);
    pdf.circle(centerX, centerY, 10.8, 'S');

    for (let angle = 0; angle < 360; angle += 15) {
      const radians = angle * Math.PI / 180;
      const inner = angle % 30 === 0 ? 11.5 : 12.3;
      const outer = 15.2;
      pdf.setDrawColor(angle % 30 === 0 ? navy[0] : red[0], angle % 30 === 0 ? navy[1] : red[1], angle % 30 === 0 ? navy[2] : red[2]);
      pdf.line(
        centerX + Math.cos(radians) * inner,
        centerY + Math.sin(radians) * inner,
        centerX + Math.cos(radians) * outer,
        centerY + Math.sin(radians) * outer
      );
    }

    pdf.setFillColor(...navy);
    pdf.roundedRect(centerX - 7.5, centerY - 6, 15, 12, 1.5, 1.5, 'F');
    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(0.6);
    pdf.line(centerX - 3, centerY - 0.5, centerX - 0.5, centerY + 2.2);
    pdf.line(centerX - 0.5, centerY + 2.2, centerX + 4, centerY - 3);

    pdf.setTextColor(...navy);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(5.5);
    pdf.text('ALCON TICKET', centerX, centerY - 8, { align: 'center' });
    pdf.setTextColor(...red);
    pdf.setFontSize(5);
    pdf.text('QR VALIDABLE', centerX, centerY + 9.3, { align: 'center' });

    pdf.setTextColor(...navy);
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(4.5);
    pdf.text(this.ticketFingerprint(booking.qrCode), centerX, centerY + 18.5, { align: 'center' });
  }

  private ticketFingerprint(qrCode: string): string {
    const normalized = qrCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const suffix = normalized.slice(-12).padStart(12, '0');
    return `ID ${suffix.match(/.{1,4}/g)?.join('-') ?? suffix}`;
  }

  private drawBrandImage(
    pdf: jsPDF,
    logo: string,
    x: number,
    y: number,
    maxWidth: number,
    maxHeight: number
  ): void {
    const properties = pdf.getImageProperties(logo);
    const scale = Math.min(maxWidth / properties.width, maxHeight / properties.height);
    const width = properties.width * scale;
    const height = properties.height * scale;

    pdf.addImage(
      logo,
      this.imageFormat(logo),
      x,
      y + (maxHeight - height) / 2,
      width,
      height,
      undefined,
      'FAST'
    );
  }

  private drawTicketBrand(
    pdf: jsPDF,
    x: number,
    y: number,
    navy: [number, number, number],
    red: [number, number, number]
  ): void {
    pdf.setFillColor(...navy);
    pdf.triangle(x, y + 13, x + 7, y, x + 14, y + 13, 'F');
    pdf.setFillColor(255, 255, 255);
    pdf.triangle(x + 4.5, y + 11, x + 7, y + 5.5, x + 9.5, y + 11, 'F');

    pdf.setTextColor(...navy);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.text('ALCON', x + 17, y + 12);

    pdf.setTextColor(...red);
    pdf.setFontSize(9.5);
    pdf.text('T I C K E T', x + 18, y + 19);

    pdf.setDrawColor(...red);
    pdf.setLineWidth(0.8);
    pdf.line(x + 18, y + 21.5, x + 71, y + 21.5);
  }

  private drawEventSummary(
    pdf: jsPDF, booking: BookingRecord, x: number, y: number,
    navy: [number, number, number], muted: [number, number, number]
  ): void {
    pdf.setFillColor(...navy);
    pdf.roundedRect(x, y, 25, 39, 1, 1, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text('EVENTO', x + 12.5, y + 8, { align: 'center' });
    pdf.setFontSize(18);
    pdf.text(this.day(booking.eventDate), x + 12.5, y + 22, { align: 'center' });
    pdf.setFontSize(7);
    pdf.text(this.month(booking.eventDate), x + 12.5, y + 31, { align: 'center' });

    pdf.setTextColor(...navy);
    pdf.setFontSize(12);
    const eventLines = pdf.splitTextToSize(booking.eventName.toUpperCase(), 61);
    pdf.text(eventLines.slice(0, 3), x + 31, y + 5);
    const titleHeight = Math.min(eventLines.length, 3) * 5;
    pdf.setTextColor(...muted);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text(booking.venueName, x + 31, y + 10 + titleHeight, { maxWidth: 61 });
    pdf.text(this.formatDate(booking.eventDate), x + 31, y + 17 + titleHeight, { maxWidth: 61 });
  }

  private drawPurchaseSummary(
    pdf: jsPDF, booking: BookingRecord, x: number, y: number,
    navy: [number, number, number], muted: [number, number, number]
  ): void {
    const rows: Array<[string, string]> = [
      ['Localidad', [...new Set(booking.seats.map((seat) => seat.section))].join(', ') || 'General'],
      ['Asientos', booking.seats.map((seat) => seat.label).join(', ') || 'No numerado'],
      ['Orden', booking.orderNumber],
      ['Metodo', booking.paymentMethod],
      ['Generado', this.formatDate(booking.createdAt)]
    ];

    pdf.setDrawColor(218, 221, 226);
    pdf.line(x, y - 6, 99, y - 6);
    let currentY = y;
    for (const [label, value] of rows) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.setTextColor(...muted);
      pdf.text(label, x, currentY);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...navy);
      pdf.text(String(value), 36, currentY, { maxWidth: 63 });
      currentY += 8;
    }

    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...muted);
    pdf.text(`Subtotal: Q${booking.totals.subtotal.toFixed(2)}`, 99, currentY + 2, { align: 'right' });
    pdf.text(`Servicio: Q${booking.totals.serviceFee.toFixed(2)}`, 99, currentY + 9, { align: 'right' });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(...navy);
    pdf.text(`TOTAL: Q${booking.totals.total.toFixed(2)}`, 99, currentY + 18, { align: 'right' });
  }

  private drawAccessDetails(
    pdf: jsPDF, booking: BookingRecord, x: number, y: number, qrImage: string,
    navy: [number, number, number], muted: [number, number, number]
  ): void {
    const section = [...new Set(booking.seats.map((seat) => seat.section))].join(', ') || 'General';
    const seats = booking.seats.map((seat) => seat.label).join(', ') || 'No numerado';

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.5);
    pdf.setTextColor(...muted);
    pdf.text('FECHA', x, y);
    pdf.text('HORA', x, y + 10);
    pdf.text('TIPO', x, y + 24);
    pdf.text('COMPRADOR', x, y + 34);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...navy);
    pdf.text(this.shortDate(booking.eventDate), x + 24, y);
    pdf.text(this.time(booking.eventDate), x + 24, y + 10);
    pdf.text('ENTRADA', x + 24, y + 24);
    pdf.text(this.buyer(booking.paymentMethod), x + 24, y + 34, { maxWidth: 52 });

    pdf.setDrawColor(205, 209, 216);
    pdf.rect(x, y + 48, 82, 24);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6);
    pdf.setTextColor(...muted);
    pdf.text('ZONA', x + 4, y + 56);
    pdf.text('ASIENTO', x + 4, y + 65);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...navy);
    pdf.text(section, x + 30, y + 56, { maxWidth: 47 });
    pdf.text(seats, x + 30, y + 65, { maxWidth: 47 });

    pdf.setDrawColor(225, 227, 231);
    pdf.rect(x + 17, y + 84, 48, 48);
    pdf.addImage(qrImage, 'PNG', x + 21, y + 88, 40, 40);
    pdf.setFontSize(5.5);
    pdf.setFont('courier', 'normal');
    pdf.setTextColor(...muted);
    pdf.text(booking.qrCode.slice(-18), x + 41, y + 137, { align: 'center' });
  }

  private drawTerms(
    pdf: jsPDF, x: number, y: number,
    navy: [number, number, number], muted: [number, number, number]
  ): void {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(...navy);
    pdf.text('Terminos y condiciones legales', x, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(4.6);
    pdf.setTextColor(...muted);
    const terms = [
      'Esta entrada permite un unico acceso al evento y sera invalidada despues de su lectura.',
      'El codigo QR es personal. No publiques, reenvies ni compartas este documento con terceros.',
      'La organizacion podra solicitar identificacion y negar el acceso si detecta fraude o duplicacion.',
      'No se admiten cambios ni devoluciones, salvo cancelacion o reprogramacion oficial del evento.',
      'El comprador acepta las normas del recinto, controles de seguridad y condiciones del organizador.',
      'Conserva este ticket legible y presentalo desde el telefono o impreso al momento del ingreso.'
    ];
    let currentY = y + 7;
    terms.forEach((term, index) => {
      const lines = pdf.splitTextToSize(`${index + 1}. ${term}`, 88);
      pdf.text(lines, x, currentY);
      currentY += lines.length * 2.5 + 2;
    });
  }

  private drawPoster(
    pdf: jsPDF, booking: BookingRecord, poster: string | null,
    x: number, y: number, width: number, height: number,
    navy: [number, number, number], red: [number, number, number]
  ): void {
    if (poster) {
      pdf.setFillColor(247, 248, 250);
      pdf.setDrawColor(211, 215, 222);
      pdf.roundedRect(x, y, width, height, 1.5, 1.5, 'FD');

      pdf.setFillColor(...navy);
      pdf.rect(x, y, width, 10, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(6);
      pdf.text('AFICHE OFICIAL', x + 5, y + 6.5);

      const imageAreaX = x + 3;
      const imageAreaY = y + 13;
      const imageAreaWidth = width - 6;
      const imageAreaHeight = height - 37;
      const properties = pdf.getImageProperties(poster);
      const scale = Math.min(
        imageAreaWidth / properties.width,
        imageAreaHeight / properties.height
      );
      const renderedWidth = properties.width * scale;
      const renderedHeight = properties.height * scale;
      const renderedX = imageAreaX + (imageAreaWidth - renderedWidth) / 2;
      const renderedY = imageAreaY + (imageAreaHeight - renderedHeight) / 2;

      pdf.addImage(
        poster,
        this.imageFormat(poster),
        renderedX,
        renderedY,
        renderedWidth,
        renderedHeight,
        undefined,
        'FAST'
      );

      pdf.setDrawColor(226, 229, 234);
      pdf.rect(renderedX, renderedY, renderedWidth, renderedHeight);

      pdf.setFillColor(...red);
      pdf.rect(x, y + height - 20, width, 20, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      const eventTitle = pdf.splitTextToSize(booking.eventName.toUpperCase(), width - 10);
      pdf.text(eventTitle.slice(0, 2), x + 5, y + height - 12);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(5.5);
      pdf.text(this.formatDate(booking.eventDate), x + 5, y + height - 4);
      return;
    }

    pdf.setFillColor(...navy);
    pdf.rect(x, y, width, height, 'F');
    pdf.setFillColor(...red);
    pdf.rect(x, y + height - 20, width, 20, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    const title = pdf.splitTextToSize(booking.eventName.toUpperCase(), width - 12);
    pdf.text(title.slice(0, 5), x + 6, y + 24);
    pdf.setFontSize(8);
    pdf.text(this.formatDate(booking.eventDate), x + 6, y + height - 11);
    pdf.text(booking.venueName, x + 6, y + height - 5, { maxWidth: width - 12 });
  }

  private async loadImage(url: string): Promise<string | null> {
    if (!url) return null;
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  private posterUrl(booking: BookingRecord): string {
    if (/^\d+$/.test(booking.eventId)) {
      return `${environment.apiBaseUrl}/events/${booking.eventId}/image`;
    }

    return booking.eventImage ?? '';
  }

  private imageFormat(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' {
    if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG';
    if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
    return 'PNG';
  }

  private formatDate(value: string): string {
    return new Intl.DateTimeFormat('es-GT', { timeZone: 'America/Guatemala', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  private shortDate(value: string): string {
    return new Intl.DateTimeFormat('es-GT', { timeZone: 'America/Guatemala', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
  }

  private time(value: string): string {
    return new Intl.DateTimeFormat('es-GT', { timeZone: 'America/Guatemala', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
  }

  private day(value: string): string {
    return new Intl.DateTimeFormat('es-GT', { timeZone: 'America/Guatemala', day: '2-digit' }).format(new Date(value));
  }

  private month(value: string): string {
    return new Intl.DateTimeFormat('es-GT', { timeZone: 'America/Guatemala', month: 'short', year: 'numeric' }).format(new Date(value)).toUpperCase();
  }

  private buyer(paymentMethod: string): string {
    const separator = paymentMethod.indexOf(' - ');
    return separator >= 0 ? paymentMethod.slice(separator + 3) : 'Cliente registrado';
  }
}
