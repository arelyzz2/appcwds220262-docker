
import { Component, inject, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

import { OptionMenuService } from './observable/option-menu/option-menu.service';
import { ProfileCard } from './profile-card/profile-card';
import { KeycloakService } from 'keycloak-angular';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        CommonModule,
        RouterOutlet,
        RouterModule,
        ButtonModule,
        ToastModule,
        ConfirmDialogModule,
        ProfileCard
    ],
    templateUrl: './app.html',
    styleUrls: ['./app.css']
})
export class App implements OnInit {

    private optionMenuService = inject(OptionMenuService);
    private router = inject(Router);
    private http = inject(HttpClient);
    private keycloak = inject(KeycloakService);
    private destroyRef = inject(DestroyRef);

    isLoggedIn = false;
    session: any = null;
    notifCount = 0;

    private activeId = '';

    private readonly baseOptions: any[] = [
        { id: '', route: '/', icon: 'home', text: 'Inicio', active: false },
        { id: 'suggestioninsert', route: '/suggestion/insert', icon: 'bookmark', text: 'Sugerencias', active: false },
        { id: 'complaintinsert', route: '/complaint/insert', icon: 'shield', text: 'Quejas', active: false },
        { id: 'followup', route: '/follow-up/view', icon: 'book', text: 'Seguimiento', active: false }
    ];

    menuOptions: any[] = this.baseOptions.map(item => ({ ...item }));

    get isManager(): boolean {
        if (!this.isLoggedIn) {
            return false;
        }

        return this.keycloak.getUserRoles().some(role => {
            const normalized = role.toUpperCase();
            return normalized.includes('ADMIN') ||
                   normalized.includes('ENCARGADO');
        });
    }

    async ngOnInit(): Promise<void> {

        try {
            await this.loadInitialSession();

            this.optionMenuService.data$()
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe({
                    next: (response: any) => {
                        this.activeId = response;
                        this.updateMenu();
                    }
                });

        } catch (error) {
            console.error('Error inicializando aplicación:', error);
        }
    }

    private async loadInitialSession(): Promise<void> {

        try {

            this.isLoggedIn = await this.keycloak.isLoggedIn();

            if (this.isLoggedIn) {

                const profile: any =
                    await this.keycloak.loadUserProfile();

                const roles = this.keycloak.getUserRoles();

                const manager = roles.some(role => {
                    const normalized = role.toUpperCase();

                    return normalized.includes('ADMIN') ||
                           normalized.includes('ENCARGADO');
                });

                this.session = {
                    username: profile.username,
                    email: profile.email,
                    firstName: profile.firstName ?? profile.username,
                    lastName: profile.lastName ?? '',
                    role: manager ? 'Encargado' : 'Usuario',
                    roles: roles
                };

            } else {
                this.session = null;
            }

        } catch (error) {
            console.error('Error cargando sesión:', error);
            this.session = null;
            this.isLoggedIn = false;
        }

        this.updateMenu();

        this.loadNotifications();
    }

    private updateMenu(): void {

        const options = this.baseOptions.map(item => ({
            ...item,
            active: item.id === this.activeId
        }));

        if (this.isManager) {
            options.push({
                id: 'admin',
                route: '/admin',
                icon: 'chart-bar',
                text: 'Panel',
                active: this.activeId === 'admin'
            });
        }

        this.menuOptions = options;
    }

    private async loadNotifications(): Promise<void> {

        if (!this.isManager) {
            this.notifCount = 0;
            return;
        }

        const pending = (data: any): number => {

            try {
                const list = typeof data === 'string'
                    ? JSON.parse(data)
                    : data;

                return Array.isArray(list)
                    ? list.filter(
                        (item: any) =>
                            item?.status === 'Pendiente de revisión'
                    ).length
                    : 0;

            } catch {
                return 0;
            }
        };

        const complaint$ = this.http.get(
            'http://localhost:8080/complaint/getall',
            { responseType: 'text' }
        ).pipe(catchError(() => of('[]')));

        const suggestion$ = this.http.get(
            'http://localhost:8080/suggestion/getall',
            { responseType: 'text' }
        ).pipe(catchError(() => of('[]')));

        try {

            const [complaints, suggestions] = await Promise.all([
                firstValueFrom(complaint$),
                firstValueFrom(suggestion$)
            ]);

            this.notifCount =
                pending(complaints) + pending(suggestions);

        } catch (error) {
            console.error('Error cargando notificaciones:', error);
            this.notifCount = 0;
        }
    }

    login(): void {
        void this.keycloak.login({
            redirectUri: `${window.location.origin}/login`
        });
    }

    goLogin(): void {
        void this.router.navigateByUrl('/login');
    }

    goNotifications(): void {
        if (this.isManager) {
            void this.router.navigateByUrl('/admin');
        }
    }

    logout(): void {

        this.notifCount = 0;
        this.session = null;
        this.isLoggedIn = false;

        void this.keycloak.logout(window.location.origin);
    }
}
