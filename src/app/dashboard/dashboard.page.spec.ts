import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
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
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
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
                food_budget: '1000.00',
                daily_meal_budget_cap: '142.86',
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
            url: '/dashboard',
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
    expect(fixture.componentInstance.profile()?.food_budget).toBe('1000.00');
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
    const accountActions = fixture.nativeElement.querySelectorAll(
      '.account-actions button',
    ) as NodeListOf<HTMLButtonElement>;
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
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
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
            url: '/dashboard',
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
    expect(navigationUrls).toEqual(['/home?mode=login&returnUrl=%2Fdashboard']);
  });

  it('should save the weekly allowance and selected dorm equipment without sending legacy settings', async () => {
    let savedPayload: unknown;
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
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
                food_budget: null,
                daily_meal_budget_cap: null,
                equipment: [],
              }),
            updateProfile: (payload: unknown) => {
              savedPayload = payload;
              return of({
                weekly_allowance: '1500.00',
                food_budget: '1500.00',
                daily_meal_budget_cap: '214.29',
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
    component.budgetForm.setValue({ weeklyAllowance: 1500 });
    component.toggleEquipment('rice_cooker');
    component.saveBudget();

    expect(savedPayload).toEqual({
      weekly_allowance: 1500,
      equipment: ['rice_cooker'],
    });
    expect(component.profile()?.food_budget).toBe('1500.00');
    expect(component.isBudgetFormOpen()).toBe(false);
    expect(component.isSaving()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Emergency fund');
  });

  it("should save and restore completed meals in today's schedule", async () => {
    const day = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
    const meals = [
      {
        day,
        category: 'breakfast',
        name: 'Egg & Garlic Rice Bowl',
        minutes: 10,
        cost: 35,
        ingredients: 'Eggs:15, Rice:15, Garlic:5',
      },
      {
        day,
        category: 'snack',
        name: 'Banana',
        minutes: 2,
        cost: 10,
        ingredients: 'Banana:10',
      },
    ];
    const plan = {
      id: 6,
      user_id: 8,
      week_start: '2026-11-09',
      title: 'Weekly Meal Plan',
      plan_data: { meals },
      created_at: '2026-11-09T00:00:00',
    };
    const savedPlanData: Record<string, unknown>[] = [];

    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } },
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
                food_budget: null,
                daily_meal_budget_cap: null,
                equipment: [],
              }),
          },
        },
        {
          provide: NutriDormDataService,
          useValue: {
            listExpenses: () => of([]),
            listPantryItems: () => of([]),
            listMealPlans: () => of([plan]),
            listGroceryItems: () => of([]),
            listNutritionLogs: () => of([]),
            updateMealPlan: (
              _id: number,
              payload: { title: string; week_start: string; plan_data: Record<string, unknown> },
            ) => {
              savedPlanData.push(payload.plan_data);
              return of({ ...plan, plan_data: payload.plan_data });
            },
          },
        },
        { provide: Router, useValue: { navigateByUrl: () => Promise.resolve(true) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();

    const checkboxes = fixture.nativeElement.querySelectorAll('.schedule-card input.meal-completion');
    expect(checkboxes.length).toBe(2);
    const snackCheckbox = checkboxes[1] as HTMLInputElement;
    snackCheckbox.checked = true;
    snackCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();

    expect(savedPlanData[0]?.['meals']).toEqual([meals[0], { ...meals[1], isCompleted: true }]);
    expect(fixture.componentInstance.mealsForDay(day)[1]?.isCompleted).toBe(true);

    snackCheckbox.checked = false;
    snackCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();

    expect(savedPlanData[1]?.['meals']).toEqual([meals[0], { ...meals[1], isCompleted: false }]);
    expect(fixture.componentInstance.mealsForDay(day)[1]?.isCompleted).toBe(false);
    const snack = fixture.componentInstance.mealsForDay(day)[1];
    expect(snack).toBeDefined();
    if (snack) {
      expect(() => fixture.componentInstance.editMealEntry(fixture.componentInstance.mealIndex(snack))).not.toThrow();
      expect(fixture.componentInstance.mealForm.controls.name.value).toBe('Banana');
    }
  });
});
