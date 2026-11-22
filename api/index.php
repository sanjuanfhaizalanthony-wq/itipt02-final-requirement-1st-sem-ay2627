<?php
declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0');

function load_environment(string $path): void
{
    if (!is_file($path)) {
        return;
    }

    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }
        [$name, $value] = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value);
        if ($name !== '' && getenv($name) === false) {
            if (strlen($value) >= 2 && (($value[0] === '"' && str_ends_with($value, '"')) || ($value[0] === "'" && str_ends_with($value, "'")))) {
                $value = substr($value, 1, -1);
            }
            putenv("$name=$value");
            $_ENV[$name] = $value;
        }
    }
}

function env_value(string $name, string $default = ''): string
{
    $value = getenv($name);
    return $value === false ? $default : $value;
}

function respond(mixed $value, int $status = 200): never
{
    http_response_code($status);
    if ($status !== 204) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }
    exit;
}

function fail_request(int $status, string $message): never
{
    respond(['detail' => $message], $status);
}

function json_body(): array
{
    $raw = file_get_contents('php://input');
    try {
        $value = json_decode($raw === false ? '' : $raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        fail_request(422, 'Request body must contain valid JSON.');
    }
    if (!is_array($value)) {
        fail_request(422, 'Request body must be a JSON object.');
    }
    return $value;
}

function required_string(array $data, string $key, int $minLength, int $maxLength, bool $trim = false): string
{
    $value = $data[$key] ?? null;
    if (!is_string($value)) {
        fail_request(422, "$key must be a string.");
    }
    if ($trim) {
        $value = trim($value);
    }
    $length = mb_strlen($value, 'UTF-8');
    if ($length < $minLength || $length > $maxLength) {
        fail_request(422, "$key must be between $minLength and $maxLength characters.");
    }
    return $value;
}

function optional_string(array $data, string $key, int $maxLength): ?string
{
    $value = $data[$key] ?? null;
    if ($value === null) {
        return null;
    }
    if (!is_string($value) || mb_strlen($value, 'UTF-8') > $maxLength) {
        fail_request(422, "$key must be a string of at most $maxLength characters or null.");
    }
    return $value;
}

function decimal_value(mixed $value, string $field, int $maxDigits, int $decimalPlaces, bool $allowZero): string
{
    if (!is_string($value) && !is_int($value) && !is_float($value)) {
        fail_request(422, "$field must be a number.");
    }
    $value = (string) $value;
    if (!preg_match('/^\d+(?:\.\d+)?$/', $value)) {
        fail_request(422, "$field must be a valid non-negative number.");
    }
    [$whole, $fraction] = array_pad(explode('.', $value, 2), 2, '');
    if (strlen(ltrim($whole, '0')) + strlen($fraction) > $maxDigits || strlen($fraction) > $decimalPlaces) {
        fail_request(422, "$field has too many digits.");
    }
    if (!$allowZero && (float) $value <= 0) {
        fail_request(422, "$field must be greater than zero.");
    }
    return number_format((float) $value, $decimalPlaces, '.', '');
}

function date_value(mixed $value, string $field, bool $allowNull = false): ?string
{
    if ($value === null && $allowNull) {
        return null;
    }
    if (!is_string($value)) {
        fail_request(422, "$field must be a valid date.");
    }
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value) {
        fail_request(422, "$field must be a valid date.");
    }
    return $value;
}

function datetime_value(mixed $value, string $field): ?string
{
    if ($value === null) {
        return null;
    }
    if (!is_string($value)) {
        fail_request(422, "$field must be a valid date and time.");
    }
    try {
        return (new DateTimeImmutable($value))->format('Y-m-d H:i:s');
    } catch (Exception) {
        fail_request(422, "$field must be a valid date and time.");
    }
}

