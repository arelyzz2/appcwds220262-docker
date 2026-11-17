import { Component, HostListener, inject } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';

@Component({
  selector: 'app-admin-topbar',
  standalone: true,
  template: `
    <div class="tb-wrap">
      <button class="tb-bell" type="button" (click)="toggle('bell'); $event.stopPropagation()" title="Notificaciones">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
      </button>

      <button class="tb-user" type="button" (click)="toggle('user'); $event.stopPropagation()">
        <span class="tb-avatar">{{ initial }}</span>
        <span class="tb-name">{{ displayName }}</span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>

      @if (open === 'bell') {
        <div class="tb-menu tb-bellmenu" (click)="$event.stopPropagation()">
          <p class="tb-empty">No tienes notificaciones nuevas.</p>
        </div>
      }

      @if (open === 'user') {
        <div class="tb-menu" (click)="$event.stopPropagation()">
          <button type="button" class="tb-item" (click)="showModal('profile')">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
            Mi Perfil
          </button>
          <button type="button" class="tb-item" (click)="showModal('settings')">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>
            Ajustes
          </button>
          <div class="tb-sep"></div>
          <button type="button" class="tb-item" (click)="logout()">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
            Cerrar Sesión
          </button>
        </div>
      }
    </div>

    @if (modal) {
      <div class="tb-overlay" (click)="modal = null">
        <div class="tb-modal" (click)="$event.stopPropagation()">
          @if (modal === 'profile') {
            <h3>Mi Perfil</h3>
            <p><b>Nombre:</b> {{ session.firstName }} {{ session.surName }}</p>
            <p><b>Correo:</b> {{ session.email }}</p>
            <p><b>Rol:</b> {{ session.role }}</p>
          } @else {
            <h3>Ajustes</h3>
            <p>Sesión iniciada como <b>{{ session.role }}</b>.</p>
            <p>La sesión se cierra automáticamente a las 8 horas.</p>
          }
          <button type="button" class="tb-close" (click)="modal = null">Cerrar</button>
        </div>
      </div>
    }
  `,
  styles: [`
   :host { position: fixed; top: 10px; right: 16px; z-index: 99999; font-family: inherit; }
    .tb-wrap { position: relative; display: flex; align-items: center; gap: 10px; }
    .tb-bell, .tb-user {
      display: flex; align-items: center; gap: 8px; border: 1px solid #e2e8f0;
      background: #fff; color: #334155; border-radius: 999px; cursor: pointer;
      box-shadow: 0 2px 8px rgba(15,23,42,.08);
    }
    .tb-bell { width: 38px; height: 38px; justify-content: center; padding: 0; }
    .tb-user { padding: 4px 12px 4px 4px; font-size: 14px; font-weight: 600; }
    .tb-avatar {
      width: 30px; height: 30px; border-radius: 50%; background: #0891b2; color: #fff;
      display: flex; align-items: center; justify-content: center; font-size: 14px;
    }
    .tb-menu {
      position: absolute; top: 48px; right: 0; width: 200px; background: #fff;
      border: 1px solid #e2e8f0; border-radius: 12px; padding: 6px;
      box-shadow: 0 10px 30px rgba(15,23,42,.15);
    }
    .tb-bellmenu { right: 48px; width: 230px; }
    .tb-item {
      width: 100%; display: flex; align-items: center; gap: 10px; border: 0; background: none;
      padding: 10px 12px; border-radius: 8px; cursor: pointer; font-size: 14px; color: #334155; text-align: left;
    }
    .tb-item:hover { background: #f1f5f9; }
    .tb-sep { height: 1px; background: #e2e8f0; margin: 4px 0; }
    .tb-empty { margin: 0; padding: 10px 12px; font-size: 13px; color: #64748b; }
    .tb-overlay {
      position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex;
      align-items: center; justify-content: center; z-index: 3000;
    }
    .tb-modal { background: #fff; border-radius: 14px; padding: 24px; width: 340px; max-width: 90vw; color: #334155; }
    .tb-modal h3 { margin: 0 0 12px; }
    .tb-modal p { margin: 6px 0; font-size: 14px; }
    .tb-close {
      margin-top: 14px; border: 0; background: #0891b2; color: #fff; padding: 8px 16px;
      border-radius: 8px; cursor: pointer;
    }
  `],
})
export class AdminTopbar {
  private keycloak = inject(KeycloakService);

  open: '' | 'bell' | 'user' = '';
  modal: '' | 'profile' | 'settings' | null = null;
  session: any = {};

  constructor() {
    try {
      this.session = JSON.parse(localStorage.getItem('session') ?? '{}') ?? {};
    } catch {
      this.session = {};
    }
  }

  get displayName(): string {
    return this.session?.firstName || 'Admin';
  }

  get initial(): string {
    return this.displayName.charAt(0).toUpperCase();
  }

  toggle(which: 'bell' | 'user') {
    this.open = this.open === which ? '' : which;
  }

  showModal(which: 'profile' | 'settings') {
    this.open = '';
    this.modal = which;
  }

  @HostListener('document:click')
  closeMenus() {
    this.open = '';
  }

  logout() {
    try {
      localStorage.removeItem('session');
    } catch (error) {
      console.error('No se pudo limpiar la sesión local:', error);
    }
    void this.keycloak.logout(window.location.origin);
  }
}