import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { adminRoleGuard, authorizerRoleGuard } from './role.guard';

describe('role guards', () => {
  const auth = {
    canAccessAdmin: vi.fn(),
    canAuthorizeEntry: vi.fn()
  };
  const router = {
    createUrlTree: vi.fn((commands: string[]) => ({ commands }) as unknown as UrlTree)
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router }
      ]
    });
  });

  it('permite las rutas administrativas solo a administradores', () => {
    auth.canAccessAdmin.mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() =>
      adminRoleGuard({} as never, {} as never)
    );

    expect(result).toBe(true);
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });

  it('redirige un autorizador fuera de las rutas administrativas', () => {
    auth.canAccessAdmin.mockReturnValue(false);

    TestBed.runInInjectionContext(() => adminRoleGuard({} as never, {} as never));

    expect(router.createUrlTree).toHaveBeenCalledWith(['/dashboard/validar']);
  });

  it('permite la validacion QR solo al autorizador', () => {
    auth.canAuthorizeEntry.mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() =>
      authorizerRoleGuard({} as never, {} as never)
    );

    expect(result).toBe(true);
  });

  it('redirige un administrador fuera de la ruta de validacion', () => {
    auth.canAuthorizeEntry.mockReturnValue(false);

    TestBed.runInInjectionContext(() => authorizerRoleGuard({} as never, {} as never));

    expect(router.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
  });
});
