import type { HttpInterceptorFn } from '@angular/common/http';

import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const isApiRequest = request.url.startsWith(`${environment.apiBaseUrl}/`);
  const isPublicAuthRequest = request.url.endsWith('/api/auth/register') || request.url.endsWith('/api/auth/login');

  if (!isApiRequest || isPublicAuthRequest || typeof sessionStorage === 'undefined') {
    return next(request);
  }

  const token = sessionStorage.getItem('nutridorm_access_token');
  if (!token) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  );
};
