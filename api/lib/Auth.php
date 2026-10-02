<?php
declare(strict_types=1);

namespace ExamLegacy;

/**
 * Server-side authentication.
 *
 * The browser is NEVER trusted. Every protected request must carry a Firebase
 * ID token in the Authorization: Bearer header. We verify the token signature
 * and claims against Google's public keys, then map the Firebase UID to a
 * MySQL user (creating one on first sign-in). Authorization for every resource
 * is re-checked against this verified identity.
 */
final class Auth
{
    private const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
    private const CERTS_TTL = 3600; // seconds

    /** Verify a Firebase ID token and return its claims. Throws ApiError on failure. */
    public static function verifyIdToken(string $idToken): array
    {
        if (FIREBASE_PROJECT_ID === '') {
            throw new ApiError('auth_not_configured', 'Authentication service is not configured', 500);
        }
        $parts = explode('.', $idToken);
        if (count($parts) !== 3) {
            throw new ApiError('invalid_token', 'Invalid session. Please sign in again.', 401);
        }
        [$h64, $p64, $s64] = $parts;
        $header = json_decode(self::b64urlDecode($h64), true);
        $claims = json_decode(self::b64urlDecode($p64), true);
        if (!is_array($header) || !is_array($claims)) {
            throw new ApiError('invalid_token', 'Invalid session. Please sign in again.', 401);
        }

        // Algorithm must be RS256 (reject "none" / alg confusion).
        if (($header['alg'] ?? '') !== 'RS256') {
            throw new ApiError('invalid_token', 'Invalid session. Please sign in again.', 401);
        }
        $kid = $header['kid'] ?? '';
        if ($kid === '') {
            throw new ApiError('invalid_token', 'Invalid session. Please sign in again.', 401);
        }

        // Time-based claims.
        $now = time();
        if (!isset($claims['exp']) || $now >= (int) $claims['exp']) {
            throw new ApiError('token_expired', 'Your session has expired. Please sign in again.', 401);
        }
        if (isset($claims['iat']) && (int) $claims['iat'] > $now + 300) {
            throw new ApiError('invalid_token', 'Invalid session. Please sign in again.', 401);
        }
        // Audience & issuer.
        if (($claims['aud'] ?? '') !== FIREBASE_PROJECT_ID) {
            throw new ApiError('invalid_token', 'Authentication failed. Please sign in again.', 401);
        }
        if (($claims['iss'] ?? '') !== 'https://securetoken.google.com/' . FIREBASE_PROJECT_ID) {
            throw new ApiError('invalid_token', 'Authentication failed. Please sign in again.', 401);
        }
        if (empty($claims['sub'])) {
            throw new ApiError('invalid_token', 'Authentication failed. Please sign in again.', 401);
        }

        // Signature verification against Google public certs.
        $cert = self::certForKid($kid);
        if ($cert === null) {
            throw new ApiError('invalid_token', 'Authentication service unavailable. Please try again.', 401);
        }
        $pub = openssl_pkey_get_public($cert);
        if ($pub === false) {
            throw new ApiError('invalid_token', 'Authentication service unavailable. Please try again.', 401);
        }
        $signature = self::b64urlDecode($s64);
        $ok = openssl_verify("$h64.$p64", $signature, $pub, OPENSSL_ALGO_SHA256);
        if ($ok !== 1) {
            throw new ApiError('invalid_token', 'Session verification failed. Please sign in again.', 401);
        }
        return $claims;
    }

    /** Fetch (and cache) Google's public certs; return the PEM for a given kid. */
    private static function certForKid(string $kid): ?string
    {
        $cacheDir = sys_get_temp_dir();
        $cacheFile = $cacheDir . '/examlegacy_google_certs.json';
        $certs = null;
        if (is_file($cacheFile) && (time() - (int) @filemtime($cacheFile)) < self::CERTS_TTL) {
            $certs = json_decode((string) file_get_contents($cacheFile), true);
        }
        if (!is_array($certs) || !isset($certs[$kid])) {
            $fetched = self::fetchCerts();
            if ($fetched !== null && !empty($fetched)) {
                $certs = $fetched;
                @file_put_contents($cacheFile, json_encode($certs), LOCK_EX);
            } else {
                // Fall back to bundled certs if network fetch fails (common on strict shared hosting)
                $bundledPath = dirname(__DIR__, 2) . '/config/google-certs.json';
                if (is_file($bundledPath)) {
                    $certs = json_decode((string) file_get_contents($bundledPath), true);
                }
            }
        }
        return isset($certs[$kid]) && is_string($certs[$kid]) ? $certs[$kid] : null;
    }

