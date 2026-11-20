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
        emergency_fund_percent: '10.00',
        food_budget: '900.00',
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
  await expect(page.getByText('₱900.00')).toBeVisible();
});
