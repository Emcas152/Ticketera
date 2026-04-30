import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { BookingRecord } from '../models/booking.model';

@Injectable({ providedIn: 'root' })
export class TicketPdfService {
  async downloadTicket(booking: BookingRecord): Promise<void> {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const qrValue = this.buildQrPayload(booking);
    const qrImage = await QRCode.toDataURL(qrValue, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 420,
      color: {
        dark: '#111111',
        light: '#ffffff'
      }
    });

    pdf.setFillColor(12, 22, 45);
    pdf.roundedRect(14, 14, 182, 269, 8, 8, 'F');

    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(20, 20, 170, 257, 6, 6, 'F');

    pdf.setFillColor(139, 9, 9);
    pdf.roundedRect(20, 20, 170, 34, 6, 6, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(24);
    pdf.text(booking.eventName, 28, 34, { maxWidth: 112 });
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(booking.venueName, 28, 44);
    pdf.text(`Orden ${booking.orderNumber}`, 28, 50);

    pdf.setTextColor(17, 24, 39);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.text('Ticket de acceso', 28, 68);

    pdf.setDrawColor(226, 232, 240);
    pdf.line(28, 72, 182, 72);

    const seatLabels = booking.seats.map((seat) => seat.label).join(', ');
    const seatTableRows = [
      ['Fecha', this.formatDate(booking.eventDate)],
      ['Generado', this.formatDate(booking.createdAt)],
      ['Asientos', seatLabels],
      ['QR', booking.qrCode],
      ['Pago', booking.paymentMethod],
      ['Total', `Q ${booking.totals.total.toFixed(2)}`]
    ];

    let currentY = 84;
    for (const [label, value] of seatTableRows) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139);
      pdf.text(label.toUpperCase(), 28, currentY);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(12);
      pdf.setTextColor(17, 24, 39);
      const lines = pdf.splitTextToSize(value, 82);
      pdf.text(lines, 28, currentY + 7);
      currentY += 10 + lines.length * 5;
    }

    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(118, 78, 56, 56, 4, 4, 'F');
    pdf.addImage(qrImage, 'PNG', 123, 83, 46, 46);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text('Codigo QR', 146, 141, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(71, 85, 105);
    const assignedSeats = booking.seats.map((seat) => `${seat.tableLabel ?? seat.row}-${seat.number}`).join('  ');
    pdf.text('Asientos asignados', 28, 188);
    pdf.setTextColor(17, 24, 39);
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(13);
    pdf.text(assignedSeats, 28, 196);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(100, 116, 139);
    pdf.text(
      'Presenta este PDF o escanea el QR en el acceso. Cada ticket corresponde a los asientos asignados en esta reserva.',
      28,
      214,
      { maxWidth: 145 }
    );

    pdf.setDrawColor(226, 232, 240);
    pdf.line(28, 230, 182, 230);
    pdf.setFontSize(9);
    pdf.text(`Reserva: ${booking.id}`, 28, 238);
    pdf.text(`Estado: ${booking.status}`, 28, 244);
    pdf.text(`Payload QR: ${qrValue}`, 28, 252, { maxWidth: 145 });

    pdf.save(`${booking.orderNumber}.pdf`);
  }

  private buildQrPayload(booking: BookingRecord): string {
    return JSON.stringify({
      bookingId: booking.id,
      orderNumber: booking.orderNumber,
      eventId: booking.eventId,
      eventName: booking.eventName,
      qrCode: booking.qrCode,
      seats: booking.seats.map((seat) => ({
        id: seat.id,
        label: seat.label,
        section: seat.section,
        table: seat.tableLabel ?? seat.row,
        number: seat.number
      })),
      total: booking.totals.total
    });
  }

  private formatDate(value: string): string {
    return new Intl.DateTimeFormat('es-GT', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  }
}
