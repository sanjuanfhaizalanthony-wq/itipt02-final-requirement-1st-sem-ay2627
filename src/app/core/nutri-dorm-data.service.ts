import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export interface Expense {
  id: number;
  amount: string;
  category: string;
  note: string | null;
  spent_at: string;
}

export interface ExpenseInput {
  amount: number;
  category: string;
  note?: string | null;
  spent_at?: string;
}

export interface PantryItem {
  id: number;
  user_id: number;
  name: string;
  quantity: string;
  unit: string;
  category: string | null;
  expires_on: string | null;
  is_consumed: boolean;
  created_at: string;
}

export interface PantryItemInput {
  name: string;
  quantity: number;
  unit: string;
  category?: string | null;
  expires_on?: string | null;
  is_consumed: boolean;
}

export interface MealPlan {
  id: number;
  user_id: number;
  week_start: string;
  title: string;
  plan_data: Record<string, unknown>;
  created_at: string;
}

export interface MealPlanInput {
  week_start: string;
  title: string;
  plan_data: Record<string, unknown>;
}

export interface GroceryItem {
  id: number;
  user_id: number;
  meal_plan_id: number | null;
  name: string;
  quantity: string;
  unit: string;
  estimated_price: string;
  category: string | null;
  is_checked: boolean;
  created_at: string;
}

export interface GroceryItemInput {
  meal_plan_id?: number | null;
  name: string;
  quantity: number;
  unit: string;
  estimated_price: number;
  category?: string | null;
}

export interface NutritionLog {
  id: number;
  user_id: number;
  logged_on: string;
  meal_name: string | null;
  calories: string;
  protein_g: string;
  fiber_g: string;
  created_at: string;
}

export interface NutritionLogInput {
  logged_on: string;
  meal_name?: string | null;
  calories: number;
  protein_g: number;
  fiber_g: number;
}

@Injectable({ providedIn: 'root' })
export class NutriDormDataService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiBaseUrl;

  listExpenses(): Observable<Expense[]> {
    return this.http.get<Expense[]>(`${this.apiUrl}/api/expenses`);
  }

  createExpense(payload: ExpenseInput): Observable<Expense> {
    return this.http.post<Expense>(`${this.apiUrl}/api/expenses`, payload);
  }

  updateExpense(id: number, payload: ExpenseInput): Observable<Expense> {
    return this.http.put<Expense>(`${this.apiUrl}/api/expenses/${id}`, payload);
  }

  deleteExpense(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/expenses/${id}`);
  }

  listPantryItems(): Observable<PantryItem[]> {
    return this.http.get<PantryItem[]>(`${this.apiUrl}/api/pantry`);
  }

  createPantryItem(payload: PantryItemInput): Observable<PantryItem> {
    return this.http.post<PantryItem>(`${this.apiUrl}/api/pantry`, payload);
  }

  updatePantryItem(id: number, payload: PantryItemInput): Observable<PantryItem> {
    return this.http.patch<PantryItem>(`${this.apiUrl}/api/pantry/${id}`, payload);
  }

  deletePantryItem(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/pantry/${id}`);
  }

  listMealPlans(): Observable<MealPlan[]> {
    return this.http.get<MealPlan[]>(`${this.apiUrl}/api/meal-plans`);
  }

  createMealPlan(payload: MealPlanInput): Observable<MealPlan> {
    return this.http.post<MealPlan>(`${this.apiUrl}/api/meal-plans`, payload);
  }

  updateMealPlan(id: number, payload: MealPlanInput): Observable<MealPlan> {
    return this.http.put<MealPlan>(`${this.apiUrl}/api/meal-plans/${id}`, payload);
  }

  deleteMealPlan(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/meal-plans/${id}`);
  }

  listGroceryItems(): Observable<GroceryItem[]> {
    return this.http.get<GroceryItem[]>(`${this.apiUrl}/api/grocery-items`);
  }

  createGroceryItem(payload: GroceryItemInput): Observable<GroceryItem> {
    return this.http.post<GroceryItem>(`${this.apiUrl}/api/grocery-items`, payload);
  }

  updateGroceryItem(id: number, payload: GroceryItemInput): Observable<GroceryItem> {
    return this.http.put<GroceryItem>(`${this.apiUrl}/api/grocery-items/${id}`, payload);
  }

  setGroceryItemChecked(id: number, isChecked: boolean): Observable<GroceryItem> {
    return this.http.patch<GroceryItem>(`${this.apiUrl}/api/grocery-items/${id}`, { is_checked: isChecked });
  }

  deleteGroceryItem(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/grocery-items/${id}`);
  }

  listNutritionLogs(loggedOn?: string): Observable<NutritionLog[]> {
    let params = new HttpParams();
    if (loggedOn) {
      params = params.set('logged_on', loggedOn);
    }
    return this.http.get<NutritionLog[]>(`${this.apiUrl}/api/nutrition-logs`, { params });
  }

  createNutritionLog(payload: NutritionLogInput): Observable<NutritionLog> {
    return this.http.post<NutritionLog>(`${this.apiUrl}/api/nutrition-logs`, payload);
  }

  updateNutritionLog(id: number, payload: NutritionLogInput): Observable<NutritionLog> {
    return this.http.put<NutritionLog>(`${this.apiUrl}/api/nutrition-logs/${id}`, payload);
  }

  deleteNutritionLog(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/nutrition-logs/${id}`);
  }
}
