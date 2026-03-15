import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, delay, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MOCK_CURRENT_USER } from '../mocks/mock-data';
import { AuthSession, ForgotPasswordPayload, LoginPayload, RegisterPayload } from '../models/auth.model';
import { User } from '../models/user.model';
import { ApiService } from './api.service';
import { NotificationService } from './notification.service';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly storage = inject(StorageService);
  private readonly notifications = inject(NotificationService);
  private readonly storageKey = 'pulse-auth-session';
  private readonly sessionSubject = new BehaviorSubject<AuthSession | null>(
    this.storage.getItem<AuthSession | null>(this.storageKey, null)
  );

  readonly session$ = this.sessionSubject.asObservable();
  readonly user$ = this.session$.pipe(map((session) => session?.user ?? null));
  readonly isAuthenticated$ = this.session$.pipe(map((session) => Boolean(session?.accessToken)));

  login(payload: LoginPayload): Observable<AuthSession> {
    const request$ = environment.useMocks
      ? of(this.createSession({ ...MOCK_CURRENT_USER, email: payload.email })).pipe(delay(600))
      : this.api.post<AuthSession>('/auth/login', payload);

    return request$.pipe(
      tap((session) => this.persistSession(session)),
      tap(() => this.notifications.success('Sesion iniciada correctamente.'))
    );
  }

  register(payload: RegisterPayload): Observable<AuthSession> {
    const request$ = environment.useMocks
      ? of(
          this.createSession({
            ...MOCK_CURRENT_USER,
            fullName: payload.fullName,
            email: payload.email,
            phone: payload.phone
          })
        ).pipe(delay(800))
      : this.api.post<AuthSession>('/auth/register', payload);

    return request$.pipe(
      tap((session) => this.persistSession(session)),
      tap(() => this.notifications.success('Cuenta creada. Tu sesion ya esta activa.'))
    );
  }

  requestPasswordReset(payload: ForgotPasswordPayload): Observable<{ message: string }> {
    const request$ = environment.useMocks
      ? of({ message: `Enlace de recuperacion enviado a ${payload.email}.` }).pipe(delay(600))
      : this.api.post<{ message: string }>('/auth/forgot-password', payload);

    return request$.pipe(tap((response) => this.notifications.info(response.message)));
  }

  updateProfile(payload: Partial<User>): Observable<User> {
    const currentSession = this.sessionSubject.value;
    const updatedUser = {
      ...(currentSession?.user ?? MOCK_CURRENT_USER),
      ...payload
    };

    const request$ = environment.useMocks
      ? of(updatedUser).pipe(delay(400))
      : this.api.put<User>('/users/me', payload);

    return request$.pipe(
      tap((user) => {
        if (!currentSession) {
          return;
        }

        this.persistSession({
          ...currentSession,
          user
        });
        this.notifications.success('Perfil actualizado.');
      })
    );
  }

  logout(showMessage = true): void {
    this.storage.removeItem(this.storageKey);
    this.sessionSubject.next(null);

    if (showMessage) {
      this.notifications.info('Sesion cerrada.');
    }
  }

  handleUnauthorized(): void {
    this.logout(false);
  }

  isLoggedIn(): boolean {
    return Boolean(this.sessionSubject.value?.accessToken);
  }

  getToken(): string | null {
    return this.sessionSubject.value?.accessToken ?? null;
  }

  getCurrentUser(): User | null {
    return this.sessionSubject.value?.user ?? null;
  }

  private persistSession(session: AuthSession): void {
    this.storage.setItem(this.storageKey, session);
    this.sessionSubject.next(session);
  }

  private createSession(user: User): AuthSession {
    return {
      accessToken: 'mock-jwt-token',
      refreshToken: 'mock-refresh-token',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      user
    };
  }
}
