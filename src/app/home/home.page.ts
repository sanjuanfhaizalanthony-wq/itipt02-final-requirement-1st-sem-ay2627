import type { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import {
  ReactiveFormsModule,
  FormControl,
  FormGroup,
  Validators,
  type AbstractControl,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowForwardOutline,
  businessOutline,
  eyeOffOutline,
  eyeOutline,
  lockClosedOutline,
  mailOutline,
  personOutline,
  restaurantOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';

import { AuthService } from '../core/auth.service';

const passwordsMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  return password === confirmPassword ? null : { passwordsDoNotMatch: true };
};

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [IonContent, IonIcon, ReactiveFormsModule],
})
export class HomePage {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly registerForm = new FormGroup(
    {
      fullName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      dormName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email],
      }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8)],
      }),
      confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    },
    { validators: passwordsMatchValidator },
  );

  readonly loginForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  readonly isSignInMode = signal(false);
  passwordVisible = false;
  confirmPasswordVisible = false;
  submitted = false;
  readonly formMessage = signal('');
  readonly formMessageType = signal<'success' | 'error'>('success');
  readonly isSubmitting = signal(false);

  constructor() {
    this.isSignInMode.set(this.route.snapshot.queryParamMap.get('mode') === 'login');
    addIcons({
      arrowForwardOutline,
      businessOutline,
      eyeOffOutline,
      eyeOutline,
      lockClosedOutline,
      mailOutline,
      personOutline,
      restaurantOutline,
      shieldCheckmarkOutline,
    });
  }

  get passwordMismatch(): boolean {
    return this.registerForm.hasError('passwordsDoNotMatch') && this.registerForm.controls.confirmPassword.touched;
  }

  showError(controlName: keyof typeof this.registerForm.controls): boolean {
    const control = this.isSignInMode() ? this.loginForm.get(controlName) : this.registerForm.controls[controlName];
    return !!control && control.invalid && (control.touched || this.submitted);
  }

  createAccount(): void {
    this.submitted = true;
    this.formMessage.set('');
    this.formMessageType.set('success');

    if (this.isSignInMode()) {
      if (this.loginForm.invalid) {
        this.loginForm.markAllAsTouched();
        return;
      }

      this.isSubmitting.set(true);
      const { email, password } = this.loginForm.getRawValue();
      this.authService.login(email, password).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
          void this.router.navigateByUrl(this.getSafePostLoginUrl(returnUrl));
        },
        error: (error: HttpErrorResponse) => {
          this.formMessageType.set('error');
          this.formMessage.set(this.getAuthError(error));
          this.isSubmitting.set(false);
        },
      });
      return;
    }

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const { fullName, dormName, email, password } = this.registerForm.getRawValue();

    this.authService
      .register({
        full_name: fullName,
        dorm_name: dormName,
        email,
        password,
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          void this.router.navigateByUrl('/dashboard');
        },
        error: (error: HttpErrorResponse) => {
          this.formMessageType.set('error');
          this.formMessage.set(this.getAuthError(error));
          this.isSubmitting.set(false);
        },
      });
  }

  showSignInNotice(): void {
    this.isSignInMode.update((isSignIn) => !isSignIn);
    this.formMessage.set('');
    this.submitted = false;
    this.registerForm.reset();
    this.loginForm.reset();
  }

  private getAuthError(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'Cannot reach the local NutriDorm API. Open the app at http://localhost:8100 and make sure MySQL and the PHP API server are running.';
    }

    if (error.status === 409) {
      return 'An account with this email already exists. Try signing in instead.';
    }
    if (error.status === 401) {
      return 'Invalid email or password.';
    }

    const detail = error.error?.detail;
    return typeof detail === 'string' ? detail : 'Could not create your account. Check your details and try again.';
  }

  private getSafePostLoginUrl(returnUrl: string | null): string {
    const allowedDashboardUrls = new Set([
      '/dashboard',
      '/dashboard/overview',
      '/dashboard/mealplan',
      '/dashboard/grocery',
      '/dashboard/pantry',
      '/dashboard/expenses',
      '/dashboard/nutrition',
    ]);
    return returnUrl && allowedDashboardUrls.has(returnUrl) ? returnUrl : '/dashboard';
  }
}
