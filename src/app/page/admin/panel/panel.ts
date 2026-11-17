import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { distinctUntilChanged, filter, map } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { KeycloakService } from 'keycloak-angular';
import { Api } from '../../../api/api';
import { RequestBuilder } from '../../../api/request-builder';
import { StrictHttpResponse } from '../../../api/strict-http-response';
import { AdminTopbar } from '../topbar/topbar';

// Arma una petición GET o POST con JSON, token y parámetros de consulta opcionales (?idOffice=...).
function makeRequest(method: 'get' | 'post', path: string, body?: any, query?: Record<string, string>) {
	return (
		http: HttpClient,
		rootUrl: string,
		params: {},
		context?: HttpContext
	): Observable<StrictHttpResponse<any>> => {
		const rb = new RequestBuilder(rootUrl, path, method);

		if (query) {
			Object.keys(query).forEach(k => rb.query(k, query[k], {}));
		}

		if (body !== undefined) {
			rb.body(body, 'application/json');
		}
		return http.request(
			rb.build({ responseType: 'text', accept: '*/*', context })
		).pipe(
			filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse),
			map((r: HttpResponse<any>) => r as StrictHttpResponse<any>)
		);
	};
}

// Arma un POST como formulario (multipart), que es lo que espera el backend al registrar.
function postForm(path: string, body: any) {
	return (
		http: HttpClient,
		rootUrl: string,
		params: {},
		context?: HttpContext
	): Observable<StrictHttpResponse<any>> => {
		const rb = new RequestBuilder(rootUrl, path, 'post');

		rb.body(body, 'multipart/form-data');
		return http.request(
			rb.build({ responseType: 'text', accept: '*/*', context })
		).pipe(
			filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse),
			map((r: HttpResponse<any>) => r as StrictHttpResponse<any>)
		);
	};
}

@Component({
	selector: 'app-admin-panel',
	imports: [ReactiveFormsModule, AdminTopbar],
	templateUrl: './panel.html',
	styleUrl: './panel.css',
})
export class AdminPanel implements OnInit {
	private api = inject(Api);                 // habla con el servidor
	private router = inject(Router);           // cambia de página
	private keycloak = inject(KeycloakService);
	private cdr = inject(ChangeDetectorRef);   // redibuja la pantalla
	private destroyRef = inject(DestroyRef);

	// Los 5 estados posibles de un caso.
	readonly statuses = ['Pendiente de revisión', 'Visto', 'Rechazado', 'En coordinación', 'Cerrado'];

	// Pantalla actual del panel.
	tab: 'dashboard' | 'complaint' | 'suggestion' | 'office' | 'professor' = 'complaint';
	complaints: any[] = [];     // quejas (para el dashboard)
	suggestions: any[] = [];    // sugerencias (para el dashboard)
	dashboardComplaintPending = 0;
	dashboardSuggestionPending = 0;
	dashboardLoaded = false;
	items: any[] = [];          // lista de la pestaña actual (ya filtrada por el servidor)
	visibleItems: any[] = [];
	statusCounts: Record<string, number> = {};
	statusPercentages: Record<string, number> = {};
	pendingCount = 0;
	inProgressCount = 0;
	completedCount = 0;
	loading = false;
	errorMsg = '';

	// --- Detalle ---
	selected: any = null;
	messages: any[] = [];
	newStatus = '';
	savingStatus = false;
	replyCtrl = new FormControl('');
	sendingReply = false;

	// --- Buscador y filtros ---
	search = new FormControl('');
	filterStatus = '';
	filterOffice = '';          // id de la oficina elegida ('' = todas)
	officeList: any[] = [];     // oficinas del desplegable (idOffice y name)
	private listCache = new Map<string, any[]>();
	private loadRequestId = 0;

	// --- Formularios de registro (oficina y docente) ---
	officeName = new FormControl('');
	profFirstName = new FormControl('');
	profSurName = new FormControl('');
	profEmail = new FormControl('');
	saving = false;

	get hasLoadedCurrentList(): boolean {
		return this.listCache.has(this.listCacheKey());
	}

	readonly statusClasses: Record<string, string | undefined> = {
		'Pendiente de revisión': 'st-pend',
		'Visto': 'st-visto',
		'Rechazado': 'st-rech',
		'En coordinación': 'st-coord',
		'Cerrado': 'st-cerr'
	};

	// Nombre del usuario para el saludo.
	get userName(): string {
		try {
			const s = JSON.parse(localStorage.getItem('session') ?? 'null');
			return s?.firstName ?? 'Encargado';
		} catch {
			return 'Encargado';
		}
	}

