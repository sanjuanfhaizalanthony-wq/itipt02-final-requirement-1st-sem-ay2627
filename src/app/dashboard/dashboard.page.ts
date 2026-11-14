import { DecimalPipe, UpperCasePipe } from '@angular/common';
import type { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal, type OnInit, type WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  addOutline,
  calendarOutline,
  checkmarkOutline,
  createOutline,
  cubeOutline,
  homeOutline,
  logOutOutline,
  nutritionOutline,
  personCircleOutline,
  receiptOutline,
  restaurantOutline,
  sparklesOutline,
  swapHorizontalOutline,
  trashOutline,
  walletOutline,
} from 'ionicons/icons';
import type { Observable } from 'rxjs';

import { AuthService, type AuthUser, type UserProfile } from '../core/auth.service';
import {
  NutriDormDataService,
  type Expense,
  type GroceryItem,
  type MealPlan,
  type NutritionLog,
  type PantryItem,
} from '../core/nutri-dorm-data.service';

type DashboardSection = 'overview' | 'expenses' | 'pantry' | 'meal-plans' | 'groceries' | 'nutrition';
type Equipment = 'rice_cooker' | 'electric_kettle' | 'microwave' | 'single_burner';
interface PlannedMeal {
  day: string;
  category: string;
  name: string;
  minutes: number;
  cost: number;
  ingredients: string;
  isCompleted?: boolean;
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SECTION_PATHS: Record<DashboardSection, string> = {
  overview: 'dashboard',
  expenses: 'dashboard/expenses',
  pantry: 'dashboard/pantry',
  'meal-plans': 'dashboard/mealplan',
  groceries: 'dashboard/grocery',
  nutrition: 'dashboard/nutrition',
};

function dashboardSectionFromPath(path: string | null): DashboardSection | null {
  switch (path) {
    case 'dashboard':
    case null:
      return 'overview';
    case 'overview':
      return 'overview';
    case 'expenses':
      return 'expenses';
    case 'pantry':
      return 'pantry';
    case 'mealplan':
    case 'meal-plan':
    case 'meal-plans':
      return 'meal-plans';
    case 'grocery':
    case 'groceries':
      return 'groceries';
    case 'nutrition':
      return 'nutrition';
    default:
      return null;
  }
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  imports: [DecimalPipe, IonContent, IonIcon, ReactiveFormsModule, UpperCasePipe],
})
export class DashboardPage implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly dataService = inject(NutriDormDataService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly user = signal<AuthUser | null>(null);
  readonly profile = signal<UserProfile | null>(null);
  readonly selectedSection = signal<DashboardSection>('overview');
  readonly expenses = signal<Expense[]>([]);
  readonly pantryItems = signal<PantryItem[]>([]);
  readonly mealPlans = signal<MealPlan[]>([]);
  readonly groceryItems = signal<GroceryItem[]>([]);
  readonly nutritionLogs = signal<NutritionLog[]>([]);
  readonly selectedEquipment = signal<Equipment[]>([]);
  readonly errorMessage = signal('');
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly isSavingMealCompletion = signal(false);
  readonly isBudgetFormOpen = signal(false);
  readonly isAccountPanelOpen = signal(false);
  readonly isPantryFormOpen = signal(false);
  readonly isGroceryFormOpen = signal(false);
  readonly selectedMealPlanId = signal<number | null>(null);
  readonly editingMealIndex = signal<number | null>(null);
  readonly editingExpenseId = signal<number | null>(null);
  readonly editingPantryId = signal<number | null>(null);
  readonly editingMealPlanId = signal<number | null>(null);
  readonly editingGroceryId = signal<number | null>(null);
  readonly editingNutritionId = signal<number | null>(null);
  readonly weekdays = WEEKDAYS;
  readonly isExpiringSoon = (item: PantryItem): boolean => {
    if (!item.expires_on || item.is_consumed) return false;
    const remaining = new Date(`${item.expires_on}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0);
    return remaining < 3 * 86400000;
  };

  readonly budgetForm = new FormGroup({
    weeklyAllowance: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0.01)] }),
  });
  readonly expenseForm = new FormGroup({
    amount: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0.01)] }),
    category: new FormControl('breakfast', { nonNullable: true, validators: [Validators.required] }),
    note: new FormControl('', { nonNullable: true }),
  });
  readonly pantryForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    quantity: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(0.01)] }),
    unit: new FormControl('piece', { nonNullable: true, validators: [Validators.required] }),
    category: new FormControl('', { nonNullable: true }),
    expiresOn: new FormControl('', { nonNullable: true }),
  });
  readonly mealPlanForm = new FormGroup({
    title: new FormControl('Weekly Meal Plan', { nonNullable: true, validators: [Validators.required] }),
    weekStart: new FormControl(new Date().toISOString().slice(0, 10), {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });
  readonly mealForm = new FormGroup({
    day: new FormControl('Monday', { nonNullable: true, validators: [Validators.required] }),
    category: new FormControl('breakfast', { nonNullable: true, validators: [Validators.required] }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    minutes: new FormControl(15, { nonNullable: true, validators: [Validators.min(1)] }),
    cost: new FormControl(0, { nonNullable: true, validators: [Validators.min(0)] }),
    ingredients: new FormControl('', { nonNullable: true }),
  });
  readonly groceryForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    quantity: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(0.01)] }),
    unit: new FormControl('piece', { nonNullable: true, validators: [Validators.required] }),
    estimatedPrice: new FormControl(0, { nonNullable: true, validators: [Validators.min(0)] }),
    category: new FormControl('', { nonNullable: true }),
  });
  readonly nutritionForm = new FormGroup({
    loggedOn: new FormControl(new Date().toISOString().slice(0, 10), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    mealName: new FormControl('', { nonNullable: true }),
    calories: new FormControl(0, { nonNullable: true, validators: [Validators.min(0)] }),
    protein: new FormControl(0, { nonNullable: true, validators: [Validators.min(0)] }),
    fiber: new FormControl(0, { nonNullable: true, validators: [Validators.min(0)] }),
  });

  constructor() {
    addIcons({
      addOutline,
      calendarOutline,
      checkmarkOutline,
      createOutline,
      cubeOutline,
      homeOutline,
      logOutOutline,
      nutritionOutline,
      personCircleOutline,
      receiptOutline,
      restaurantOutline,
      sparklesOutline,
      swapHorizontalOutline,
      trashOutline,
      walletOutline,
    });
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const section = dashboardSectionFromPath(params.get('section'));
      if (section) this.selectedSection.set(section);
      else void this.router.navigateByUrl('/dashboard');
    });

    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.user.set(user);
        this.loadProfile();
        this.loadExpenses();
        this.loadPantry();
        this.loadMealPlans();
        this.loadGroceries();
        this.loadNutrition();
      },
      error: (error: HttpErrorResponse) => this.handleLoadError(error),
    });
  }

  signOut(): void {
    this.authService.signOut();
    void this.router.navigateByUrl('/home');
  }

  switchAccount(): void {
    this.authService.signOut();
    void this.router.navigateByUrl('/home?mode=login');
  }

  toggleAccountPanel(): void {
    this.isAccountPanelOpen.update((open) => !open);
  }

  selectSection(section: DashboardSection): void {
    this.selectedSection.set(section);
    this.errorMessage.set('');
    const url = `/${SECTION_PATHS[section]}`;
    if (this.router.url !== url) void this.router.navigateByUrl(url);
  }

  toggleBudgetForm(): void {
    this.isBudgetFormOpen.update((open) => !open);
  }

  togglePantryForm(): void {
    this.isPantryFormOpen.update((open) => !open);
    if (this.isPantryFormOpen()) this.editingPantryId.set(null);
  }

  openPantryForm(): void {
    this.selectSection('pantry');
    this.editingPantryId.set(null);
    this.pantryForm.reset();
    this.isPantryFormOpen.set(true);
  }

  toggleGroceryForm(): void {
    this.isGroceryFormOpen.update((open) => !open);
    if (this.isGroceryFormOpen()) this.editingGroceryId.set(null);
  }

  groceryCategories(): string[] {
    return [...new Set(this.groceryItems().map((item) => item.category || 'Other'))];
  }

  groceriesInCategory(category: string): GroceryItem[] {
    return this.groceryItems().filter((item) => (item.category || 'Other') === category);
  }

  groceryTotal(): number {
    return this.groceryItems().reduce((sum, item) => sum + Number(item.estimated_price), 0);
  }

  mealIndex(meal: PlannedMeal): number {
    return this.plannedMeals().indexOf(meal);
  }

  spentThisWeek(): number {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    start.setHours(0, 0, 0, 0);
    return this.expenses()
      .filter((expense) => new Date(expense.spent_at).getTime() >= start.getTime())
      .reduce((sum, expense) => sum + Number(expense.amount), 0);
  }

  foodBudgetLeft(): number {
    return Math.max(0, Number(this.profile()?.food_budget ?? 0) - this.spentThisWeek());
  }

  plannedMeals(): PlannedMeal[] {
    const plan = this.currentMealPlan();
    const meals = plan?.plan_data['meals'];
    return Array.isArray(meals) ? meals.filter((meal): meal is PlannedMeal => this.isPlannedMeal(meal)) : [];
  }

  currentMealPlan(): MealPlan | null {
    const plans = this.mealPlans();
    return plans.find((plan) => plan.id === this.selectedMealPlanId()) ?? plans[0] ?? null;
  }

  plannedMealCost(): number {
    return this.plannedMeals().reduce((sum, meal) => sum + Number(meal.cost || 0), 0);
  }

  plannedBudgetPercent(): number {
    const budget = Number(this.profile()?.food_budget ?? 0);
    return budget ? Math.min(100, (this.plannedMealCost() / budget) * 100) : 0;
  }

  mealsForDay(day: string): PlannedMeal[] {
    return this.plannedMeals().filter((meal) => meal.day === day);
  }

  setMealCompleted(meal: PlannedMeal, event: Event): void {
    const target = event.target;
    const plan = this.currentMealPlan();
    if (!(target instanceof HTMLInputElement) || !plan || this.isSavingMealCompletion()) return;

    const index = this.plannedMeals().indexOf(meal);
    if (index < 0 || meal.isCompleted === target.checked) return;

    const meals = this.plannedMeals().map((item, mealIndex) =>
      mealIndex === index ? { ...item, isCompleted: target.checked } : item,
    );
    this.isSavingMealCompletion.set(true);
    this.dataService
      .updateMealPlan(plan.id, {
        title: plan.title,
        week_start: plan.week_start,
        plan_data: { ...plan.plan_data, meals },
      })
      .subscribe({
        next: (updated) => {
          this.mealPlans.update((plans) => plans.map((item) => (item.id === updated.id ? updated : item)));
          this.errorMessage.set('');
          this.isSavingMealCompletion.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.handleSaveError(error);
          this.isSavingMealCompletion.set(false);
        },
      });
  }

  dayTotal(day: string): number {
    return this.mealsForDay(day).reduce((sum, meal) => sum + Number(meal.cost || 0), 0);
  }

  currentDay(): string {
    return WEEKDAYS[(new Date().getDay() + 6) % 7];
  }

  isPantryExpired(item: PantryItem): boolean {
    return !!item.expires_on && item.expires_on < new Date().toISOString().slice(0, 10);
  }

  pantryExpiryLabel(item: PantryItem): string {
    if (!item.expires_on) return 'No expiry date';
    const remaining = Math.ceil(
      (new Date(`${item.expires_on}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000,
    );
    if (remaining < 0) return 'EXPIRED';
    if (remaining === 0) return 'Use today';
    return `${remaining} day${remaining === 1 ? '' : 's'} left`;
  }

  createBudgetPlan(): void {
    if (this.plannedMeals().length) {
      this.errorMessage.set('This plan already contains meals. Create a new weekly plan before auto-filling it.');
      return;
    }
    const meals: PlannedMeal[] = WEEKDAYS.flatMap((day) => [
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
        category: 'lunch',
        name: 'Canned Tuna & Garlic Pasta',
        minutes: 15,
        cost: 65,
        ingredients: 'Canned Tuna:45, Pasta:15, Garlic:5',
      },
      {
        day,
        category: 'dinner',
        name: 'Healthy Monggo Soup',
        minutes: 25,
        cost: 45,
        ingredients: 'Mung Beans:25, Malunggay:10, Onion:10',
      },
    ]);
    const existing = this.currentMealPlan();
    const payload = {
      title: 'Weekly Budget Meal Plan',
      week_start: this.mealPlanForm.controls.weekStart.value,
      plan_data: { meals },
    };
    const request = existing
      ? this.dataService.updateMealPlan(existing.id, payload)
      : this.dataService.createMealPlan(payload);
    request.subscribe({
      next: (plan) => {
        this.selectedMealPlanId.set(plan.id);
        this.mealPlans.update((plans) =>
          existing ? plans.map((item) => (item.id === plan.id ? plan : item)) : [plan, ...plans],
        );
      },
      error: (error: HttpErrorResponse) => this.handleSaveError(error),
    });
  }

  saveMealEntry(): void {
    const plan = this.currentMealPlan();
    if (!plan) {
      this.errorMessage.set('Create a weekly meal plan before adding meals.');
      return;
    }
    if (this.mealForm.invalid) {
      this.mealForm.markAllAsTouched();
      return;
    }
    const value = this.mealForm.getRawValue();
    const entry: PlannedMeal = { ...value };
    const meals = [...this.plannedMeals()];
    const editIndex = this.editingMealIndex();
    if (editIndex === null) meals.push(entry);
    else meals[editIndex] = { ...entry, isCompleted: meals[editIndex]?.isCompleted };
    this.persistMealEntries(plan, meals);
  }

  editMealEntry(index: number): void {
    const item = this.plannedMeals()[index];
    if (!item) return;
    this.editingMealIndex.set(index);
    this.mealForm.setValue({
      day: item.day,
      category: item.category,
      name: item.name,
      minutes: item.minutes,
      cost: item.cost,
      ingredients: item.ingredients,
    });
    this.selectSection('meal-plans');
  }

  deleteMealEntry(index: number): void {
    const plan = this.currentMealPlan();
    if (!plan) return;
    this.persistMealEntries(
      plan,
      this.plannedMeals().filter((_, itemIndex) => itemIndex !== index),
    );
  }

  selectMealPlan(id: number): void {
    this.selectedMealPlanId.set(id);
    this.editingMealIndex.set(null);
    this.mealForm.reset();
  }

  togglePantryItem(item: PantryItem): void {
    this.dataService
      .updatePantryItem(item.id, {
        name: item.name,
        quantity: Number(item.quantity),
        unit: item.unit,
        category: item.category,
        expires_on: item.expires_on,
        is_consumed: !item.is_consumed,
      })
      .subscribe({
        next: () => this.loadPantry(),
        error: (error: HttpErrorResponse) => this.handleSaveError(error),
      });
  }

  isEquipmentSelected(equipment: Equipment): boolean {
    return this.selectedEquipment().includes(equipment);
  }

  toggleEquipment(equipment: Equipment): void {
    this.selectedEquipment.update((selected) =>
      selected.includes(equipment) ? selected.filter((item) => item !== equipment) : [...selected, equipment],
    );
  }

  saveBudget(): void {
    if (this.budgetForm.invalid) {
      this.budgetForm.markAllAsTouched();
      this.errorMessage.set('Please enter a weekly allowance greater than ₱0.');
      return;
    }

    this.isSaving.set(true);
    const { weeklyAllowance } = this.budgetForm.getRawValue();
    this.authService
      .updateProfile({
        weekly_allowance: Number(weeklyAllowance),
        equipment: this.selectedEquipment(),
      })
      .subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.isSaving.set(false);
          this.isBudgetFormOpen.set(false);
          this.errorMessage.set('');
        },
        error: (error: HttpErrorResponse) => {
          this.isSaving.set(false);
          this.handleSaveError(error);
        },
      });
  }

  saveExpense(): void {
    if (this.expenseForm.invalid) {
      this.expenseForm.markAllAsTouched();
      return;
    }
    const id = this.editingExpenseId();
    const request = this.expenseForm.getRawValue();
    const payload = { ...request, note: request.note || null };
    const operation = id ? this.dataService.updateExpense(id, payload) : this.dataService.createExpense(payload);
    this.saveList(operation, this.loadExpenses, this.editingExpenseId, this.expenseForm);
  }

  editExpense(item: Expense): void {
    this.editingExpenseId.set(item.id);
    this.expenseForm.setValue({ amount: Number(item.amount), category: item.category, note: item.note ?? '' });
  }

  deleteExpense(id: number): void {
    this.dataService.deleteExpense(id).subscribe({
      next: () => this.loadExpenses(),
      error: (error: HttpErrorResponse) => this.handleSaveError(error),
    });
  }

  savePantryItem(): void {
    if (this.pantryForm.invalid) {
      this.pantryForm.markAllAsTouched();
      return;
    }
    const id = this.editingPantryId();
    const value = this.pantryForm.getRawValue();
    const payload = {
      name: value.name,
      quantity: value.quantity,
      unit: value.unit,
      category: value.category || null,
      expires_on: value.expiresOn || null,
      is_consumed: this.editingPantryId()
        ? (this.pantryItems().find((item) => item.id === this.editingPantryId())?.is_consumed ?? false)
        : false,
    };
    const operation = id ? this.dataService.updatePantryItem(id, payload) : this.dataService.createPantryItem(payload);
    this.saveList(operation, this.loadPantry, this.editingPantryId, this.pantryForm);
  }

  editPantryItem(item: PantryItem): void {
    this.isPantryFormOpen.set(true);
    this.editingPantryId.set(item.id);
    this.pantryForm.setValue({
      name: item.name,
      quantity: Number(item.quantity),
      unit: item.unit,
      category: item.category ?? '',
      expiresOn: item.expires_on ?? '',
    });
  }

  deletePantryItem(id: number): void {
    this.dataService.deletePantryItem(id).subscribe({
      next: () => this.loadPantry(),
      error: (error: HttpErrorResponse) => this.handleSaveError(error),
    });
  }

  saveMealPlan(): void {
    if (this.mealPlanForm.invalid) {
      this.mealPlanForm.markAllAsTouched();
      return;
    }
    const id = this.editingMealPlanId();
    const value = this.mealPlanForm.getRawValue();
    const current = id ? this.mealPlans().find((plan) => plan.id === id) : null;
    const payload = {
      title: value.title,
      week_start: value.weekStart,
      plan_data: current?.plan_data ?? { meals: [] },
    };
    const operation = id ? this.dataService.updateMealPlan(id, payload) : this.dataService.createMealPlan(payload);
    operation.subscribe({
      next: (plan) => {
        this.editingMealPlanId.set(null);
        this.selectedMealPlanId.set(plan.id);
        this.mealPlanForm.reset();
        this.mealPlans.update((plans) =>
          id ? plans.map((item) => (item.id === plan.id ? plan : item)) : [plan, ...plans],
        );
        this.errorMessage.set('');
      },
      error: (error: HttpErrorResponse) => this.handleSaveError(error),
    });
  }

  editMealPlan(item: MealPlan): void {
    this.editingMealPlanId.set(item.id);
    this.selectedMealPlanId.set(item.id);
    this.mealPlanForm.setValue({ title: item.title, weekStart: item.week_start });
  }

  deleteMealPlan(id: number): void {
    this.dataService.deleteMealPlan(id).subscribe({
      next: () => {
        this.loadMealPlans();
        this.loadGroceries();
      },
      error: (error: HttpErrorResponse) => this.handleSaveError(error),
    });
  }

  saveGroceryItem(): void {
    if (this.groceryForm.invalid) {
      this.groceryForm.markAllAsTouched();
      return;
    }
    const id = this.editingGroceryId();
    const value = this.groceryForm.getRawValue();
    const payload = {
      name: value.name,
      quantity: value.quantity,
      unit: value.unit,
      estimated_price: value.estimatedPrice,
      category: value.category || null,
    };
    const operation = id
      ? this.dataService.updateGroceryItem(id, payload)
      : this.dataService.createGroceryItem(payload);
    this.saveList(operation, this.loadGroceries, this.editingGroceryId, this.groceryForm);
  }

  editGroceryItem(item: GroceryItem): void {
    this.isGroceryFormOpen.set(true);
    this.editingGroceryId.set(item.id);
    this.groceryForm.setValue({
      name: item.name,
      quantity: Number(item.quantity),
      unit: item.unit,
      estimatedPrice: Number(item.estimated_price),
      category: item.category ?? '',
    });
  }

  toggleGroceryItem(item: GroceryItem): void {
    this.dataService.setGroceryItemChecked(item.id, !item.is_checked).subscribe({
      next: () => this.loadGroceries(),
      error: (error: HttpErrorResponse) => this.handleSaveError(error),
    });
  }

  deleteGroceryItem(id: number): void {
    this.dataService.deleteGroceryItem(id).subscribe({
      next: () => this.loadGroceries(),
      error: (error: HttpErrorResponse) => this.handleSaveError(error),
    });
  }

  saveNutritionLog(): void {
    if (this.nutritionForm.invalid) {
      this.nutritionForm.markAllAsTouched();
      return;
    }
    const id = this.editingNutritionId();
    const value = this.nutritionForm.getRawValue();
    const payload = {
      logged_on: value.loggedOn,
      meal_name: value.mealName || null,
      calories: value.calories,
      protein_g: value.protein,
      fiber_g: value.fiber,
    };
    const operation = id
      ? this.dataService.updateNutritionLog(id, payload)
      : this.dataService.createNutritionLog(payload);
    this.saveList(operation, this.loadNutrition, this.editingNutritionId, this.nutritionForm);
  }

  editNutritionLog(item: NutritionLog): void {
    this.editingNutritionId.set(item.id);
    this.nutritionForm.setValue({
      loggedOn: item.logged_on,
      mealName: item.meal_name ?? '',
      calories: Number(item.calories),
      protein: Number(item.protein_g),
      fiber: Number(item.fiber_g),
    });
  }

  deleteNutritionLog(id: number): void {
    this.dataService.deleteNutritionLog(id).subscribe({
      next: () => this.loadNutrition(),
      error: (error: HttpErrorResponse) => this.handleSaveError(error),
    });
  }

  cancelEdit(editingId: WritableSignal<number | null>, form: FormGroup): void {
    editingId.set(null);
    form.reset();
  }

  private loadProfile(): void {
    this.authService.getProfile().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.selectedEquipment.set(profile.equipment as Equipment[]);
        this.isBudgetFormOpen.set(profile.weekly_allowance === null);
        this.budgetForm.setValue({ weeklyAllowance: Number(profile.weekly_allowance ?? 0) });
        this.isLoading.set(false);
      },
      error: (error: HttpErrorResponse) => this.handleLoadError(error),
    });
  }

  private readonly loadExpenses = (): void => {
    this.dataService.listExpenses().subscribe({
      next: (items) => this.expenses.set(items),
      error: (error: HttpErrorResponse) => this.handleSaveError(error),
    });
  };

  private readonly loadPantry = (): void => {
    this.dataService.listPantryItems().subscribe({
      next: (items) => this.pantryItems.set(items),
      error: (error: HttpErrorResponse) => this.handleSaveError(error),
    });
  };

  private readonly loadMealPlans = (): void => {
    this.dataService.listMealPlans().subscribe({
      next: (items) => {
        this.mealPlans.set(items);
        if (!items.some((item) => item.id === this.selectedMealPlanId())) {
          this.selectedMealPlanId.set(items[0]?.id ?? null);
        }
      },
      error: (error: HttpErrorResponse) => this.handleSaveError(error),
    });
  };

  private readonly loadGroceries = (): void => {
    this.dataService.listGroceryItems().subscribe({
      next: (items) => this.groceryItems.set(items),
      error: (error: HttpErrorResponse) => this.handleSaveError(error),
    });
  };

  private readonly loadNutrition = (): void => {
    this.dataService.listNutritionLogs().subscribe({
      next: (items) => this.nutritionLogs.set(items),
      error: (error: HttpErrorResponse) => this.handleSaveError(error),
    });
  };

  private saveList<T>(
    operation: Observable<T>,
    reload: () => void,
    editingId: WritableSignal<number | null>,
    form: FormGroup,
  ): void {
    operation.subscribe({
      next: () => {
        editingId.set(null);
        form.reset();
        this.errorMessage.set('');
        reload();
      },
      error: (error: HttpErrorResponse) => this.handleSaveError(error),
    });
  }

  private persistMealEntries(plan: MealPlan, meals: PlannedMeal[]): void {
    this.dataService
      .updateMealPlan(plan.id, {
        title: plan.title,
        week_start: plan.week_start,
        plan_data: { ...plan.plan_data, meals },
      })
      .subscribe({
        next: (updated) => {
          this.mealPlans.update((plans) => plans.map((item) => (item.id === updated.id ? updated : item)));
          this.editingMealIndex.set(null);
          this.mealForm.reset();
          this.errorMessage.set('');
        },
        error: (error: HttpErrorResponse) => this.handleSaveError(error),
      });
  }

  private isPlannedMeal(value: unknown): value is PlannedMeal {
    if (typeof value !== 'object' || value === null) return false;
    const meal = value as Partial<PlannedMeal>;
    return (
      typeof meal.day === 'string' &&
      typeof meal.category === 'string' &&
      typeof meal.name === 'string' &&
      typeof meal.minutes === 'number' &&
      typeof meal.cost === 'number' &&
      typeof meal.ingredients === 'string' &&
      (meal.isCompleted === undefined || typeof meal.isCompleted === 'boolean')
    );
  }

  private handleSaveError(error: HttpErrorResponse): void {
    if (error.status === 401) {
      this.handleLoadError(error);
      return;
    }
    if (error.status === 0) {
      this.errorMessage.set('Cannot connect to the NutriDorm API. Check that the backend is running.');
      return;
    }

    const detail: unknown = error.error?.detail;
    if (Array.isArray(detail)) {
      const validationMessages = detail
        .map((item: unknown) => {
          if (typeof item !== 'object' || item === null || !('msg' in item)) return '';
          const field = 'loc' in item && Array.isArray(item.loc) ? item.loc.at(-1) : null;
          return `${typeof field === 'string' ? `${field.replaceAll('_', ' ')}: ` : ''}${String(item.msg)}`;
        })
        .filter(Boolean);
      this.errorMessage.set(
        validationMessages.length
          ? `Could not save: ${validationMessages.join('; ')}`
          : 'The API rejected the budget details. Check the values and try again.',
      );
      return;
    }
    if (typeof detail === 'string' && error.status < 500) {
      this.errorMessage.set(`Could not save: ${detail}`);
      return;
    }
    this.errorMessage.set('Could not save your changes. Please check that the database is available and try again.');
  }

  private handleLoadError(error: HttpErrorResponse): void {
    this.isLoading.set(false);

    if (error.status === 401) {
      this.authService.signOut();
      const returnUrl = encodeURIComponent(this.router.url);
      void this.router.navigateByUrl(`/home?mode=login&returnUrl=${returnUrl}`, { replaceUrl: true });
      return;
    }

    this.errorMessage.set(
      error.status === 0
        ? 'Cannot connect to the NutriDorm API. Check that the backend is running.'
        : 'Could not load your dashboard. Please try again.',
    );
  }
}
