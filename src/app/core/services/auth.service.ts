import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, delay, map, of, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MOCK_CURRENT_USER } from '../mocks/mock-data';
import { AuthSession, ForgotPasswordPayload, LoginPayload, RegisterPayload, ResetPasswordPayload } from '../models/auth.model';
import { User } from '../models/user.model';
import { ApiService } from './api.service';
import { NotificationService } from './notification.service';
import { StorageService } from './storage.service';

interface ApiAuthResponse {
  success?: boolean;
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  user?: Partial<User> & {
    role_id?: number | string;
    name?: string;
    full_name?: string;
    membership_tier?: User['membershipTier'];
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly storage = inject(StorageService);
  private readonly notifications = inject(NotificationService);
  private readonly document = inject(DOCUMENT);
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
      : this.api
          .post<AuthSession | ApiAuthResponse>('/auth/login', payload)
          .pipe(map((response) => this.normalizeSession(response, payload.email)));

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
      : this.api
          .post<{ success?: boolean; message?: string }>('/auth/register', {
            name: payload.fullName,
            role_id: '2',
            email: payload.email,
            phone: payload.phone || undefined,
            password: payload.password,
            password_confirmation: payload.password
          })
          .pipe(
            switchMap(() =>
              this.api
                .post<AuthSession | ApiAuthResponse>('/auth/login', {
                  email: payload.email,
                  password: payload.password
                })
                .pipe(map((response) => this.normalizeSession(response, payload.email)))
            )
          );

    return request$.pipe(
      tap((session) => this.persistSession(session)),
      tap(() => this.notifications.success('Cuenta creada. Tu sesion ya esta activa.'))
    );
  }

  requestPasswordReset(payload: ForgotPasswordPayload): Observable<{ message: string }> {
    const resetUrl = new URL('/auth/reset-password', this.document.location.origin).toString();
    const request$ = environment.useMocks
      ? of({ message: `Enlace de recuperacion enviado a ${payload.email}.` }).pipe(delay(600))
      : this.api.post<{ message: string }>('/auth/forgot-password', {
          ...payload,
          reset_url: resetUrl
        });

    return request$.pipe(tap((response) => this.notifications.info(response.message)));
  }

  resetPassword(payload: ResetPasswordPayload): Observable<{ message: string }> {
    const normalizedEmail = this.extractEmail(payload.email);
    const normalizedPayload = {
      ...payload,
      email: normalizedEmail
    };
    const request$ = environment.useMocks
      ? of({ message: 'Contrasena restablecida correctamente.' }).pipe(delay(600))
      : this.api.post<{ message: string }>('/auth/reset-password', normalizedPayload);

    return request$.pipe(tap((response) => this.notifications.success(response.message)));
  }

  logout(showMessage = true): void {
    if (this.isLoggedIn() && !environment.useMocks) {
      this.api.post<unknown>('/auth/logout', {}).subscribe({ error: () => undefined });
    }

    this.clearSession();

    if (showMessage) {
      this.notifications.info('Sesion cerrada.');
    }
  }

  handleUnauthorized(): void {
    this.clearSession();
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

  canAccessAdmin(): boolean {
    const roleId = this.sessionSubject.value?.user.roleId;
    return roleId !== undefined && [1, 2].includes(roleId);
  }

  canAuthorizeEntry(): boolean {
    const roleId = this.sessionSubject.value?.user.roleId;
    return roleId !== undefined && [1, 2, 3].includes(roleId);
  }

  isAutorizadorOnly(): boolean {
    return this.sessionSubject.value?.user.roleId === 3;
  }

  canAccessDashboard(): boolean {
    return this.canAccessAdmin() || this.canAuthorizeEntry();
  }

  private persistSession(session: AuthSession): void {
    this.storage.setItem(this.storageKey, session);
    this.sessionSubject.next(session);
  }

  private normalizeSession(response: AuthSession | ApiAuthResponse, fallbackEmail: string): AuthSession {
    const accessToken =
      'accessToken' in response && response.accessToken
        ? response.accessToken
        : 'token' in response
          ? response.token
          : undefined;

    if (!accessToken) {
      throw new Error('La respuesta de autenticacion no incluye token.');
    }

    return {
      accessToken,
      refreshToken: response.refreshToken,
      expiresAt: response.expiresAt ?? this.getTokenExpiration(accessToken),
      user: this.normalizeUser(response.user, fallbackEmail)
    };
  }

  private normalizeUser(user: ApiAuthResponse['user'], fallbackEmail: string): User {
    return {
      id: String(user?.id ?? ''),
      roleId: this.normalizeRoleId(user?.roleId ?? user?.role_id),
      fullName: user?.fullName ?? user?.full_name ?? user?.name ?? fallbackEmail,
      email: user?.email ?? fallbackEmail,
      phone: user?.phone,
      city: user?.city,
      membershipTier: user?.membershipTier ?? user?.membership_tier,
      avatarUrl: user?.avatarUrl
    };
  }

  private normalizeRoleId(value: number | string | undefined): number | undefined {
    const roleId = Number(value);
    return Number.isInteger(roleId) ? roleId : undefined;
  }

  private getTokenExpiration(token: string): string {
    const payload = this.decodeJwtPayload(token);
    const expiration = typeof payload?.['exp'] === 'number' ? payload['exp'] * 1000 : Date.now() + 1000 * 60 * 60 * 24;

    return new Date(expiration).toISOString();
  }

  private decodeJwtPayload(token: string): Record<string, unknown> | null {
    const payload = token.split('.')[1];

    if (!payload) {
      return null;
    }

    try {
      const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
      const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=');

      return JSON.parse(atob(paddedPayload)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private extractEmail(value: string): string {
    const decoded = this.decodeRepeatedly(value);
    return decoded.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() ?? '';
  }

  private decodeRepeatedly(value: string): string {
    let decoded = value.trim();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const next = decodeURIComponent(decoded.replace(/\+/g, ' '));
        if (next === decoded) break;
        decoded = next;
      } catch {
        break;
      }
    }
    return decoded;
  }

  private createSession(user: User): AuthSession {
    return {
      accessToken: 'mock-jwt-token',
      refreshToken: 'mock-refresh-token',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      user
    };
  }

  private clearSession(): void {
    this.storage.removeItem(this.storageKey);
    this.sessionSubject.next(null);
  }
}