	// "Buenos días", "Buenas tardes" o "Buenas noches" según la hora.
	get greeting(): string {
		const h = new Date().getHours();
		return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
	}

	// Fecha de hoy escrita.
	get today(): string {
		return new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
	}

	// Guarda el estado elegido en los chips.
	setFilter(status: string): void {
		this.filterStatus = status;
		this.updateListSummary();
	}

	// Guarda la oficina elegida y vuelve a pedir la lista filtrada al servidor.
	setOffice(idOffice: string): void {
		this.filterOffice = idOffice;
		this.items = this.listCache.get(this.listCacheKey()) ?? [];
		this.updateListSummary();
		this.load();
	}

	// Al abrir la página, carga la lista y las oficinas del desplegable.
	ngOnInit(): void {
		this.search.valueChanges
			.pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
			.subscribe(() => this.updateListSummary());

		this.updateListSummary();
		this.load();
		this.loadOffices();
	}

	// Trae la lista de oficinas para el desplegable del filtro.
	private loadOffices(): void {
		this.api.invoke(makeRequest('get', '/office/getall') as any, {} as any).then((response: any) => {
			this.officeList = this.parse(response)?.listOffice ?? [];
			this.refresh();
		}).catch((error: any) => {
			console.error('Error al cargar oficinas:', error);
		});
	}

	// Cambia de pantalla y carga sus datos.
	changeTab(tab: 'dashboard' | 'complaint' | 'suggestion' | 'office' | 'professor'): void {
		if (tab === this.tab && !this.selected) return;

		this.tab = tab;
		this.selected = null;
		this.filterStatus = '';
		this.filterOffice = '';
		this.search.setValue('');
		if (tab === 'complaint' || tab === 'suggestion') {
			this.items = this.listCache.get(this.listCacheKey()) ?? [];
			this.updateListSummary();
		}

		if (tab === 'office' || tab === 'professor') {
			this.loadRequestId++;
			this.loading = false;
			this.errorMsg = '';
			return; // estos formularios no cargan lista
		}
		if (tab === 'dashboard') {
			this.loadDashboard();
		} else {
			this.load();
		}
	}

	// Redibuja la pantalla con los datos nuevos.
	private refresh(): void {
		this.cdr.markForCheck();
	}

	goLanding(): void {
		void this.router.navigateByUrl('/');
	}

	// Si el servidor dice 401/403, cierra la sesión y va al login.
	private handleAuthError(error: any): boolean {
		if (error?.status !== 401 && error?.status !== 403) return false;

		this.errorMsg = error.status === 401
			? 'La sesión del backend no está autorizada. Verifica el token Bearer y vuelve a intentar.'
			: 'El backend denegó el acceso a este recurso (403). Verifica los roles configurados.';
		this.loading = false;
		this.refresh();
		return true;
	}

	retryCurrentLoad(): void {
		if (this.tab === 'dashboard') {
			this.loadDashboard();
		} else if (this.tab === 'complaint' || this.tab === 'suggestion') {
			this.load();
		}
	}

	// ------------------------- LISTA -------------------------

	// Trae la lista de quejas o sugerencias; si hay oficina elegida, el servidor la filtra.
	load(): void {
		this.loading = true;
		this.errorMsg = '';

		const requestId = ++this.loadRequestId;
		const cacheKey = this.listCacheKey();
		const query = this.filterOffice ? { idOffice: this.filterOffice } : undefined;
		this.api.invoke(makeRequest('get', '/' + this.tab + '/getall', undefined, query) as any, {} as any).then((response: any) => {
			if (requestId !== this.loadRequestId) return;
			this.items = this.toList(this.parse(response));
			this.listCache.set(cacheKey, this.items);
			this.updateListSummary();
			this.loading = false;
			this.refresh();
		}).catch((error: any) => {
			if (requestId !== this.loadRequestId) return;
			console.error('Error al cargar el panel:', error);
			if (this.handleAuthError(error)) return;
			this.errorMsg = 'No se pudo cargar la lista (' + (error?.status ?? '?') + ').';
			this.loading = false;
			this.refresh();
		});
	}

