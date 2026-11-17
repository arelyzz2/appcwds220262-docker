import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { KeycloakService } from 'keycloak-angular';
import { environment } from './environments/environments';

export const keycloakBearerInterceptor: HttpInterceptorFn = (request, next) => {
    const keycloak = inject(KeycloakService);
    const backendUrl = environment.urlBase.endsWith('/')
        ? environment.urlBase
        : `${environment.urlBase}/`;
    const isBackendRequest =
        request.url === environment.urlBase ||
        request.url.startsWith(backendUrl);

    if (!isBackendRequest || !keycloak.isLoggedIn()) {
        return next(request);
    }

    return from(keycloak.updateToken(30)).pipe(
        switchMap(() => from(keycloak.getToken())),
        switchMap(token => token
            ? next(request.clone({
                setHeaders: { Authorization: `Bearer ${token}` }
            }))
            : next(request))
    );
};
