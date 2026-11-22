import { expect, test } from '@playwright/test';

test('visits the app root url', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
});

test('creates an account and opens the personal dashboard', async ({ page }) => {
  await page.route('**/api/auth/register', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'e2e-test-token',
        token_type: 'bearer',
        user: {
          id: 1,
          full_name: 'Alex Santos',
          dorm_name: 'San Leonardo Dorm',
          email: 'alex@example.com',
        },
      }),
    }),
  );
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: 1,
        full_name: 'Alex Santos',
        dorm_name: 'San Leonardo Dorm',
        email: 'alex@example.com',
      }),
    }),
  );
  await page.route('**/api/profile', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        weekly_allowance: '1000.00',
        food_budget: '1000.00',
        daily_meal_budget_cap: '142.86',
        equipment: ['rice_cooker'],
      }),
    }),
  );
  await Promise.all(
    ['expenses', 'pantry', 'meal-plans', 'grocery-items', 'nutrition-logs'].map((resource) =>
      page.route(`**/api/${resource}`, (route) =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) }),
      ),
    ),
  );

  await page.goto('/');
  await page.getByLabel('Full name').fill('Alex Santos');
  await page.getByLabel('Dormitory name or location').fill('San Leonardo Dorm');
  await page.getByLabel('Email address').fill('alex@example.com');
  await page.getByLabel('Password', { exact: true }).fill('secure-pass-123');
  await page.getByLabel('Confirm password').fill('secure-pass-123');
  await page.getByRole('button', { name: 'Create Dorm Account' }).click();

  await expect(page.getByRole('heading', { name: 'Weekly Budget Tracker' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await expect(page.locator('.budget-main .allowance')).toHaveText('₱1000.00');
  await expect(page.getByText('Emergency fund', { exact: false })).toHaveCount(0);
});

test('opens meal plan, grocery and pantry from their direct URLs', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('nutridorm_access_token', 'e2e-test-token'));
  await page.route('**/api/**', (route) => {
    const responses: Record<string, unknown> = {
      '/api/auth/me': {
        id: 1,
        full_name: 'Alex Santos',
        dorm_name: 'San Leonardo Dorm',
        email: 'alex@example.com',
      },
      '/api/profile': {
        weekly_allowance: '1000.00',
        food_budget: '1000.00',
        daily_meal_budget_cap: '142.86',
        equipment: [],
      },
    };
    const pathname = new URL(route.request().url()).pathname;
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(responses[pathname] ?? []),
    });
  });

  const sections = [
    { path: '/mealplan', canonicalPath: '/dashboard/mealplan', heading: 'Weekly Meal Planner' },
    { path: '/grocery', canonicalPath: '/dashboard/grocery', heading: 'Grocery List' },
    { path: '/pantry', canonicalPath: '/dashboard/pantry', heading: 'Pantry & Expiration Tracker' },
  ];

  for (const section of sections) {
    await page.goto(section.path);
    await expect(page).toHaveURL(new RegExp(`${section.canonicalPath}$`));
    await expect(page.getByRole('heading', { name: section.heading })).toBeVisible();
  }
});

test('returns to the requested section after signing in from a direct URL', async ({ page }) => {
  let currentUserRequests = 0;
  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/auth/me') {
      currentUserRequests += 1;
      if (currentUserRequests === 1) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: '{"detail":"Unauthorized"}',
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          full_name: 'Alex Santos',
          dorm_name: 'San Leonardo Dorm',
          email: 'alex@example.com',
        }),
      });
      return;
    }
    if (pathname === '/api/auth/login') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'e2e-test-token',
          token_type: 'bearer',
          user: {
            id: 1,
            full_name: 'Alex Santos',
            dorm_name: 'San Leonardo Dorm',
            email: 'alex@example.com',
          },
        }),
      });
      return;
    }
    if (pathname === '/api/profile') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          weekly_allowance: '1000.00',
          food_budget: '1000.00',
          daily_meal_budget_cap: '142.86',
          equipment: [],
        }),
      });
      return;
    }
    await route.fulfill({ contentType: 'application/json', body: '[]' });
  });

  await page.goto('/mealplan');
  await expect(page).toHaveURL(/\/home\?mode=login&returnUrl=%2Fdashboard%2Fmealplan$/);
  await page.getByLabel('Email address').fill('alex@example.com');
  await page.getByLabel('Password', { exact: true }).fill('secure-pass-123');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page).toHaveURL(/\/dashboard\/mealplan$/);
  await expect(page.getByRole('heading', { name: 'Weekly Meal Planner' })).toBeVisible();
});