	// Trae quejas y sugerencias juntas para el dashboard.
	loadDashboard(): void {
		this.loading = true;
		this.errorMsg = '';
		const requestId = ++this.loadRequestId;

		Promise.all([
			this.api.invoke(makeRequest('get', '/complaint/getall') as any, {} as any),
			this.api.invoke(makeRequest('get', '/suggestion/getall') as any, {} as any),
		]).then(([c, s]: any[]) => {
			if (requestId !== this.loadRequestId) return;
			this.complaints = this.toList(this.parse(c));
			this.suggestions = this.toList(this.parse(s));
			this.dashboardComplaintPending = this.countOf(this.complaints, 'Pendiente de revisión');
			this.dashboardSuggestionPending = this.countOf(this.suggestions, 'Pendiente de revisión');
			this.dashboardLoaded = true;
			this.loading = false;
			this.refresh();
		}).catch((error: any) => {
			if (requestId !== this.loadRequestId) return;
			console.error('Error al cargar el dashboard:', error);
			if (this.handleAuthError(error)) return;
			this.errorMsg = 'No se pudo cargar el dashboard (' + (error?.status ?? '?') + ').';
			this.loading = false;
			this.refresh();
		});
	}

	// Convierte la respuesta del servidor en una lista, venga como venga.
	private toList(data: any): any[] {
		const list = Array.isArray(data) ? data : (data?.data ?? data?.list ?? []);
		return Array.isArray(list) ? list : [];
	}

	// Cuenta los casos de una lista con cierto estado (dashboard).
	countOf(list: any[], status: string): number {
		return list.filter((i: any) => i.status === status).length;
	}

	private updateListSummary(): void {
		const text = String(this.search.value ?? '').trim().toLowerCase();
		this.visibleItems = this.items.filter((item: any) => {
			const matchesStatus = !this.filterStatus || item.status === this.filterStatus;
			const searchableText = [item.code, item.complaintFullName ?? item.fullName, item.description]
				.join(' ')
				.toLowerCase();
			return matchesStatus && (!text || searchableText.includes(text));
		});

		this.statusCounts = {};
		for (const status of this.statuses) {
			this.statusCounts[status] = this.items.filter((item: any) => item.status === status).length;
		}

		this.statusPercentages = {};
		for (const status of this.statuses) {
			this.statusPercentages[status] = this.items.length
				? Math.round((this.statusCounts[status] * 100) / this.items.length)
				: 0;
		}

		this.pendingCount = this.statusCounts['Pendiente de revisión'] ?? 0;
		this.inProgressCount = (this.statusCounts['Visto'] ?? 0) + (this.statusCounts['En coordinación'] ?? 0);
		this.completedCount = (this.statusCounts['Cerrado'] ?? 0) + (this.statusCounts['Rechazado'] ?? 0);
	}

	// ------------------------- REGISTRO (OFICINA / DOCENTE) -------------------------

	// Valida y guarda una oficina nueva; luego refresca el desplegable.
	saveOffice(): void {
		const name = String(this.officeName.value ?? '').trim();
		if (!name) {
			alert('Escriba el nombre de la oficina.');
			return;
		}
		this.sendForm('/office/insert', { name }, () => {
			this.officeName.setValue('');
			this.loadOffices();
		});
	}

	// Valida y guarda un docente nuevo.
	saveProfessor(): void {
		const firstName = String(this.profFirstName.value ?? '').trim();
		const surName = String(this.profSurName.value ?? '').trim();
		const email = String(this.profEmail.value ?? '').trim();

		if (!firstName || !surName || !email) {
			alert('Complete nombres, apellidos y correo.');
			return;
		}
		this.sendForm('/professor/insert', { firstName, surName, email }, () => {
			this.profFirstName.setValue('');
			this.profSurName.setValue('');
			this.profEmail.setValue('');
		});
	}

	// Envía el formulario al servidor y avisa si se guardó o falló.
	private sendForm(path: string, body: any, onOk: () => void): void {
		if (this.saving) return;
		this.saving = true;

		this.api.invoke(postForm(path, body) as any, {} as any).then((response: any) => {
			const res = this.parse(response);
			this.saving = false;

			if (res?.type === 'success') {
				onOk();
				alert('Registrado correctamente.');
			} else {
				alert((res?.listMessage ?? ['No se pudo registrar.']).join(' '));
			}
			this.refresh();
		}).catch((error: any) => {
			console.error('Error al registrar:', error);
			this.saving = false;
			if (this.handleAuthError(error)) return;
			alert('No se pudo registrar (' + (error?.status ?? '?') + ').');
			this.refresh();
		});
	}

	// ------------------------- DETALLE -------------------------

	// Abre el detalle de un caso.
	openDetail(item: any): void {
		this.selected = { ...item };
		this.newStatus = item.status ?? '';
		this.messages = [];
		this.replyCtrl.setValue('');
		this.refreshDetail();
	}

	// Cierra el detalle y recarga la lista.
	closeDetail(): void {
		this.selected = null;
		this.load();
	}

