import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';

export const managerGuard: CanActivateFn = async (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const keycloak = inject(KeycloakService);
  const router = inject(Router);

  // 1. Verificar si el usuario está autenticado en Keycloak
  const isLoggedIn = await keycloak.isLoggedIn();

  if (!isLoggedIn) {
    // Si no hay sesión, invocar la autenticación de Keycloak
    await keycloak.login({
      redirectUri: window.location.origin + state.url
    });
    return false;
  }

  // 2. Extraer roles de Keycloak y roles requeridos por la ruta
  const userRoles = keycloak.getUserRoles();
  const requiredRoles = route.data['roles'] as Array<string>;

  // Si la ruta no exige roles específicos, se permite el acceso
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  // 3. Validación flexible para mapeo de roles (ADMIN, ROLE_ADMIN, Encargado, etc.)
  const hasRequiredRole = requiredRoles.some(reqRole => {
    return userRoles.some(uRole => {
      const userR = uRole.toUpperCase();
      const reqR = reqRole.toUpperCase();
      return (
        userR === reqR || 
        userR === `ROLE_${reqR}` || 
        (reqR === 'ADMIN' && (userR.includes('ADMIN') || userR.includes('ENCARGADO')))
      );
    });
  });

  if (!hasRequiredRole) {
    // Si no cumple el rol requerido, redirige al inicio en lugar de romper en /login
    return router.createUrlTree(['/']);
  }

  return true;
};