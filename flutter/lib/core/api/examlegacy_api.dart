import 'dart:convert';
import 'package:http/http.dart' as http;
import '../performance/isolate_worker.dart';
import '../storage/offline_store.dart';

/// ExamLegacy Network Client: Dual MySQL REST & Cloud Firestore connector.
class ExamLegacyApi {
  static const String baseUrl = 'http://127.0.0.1:8000/api';

  static Map<String, String> _headers() {
    final token = OfflineStore.getAuthToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  /// Fetch product catalog with automatic offline fallback.
  static Future<List<Map<String, dynamic>>> fetchProducts() async {
    try {
      final response = await http
          .get(Uri.parse('$baseUrl/products?limit=20'), headers: _headers())
          .timeout(const Duration(seconds: 4));

      if (response.statusCode == 200) {
        // Parse on background isolate to prevent UI thread frame drops
        final data = await IsolateWorker.parseJson(response.body);
        final list = (data['data']['products'] as List)
            .map((e) => Map<String, dynamic>.from(e))
            .toList();

        // Update local offline store asynchronously
        unawaited(OfflineStore.saveCatalog(list));
        return list;
      }
    } catch (_) {
      // Network failed or offline - return local cached copy instantly
    }
    return OfflineStore.getCatalog();
  }

  /// Ask Study AI
  static Future<String> askStudyAi(String query) async {
    final response = await http.post(
      Uri.parse('$baseUrl/ai/study'),
      headers: _headers(),
      body: await IsolateWorker.stringifyJson({'message': query}),
    );
    if (response.statusCode == 200) {
      final data = await IsolateWorker.parseJson(response.body);
      return data['data']['response'] ?? 'No response received.';
    }
    throw Exception('Failed to get answer from Study AI');
  }
}

void unawaited(Future<void> future) {}
