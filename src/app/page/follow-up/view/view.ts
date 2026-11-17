import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { RadioButtonModule } from 'primeng/radiobutton';
import { InputTextModule } from 'primeng/inputtext';
import { InputMaskModule } from 'primeng/inputmask';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { Api } from '../../../api/api';
import { apisuggestiongetbycode } from '../../../api/functions';
import { RequestBuilder } from '../../../api/request-builder';
import { StrictHttpResponse } from '../../../api/strict-http-response';

// Lee el token guardado al iniciar sesión (si no hay sesión, devuelve vacío)
function sessionToken(): string {
	try {
		return JSON.parse(localStorage.getItem('session') ?? 'null')?.token ?? '';
	} catch {
		return '';
	}
}

// Convierte la respuesta HTTP en el formato que espera api.invoke
function toStrict(source: Observable<any>): Observable<StrictHttpResponse<any>> {
	return source.pipe(
		filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse),
		map((r: HttpResponse<any>) => r as StrictHttpResponse<any>)
	);
}

// Búsqueda de quejas por código: GET /complaint/getbycode/{code}
function apicomplaintgetbycode(
	http: HttpClient,
	rootUrl: string,
	params: { code: string },
	context?: HttpContext
): Observable<StrictHttpResponse<any>> {
	const rb = new RequestBuilder(rootUrl, '/complaint/getbycode/{code}', 'get');
	rb.path('code', params.code, {});
	return toStrict(http.request(rb.build({ responseType: 'text', accept: '*/*', context })));
}

// Mensaje nuevo en una queja: POST /complaint/insert-comment
function apicomplaintaddcomment(
	http: HttpClient,
	rootUrl: string,
	params: { body: { complaintCode: string; comment: string } },
	context?: HttpContext
): Observable<StrictHttpResponse<any>> {
	const rb = new RequestBuilder(rootUrl, '/complaint/insert-comment', 'post');
	const token = sessionToken();
	if (token) rb.header('Authorization', 'Bearer ' + token, {});
	rb.body(params.body, 'application/json');
	return toStrict(http.request(rb.build({ responseType: 'text', accept: '*/*', context })));
}

// Mensajes de una sugerencia (respaldo si el servidor no los trae en getbycode): GET /suggestion/comments/{code}
function apisuggestioncomments(
	http: HttpClient,
	rootUrl: string,
	params: { code: string },
	context?: HttpContext
): Observable<StrictHttpResponse<any>> {
	const rb = new RequestBuilder(rootUrl, '/suggestion/comments/{code}', 'get');
	rb.path('code', params.code, {});
	return toStrict(http.request(rb.build({ responseType: 'text', accept: '*/*', context })));
}

// Mensaje nuevo en una sugerencia: POST /suggestion/insert-comment
function apisuggestionaddcomment(
	http: HttpClient,
	rootUrl: string,
	params: { body: { complaintCode: string; comment: string } },
	context?: HttpContext
): Observable<StrictHttpResponse<any>> {
	const rb = new RequestBuilder(rootUrl, '/suggestion/insert-comment', 'post');
	const token = sessionToken();
	if (token) rb.header('Authorization', 'Bearer ' + token, {});
	rb.body(params.body, 'application/json');
	return toStrict(http.request(rb.build({ responseType: 'text', accept: '*/*', context })));
}

@Component({
	selector: 'app-follow-up-view',
	imports: [NgClass, DatePipe, ReactiveFormsModule, RadioButtonModule, InputTextModule, InputMaskModule, ButtonModule, TextareaModule],
	templateUrl: './view.html',
	styleUrl: './view.css',
})
export class FollowUpView implements OnInit {
	private formBuilder = inject(FormBuilder);
	private api = inject(Api);
	private cdr = inject(ChangeDetectorRef);

	frmFollowUp!: FormGroup;
	dataReponse: any = { status: '' };

	// --- Mensajes ---
	commentsList: any[] = [];
	commentCtrl = new FormControl('');
	sendingComment = false;
	private searchedType = 'suggestion';
	private searchedCode = '';

	// Mensaje cuando el código no existe (viene del servidor)
	notFoundMsg = '';

	ngOnInit(): void {
		this.frmFollowUp = this.formBuilder.group({
			type: ['suggestion'],
			code: [''],
		});
	}

	onChangeType(): void {
		this.frmFollowUp.get('code')?.setValue('');
		this.dataReponse = { status: '' };
		this.commentsList = [];
		this.notFoundMsg = '';
		this.commentCtrl.setValue('');
	}

