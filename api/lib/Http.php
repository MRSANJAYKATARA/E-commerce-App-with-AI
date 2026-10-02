<?php
declare(strict_types=1);

namespace ExamLegacy;

/**
 * HTTP request parsing + JSON responses. Also carries the ApiError type used
 * across the API to produce consistent, safe error payloads.
 */
final class ApiError extends \RuntimeException
{
    public int $httpStatus;
    public string $errorCode;

    public function __construct(string $errorCode, string $message, int $httpStatus = 400)
    {
        parent::__construct($message);
        $this->errorCode = $errorCode;
        $this->httpStatus = $httpStatus;
    }
}

final class Http
{
    /** Decoded JSON body as associative array. */
    public static function jsonBody(): array
    {
        $raw = file_get_contents('php://input');
        if ($raw === false || $raw === '') {
            return [];
        }
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            throw new ApiError('invalid_body', 'Request body must be valid JSON', 400);
        }
        return $data;
    }

    public static function method(): string
    {
        return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    }

    public static function requireMethod(string ...$allowed): void
    {
        if (!in_array(self::method(), $allowed, true)) {
            throw new ApiError('method_not_allowed', 'Method not allowed', 405);
        }
    }

    public static function query(string $key, ?string $default = null): ?string
    {
        $v = $_GET[$key] ?? null;
        return is_string($v) ? $v : $default;
    }

    /** @param array<string,mixed> $payload */
    public static function json(array $payload, int $status = 200): void
    {
        if (!headers_sent()) {
            http_response_code($status);
            header('Content-Type: application/json; charset=utf-8');
            header('X-Content-Type-Options: nosniff');
            header('Cache-Control: no-store');
        }
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public static function ok(array $data = [], int $status = 200): void
    {
        self::json(['ok' => true, 'data' => $data], $status);
    }

    public static function fail(ApiError $e): void
    {
        self::json([
            'ok' => false,
            'error' => ['code' => $e->errorCode, 'message' => $e->getMessage()],
        ], $e->httpStatus);
    }

    /** Bearer token from Authorization or custom fallback headers. */
    public static function bearerToken(): ?string
    {
        // 1. Standard server variable
        $h = $_SERVER['HTTP_AUTHORIZATION'] ?? '';

        // 2. Apache mod_rewrite environment variable (E=HTTP_AUTHORIZATION)
        if ($h === '' && !empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $h = (string) $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        }

        // 3. Custom X-Authorization header (never stripped by Apache/FastCGI)
        if ($h === '' && !empty($_SERVER['HTTP_X_AUTHORIZATION'])) {
            $h = (string) $_SERVER['HTTP_X_AUTHORIZATION'];
        }

        // 4. Custom X-Firebase-Token header
        if (!empty($_SERVER['HTTP_X_FIREBASE_TOKEN'])) {
            return trim((string) $_SERVER['HTTP_X_FIREBASE_TOKEN']);
        }

        // 5. apache_request_headers() fallback
        if ($h === '' && function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            $h = $headers['Authorization'] ?? $headers['authorization'] ?? $headers['X-Authorization'] ?? $headers['x-authorization'] ?? '';
            if (!empty($headers['X-Firebase-Token'] ?? $headers['x-firebase-token'])) {
                return trim((string) ($headers['X-Firebase-Token'] ?? $headers['x-firebase-token']));
            }
        }

        // 6. getallheaders() fallback
        if ($h === '' && function_exists('getallheaders')) {
            $headers = getallheaders();
            $h = $headers['Authorization'] ?? $headers['authorization'] ?? $headers['X-Authorization'] ?? $headers['x-authorization'] ?? '';
            if (!empty($headers['X-Firebase-Token'] ?? $headers['x-firebase-token'])) {
                return trim((string) ($headers['X-Firebase-Token'] ?? $headers['x-firebase-token']));
            }
        }

        // 7. Extract Bearer token from string
        if (preg_match('/^Bearer\s+(.+)$/i', $h, $m)) {
            return trim($m[1]);
        }

        // 8. If token passed directly without Bearer prefix
        if (strlen($h) > 64 && strpos($h, '.') !== false) {
            return trim($h);
        }

        // 9. Query parameter fallback (?token=...)
        if (!empty($_GET['token']) && is_string($_GET['token']) && strlen($_GET['token']) > 64) {
            return trim($_GET['token']);
        }

        return null;
    }
}
