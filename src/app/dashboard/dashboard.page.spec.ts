import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService } from '../core/auth.service';
import { NutriDormDataService } from '../core/nutri-dorm-data.service';

import { DashboardPage } from './dashboard.page';

describe('DashboardPage', () => {
  afterEach(() => {
    sessionStorage.removeItem('nutridorm_access_token');
  });

  it('should display the signed-in user and saved profile using signals', async () => {
    const navigationUrls: string[] = [];
    let signOutCount = 0;
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        {
          provide: AuthService,
          useValue: {
            getCurrentUser: () =>
              of({
                id: 8,
                full_name: 'Alex Santos',
                dorm_name: 'San Leonardo Dorm',
                email: 'alex@example.com',
              }),
            getProfile: () =>
              of({
                weekly_allowance: '1000.00',
                emergency_fund_percent: '10.00',
                food_budget: '900.00',
                daily_meal_budget_cap: '128.57',
                equipment: ['rice_cooker'],
              }),
            signOut: () => {
              signOutCount += 1;
              sessionStorage.removeItem('nutridorm_access_token');
            },
          },
        },
        {
          provide: NutriDormDataService,
          useValue: {
            listExpenses: () => of([]),
            listPantryItems: () => of([]),
            listMealPlans: () => of([]),
            listGroceryItems: () => of([]),
            listNutritionLogs: () => of([]),
          },
        },
        {
          provide: Router,
          useValue: {
            navigateByUrl: (url: string) => {
              navigationUrls.push(url);
              return Promise.resolve(true);
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();

    expect(fixture.componentInstance.user()?.full_name).toBe('Alex Santos');
    expect(fixture.componentInstance.profile()?.food_budget).toBe('900.00');
    expect(fixture.componentInstance.isLoading()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('San Leonardo Dorm');
    expect(fixture.nativeElement.textContent).toContain('Meal Plan');
    expect(fixture.nativeElement.textContent).toContain('Auto-Fill Budget Plan');
    const pantryBadge = fixture.nativeElement.querySelector('.alert-badge') as HTMLElement;
    expect(pantryBadge.textContent?.trim()).toBe('0');

    fixture.componentInstance.pantryItems.set([
      {
        id: 1,
        user_id: 8,
        name: 'Rice',
        quantity: '1.00',
        unit: 'kg',
        category: null,
        expires_on: null,
        is_consumed: false,
        created_at: '2026-11-09T00:00:00',
      },
      {
        id: 2,
        user_id: 8,
        name: 'Eggs',
        quantity: '2.00',
        unit: 'piece',
        category: null,
        expires_on: null,
        is_consumed: false,
        created_at: '2026-11-09T00:00:00',
      },
    ]);
    fixture.detectChanges();
    expect(pantryBadge.textContent?.trim()).toBe('2');

    fixture.componentInstance.pantryItems.update((items) => items.slice(0, 1));
    fixture.detectChanges();
    expect(pantryBadge.textContent?.trim()).toBe('1');

    sessionStorage.setItem('nutridorm_access_token', 'active-token');
    (fixture.nativeElement.querySelector('[aria-label="Account profile"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Alex Santos');
    expect(fixture.nativeElement.textContent).toContain('alex@example.com');
    const accountActions = fixture.nativeElement.querySelectorAll('.account-actions button') as NodeListOf<HTMLButtonElement>;
    accountActions[0].click();
    expect(sessionStorage.getItem('nutridorm_access_token')).toBeNull();
    expect(navigationUrls).toEqual(['/home?mode=login']);
    accountActions[1].click();
    expect(signOutCount).toBe(2);
    expect(navigationUrls).toEqual(['/home?mode=login', '/home']);

    fixture.componentInstance.selectSection('groceries');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Automated Grocery List');
  });

  it('should return to registration when the access token has expired', async () => {
    sessionStorage.setItem('nutridorm_access_token', 'expired');
    const navigationUrls: string[] = [];

    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        {
          provide: AuthService,
          useValue: {
            getCurrentUser: () => throwError(() => ({ status: 401 })),
            signOut: () => sessionStorage.removeItem('nutridorm_access_token'),
          },
        },
        { provide: NutriDormDataService, useValue: {} },
        {
          provide: Router,
          useValue: {
            navigateByUrl: (url: string) => {
              navigationUrls.push(url);
              return Promise.resolve(true);
            },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();

    expect(sessionStorage.getItem('nutridorm_access_token')).toBeNull();
    expect(navigationUrls).toEqual(['/home']);
  });

  it('should save the allowance, emergency percentage and selected dorm equipment', async () => {
    let savedPayload: unknown;
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        {
          provide: AuthService,
          useValue: {
            getCurrentUser: () =>
              of({
                id: 8,
                full_name: 'Alex Santos',
                dorm_name: 'San Leonardo Dorm',
                email: 'alex@example.com',
              }),
            getProfile: () =>
              of({
                weekly_allowance: null,
                emergency_fund_percent: '10.00',
                food_budget: null,
                daily_meal_budget_cap: null,
                equipment: [],
              }),
            updateProfile: (payload: unknown) => {
              savedPayload = payload;
              return of({
                weekly_allowance: '1500.00',
                emergency_fund_percent: '15.00',
                food_budget: '1275.00',
                daily_meal_budget_cap: '182.14',
                equipment: ['rice_cooker'],
              });
            },
          },
        },
        {
          provide: NutriDormDataService,
          useValue: {
            listExpenses: () => of([]),
            listPantryItems: () => of([]),
            listMealPlans: () => of([]),
            listGroceryItems: () => of([]),
            listNutritionLogs: () => of([]),
          },
        },
        { provide: Router, useValue: { navigateByUrl: () => Promise.resolve(true) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.budgetForm.setValue({ weeklyAllowance: 1500, emergencyPercent: 15 });
    component.toggleEquipment('rice_cooker');
    component.saveBudget();

    expect(savedPayload).toEqual({
      weekly_allowance: 1500,
      emergency_fund_percent: 15,
      equipment: ['rice_cooker'],
    });
    expect(component.profile()?.food_budget).toBe('1275.00');
    expect(component.isBudgetFormOpen()).toBe(false);
    expect(component.isSaving()).toBe(false);
  });
});
