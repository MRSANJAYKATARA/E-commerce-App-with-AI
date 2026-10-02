<?php
declare(strict_types=1);

namespace ExamLegacy;

if (!defined('FIREBASE_PROJECT_ID')) {
    $cfgPath = dirname(__DIR__) . '/config.php';
    if (is_file($cfgPath)) {
        require_once $cfgPath;
    }
}

/**
 * Google Cloud Firestore REST API Client for ExamLegacy.
 *
 * Uses the Service Account credentials (`config/firebase-service-account.json`)
 * to generate a signed Google OAuth2 Bearer token (JWT RS256).
 * Maintains dual-sync with MySQL for users, orders, financial ledgers, and audit logs.
 */
final class Firestore
{
    private static function tokenCacheFile(): string
    {
        return rtrim(sys_get_temp_dir(), '/') . '/examlegacy_firestore_token.json';
    }
    private const TOKEN_SCOPE = 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform';
    private const OAUTH_URL = 'https://oauth2.googleapis.com/token';

    /** Check if Firestore Service Account credentials are valid and present. */
    public static function isConfigured(): bool
    {
        $saPath = self::getServiceAccountPath();
        return $saPath !== null && is_file($saPath) && is_readable($saPath);
    }

    /** Path to service account json file. */
    public static function getServiceAccountPath(): ?string
    {
        $saCustom = defined('FIREBASE_SERVICE_ACCOUNT') && \FIREBASE_SERVICE_ACCOUNT !== '' ? (string)\FIREBASE_SERVICE_ACCOUNT : null;
        $candidates = [
            dirname(__DIR__, 2) . '/config/firebase-service-account.json',
            dirname(__DIR__) . '/config/firebase-service-account.json',
            $saCustom !== null ? (
                (strpos($saCustom, '/') === 0) ? $saCustom : dirname(__DIR__, 2) . '/' . $saCustom
            ) : null,
        ];
        foreach ($candidates as $c) {
            if ($c !== null && is_file($c)) {
                return $c;
            }
        }
        return null;
    }

    /** Retrieve or refresh the cached Google Cloud OAuth2 Access Token. */
    public static function getAccessToken(): ?string
    {
        $cacheFile = self::tokenCacheFile();
        if (is_file($cacheFile)) {
            $cached = json_decode((string) @file_get_contents($cacheFile), true);
            if (is_array($cached) && !empty($cached['token']) && !empty($cached['expires_at'])) {
                if (time() < ((int) $cached['expires_at'] - 120)) {
                    return (string) $cached['token'];
                }
            }
        }

        $saPath = self::getServiceAccountPath();
        if ($saPath === null) {
            error_log('[Firestore] Service account file not found.');
            return null;
        }

        $sa = json_decode((string) file_get_contents($saPath), true);
        if (!is_array($sa) || empty($sa['client_email']) || empty($sa['private_key'])) {
            error_log('[Firestore] Invalid service account format.');
            return null;
        }

        $now = time();
        $b64Url = function ($data): string {
            return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode(is_string($data) ? $data : json_encode($data)));
        };

        $header = $b64Url(['alg' => 'RS256', 'typ' => 'JWT']);
        $claims = $b64Url([
            'iss'   => $sa['client_email'],
            'scope' => self::TOKEN_SCOPE,
            'aud'   => self::OAUTH_URL,
            'exp'   => $now + 3600,
            'iat'   => $now,
        ]);

        $signature = '';
        $key = openssl_pkey_get_private($sa['private_key']);
        if ($key === false) {
            error_log('[Firestore] Failed to parse private key.');
            return null;
        }
        $signed = openssl_sign("$header.$claims", $signature, $key, OPENSSL_ALGO_SHA256);
        if (!$signed) {
            error_log('[Firestore] Failed to sign JWT assertion.');
            return null;
        }

        $jwt = "$header.$claims." . $b64Url($signature);

