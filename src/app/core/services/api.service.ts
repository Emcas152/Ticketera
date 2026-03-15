import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T, P extends object = Record<string, string | number | boolean | undefined>>(
    path: string,
    params?: P
  ): Observable<T> {
    return this.http.get<T>(this.resolveUrl(path), { params: this.createParams(params) });
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(this.resolveUrl(path), body);
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(this.resolveUrl(path), body);
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(this.resolveUrl(path));
  }

  private resolveUrl(path: string): string {
    return path.startsWith('http') ? path : `${environment.apiBaseUrl}${path}`;
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
}
