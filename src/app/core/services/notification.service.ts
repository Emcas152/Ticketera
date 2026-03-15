import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.open(message, 'success-toast');
  }

  info(message: string): void {
    this.open(message, 'info-toast');
  }

  error(message: string): void {
    this.open(message, 'error-toast');
  }

  private open(message: string, panelClass: string): void {
    this.snackBar.open(message, 'Cerrar', {
      duration: 4500,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass
    });
  }
}