        $ch = curl_init(self::OAUTH_URL);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query([
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion'  => $jwt,
            ]),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 8,
        ]);
        $response = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if ($code !== 200 || !is_string($response)) {
            error_log("[Firestore] OAuth token exchange failed (HTTP $code): $response");
            return null;
        }

        $tokenData = json_decode($response, true);
        if (!is_array($tokenData) || empty($tokenData['access_token'])) {
            return null;
        }

        $token = (string) $tokenData['access_token'];
        $expiresIn = (int) ($tokenData['expires_in'] ?? 3600);

        @file_put_contents(self::tokenCacheFile(), json_encode([
            'token'      => $token,
            'expires_at' => $now + $expiresIn,
        ]), LOCK_EX);

        return $token;
    }

    /** Base Firestore API URL for default database */
    private static function baseUrl(): string
    {
        $projectId = (defined('FIREBASE_PROJECT_ID') && \FIREBASE_PROJECT_ID !== '') ? \FIREBASE_PROJECT_ID : 'examlegacy-19d4b';
        return "https://firestore.googleapis.com/v1/projects/{$projectId}/databases/(default)/documents";
    }

    /**
     * Create or update (upsert) a document in Firestore.
     * @param string $collection E.g. 'users', 'orders'
     * @param string $documentId E.g. 'uid123', 'EL_1001'
     * @param array<string,mixed> $data Associative array of fields
     */
    public static function setDocument(string $collection, string $documentId, array $data, bool $merge = true): ?array
    {
        $token = self::getAccessToken();
        if ($token === null) {
            return null;
        }

        $cleanId = trim($documentId, '/');
        $url = self::baseUrl() . '/' . trim($collection, '/') . '/' . rawurlencode($cleanId);
        if ($merge) {
            $updateMasks = [];
            foreach (array_keys($data) as $field) {
                $updateMasks[] = 'updateMask.fieldPaths=' . rawurlencode((string) $field);
            }
            if (!empty($updateMasks)) {
                $url .= '?' . implode('&', $updateMasks);
            }
        }

        $body = json_encode(['fields' => self::toFirestoreFields($data)], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => 'PATCH',
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_HTTPHEADER     => [
                "Authorization: Bearer $token",
                'Content-Type: application/json; charset=utf-8',
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 8,
        ]);
        $res = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);

        if ($code >= 200 && $code < 300 && is_string($res)) {
            $parsed = json_decode($res, true);
            return is_array($parsed) ? self::fromFirestoreDoc($parsed) : null;
        }

        error_log("[Firestore] setDocument failed ($collection/$documentId, HTTP $code): $res");
        return null;
    }

    /** Get a single document from Firestore. */
    public static function getDocument(string $collection, string $documentId): ?array
    {
        $token = self::getAccessToken();
        if ($token === null) {
            return null;
        }

        $url = self::baseUrl() . '/' . trim($collection, '/') . '/' . rawurlencode(trim($documentId, '/'));
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_HTTPHEADER     => ["Authorization: Bearer $token"],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 6,
        ]);
        $res = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);

        if ($code === 200 && is_string($res)) {
            $parsed = json_decode($res, true);
            return is_array($parsed) ? self::fromFirestoreDoc($parsed) : null;
        }
        return null;
    }

    /** Delete a document from Firestore. */
    public static function deleteDocument(string $collection, string $documentId): bool
    {
        $token = self::getAccessToken();
        if ($token === null) {
            return false;
        }

        $url = self::baseUrl() . '/' . trim($collection, '/') . '/' . rawurlencode(trim($documentId, '/'));
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => 'DELETE',
            CURLOPT_HTTPHEADER     => ["Authorization: Bearer $token"],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 6,
        ]);
        curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        return $code >= 200 && $code < 300;
    }

    // ------------------------------------------------------------------------
    // Specialized Domain Synchronizers
    // ------------------------------------------------------------------------

    /** Sync a MySQL user row into Firestore `users/{firebase_uid}` */
    public static function syncUser(array $user): bool
    {
        $uid = $user['firebase_uid'] ?? null;
        if (!$uid) {
            return false;
        }

        $doc = [
            'id'                   => (int) ($user['id'] ?? 0),
            'firebase_uid'         => (string) $uid,
            'email'                => (string) ($user['email'] ?? ''),
            'name'                 => (string) ($user['name'] ?? ''),
            'avatar_url'           => (string) ($user['avatar_url'] ?? ''),
            'role'                 => (string) ($user['role'] ?? 'user'),
            'status'               => (string) ($user['status'] ?? 'active'),
            'wallet_balance_paise' => (int) ($user['wallet_balance_paise'] ?? 0),
            'wallet_balance_inr'   => round(((int) ($user['wallet_balance_paise'] ?? 0)) / 100, 2),
            'ai_credit_balance'    => (int) ($user['ai_credit_balance'] ?? 0),
            'vip_active'           => !empty($user['vip_active']) ? true : false,
            'updated_at'           => gmdate('Y-m-d\TH:i:s\Z'),
        ];
        return self::setDocument('users', (string) $uid, $doc) !== null;
    }

    /** Sync a MySQL order into Firestore `orders/{order_no}` */
    public static function syncOrder(array $order, array $items = []): bool
    {
        $orderNo = $order['order_no'] ?? null;
        if (!$orderNo) {
            return false;
        }

        $doc = [
            'id'                   => (int) ($order['id'] ?? 0),
            'order_no'             => (string) $orderNo,
            'user_id'              => (int) ($order['user_id'] ?? 0),
            'status'               => (string) ($order['status'] ?? 'pending'),
            'total_amount_paise'   => (int) ($order['total_amount_paise'] ?? 0),
            'total_amount_inr'     => round(((int) ($order['total_amount_paise'] ?? 0)) / 100, 2),
            'wallet_applied_paise' => (int) ($order['wallet_applied_paise'] ?? 0),
            'gateway_amount_paise' => (int) ($order['gateway_amount_paise'] ?? 0),
            'payment_method'       => (string) ($order['payment_method'] ?? 'cashfree'),
            'paid_at'              => !empty($order['paid_at']) ? gmdate('Y-m-d\TH:i:s\Z', strtotime((string) $order['paid_at'])) : null,
            'created_at'           => !empty($order['created_at']) ? gmdate('Y-m-d\TH:i:s\Z', strtotime((string) $order['created_at'])) : gmdate('Y-m-d\TH:i:s\Z'),
            'updated_at'           => gmdate('Y-m-d\TH:i:s\Z'),
        ];

        if (!empty($items)) {
            $doc['items'] = array_map(function ($it) {
                return [
                    'product_id'  => (int) ($it['product_id'] ?? 0),
                    'title'       => (string) ($it['title'] ?? ''),
                    'price_paise' => (int) ($it['price_paise'] ?? 0),
                ];
            }, $items);
        }

        return self::setDocument('orders', (string) $orderNo, $doc) !== null;
    }

    /** Sync a financial wallet transaction into Firestore `wallet_transactions/{id}` */
    public static function syncWalletTransaction(array $tx): bool
    {
        $id = $tx['id'] ?? null;
        if (!$id) {
            return false;
        }
        $doc = [
            'id'              => (int) $id,
            'user_id'         => (int) ($tx['user_id'] ?? 0),
            'type'            => (string) ($tx['type'] ?? 'deposit'),
            'amount_paise'    => (int) ($tx['amount_paise'] ?? 0),
            'amount_inr'      => round(((int) ($tx['amount_paise'] ?? 0)) / 100, 2),
            'balance_after'   => (int) ($tx['balance_after'] ?? 0),
            'description'     => (string) ($tx['description'] ?? ''),
            'idempotency_key' => (string) ($tx['idempotency_key'] ?? ''),
            'created_at'      => !empty($tx['created_at']) ? gmdate('Y-m-d\TH:i:s\Z', strtotime((string) $tx['created_at'])) : gmdate('Y-m-d\TH:i:s\Z'),
        ];
        return self::setDocument('wallet_transactions', (string) $id, $doc) !== null;
    }

    /** Sync an audit or tax ledger log into Firestore `audit_logs/{id}` */
    public static function syncAuditLog(string $action, array $details = []): bool
    {
        $id = time() . '_' . substr(bin2hex(random_bytes(4)), 0, 8);
        $doc = [
            'action'     => $action,
            'details'    => $details,
            'ip'         => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'server',
            'created_at' => gmdate('Y-m-d\TH:i:s\Z'),
        ];
        return self::setDocument('audit_logs', $id, $doc) !== null;
    }

    /** Sync all products into Firestore `products/{slug}` */
    public static function syncProduct(array $product): bool
    {
        $slug = $product['slug'] ?? null;
        if (!$slug) {
            return false;
        }
        $doc = [
            'id'               => (int) ($product['id'] ?? 0),
            'slug'             => (string) $slug,
            'title'            => (string) ($product['title'] ?? ''),
            'description'      => (string) ($product['description'] ?? ''),
            'price_paise'      => (int) ($product['price_paise'] ?? 0),
            'price_inr'        => round(((int) ($product['price_paise'] ?? 0)) / 100, 2),
            'category'         => (string) ($product['category'] ?? 'General'),
            'is_published'     => !empty($product['is_published']),
            'download_allowed' => !empty($product['download_allowed']),
            'updated_at'       => gmdate('Y-m-d\TH:i:s\Z'),
        ];
        return self::setDocument('products', (string) $slug, $doc) !== null;
    }

    // ------------------------------------------------------------------------
    // Type Converters
    // ------------------------------------------------------------------------

    /** Convert PHP array into Firestore Typed Fields schema */
    private static function toFirestoreFields(array $data): array
    {
        $fields = [];
        foreach ($data as $key => $val) {
            $fields[$key] = self::toFirestoreValue($val);
        }
        return $fields;
    }

    /** Convert a single PHP value to Firestore value object */
    private static function toFirestoreValue($val): array
    {
        if ($val === null) {
            return ['nullValue' => null];
        }
        if (is_bool($val)) {
            return ['booleanValue' => $val];
        }
        if (is_int($val)) {
            return ['integerValue' => (string) $val];
        }
        if (is_float($val)) {
            return ['doubleValue' => $val];
        }
        if (is_string($val)) {
            // Check for ISO-8601 UTC timestamp format: YYYY-MM-DDTHH:MM:SSZ
            if (preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/', $val)) {
                return ['timestampValue' => $val];
            }
            return ['stringValue' => $val];
        }
        if (is_array($val)) {
            $isAssoc = array_keys($val) !== range(0, count($val) - 1);
            if ($isAssoc) {
                return ['mapValue' => ['fields' => self::toFirestoreFields($val)]];
            }
            $values = [];
            foreach ($val as $item) {
                $values[] = self::toFirestoreValue($item);
            }
            return ['arrayValue' => ['values' => $values]];
        }
        return ['stringValue' => (string) $val];
    }

    /** Convert Firestore Document response to clean PHP associative array */
    private static function fromFirestoreDoc(array $doc): array
    {
        $out = [];
        if (!empty($doc['fields']) && is_array($doc['fields'])) {
            foreach ($doc['fields'] as $key => $valObj) {
                $out[$key] = self::fromFirestoreValue($valObj);
            }
        }
        return $out;
    }

    private static function fromFirestoreValue(array $valObj)
    {
        if (array_key_exists('stringValue', $valObj)) return (string) $valObj['stringValue'];
        if (array_key_exists('integerValue', $valObj)) return (int) $valObj['integerValue'];
        if (array_key_exists('doubleValue', $valObj)) return (float) $valObj['doubleValue'];
        if (array_key_exists('booleanValue', $valObj)) return (bool) $valObj['booleanValue'];
        if (array_key_exists('nullValue', $valObj)) return null;
        if (array_key_exists('timestampValue', $valObj)) return (string) $valObj['timestampValue'];
        if (!empty($valObj['mapValue']['fields'])) {
            return self::fromFirestoreDoc($valObj['mapValue']);
        }
        if (!empty($valObj['arrayValue']['values'])) {
            $arr = [];
            foreach ($valObj['arrayValue']['values'] as $item) {
                $arr[] = self::fromFirestoreValue($item);
            }
            return $arr;
        }
        return null;
    }
}
