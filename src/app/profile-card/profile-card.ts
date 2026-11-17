import { Component, EventEmitter, HostListener, Input, OnInit, Output, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
	selector: 'app-profile-card',
	standalone: true,
	template: `
		<button type="button" class="pc-trigger" (click)="toggle($event)">
			<span class="pc-mini">{{ initial }}</span>
			<span class="pc-name">{{ session?.firstName }}</span>
			<i class="pi pi-angle-down" [class.up]="open"></i>
		</button>

		@if (open) {
			<div class="pc-card" (click)="$event.stopPropagation()">
				<div class="pc-banner"></div>

				<div class="pc-head">
					<div class="pc-avatar">
						{{ initial }}
						<span class="pc-dot" title="Sesión activa"></span>
					</div>
					<h3>{{ session?.firstName }} {{ session?.surName }}</h3>
					<p class="pc-mail">{{ session?.email }}</p>
					<span class="pc-role" [class.mgr]="isManager">{{ session?.role }}</span>
				</div>

				@if (view === 'profile') {
					<div class="pc-list">
						@if (isManager) {
							<button type="button" class="pc-item" (click)="go('/admin')">
								<i class="pi pi-chart-bar"></i><span>Panel administrativo</span>
								<i class="pi pi-angle-right"></i>
							</button>
						}
						<button type="button" class="pc-item" (click)="go('/follow-up/view')">
							<i class="pi pi-book"></i><span>Seguimiento de casos</span>
							<i class="pi pi-angle-right"></i>
						</button>
						<button type="button" class="pc-item" (click)="view = 'settings'">
							<i class="pi pi-sliders-h"></i><span>Ajustes</span>
							<i class="pi pi-angle-right"></i>
						</button>
					</div>
				} @else {
					<div class="pc-settings">
						<button type="button" class="pc-back" (click)="view = 'profile'">
							<i class="pi pi-angle-left"></i> Volver
						</button>

						<p class="pc-label">Tamaño del texto</p>
						<div class="pc-sizes">
							@for (s of sizes; track s.px) {
								<button type="button" [class.on]="size === s.px" (click)="setSize(s.px)">{{ s.label }}</button>
							}
						</div>

						<p class="pc-label">Cuenta</p>
						<p class="pc-note"><i class="pi pi-envelope"></i> {{ session?.email }}</p>
						<p class="pc-note"><i class="pi pi-clock"></i> La sesión se cierra automáticamente a las 8 horas.</p>
					</div>
				}

				<div class="pc-foot">
					<button type="button" class="pc-logout" (click)="doLogout()">
						<i class="pi pi-sign-out"></i> Cerrar sesión
					</button>
				</div>
			</div>
		}
	`,
	styles: [`
		:host { position: relative; display: inline-block; }
		.pc-trigger {
			display: flex; align-items: center; gap: 8px; cursor: pointer; border: 1px solid #e2e8f0;
			background: #fff; padding: 4px 12px 4px 4px; border-radius: 999px; font-size: 14px; font-weight: 600; color: #1e293b;
		}
		.pc-trigger:hover { box-shadow: 0 2px 8px rgba(15,23,42,.12); }
		.pc-trigger .pi { font-size: 12px; transition: transform .2s; }
		.pc-trigger .pi.up { transform: rotate(180deg); }
		.pc-mini {
			width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(135deg, #0891b2, #4f46e5);
			color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700;
		}

		.pc-card {
			position: absolute; right: 0; top: calc(100% + 12px); width: 320px; z-index: 3000; overflow: hidden;
			background: #fff; border-radius: 20px; box-shadow: 0 20px 50px rgba(15,23,42,.25);
			animation: pcIn .18s ease both; text-align: center; font-size: 14px; color: #1e293b;
		}
		@keyframes pcIn { from { opacity: 0; transform: translateY(-8px) scale(.98); } to { opacity: 1; transform: none; } }
		.pc-banner { height: 78px; background: linear-gradient(120deg, #0f766e, #0e7490 50%, #3730a3); }
		.pc-head { margin-top: -42px; padding: 0 20px 14px; }
		.pc-avatar {
			position: relative; width: 84px; height: 84px; margin: 0 auto 8px; border-radius: 50%;
			background: linear-gradient(135deg, #0e7490, #4f46e5); color: #fff; font-size: 36px; font-weight: 700;
			display: flex; align-items: center; justify-content: center; border: 4px solid #fff;
			box-shadow: 0 6px 16px rgba(15,23,42,.2);
		}
		.pc-dot {
			position: absolute; right: 4px; bottom: 4px; width: 16px; height: 16px; border-radius: 50%;
			background: #22c55e; border: 3px solid #fff;
		}
		.pc-head h3 { margin: 0; font-size: 18px; font-family: Georgia, serif; }
		.pc-mail { margin: 4px 0 10px; color: #64748b; font-size: 13px; word-break: break-all; }
		.pc-role {
			display: inline-block; padding: 4px 14px; border-radius: 999px; font-size: 12px; font-weight: 700;
			background: #e0f2fe; color: #0369a1;
		}
		.pc-role.mgr { background: #ede9fe; color: #6d28d9; }

		.pc-list { border-top: 1px solid #eef2f7; padding: 8px; }
		.pc-item {
			width: 100%; display: flex; align-items: center; gap: 12px; border: 0; background: transparent; cursor: pointer;
			padding: 11px 12px; border-radius: 12px; font-size: 14px; color: #1e293b; text-align: left;
		}
		.pc-item span { flex: 1; }
		.pc-item .pi:first-child { color: #0e7490; }
		.pc-item .pi:last-child { color: #94a3b8; font-size: 12px; }
		.pc-item:hover { background: #f1f5f9; }

		.pc-settings { border-top: 1px solid #eef2f7; padding: 12px 16px; text-align: left; }
		.pc-back { border: 0; background: none; color: #0e7490; font-weight: 700; cursor: pointer; padding: 0 0 8px; font-size: 13px; }
		.pc-label { margin: 10px 0 6px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #94a3b8; }
		.pc-sizes { display: flex; gap: 8px; }
		.pc-sizes button {
			flex: 1; border: 2px solid #e2e8f0; background: #fff; border-radius: 10px; padding: 8px 0; cursor: pointer; font-weight: 700;
		}
		.pc-sizes button.on { border-color: #0891b2; background: #ecfeff; color: #0e7490; }
		.pc-note { margin: 6px 0; font-size: 13px; color: #55656c; display: flex; gap: 8px; align-items: flex-start; }
		.pc-note .pi { color: #0e7490; margin-top: 2px; }

		.pc-foot { padding: 10px 16px 16px; }
		.pc-logout {
			width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer;
			border: 1px solid #fecaca; background: #fef2f2; color: #b91c1c; padding: 11px; border-radius: 12px; font-weight: 700; font-size: 14px;
		}
		.pc-logout:hover { background: #fee2e2; }
	`],
})
export class ProfileCard implements OnInit {
	private router = inject(Router);