	// Pide los datos completos del caso abierto.
	private refreshDetail(): void {
		if (!this.selected?.code) return;

		const path = '/' + this.tab + '/getbycode/' + encodeURIComponent(this.selected.code);
		this.api.invoke(makeRequest('get', path) as any, {} as any).then((response: any) => {
			const data = this.parse(response);
			if (data && typeof data === 'object') {
				this.selected = { ...this.selected, ...data };
				this.newStatus = this.selected.status ?? this.newStatus;
				this.messages = this.extractMessages(data);
			}
			this.refresh();
			if (this.tab === 'suggestion') this.loadSuggestionMessages();
		}).catch((error: any) => {
			console.error('Error al cargar el detalle:', error);
			this.refresh();
		});
	}

	// Trae los mensajes de una sugerencia (vienen de otra ruta).
	private loadSuggestionMessages(): void {
		if (!this.selected?.code) return;

		const path = '/suggestion/comments/' + encodeURIComponent(this.selected.code);
		this.api.invoke(makeRequest('get', path) as any, {} as any).then((response: any) => {
			this.messages = this.extractMessages(this.parse(response));
			this.refresh();
		}).catch((error: any) => {
			console.error('Error al cargar los mensajes:', error);
			this.refresh();
		});
	}

	// Guarda el nuevo estado del caso.
	saveStatus(): void {
		if (!this.selected || !this.newStatus || this.savingStatus) return;

		this.savingStatus = true;
		const body = { complaintCode: this.selected.code, status: this.newStatus };

		this.api.invoke(makeRequest('post', '/' + this.tab + '/update-status', body) as any, {} as any).then((response: any) => {
			const res = this.parse(response);
			this.savingStatus = false;

			if (res?.type === 'error') {
				this.refresh();
				alert('El servidor rechazó el cambio: ' + (res?.listMessage ?? []).join(' '));
				return;
			}
			this.selected = { ...this.selected, status: this.newStatus };
			this.refresh();
			alert('Estado actualizado.');
		}).catch((error: any) => {
			console.error('Error al cambiar el estado:', error);
			this.savingStatus = false;
			if (this.handleAuthError(error)) return;
			this.refresh();
			alert('No se pudo cambiar el estado (' + (error?.status ?? '?') + ').');
		});
	}

	// Envía la respuesta del encargado al estudiante (quejas y sugerencias).
	sendReply(): void {
		const comment = String(this.replyCtrl.value ?? '').trim();
		if (!comment || this.sendingReply || !this.selected?.code) return;

		this.sendingReply = true;
		const body = { complaintCode: this.selected.code, comment };
		const path = this.tab === 'complaint' ? '/complaint/insert-comment' : '/suggestion/insert-comment';

		this.api.invoke(makeRequest('post', path, body) as any, {} as any).then((response: any) => {
			const res = this.parse(response);
			this.sendingReply = false;

			if (res?.type === 'error') {
				this.refresh();
				alert('El servidor rechazó el mensaje: ' + (res?.listMessage ?? []).join(' '));
				return;
			}
			this.replyCtrl.setValue('');
			this.refreshDetail();
		}).catch((error: any) => {
			console.error('Error al enviar la respuesta:', error);
			this.sendingReply = false;
			this.refresh();
			alert('No se pudo enviar la respuesta (' + (error?.status ?? '?') + ').');
		});
	}

	// Cierra la sesión y vuelve al login.
	logout(): void {
		localStorage.removeItem('session');
		void this.keycloak.logout(window.location.origin);
	}

	// ------------------------- UTILIDADES -------------------------

	// Convierte el texto del servidor en datos.
	private parse(response: any): any {
		if (typeof response !== 'string') return response;
		if (response.trim() === '') return null;
		try {
			return JSON.parse(response);
		} catch {
			return null;
		}
	}

	// Deja los mensajes con un campo "text" uniforme.
	private extractMessages(obj: any): any[] {
		const raw = this.findMessagesArray(obj);
		return raw.map((c: any) => {
			if (typeof c === 'string') return { text: c };
			return { ...c, text: c?.description ?? c?.message ?? c?.comment ?? c?.text ?? '' };
		});
	}

	// Busca la lista de comentarios dentro de la respuesta.
	private findMessagesArray(obj: any): any[] {
		if (!obj || typeof obj !== 'object') return [];
		if (Array.isArray(obj.listComment)) return obj.listComment;
		for (const key of Object.keys(obj)) {
			if (/comment/i.test(key) && Array.isArray(obj[key])) return obj[key];
		}
		return [];
	}

	private listCacheKey(): string {
		return `${this.tab}:${this.filterOffice}`;
	}
}