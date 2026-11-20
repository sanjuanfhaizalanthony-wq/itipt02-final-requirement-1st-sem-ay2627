import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';

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
    expect(fixture.nativeElement.textContent).not.toContain('QUICK ACTIONS');
    expect(fixture.nativeElement.querySelector('.quick-actions')).toBeNull();
    expect(fixture.nativeElement.querySelector('.stats-grid .stat-card')).not.toBeNull();
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
    (fixture.nativeElement.querySelector('.bottom-nav button:nth-child(4)') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Add Pantry Item');

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

  it('should show meal history by week and save meals marked as eaten', async () => {
    const meal = {
      day: 'Monday',
      category: 'breakfast',
      name: 'Oatmeal',
      minutes: 10,
      cost: 30,
      ingredients: 'Oats:30',
    };
    const plan = {
      id: 21,
      user_id: 8,
      week_start: '2026-11-21',
      title: 'Weekly Meal Plan',
      plan_data: { meals: [meal] },
      created_at: '2026-11-21T00:00:00',
    };
    const nextWeekPlan = {
      id: 22,
      user_id: 8,
      week_start: '2026-11-28',
      title: 'Next Weekly Meal Plan',
      plan_data: { meals: [{ ...meal, name: 'Banana', day: 'Tuesday' }] },
      created_at: '2026-11-28T00:00:00',
    };
    let savedPlanData: Record<string, unknown> | null = null;
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
                equipment: [],
              }),
          },
        },
        {
          provide: NutriDormDataService,
          useValue: {
            listExpenses: () => of([]),
            listPantryItems: () => of([]),
            listMealPlans: () => of([nextWeekPlan, plan]),
            listGroceryItems: () => of([]),
            listNutritionLogs: () => of([]),
            updateMealPlan: (
              _id: number,
              payload: { title: string; week_start: string; plan_data: Record<string, unknown> },
            ) => {
              savedPlanData = payload.plan_data;
              return of({ ...nextWeekPlan, ...payload });
            },
          },
        },
        { provide: Router, useValue: { navigateByUrl: () => Promise.resolve(true) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();

    const historyButtons = fixture.nativeElement.querySelectorAll(
      '.history-week > button',
    ) as NodeListOf<HTMLButtonElement>;
    expect(historyButtons).toHaveLength(2);
    expect(historyButtons[0]?.textContent).toContain('Nov 28 - Dec 4, 2026');
    expect(historyButtons[1]?.textContent).toContain('Nov 21 - Nov 27, 2026');
    historyButtons[1]?.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No meals marked as eaten this week.');

    fixture.componentInstance.selectSection('meal-plans');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Auto-Optimize');
    const eatenCheckbox = fixture.nativeElement.querySelector('.day-card .eaten-check input') as HTMLInputElement;
    eatenCheckbox.checked = true;
    eatenCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
    expect(savedPlanData).toEqual({
      meals: [{ ...meal, name: 'Banana', day: 'Tuesday', isEaten: true }],
    });

    fixture.componentInstance.selectSection('overview');
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.history-week > button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('1 eaten');
    expect(fixture.nativeElement.textContent).toContain('Banana');
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
