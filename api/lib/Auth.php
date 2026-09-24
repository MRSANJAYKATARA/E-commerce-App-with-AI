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
            throw new ApiError('auth_not_configured', 'Authentication is not configured', 500);
        }
        $parts = explode('.', $idToken);
        if (count($parts) !== 3) {
            throw new ApiError('invalid_token', 'Malformed token', 401);
        }
        [$h64, $p64, $s64] = $parts;
        $header = json_decode(self::b64urlDecode($h64), true);
        $claims = json_decode(self::b64urlDecode($p64), true);
        if (!is_array($header) || !is_array($claims)) {
            throw new ApiError('invalid_token', 'Malformed token payload', 401);
        }

        // Algorithm must be RS256 (reject "none" / alg confusion).
        if (($header['alg'] ?? '') !== 'RS256') {
            throw new ApiError('invalid_token', 'Unexpected token algorithm', 401);
        }
        $kid = $header['kid'] ?? '';
        if ($kid === '') {
            throw new ApiError('invalid_token', 'Missing key id', 401);
        }

        // Time-based claims.
        $now = time();
        if (!isset($claims['exp']) || $now >= (int) $claims['exp']) {
            throw new ApiError('token_expired', 'Token expired', 401);
        }
        if (isset($claims['iat']) && (int) $claims['iat'] > $now + 300) {
            throw new ApiError('invalid_token', 'Token issued in the future', 401);
        }
        // Audience & issuer.
        if (($claims['aud'] ?? '') !== FIREBASE_PROJECT_ID) {
            throw new ApiError('invalid_token', 'Token audience mismatch', 401);
        }
        if (($claims['iss'] ?? '') !== 'https://securetoken.google.com/' . FIREBASE_PROJECT_ID) {
            throw new ApiError('invalid_token', 'Token issuer mismatch', 401);
        }
        if (empty($claims['sub'])) {
            throw new ApiError('invalid_token', 'Missing subject', 401);
        }

        // Signature verification against Google public certs.
        $cert = self::certForKid($kid);
        if ($cert === null) {
            throw new ApiError('invalid_token', 'Unknown signing key', 401);
        }
        $pub = openssl_pkey_get_public($cert);
        if ($pub === false) {
            throw new ApiError('invalid_token', 'Invalid signing key', 401);
        }
        $signature = self::b64urlDecode($s64);
        $ok = openssl_verify("$h64.$p64", $signature, $pub, OPENSSL_ALGO_SHA256);
        if ($ok !== 1) {
            throw new ApiError('invalid_token', 'Token signature invalid', 401);
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
            if ($fetched === null) {
                // Fall back to cache if network fails.
                $certs = is_array($certs) ? $certs : [];
            } else {
                $certs = $fetched;
                @file_put_contents($cacheFile, json_encode($certs), LOCK_EX);
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
            CURLOPT_TIMEOUT        => 8,
            CURLOPT_HTTPHEADER     => ['Cache-Control: no-cache'],
        ]);
        $body = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
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

    /**
     * Verify the bearer token, sync/create the MySQL user and return the user row.
     * Throws ApiError(401/403) if the token is invalid or the account is blocked.
     */
    public static function authenticate(): array
    {
        $token = Http::bearerToken();
        if ($token === null) {
            throw new ApiError('unauthenticated', 'Missing authentication token', 401);
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

        // Grant one-time trial AI credits (configurable) exactly once.
        if ((int) $user['trial_credits_given'] === 0) {
            self::grantTrialCredits($userId);
            $user = Db::one('SELECT * FROM users WHERE id = ?', [$userId]);
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