	getDataSuggestionComplaint(): void {
		const type = this.frmFollowUp.get('type')?.value;

		// Quita los "_" de la máscara, espacios y símbolos: solo letras y números
		const code = String(this.frmFollowUp.get('code')?.value ?? '')
			.replace(/[^A-Za-z0-9]/g, '')
			.toUpperCase();

		if (!code) {
			alert('Ingrese un código.');
			return;
		}

		const fn: any = type === 'complaint' ? apicomplaintgetbycode : apisuggestiongetbycode;

		this.api.invoke(fn, { code } as any).then((response: any) => {
			const apiResponseData = this.parse(response);
			const data = this.findStatus(apiResponseData);

			if (data) {
				this.dataReponse = { ...data };
				this.searchedType = type;
				this.searchedCode = code;
				this.notFoundMsg = '';
				// Tanto la queja como la sugerencia traen sus mensajes en listComment
				if (Array.isArray(data.listComment)) {
					this.commentsList = data.listComment;
				} else {
					this.commentsList = [];
					this.loadSuggestionComments();
				}
			} else {
				this.dataReponse = { status: '' };
				this.commentsList = [];
				this.notFoundMsg = (apiResponseData?.listMessage ?? []).join(' ') || 'Que no existe el registro buscado';
				alert(this.notFoundMsg + '.');
			}
			this.cdr.detectChanges();
		}).catch((error: any) => {
			console.error('Error seguimiento:', error);
			this.dataReponse = { status: '' };
			this.commentsList = [];
			this.notFoundMsg = '';
			this.cdr.detectChanges();
			alert('Algo ocurrió mal al buscar.');
		});
	}

	showTimeLine(): boolean {
		return !!this.dataReponse?.status;
	}

	// ------------------------- MENSAJES -------------------------

	// Vuelve a pedir el caso que se está viendo para refrescar sus mensajes
	loadComments(): void {
		if (!this.searchedCode) return;

		const fn: any = this.searchedType === 'complaint' ? apicomplaintgetbycode : apisuggestiongetbycode;

		this.api.invoke(fn, { code: this.searchedCode } as any)
			.then((response: any) => {
				const data = this.parse(response);
				if (this.searchedType === 'suggestion' && !Array.isArray(data?.listComment)) {
					this.loadSuggestionComments();
					return;
				}
				this.commentsList = this.findCommentsArray(data);
				this.cdr.detectChanges();
			})
			.catch((error: any) => {
				console.error('Error al cargar mensajes:', error);
			});
	}

	// Respaldo: pide los mensajes de la sugerencia a su propia ruta
	private loadSuggestionComments(): void {
		this.api.invoke(apisuggestioncomments as any, { code: this.searchedCode } as any)
			.then((response: any) => {
				this.commentsList = this.findCommentsArray(this.parse(response));
				this.cdr.detectChanges();
			})
			.catch(() => {
				this.commentsList = [];
				this.cdr.detectChanges();
			});
	}

	onSendComment(): void {
		const comment = String(this.commentCtrl.value ?? '').trim();
		if (!comment || this.sendingComment || !this.searchedCode) return;

		this.sendingComment = true;
		const fn: any = this.searchedType === 'complaint' ? apicomplaintaddcomment : apisuggestionaddcomment;

		this.api.invoke(fn, { body: { complaintCode: this.searchedCode, comment } } as any)
			.then((response: any) => {
				const res = this.parse(response);
				this.sendingComment = false;

				if (res?.type === 'error') {
					this.cdr.detectChanges();
					alert((res?.listMessage ?? ['No se pudo registrar el mensaje.']).join(' '));
					return;
				}
				this.commentCtrl.setValue('');
				this.loadComments();
				this.cdr.detectChanges();
			})
			.catch((error: any) => {
				console.error('Error al registrar mensaje:', error);
				this.sendingComment = false;
				this.cdr.detectChanges();
				alert('No se pudo registrar el mensaje.');
			});
	}

	// ------------------------- UTILIDADES -------------------------

	private parse(response: any): any {
		if (typeof response !== 'string') return response;
		if (response.trim() === '') return null;
		try {
			return JSON.parse(response);
		} catch {
			return null;
		}
	}

	private findStatus(obj: any): any {
		if (!obj || typeof obj !== 'object') return null;
		if (typeof obj.status === 'string' && obj.status !== '') return obj;
		for (const key of Object.keys(obj)) {
			const found = this.findStatus(obj[key]);
			if (found) return found;
		}
		return null;
	}

	// Busca la lista de mensajes (listComment) y no confunde listMessage con mensajes
	private findCommentsArray(obj: any): any[] {
		if (!obj || typeof obj !== 'object') return [];
		if (Array.isArray(obj.listComment)) return obj.listComment;
		for (const key of Object.keys(obj)) {
			if (/comment/i.test(key) && Array.isArray(obj[key])) return obj[key];
		}
		return [];
	}
}