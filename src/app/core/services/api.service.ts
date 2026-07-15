import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T, P extends object = Record<string, string | number | boolean | undefined>>(
    path: string,
    params?: P
  ): Observable<T> {
    return this.http
      .get<T | ApiEnvelope<T> | DataEnvelope<T>>(this.resolveUrl(path), { params: this.createParams(params) })
      .pipe(map((response) => this.unwrapResponse(response)));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .post<T | ApiEnvelope<T> | DataEnvelope<T>>(this.resolveUrl(path), body)
      .pipe(map((response) => this.unwrapResponse(response)));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .put<T | ApiEnvelope<T> | DataEnvelope<T>>(this.resolveUrl(path), body)
      .pipe(map((response) => this.unwrapResponse(response)));
  }

  delete<T>(path: string): Observable<T> {
    return this.http
      .delete<T | ApiEnvelope<T> | DataEnvelope<T>>(this.resolveUrl(path))
      .pipe(map((response) => this.unwrapResponse(response)));
  }

  private resolveUrl(path: string): string {
    if (path.startsWith('http')) {
      return path;
    }

    const baseUrl = environment.apiBaseUrl.replace(/\/+$/, '');
    const normalizedPath = path.replace(/^\/+/, '');

    return `${baseUrl}/${normalizedPath}`;
  }

  private createParams(params?: object): HttpParams | undefined {
    if (!params) {
      return undefined;
    }

    let httpParams = new HttpParams();

    Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });

    return httpParams;
  }

  private unwrapResponse<T>(response: T | ApiEnvelope<T> | DataEnvelope<T>): T {
    if (this.isDataEnvelope(response)) {
      return response.data;
    }

    return response;
  }

  private isDataEnvelope<T>(response: T | ApiEnvelope<T> | DataEnvelope<T>): response is ApiEnvelope<T> | DataEnvelope<T> {
    return Boolean(response && typeof response === 'object' && 'data' in response);
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

interface DataEnvelope<T> {
  data: T;
}
