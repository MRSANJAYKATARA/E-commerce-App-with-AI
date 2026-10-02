import 'dart:async';
import 'dart:convert';
import 'dart:isolate';

/// Zero-Jank Worker Isolate Helper.
///
/// Dispatches expensive tasks (JSON parsing, decryption, token processing)
/// away from the Main UI Isolate so the UI thread never drops below 120 FPS.
class IsolateWorker {
  /// Parse JSON string on a background thread.
  static Future<dynamic> parseJson(String source) async {
    return Isolate.run(() => jsonDecode(source));
  }

  /// Encode data to JSON string on a background thread.
  static Future<String> stringifyJson(dynamic data) async {
    return Isolate.run(() => jsonEncode(data));
  }

  /// Execute any heavy CPU bound computation in a background isolate.
  static Future<R> compute<T, R>(R Function(T) callback, T message) async {
    return Isolate.run(() => callback(message));
  }
}
