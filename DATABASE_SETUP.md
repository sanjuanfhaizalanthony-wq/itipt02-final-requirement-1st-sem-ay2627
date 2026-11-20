# NutriDorm database and API

## Start the local API

1. Start MySQL from XAMPP.
2. From the project root, copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell). Set `DATABASE_URL` to your MySQL username and password. Change `JWT_SECRET` to a private, random value of at least 32 characters. Do not commit `.env`.
3. Make sure the XAMPP PHP CLI has the `pdo_mysql`, `openssl`, and `mbstring` extensions enabled. Create/activate a Python virtual environment, install Uvicorn, and start the API from the project root:

   ```powershell
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install -r requirements.txt
   python -m uvicorn main:app --reload
   ```

Uvicorn serves the API on `http://127.0.0.1:8000` and automatically starts the PHP API internally on `127.0.0.1:8001`. The PHP API uses the XAMPP-provided PDO MySQL extension and PHP built-ins; it does not require Composer packages. It connects to `nutridorm_db` and creates its tables from [`database/schema.sql`](./database/schema.sql) when the API receives a request. It does not add fake/sample users. Keep the Uvicorn terminal open while using the app; stopping Uvicorn also stops its PHP API process.

Open `http://127.0.0.1:8000/` for the API welcome page and `http://127.0.0.1:8000/api/health` to verify the database connection.

## Data stored

- `users`: name, dorm, unique email, salted password hash, and creation time.
- `user_profiles`: weekly allowance, emergency-fund percentage, and dorm equipment.
- `expenses`: meal/spending amounts, category, note, and date.
- `pantry_items`: ingredient quantity, unit, category, expiry, and consumed status.
- `meal_plans`: week, title, and the selected meal-plan data.
- `grocery_items`: shopping item, quantity, estimated price, category, meal-plan link, and checked status.
- `nutrition_logs`: meal/date and calories, protein, and fiber.

User-owned API records are scoped to the signed-in user. Registration and login return a bearer token; authenticated requests send it in the `Authorization` header.

The Ionic app uses the local API at `http://127.0.0.1:8000` in development and production. Keep Uvicorn and MySQL running while creating accounts or signing in; account credentials are stored in the MySQL `users` table.

The REST API provides create, list, update, and delete operations for expenses, pantry items, meal plans, grocery items, and nutrition logs. The corresponding typed Angular HTTP methods are in [`src/app/core/nutri-dorm-data.service.ts`](./src/app/core/nutri-dorm-data.service.ts).

For the phpMyAdmin/XAMPP default `root` account with no password, use:

```text
DATABASE_URL=mysql://root:@127.0.0.1:3306/nutridorm_db
```

If your MySQL root account has a password, put the password after `root:` instead.