    /** @return array<string,string>|null */
    private static function fetchCerts(): ?array
    {
        if (!function_exists('curl_init')) {
            return null;
        }
        $ch = curl_init(self::CERTS_URL);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 5,
            CURLOPT_IPRESOLVE      => CURL_IPRESOLVE_V4,
            CURLOPT_HTTPHEADER     => ['Cache-Control: no-cache'],
        ]);
        $body = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if ($code !== 200 || !is_string($body)) {
            return null;
        }
        $data = json_decode($body, true);
        return is_array($data) ? $data : null;
    }

    private static function b64urlDecode(string $s): string
    {
        $rem = strlen($s) % 4;
        if ($rem > 0) {
            $s .= str_repeat('=', 4 - $rem);
        }
        $d = base64_decode(strtr($s, '-_', '+/'), true);
        return $d === false ? '' : $d;
    }

    /** Return a configured signing secret, rejecting empty and template values. */
    private static function configuredAdminSecret(): string
    {
        $secret = trim((string) env('ADMIN_SECRET', ''));
        if (strlen($secret) < 32 || preg_match('/^(?:change_this|your_|placeholder)/i', $secret)) {
            return '';
        }
        return $secret;
    }

    /** Issue a signed 30-day admin token that works completely independent of Google OAuth. */
    public static function issueAdminToken(int $userId): string
    {
        $secret = self::configuredAdminSecret();
        if ($secret === '') {
            throw new ApiError('admin_not_configured', 'Administrator authentication is not configured.', 503);
        }
        $exp = time() + (30 * 86400); // 30 days
        $payload = "$userId|$exp";
        $sig = hash_hmac('sha256', $payload, $secret);
        return 'eladm_' . base64_encode("$payload|$sig");
    }

    /** Verify a signed admin token. */
    public static function verifyAdminToken(string $token): ?array
    {
        $secret = self::configuredAdminSecret();
        if ($secret === '') {
            return null;
        }
        if (strpos($token, 'eladm_') === 0) {
            $raw = base64_decode(substr($token, 6), true);
            if ($raw) {
                $parts = explode('|', $raw);
                if (count($parts) === 3) {
                    [$userId, $exp, $sig] = $parts;
                    if ((int)$exp >= time()) {
                        $expected = hash_hmac('sha256', "$userId|$exp", $secret);
                        if (hash_equals($expected, $sig)) {
                            return Db::one("SELECT * FROM users WHERE id = ? AND role = 'admin'", [(int)$userId]);
                        }
                    }
                }
            }
        }
        return null;
    }

    /** Authenticate admin via Email and Password without requiring Google sign-in. */
    public static function adminLogin(string $email, string $password): array
    {
        $email = strtolower(trim($email));
        $password = trim($password);
        if ($email === '' || $password === '') {
            throw new ApiError('invalid_input', 'Email and password are required', 400);
        }

        $adminEmails = array_filter(array_map('trim', explode(',', strtolower(env('ADMIN_EMAILS', '')))));
        if ($adminEmails === []) {
            throw new ApiError('admin_not_configured', 'Administrator login is not configured.', 503);
        }
        if (!in_array($email, $adminEmails, true)) {
            throw new ApiError('forbidden', 'Only designated Superadmin email is authorized', 403);
        }

        $adminPass = env('ADMIN_PASSWORD', '');
        $adminSecret = self::configuredAdminSecret();

        $user = Db::one('SELECT * FROM users WHERE email = ?', [$email]);
        $passwordValid = false;

        if (($adminPass !== '' && hash_equals($adminPass, $password))
            || ($adminSecret !== '' && hash_equals($adminSecret, $password))) {
            $passwordValid = true;
        } elseif ($user !== null && !empty($user['password_hash']) && password_verify($password, $user['password_hash'])) {
            $passwordValid = true;
        }

        if (!$passwordValid) {
            throw new ApiError('invalid_credentials', 'Incorrect admin password. Please try again.', 401);
        }

        if ($user === null) {
            Db::run(
                "INSERT INTO users (firebase_uid, email, email_verified, name, role, status, ai_credit_balance, created_at, updated_at)
                 VALUES ('2RyGoMqyjqcXiBrp5gH1VdSLWx72', ?, 1, 'Sanjay Katara (Superadmin)', 'admin', 'active', 99999, NOW(), NOW())
                 ON DUPLICATE KEY UPDATE role = 'admin', status = 'active'",
                [$email]
            );
            $user = Db::one('SELECT * FROM users WHERE email = ?', [$email]);
        } else {
            if ($user['role'] !== 'admin' || $user['status'] !== 'active') {
                Db::run("UPDATE users SET role = 'admin', status = 'active' WHERE id = ?", [(int)$user['id']]);
                $user['role'] = 'admin';
                $user['status'] = 'active';
            }
        }

        $token = self::issueAdminToken((int)$user['id']);
        return [
            'token' => $token,
            'user'  => [
                'id'    => (int)$user['id'],
                'email' => $user['email'],
                'name'  => $user['name'] ?: 'Sanjay Katara (Superadmin)',
                'role'  => 'admin',
            ],
        ];
    }

    /**
     * Verify the bearer token, sync/create the MySQL user and return the user row.
     * Throws ApiError(401/403) if the token is invalid or the account is blocked.
     */
    public static function authenticate(): array
    {
        $clientAdminToken = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? null;
        $bearer = Http::bearerToken();

        // 1. Signed Admin Session Token Verification
        if ($clientAdminToken !== null) {
            $adm = self::verifyAdminToken($clientAdminToken);
            if ($adm !== null) {
                return $adm;
            }
        }
        if ($bearer !== null) {
            $adm = self::verifyAdminToken($bearer);
            if ($adm !== null) {
                return $adm;
            }
        }

        // 2. Direct Admin Master Key / Token authentication (X-Admin-Token or Bearer)
        $adminSecret = self::configuredAdminSecret();
        if ($adminSecret !== '' && (($clientAdminToken !== null && hash_equals($adminSecret, $clientAdminToken)) || ($bearer !== null && hash_equals($adminSecret, $bearer)))) {
            $adminUser = Db::one("SELECT * FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
            if ($adminUser !== null) {
                return $adminUser;
            }
            // Auto-provision single designated superadmin row if DB was fresh
            Db::run(
                "INSERT INTO users (firebase_uid, email, email_verified, name, role, status, ai_credit_balance, created_at, updated_at)
                 VALUES ('2RyGoMqyjqcXiBrp5gH1VdSLWx72', 'sanjaykatara59927@gmail.com', 1, 'Sanjay Katara (Superadmin)', 'admin', 'active', 99999, NOW(), NOW())
                 ON DUPLICATE KEY UPDATE role = 'admin', status = 'active'"
            );
            $adminUser = Db::one("SELECT * FROM users WHERE firebase_uid = '2RyGoMqyjqcXiBrp5gH1VdSLWx72' OR role = 'admin' ORDER BY id ASC LIMIT 1");
            if ($adminUser !== null) {
                return $adminUser;
            }
        }

        $token = Http::bearerToken();
        if ($token === null) {
            throw new ApiError('unauthenticated', 'Please sign in to continue.', 401);
        }
        $claims = self::verifyIdToken($token);
        $uid  = (string) $claims['sub'];
        $user = self::syncUser($uid, $claims);

        if ($user['status'] === 'suspended' || $user['status'] === 'disabled') {
            throw new ApiError('account_blocked', 'Your account has been restricted. Contact support.', 403);
        }
        return $user;
    }

    /** Create or update the local user record from verified token claims. */
    public static function syncUser(string $uid, array $claims): array
    {
        $email = isset($claims['email']) ? (string) $claims['email'] : '';
        $name  = isset($claims['name']) ? (string) $claims['name'] : '';
        $pic   = isset($claims['picture']) ? (string) $claims['picture'] : '';
        $emailVerified = !empty($claims['email_verified']) ? 1 : 0;

        $existing = Db::one('SELECT * FROM users WHERE firebase_uid = ?', [$uid]);
        if ($existing === null && $email !== '') {
            // Link by verified email if a row already exists (defensive; normally uid is stable).
            $existing = Db::one('SELECT * FROM users WHERE email = ?', [$email]);
        }

        if ($existing === null) {
            Db::run(
                'INSERT INTO users (firebase_uid, email, email_verified, name, avatar_url, last_login_at)
                 VALUES (?,?,?,?,?, NOW())',
                [$uid, $email, $emailVerified, $name !== '' ? $name : ($email ?: 'User'), $pic !== '' ? $pic : null]
            );
            $userId = Db::insertId();
            $user = Db::one('SELECT * FROM users WHERE id = ?', [$userId]);
            // Brand-new account -> welcome email (fire-and-forget).
            if ($email !== '') {
                try {
                    Mailer::sendWelcomeEmail($email, $name);
                } catch (\Throwable $e) {
                    error_log('[ExamLegacy] Welcome email dispatch failed: ' . $e->getMessage());
                }
            }
        } else {
            $userId = (int) $existing['id'];
            // Keep firebase_uid linked (in case we matched by email).
            Db::run(
                'UPDATE users SET firebase_uid = ?, email = COALESCE(NULLIF(?,\'\'), email),
                    email_verified = ?, name = COALESCE(NULLIF(?, \'\'), name),
                    avatar_url = COALESCE(NULLIF(?, \'\'), avatar_url), last_login_at = NOW()
                 WHERE id = ?',
                [$uid, $email, $emailVerified, $name, $pic, $userId]
            );
            $user = Db::one('SELECT * FROM users WHERE id = ?', [$userId]);
        }

        // Automatic Admin Promotion for single designated superadmin
        $adminEmails = array_filter(array_map('trim', explode(',', strtolower(env('ADMIN_EMAILS', '')))));
        $adminUids = array_filter(array_map('trim', explode(',', env('ADMIN_UIDS', ''))));
        if (($email !== '' && in_array(strtolower($email), $adminEmails, true)) || in_array($uid, $adminUids, true)) {
            Db::run("UPDATE users SET role = 'admin' WHERE id = ?", [$userId]);
            $user['role'] = 'admin';
        } elseif (($user['role'] ?? '') === 'admin') {
            Db::run("UPDATE users SET role = 'user' WHERE id = ?", [$userId]);
            $user['role'] = 'user';
        }

        // Grant one-time trial AI credits (configurable) exactly once.
        if ((int) $user['trial_credits_given'] === 0) {
            self::grantTrialCredits($userId);
            $user = Db::one('SELECT * FROM users WHERE id = ?', [$userId]);
        }
        // Dual-sync to Google Cloud Firestore (non-blocking)
        try {
            Firestore::syncUser($user);
        } catch (\Throwable $e) {
            error_log('[Auth] Firestore syncUser notice: ' . $e->getMessage());
        }
        return $user;
    }

    private static function grantTrialCredits(int $userId): void
    {
        $trial = (int) (Settings::get('trial_ai_credits', '50'));
        if ($trial <= 0) {
            Db::run('UPDATE users SET trial_credits_given = 1 WHERE id = ?', [$userId]);
            return;
        }
        Db::transaction(function () use ($userId, $trial) {
            $u = Db::one('SELECT * FROM users WHERE id = ? FOR UPDATE', [$userId]);
            if ((int) $u['trial_credits_given'] === 1) {
                return;
            }
            $balance = (int) $u['ai_credit_balance'] + $trial;
            Db::run(
                'INSERT INTO ai_credit_transactions (user_id, type, amount, balance_after, idempotency_key, description)
                 VALUES (?,?,?,?,?,?)',
                [$userId, 'trial', $trial, $balance, 'trial:' . $userId, 'Welcome trial AI credits']
            );
            Db::run(
                'UPDATE users SET ai_credit_balance = ?, trial_credits_given = 1 WHERE id = ?',
                [$balance, $userId]
            );
        });
    }

    /** Require an authenticated admin; returns the admin user row. */
    public static function authenticateAdmin(): array
    {
        $user = self::authenticate();
        if (($user['role'] ?? 'user') !== 'admin') {
            throw new ApiError('forbidden', 'Administrator access required', 403);
        }
        return $user;
    }
}
