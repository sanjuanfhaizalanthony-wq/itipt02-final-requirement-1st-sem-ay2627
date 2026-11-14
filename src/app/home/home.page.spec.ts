import { provideHttpClient } from '@angular/common/http';

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';

import { environment } from '../../environments/environment';

import { HomePage } from './home.page';
import { expect } from 'vitest';
import { afterEach, beforeEach, describe, it } from 'node:test';

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;
  let httpMock: HttpTestingController;
  const navigationUrls: string[] = [];
  let routeMode: string | null;
  let routeReturnUrl: string | null;

  beforeEach(async () => {
    navigationUrls.length = 0;
    routeMode = null;
    routeReturnUrl = null;
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: Router,
          useValue: {
            navigateByUrl: (url: string) => {
              navigationUrls.push(url);
              return Promise.resolve(true);
            },
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (name: string) => {
                  if (name === 'mode') return routeMode;
                  if (name === 'returnUrl') return routeReturnUrl;
                  return null;
                },
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.removeItem('nutridorm_access_token');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should submit validated registration details to the API', () => {
    component.registerForm.setValue({
      fullName: 'Alex Santos',
      dormName: 'San Leonardo Dorm',
      email: 'alex@example.com',
      password: 'secure-pass-123',
      confirmPassword: 'secure-pass-123',
    });

    component.createAccount();

    const request = httpMock.expectOne(`${environment.apiBaseUrl}/api/auth/register`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      full_name: 'Alex Santos',
      dorm_name: 'San Leonardo Dorm',
      email: 'alex@example.com',
      password: 'secure-pass-123',
    });
    request.flush({
      access_token: 'test-token',
      token_type: 'bearer',
      user: {
        id: 1,
        full_name: 'Alex Santos',
        dorm_name: 'San Leonardo Dorm',
        email: 'alex@example.com',
      },
    });

    expect(sessionStorage.getItem('nutridorm_access_token')).toBe('test-token');
    expect(component.isSubmitting()).toBe(false);
    expect(navigationUrls).toEqual(['/dashboard']);
  });

  it('should not call the API when the registration form is invalid', () => {
    component.createAccount();

    httpMock.expectNone(`${environment.apiBaseUrl}/api/auth/register`);
    expect(component.registerForm.touched).toBe(true);
  });

  it('should sign in and open the dashboard', () => {
    component.showSignInNotice();
    routeReturnUrl = '/dashboard/mealplan';
    component.loginForm.setValue({ email: 'alex@example.com', password: 'secure-pass-123' });

    component.createAccount();

    const request = httpMock.expectOne(`${environment.apiBaseUrl}/api/auth/login`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'alex@example.com', password: 'secure-pass-123' });
    request.flush({
      access_token: 'login-token',
      token_type: 'bearer',
      user: {
        id: 1,
        full_name: 'Alex Santos',
        dorm_name: 'San Leonardo Dorm',
        email: 'alex@example.com',
      },
    });

    expect(sessionStorage.getItem('nutridorm_access_token')).toBe('login-token');
    expect(navigationUrls).toEqual(['/dashboard/mealplan']);
  });

  it('should ignore unsafe login return URLs', () => {
    component.showSignInNotice();
    routeReturnUrl = 'https://example.com';
    component.loginForm.setValue({ email: 'alex@example.com', password: 'secure-pass-123' });
    component.createAccount();

    const request = httpMock.expectOne(`${environment.apiBaseUrl}/api/auth/login`);
    request.flush({
      access_token: 'login-token',
      token_type: 'bearer',
      user: {
        id: 1,
        full_name: 'Alex Santos',
        dorm_name: 'San Leonardo Dorm',
        email: 'alex@example.com',
      },
    });

    expect(navigationUrls).toEqual(['/dashboard']);
  });

  it('should open directly in sign-in mode when switching accounts', () => {
    routeMode = 'login';
    const loginFixture = TestBed.createComponent(HomePage);
    loginFixture.detectChanges();

    expect(loginFixture.componentInstance.isSignInMode()).toBe(true);
    expect(loginFixture.nativeElement.textContent).toContain('Welcome back');
    expect(loginFixture.nativeElement.textContent).toContain('Sign In');
  });

  it('should validate the login form fields instead of registration fields', () => {
    routeMode = 'login';
    const loginFixture = TestBed.createComponent(HomePage);
    const loginComponent = loginFixture.componentInstance;
    loginComponent.loginForm.setValue({ email: 'alex@example.com', password: 'secure-pass-123' });
    loginComponent.submitted = true;
    loginFixture.detectChanges();

    expect(loginFixture.nativeElement.textContent).not.toContain('Enter a valid email address.');
    expect(loginFixture.nativeElement.textContent).not.toContain('Enter your password.');
  });
});