function base64url_encode(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function base64url_decode(string $value): string|false
{
    $padded = strtr($value, '-_', '+/');
    return base64_decode($padded . str_repeat('=', (4 - strlen($padded) % 4) % 4), true);
}

function make_token(int $userId, string $secret, int $hours): string
{
    $now = time();
    $header = base64url_encode('{"alg":"HS256","typ":"JWT"}');
    $payload = base64url_encode(json_encode(['sub' => (string) $userId, 'iat' => $now, 'exp' => $now + $hours * 3600], JSON_THROW_ON_ERROR));
    $unsigned = "$header.$payload";
    return $unsigned . '.' . base64url_encode(hash_hmac('sha256', $unsigned, $secret, true));
}

function token_user_id(string $secret): int
{
    $authorization = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (strtolower($name) === 'authorization') {
                $authorization = $value;
                break;
            }
        }
    }
    if (!preg_match('/^Bearer\s+(\S+)$/i', $authorization, $matches)) {
        header('WWW-Authenticate: Bearer');
        fail_request(401, 'Not authenticated.');
    }

    $parts = explode('.', $matches[1]);
    if (count($parts) !== 3) {
        header('WWW-Authenticate: Bearer');
        fail_request(401, 'Invalid or expired access token.');
    }
    [$headerPart, $payloadPart, $signature] = $parts;
    $header = base64url_decode($headerPart);
    $payload = base64url_decode($payloadPart);
    $actualSignature = base64url_decode($signature);
    $expectedSignature = hash_hmac('sha256', "$headerPart.$payloadPart", $secret, true);
    $headerData = $header === false ? null : json_decode($header, true);
    $payloadData = $payload === false ? null : json_decode($payload, true);
    if (
        $actualSignature === false
        || !hash_equals($expectedSignature, $actualSignature)
        || !is_array($headerData)
        || ($headerData['alg'] ?? null) !== 'HS256'
        || !is_array($payloadData)
        || !isset($payloadData['sub'], $payloadData['exp'])
        || !ctype_digit((string) $payloadData['sub'])
        || (int) $payloadData['exp'] <= time()
    ) {
        header('WWW-Authenticate: Bearer');
        fail_request(401, 'Invalid or expired access token.');
    }
    return (int) $payloadData['sub'];
}

function password_hash_compatible(string $password): string
{
    $salt = random_bytes(16);
    $rounds = 600000;
    $digest = hash_pbkdf2('sha256', $password, $salt, $rounds, 64);
    return 'pbkdf2_sha256$' . $rounds . '$' . bin2hex($salt) . '$' . $digest;
}

function password_matches(string $password, string $stored): bool
{
    $parts = explode('$', $stored);
    if (count($parts) !== 4 || $parts[0] !== 'pbkdf2_sha256' || !ctype_digit($parts[1])) {
        return false;
    }
    $salt = hex2bin($parts[2]);
    if ($salt === false) {
        return false;
    }
    return hash_equals($parts[3], hash_pbkdf2('sha256', $password, $salt, (int) $parts[1], 64));
}

function user_response(array $user): array
{
    return [
        'id' => (int) $user['id'],
        'full_name' => $user['full_name'],
        'dorm_name' => $user['dorm_name'],
        'email' => $user['email'],
    ];
}

function profile_response(PDO $db, int $userId): array
{
    $query = $db->prepare('SELECT weekly_allowance, emergency_fund_percent, equipment FROM user_profiles WHERE user_id = ?');
    $query->execute([$userId]);
    $profile = $query->fetch();
    if (!$profile) {
        $db->prepare('INSERT INTO user_profiles (user_id, emergency_fund_percent, equipment) VALUES (?, ?, ?)')
            ->execute([$userId, '10.00', '[]']);
        $profile = ['weekly_allowance' => null, 'emergency_fund_percent' => '10.00', 'equipment' => '[]'];
    }
    $allowance = $profile['weekly_allowance'];
    $emergency = (string) $profile['emergency_fund_percent'];
    $foodBudget = $allowance === null ? null : number_format((float) $allowance, 2, '.', '');
    return [
        'weekly_allowance' => $allowance,
        'emergency_fund_percent' => $emergency,
        'equipment' => json_decode((string) $profile['equipment'], true, 512, JSON_THROW_ON_ERROR),
        'food_budget' => $foodBudget,
        'daily_meal_budget_cap' => $foodBudget === null ? null : number_format((float) $foodBudget / 7, 2, '.', ''),
    ];
}

