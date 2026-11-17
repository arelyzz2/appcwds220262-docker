import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { KeycloakService } from 'keycloak-angular';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterModule],
    templateUrl: './login.html',
    styleUrl: './login.css',
})
export class Login implements OnInit {
    private fb = inject(FormBuilder);
    private keycloak = inject(KeycloakService);
    private router = inject(Router);

    sending = false;
    messages: string[] = [];

    form = this.fb.group({
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required]],
    });

    async ngOnInit(): Promise<void> {
        const isLoggedIn = await this.keycloak.isLoggedIn();
        if (isLoggedIn) {
            const roles = this.keycloak.getUserRoles();
            const isManager = roles.some(r => {
                const role = r.toUpperCase();
                return role.includes('ADMIN') || role.includes('ENCARGADO');
            });

            if (isManager) {
                this.router.navigateByUrl('/admin');
            } else {
                this.router.navigateByUrl('/');
            }
        }
    }

    submit(): void {
        this.messages = ['El acceso con correo y contraseña no está conectado a un servicio propio. Usa el botón “Ingresar con Keycloak”.'];
    }

    loginWithKeycloak(): void {
        void this.keycloak.login({
            redirectUri: `${window.location.origin}/login`
        });
    }

    goRegister(): void {
        this.router.navigate(['/register']);
    }

    goHome(): void {
        this.router.navigate(['/']);
    }
}