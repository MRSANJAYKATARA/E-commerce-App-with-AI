import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

/// Snappy Offline-First Local Store (0ms read time).
///
/// Keeps cached copies of all essential catalog, user, and wallet records
/// so the app launches instantly without waiting for network requests.
class OfflineStore {
  static SharedPreferences? _prefs;

  static Future<void> init() async {
    _prefs ??= await SharedPreferences.getInstance();
  }

  static Future<void> saveCatalog(List<Map<String, dynamic>> products) async {
    await _prefs?.setString('cached_catalog', jsonEncode(products));
  }

  static List<Map<String, dynamic>> getCatalog() {
    final raw = _prefs?.getString('cached_catalog');
    if (raw == null || raw.isEmpty) return [];
    try {
      final decoded = jsonDecode(raw) as List;
      return decoded.map((e) => Map<String, dynamic>.from(e)).toList();
    } catch (_) {
      return [];
    }
  }

  static Future<void> saveUserProfile(Map<String, dynamic> user) async {
    await _prefs?.setString('cached_user_profile', jsonEncode(user));
  }

  static Map<String, dynamic>? getUserProfile() {
    final raw = _prefs?.getString('cached_user_profile');
    if (raw == null || raw.isEmpty) return null;
    try {
      return Map<String, dynamic>.from(jsonDecode(raw));
    } catch (_) {
      return null;
    }
  }

  static Future<void> setAuthToken(String token) async {
    await _prefs?.setString('auth_token', token);
  }

  static String? getAuthToken() {
    return _prefs?.getString('auth_token');
  }

  static Future<void> clearSession() async {
    await _prefs?.remove('auth_token');
    await _prefs?.remove('cached_user_profile');
  }
}