function record_row(PDO $db, string $table, int $id, int $userId): array
{
    $query = $db->prepare("SELECT * FROM `$table` WHERE id = ? AND user_id = ?");
    $query->execute([$id, $userId]);
    $row = $query->fetch();
    if (!$row) {
        fail_request(404, 'Record not found.');
    }
    foreach (['is_consumed', 'is_checked'] as $booleanField) {
        if (array_key_exists($booleanField, $row)) {
            $row[$booleanField] = (bool) $row[$booleanField];
        }
    }
    if (isset($row['plan_data'])) {
        $row['plan_data'] = json_decode((string) $row['plan_data'], true, 512, JSON_THROW_ON_ERROR);
    }
    foreach (['id', 'user_id', 'meal_plan_id'] as $integerField) {
        if (isset($row[$integerField])) {
            $row[$integerField] = (int) $row[$integerField];
        }
    }
    return $row;
}

function validate_record(string $resource, array $data, string $method): array
{
    if ($resource === 'expenses') {
        $values = [
            'amount' => decimal_value($data['amount'] ?? null, 'amount', 10, 2, false),
            'category' => required_string($data, 'category', 1, 40),
        ];
        if (array_key_exists('note', $data)) {
            $values['note'] = optional_string($data, 'note', 255);
        }
        if (array_key_exists('spent_at', $data) && $data['spent_at'] !== null) {
            $values['spent_at'] = datetime_value($data['spent_at'], 'spent_at');
        }
        return $values;
    }
    if ($resource === 'pantry') {
        return [
            'name' => required_string($data, 'name', 1, 120),
            'quantity' => decimal_value($data['quantity'] ?? '1', 'quantity', 10, 2, false),
            'unit' => isset($data['unit']) ? required_string($data, 'unit', 1, 30) : 'piece',
            'category' => optional_string($data, 'category', 60),
            'expires_on' => date_value($data['expires_on'] ?? null, 'expires_on', true),
            'is_consumed' => filter_var($data['is_consumed'] ?? false, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE)
                ?? fail_request(422, 'is_consumed must be a boolean.'),
        ];
    }
    if ($resource === 'meal-plans') {
        if (!isset($data['plan_data']) || !is_array($data['plan_data'])) {
            fail_request(422, 'plan_data must be an object.');
        }
        return [
            'week_start' => date_value($data['week_start'] ?? null, 'week_start'),
            'title' => isset($data['title']) ? required_string($data, 'title', 0, 120) : 'Weekly Meal Plan',
            'plan_data' => json_encode((object) $data['plan_data'], JSON_THROW_ON_ERROR),
        ];
    }
    if ($resource === 'grocery-items') {
        if ($method === 'PATCH') {
            return [
                'is_checked' => filter_var($data['is_checked'] ?? null, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE)
                    ?? fail_request(422, 'is_checked must be a boolean.'),
            ];
        }
        $values = [
            'name' => required_string($data, 'name', 1, 120),
            'quantity' => decimal_value($data['quantity'] ?? '1', 'quantity', 10, 2, false),
            'unit' => isset($data['unit']) ? required_string($data, 'unit', 1, 30) : 'piece',
            'estimated_price' => decimal_value($data['estimated_price'] ?? '0', 'estimated_price', 10, 2, true),
            'category' => optional_string($data, 'category', 60),
            'meal_plan_id' => isset($data['meal_plan_id']) && $data['meal_plan_id'] !== ''
                ? filter_var($data['meal_plan_id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]])
                : null,
        ];
        if ($values['meal_plan_id'] === false) {
            fail_request(422, 'meal_plan_id must be a positive integer or null.');
        }
        return $values;
    }
    if ($resource === 'nutrition-logs') {
        return [
            'logged_on' => date_value($data['logged_on'] ?? date('Y-m-d'), 'logged_on'),
            'meal_name' => optional_string($data, 'meal_name', 120),
            'calories' => decimal_value($data['calories'] ?? '0', 'calories', 8, 2, true),
            'protein_g' => decimal_value($data['protein_g'] ?? '0', 'protein_g', 8, 2, true),
            'fiber_g' => decimal_value($data['fiber_g'] ?? '0', 'fiber_g', 8, 2, true),
        ];
    }
    fail_request(404, 'Not found.');
}

load_environment(dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env');

$databaseUrl = env_value('DATABASE_URL');
$jwtSecret = env_value('JWT_SECRET');
$tokenHours = max(1, (int) env_value('ACCESS_TOKEN_HOURS', '12'));
$allowedOrigins = array_filter(array_map('trim', explode(',', env_value(
    'CORS_ORIGINS',
    'http://localhost:8100,http://127.0.0.1:8100,http://localhost:4200,http://127.0.0.1:4200'
))));

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    respond(null, 204);
}

try {
    if ($databaseUrl === '' || $jwtSecret === '') {
        throw new RuntimeException('DATABASE_URL and JWT_SECRET must be configured in .env.');
    }
    if (strlen($jwtSecret) < 32) {
        throw new RuntimeException('JWT_SECRET must be at least 32 characters long.');
    }
    if (!str_starts_with($databaseUrl, 'mysql://') && !str_starts_with($databaseUrl, 'mysql+pymysql://')) {
        throw new RuntimeException('DATABASE_URL must use MySQL and point to nutridorm_db.');
    }
    $parseableUrl = preg_replace('/^mysql\+pymysql:\/\//', 'mysql://', $databaseUrl);
    $databaseParts = parse_url($parseableUrl);
    if (!is_array($databaseParts) || strtolower(ltrim((string) ($databaseParts['path'] ?? ''), '/')) !== 'nutridorm_db') {
        throw new RuntimeException('DATABASE_URL must point to the nutridorm_db database.');
    }
    $host = $databaseParts['host'] ?? '127.0.0.1';
    $port = $databaseParts['port'] ?? 3306;
    $databaseName = 'nutridorm_db';
    $username = rawurldecode($databaseParts['user'] ?? '');
    $password = rawurldecode($databaseParts['pass'] ?? '');
    $serverDsn = "mysql:host=$host;port=$port;charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];
    try {
        $serverDb = new PDO($serverDsn, $username, $password, $options);
        $serverDb->exec("CREATE DATABASE IF NOT EXISTS `$databaseName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    } catch (PDOException $createError) {
        try {
            $db = new PDO("$serverDsn;dbname=$databaseName", $username, $password, $options);
            $db->query('SELECT 1');
        } catch (PDOException $connectError) {
            throw $createError;
        }
    }
    if (!isset($db)) {
        $db = new PDO("$serverDsn;dbname=$databaseName", $username, $password, $options);
    }

    $schemaPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'database' . DIRECTORY_SEPARATOR . 'schema.sql';
    $schema = file_get_contents($schemaPath);
    if ($schema === false) {
        throw new RuntimeException('Could not read database/schema.sql.');
    }
    foreach (preg_split('/;\s*(?:\r?\n|$)/', $schema) ?: [] as $statement) {
        $statement = trim($statement);
        if ($statement === '' || preg_match('/^(CREATE DATABASE|USE)\b/i', $statement)) {
            continue;
        }
        $db->exec($statement);
    }

    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    if ($path === '/') {
        respond([
            'name' => 'NutriDorm API',
            'status' => 'running',
            'docs' => null,
            'health' => '/api/health',
            'auth' => ['register' => '/api/auth/register', 'login' => '/api/auth/login'],
        ]);
    }
    if ($path === '/api/health' && $method === 'GET') {
        $db->query('SELECT 1');
        respond(['status' => 'ok', 'database' => 'connected']);
    }

    if ($path === '/api/auth/register' && $method === 'POST') {
        $body = json_body();
        $fullName = required_string($body, 'full_name', 2, 120, true);
        $dormName = required_string($body, 'dorm_name', 2, 160, true);
        $email = strtolower(required_string($body, 'email', 5, 254, true));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            fail_request(422, 'Enter a valid email address.');
        }
        $passwordValue = required_string($body, 'password', 8, 128);
        try {
            $db->beginTransaction();
            $insert = $db->prepare('INSERT INTO users (full_name, dorm_name, email, password_hash) VALUES (?, ?, ?, ?)');
            $insert->execute([$fullName, $dormName, $email, password_hash_compatible($passwordValue)]);
            $userId = (int) $db->lastInsertId();
            $db->prepare('INSERT INTO user_profiles (user_id, emergency_fund_percent, equipment) VALUES (?, ?, ?)')
                ->execute([$userId, '10.00', '[]']);
            $db->commit();
        } catch (PDOException $error) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            if ($error->getCode() === '23000') {
                fail_request(409, 'An account with this email already exists.');
            }
            throw $error;
        }
        $query = $db->prepare('SELECT * FROM users WHERE id = ?');
        $query->execute([$userId]);
        $user = $query->fetch();
        respond(['access_token' => make_token($userId, $jwtSecret, $tokenHours), 'token_type' => 'bearer', 'user' => user_response($user)], 201);
    }

    if ($path === '/api/auth/login' && $method === 'POST') {
        $body = json_body();
        $email = strtolower(trim(required_string($body, 'email', 5, 254)));
        $passwordValue = required_string($body, 'password', 1, 128);
        $query = $db->prepare('SELECT * FROM users WHERE email = ?');
        $query->execute([$email]);
        $user = $query->fetch();
        if (!$user || !password_matches($passwordValue, $user['password_hash'])) {
            fail_request(401, 'Invalid email or password.');
        }
        respond(['access_token' => make_token((int) $user['id'], $jwtSecret, $tokenHours), 'token_type' => 'bearer', 'user' => user_response($user)]);
    }

    if (str_starts_with($path, '/api/')) {
        $userId = token_user_id($jwtSecret);
        if ($path === '/api/auth/me' && $method === 'GET') {
            $query = $db->prepare('SELECT * FROM users WHERE id = ?');
            $query->execute([$userId]);
            $user = $query->fetch();
            if (!$user) {
                fail_request(401, 'Account no longer exists.');
            }
            respond(user_response($user));
        }
        if ($path === '/api/profile' && $method === 'GET') {
            respond(profile_response($db, $userId));
        }
        if ($path === '/api/profile' && $method === 'PUT') {
            $body = json_body();
            $allowance = $body['weekly_allowance'] ?? null;
            $allowanceValue = $allowance === null ? null : decimal_value($allowance, 'weekly_allowance', 10, 2, false);
            $equipment = $body['equipment'] ?? [];
            if (!is_array($equipment) || count($equipment) > 20 || array_filter($equipment, 'is_string') !== $equipment) {
                fail_request(422, 'equipment must be a list of at most 20 strings.');
            }
            $query = $db->prepare(
                'INSERT INTO user_profiles (user_id, weekly_allowance, equipment) VALUES (?, ?, ?) '
                . 'ON DUPLICATE KEY UPDATE weekly_allowance = VALUES(weekly_allowance), equipment = VALUES(equipment)'
            );
            $query->execute([$userId, $allowanceValue, json_encode(array_values($equipment), JSON_THROW_ON_ERROR)]);
            respond(profile_response($db, $userId));
        }

        if (preg_match('#^/api/(expenses|pantry|meal-plans|grocery-items|nutrition-logs)(?:/([0-9]+))?$#', $path, $matches)) {
            $resource = $matches[1];
            $id = isset($matches[2]) ? (int) $matches[2] : null;
            $table = ['pantry' => 'pantry_items'][$resource] ?? str_replace('-', '_', $resource);
            $order = [
                'expenses' => 'spent_at DESC',
                'pantry' => 'created_at DESC',
                'meal-plans' => 'week_start DESC',
                'grocery-items' => 'created_at DESC',
                'nutrition-logs' => 'logged_on DESC, created_at DESC',
            ][$resource];

            if ($method === 'GET' && $id === null) {
                $sql = "SELECT * FROM `$table` WHERE user_id = ?";
                $params = [$userId];
                if ($resource === 'nutrition-logs' && isset($_GET['logged_on'])) {
                    $sql .= ' AND logged_on = ?';
                    $params[] = date_value($_GET['logged_on'], 'logged_on');
                }
                $query = $db->prepare("$sql ORDER BY $order");
                $query->execute($params);
                $rows = $query->fetchAll();
                respond(array_map(static function (array $row) use ($resource): array {
                    foreach (['is_consumed', 'is_checked'] as $booleanField) {
                        if (array_key_exists($booleanField, $row)) {
                            $row[$booleanField] = (bool) $row[$booleanField];
                        }
                    }
                    foreach (['id', 'user_id', 'meal_plan_id'] as $integerField) {
                        if (isset($row[$integerField])) {
                            $row[$integerField] = (int) $row[$integerField];
                        }
                    }
                    if (isset($row['plan_data'])) {
                        $row['plan_data'] = json_decode((string) $row['plan_data'], true, 512, JSON_THROW_ON_ERROR);
                    }
                    return $row;
                }, $rows));
            }
            if ($id === null && $method === 'POST') {
                $values = validate_record($resource, json_body(), $method);
                if ($resource === 'grocery-items' && $values['meal_plan_id'] !== null) {
                    $planQuery = $db->prepare('SELECT id FROM meal_plans WHERE id = ? AND user_id = ?');
                    $planQuery->execute([$values['meal_plan_id'], $userId]);
                    if (!$planQuery->fetch()) {
                        fail_request(404, 'Meal plan not found.');
                    }
                }
                $values['user_id'] = $userId;
                $columns = array_keys($values);
                $quotedColumns = implode(', ', array_map(static fn(string $column): string => "`$column`", $columns));
                $placeholders = implode(', ', array_fill(0, count($columns), '?'));
                $insert = $db->prepare("INSERT INTO `$table` ($quotedColumns) VALUES ($placeholders)");
                $insert->execute(array_values($values));
                respond(record_row($db, $table, (int) $db->lastInsertId(), $userId), 201);
            }
            if ($id !== null && in_array($method, ['PUT', 'PATCH'], true)) {
                $existing = record_row($db, $table, $id, $userId);
                $values = validate_record($resource, json_body(), $method);
                if ($resource === 'expenses') {
                    $values = array_filter($values, static fn(mixed $value): bool => $value !== null);
                }
                if ($resource === 'grocery-items' && isset($values['meal_plan_id'])) {
                    $planQuery = $db->prepare('SELECT id FROM meal_plans WHERE id = ? AND user_id = ?');
                    $planQuery->execute([$values['meal_plan_id'], $userId]);
                    if (!$planQuery->fetch()) {
                        fail_request(404, 'Meal plan not found.');
                    }
                }
                $columns = array_keys($values);
                $assignments = implode(', ', array_map(static fn(string $column): string => "`$column` = ?", $columns));
                $update = $db->prepare("UPDATE `$table` SET $assignments WHERE id = ? AND user_id = ?");
                $update->execute([...array_values($values), $id, $userId]);
                respond(record_row($db, $table, $id, $userId));
            }
            if ($id !== null && $method === 'DELETE') {
                record_row($db, $table, $id, $userId);
                $delete = $db->prepare("DELETE FROM `$table` WHERE id = ? AND user_id = ?");
                $delete->execute([$id, $userId]);
                respond(null, 204);
            }
        }
    }
    fail_request(404, 'Not found.');
} catch (Throwable $error) {
    error_log((string) $error);
    fail_request(500, 'The NutriDorm API could not complete the request.');
}
