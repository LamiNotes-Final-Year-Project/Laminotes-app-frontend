import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Get the auth token from localStorage directly to avoid dependency issues
  const token = localStorage.getItem('auth_token');

  // If token exists, clone the request and add the authorization header
  if (token) {
    console.log(`🔑 Adding auth token to request: ${req.url}`);
    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
    return next(authReq);
  }

  // If no token exists, proceed with original request
  console.log(`ℹ️ No auth token available for request: ${req.url}`);
  return next(req);
};
