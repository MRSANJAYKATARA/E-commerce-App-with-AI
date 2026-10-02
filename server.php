<?php
/**
 * Local development router for PHP's built-in server:
 *   php -S 0.0.0.0:8000 server.php
 * In production, use Apache (.htaccess provided) or Nginx (see docs).
 */

// Hardening headers for dev (parity with .htaccess in production).
if (!headers_sent()) {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    header('X-Permitted-Cross-Domain-Policies: none');
}

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Block sensitive files & internal paths (parity with production .htaccess)
if (
    preg_match('#(^|/)\.#', $path) ||
    preg_match('#^/(vendor|migrations|docs|storage|api/lib|tools|config)/#', $path) ||
    preg_match('#^/(composer\.(json|lock)|api/config\.php)$#', $path)
) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Forbidden';
    return true;
}

$file = __DIR__ . $path;
// Serve existing static assets directly.
if ($path !== '/' && is_file($file) && !preg_match('#^/api#', $path)) {
    return false;
}
// Privacy Policy standalone route (DPDP Act, 2023)
if ($path === '/privacy' || $path === '/privacy.html') {
    require __DIR__ . '/privacy.html';
    return true;
}
// 1-Click Database Installer route
if ($path === '/install' || $path === '/install.php') {
    require __DIR__ . '/install.php';
    return true;
}
// Admin dashboard route
if ($path === '/admin' || $path === '/admin/') {
    require __DIR__ . '/admin/index.html';
    return true;
}
// Route /api/* to the front controller.
if (preg_match('#^/api#', $path)) {
    $_SERVER['SCRIPT_NAME'] = '/api/index.php';
    require __DIR__ . '/api/index.php';
    return true;
}
// SPA fallback for the student app.
if (is_file(__DIR__ . '/index.html')) {
    require __DIR__ . '/index.html';
    return true;
}
http_response_code(404);
echo 'Not found';