	@Input() session: any = null;
	@Output() logout = new EventEmitter<void>();

	open = false;
	view: 'profile' | 'settings' = 'profile';

	readonly sizes = [
		{ label: 'A', px: 14 },
		{ label: 'A+', px: 16 },
		{ label: 'A++', px: 18 },
	];
	size = 16;

	get initial(): string {
		return String(this.session?.firstName ?? '?').charAt(0).toUpperCase();
	}

	get isManager(): boolean {
		return this.session?.role === 'Encargado';
	}

	ngOnInit(): void {
		// Recupera el tamaño de texto elegido antes
		try {
			const saved = Number(localStorage.getItem('uiFontSize'));
			if (saved) {
				this.size = saved;
				document.documentElement.style.fontSize = saved + 'px';
			}
		} catch {}
	}

	toggle(event: Event): void {
		event.stopPropagation();
		this.open = !this.open;
		this.view = 'profile';
	}

	setSize(px: number): void {
		this.size = px;
		document.documentElement.style.fontSize = px + 'px';
		try {
			localStorage.setItem('uiFontSize', String(px));
		} catch {}
	}

	go(path: string): void {
		this.open = false;
		this.router.navigate([path]);
	}

	doLogout(): void {
		this.open = false;
		this.logout.emit();
	}

	@HostListener('document:click')
	closeOutside(): void {
		this.open = false;
	}
}