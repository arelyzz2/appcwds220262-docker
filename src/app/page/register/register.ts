import { AfterViewInit, ChangeDetectorRef, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { Api } from '../../api/api';
import { RequestBuilder } from '../../api/request-builder';
import { StrictHttpResponse } from '../../api/strict-http-response';

// POST /user/register-student
function apiuserregisterstudent(
	http: HttpClient,
	rootUrl: string,
	params: { body: { firstName: string; surName: string; email: string; password: string } },
	context?: HttpContext
): Observable<StrictHttpResponse<any>> {
	const rb = new RequestBuilder(rootUrl, '/user/register-student', 'post');
	rb.body(params.body, 'application/json');

	return http.request(
		rb.build({ responseType: 'text', accept: '*/*', context })
	).pipe(
		filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse),
		map((r: HttpResponse<any>) => r as StrictHttpResponse<any>)
	);
}

@Component({
	selector: 'app-register',
	imports: [ReactiveFormsModule],
	templateUrl: './register.html',
	styleUrl: './register.css',
})
export class Register implements AfterViewInit {
	private fb = inject(FormBuilder);
	private api = inject(Api);
	private router = inject(Router);
	private cdr = inject(ChangeDetectorRef);

	sending = false;
	messages: string[] = [];
	ok = false;

	form = this.fb.group({
		firstName: ['', [Validators.required, Validators.maxLength(70)]],
		surName: ['', [Validators.required, Validators.maxLength(40)]],
		email: ['', [Validators.required, Validators.email]],
		password: ['', [Validators.required, Validators.minLength(6)]],
	});

	ngAfterViewInit(): void {
		// Chrome rellena los campos un instante después de cargar; se vacían de nuevo
		setTimeout(() => {
			this.form.reset({ firstName: '', surName: '', email: '', password: '' });
			this.cdr.detectChanges();
		}, 150);
	}

	submit(): void {
		if (this.form.invalid || this.sending) {
			this.form.markAllAsTouched();
			return;
		}

		this.sending = true;
		this.messages = [];
		this.ok = false;

		const body = this.form.getRawValue() as any;

		this.api.invoke(apiuserregisterstudent as any, { body } as any).then((response: any) => {
			const res = this.parse(response);
			this.messages = res?.listMessage ?? [];
			this.ok = res?.type === 'success';
			this.sending = false;

			if (this.ok) {
				this.form.reset({ firstName: '', surName: '', email: '', password: '' });
				if (this.messages.length === 0) {
					this.messages = ['Registro exitoso. Te llevamos al inicio de sesión...'];
				}
				this.cdr.detectChanges();
				// Pausa corta para que se vea el mensaje de éxito
				setTimeout(() => this.goLogin(), 1500);
				return;
			}
			this.cdr.detectChanges();
		}).catch((error: any) => {
			console.error('Error en el registro:', error);
			this.messages = ['No se pudo completar el registro (' + (error?.status ?? '?') + ').'];
			this.ok = false;
			this.sending = false;
			this.cdr.detectChanges();
		});
	}

	goLogin(): void {
		this.router.navigate(['/login']);
	}

	// Evita que un cuerpo vacío o no-JSON deje el botón colgado
	private parse(response: any): any {
		if (typeof response !== 'string') return response;
		if (response.trim() === '') return null;
		try {
			return JSON.parse(response);
		} catch {
			return null;
		}
	}
}