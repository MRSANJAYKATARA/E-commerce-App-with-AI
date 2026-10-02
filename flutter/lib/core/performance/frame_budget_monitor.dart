import 'dart:ui';
import 'package:flutter/foundation.dart';
import 'package:flutter/scheduler.dart';

/// Senior Flutter Performance: 120 FPS Frame Budget Monitor.
///
/// At 120Hz, one frame = 8.33 milliseconds (4.16ms UI thread + 4.16ms Raster thread).
/// Any frame that exceeds 8.33ms is considered a dropped frame (jank).
class FrameBudgetMonitor {
  static const double targetRefreshRate = 120.0;
  static const double frameBudgetMs = 1000.0 / targetRefreshRate; // 8.33ms

  static int totalFrames = 0;
  static int jankFrames = 0;
  static bool _initialized = false;

  /// Start monitoring frame performance in debug/profile mode.
  static void initialize() {
    if (_initialized) return;
    _initialized = true;

    WidgetsBinding.instance.addTimingsCallback((List<FrameTiming> timings) {
      for (final timing in timings) {
        totalFrames++;
        final uiTimeMs = timing.buildDuration.inMicroseconds / 1000.0;
        final rasterTimeMs = timing.rasterDuration.inMicroseconds / 1000.0;
        final totalDurationMs = timing.totalSpan.inMicroseconds / 1000.0;

        if (totalDurationMs > frameBudgetMs) {
          jankFrames++;
          if (kDebugMode) {
            debugPrint(
              '[120FPS JANK DETECTED] Frame #${totalFrames} took ${totalDurationMs.toStringAsFixed(2)}ms '
              '(UI: ${uiTimeMs.toStringAsFixed(2)}ms, Raster: ${rasterTimeMs.toStringAsFixed(2)}ms, '
              'Budget: ${frameBudgetMs.toStringAsFixed(2)}ms)',
            );
          }
        }
      }
    });
  }

  /// Current UI smoothness ratio (percentage of 120 FPS frames delivered).
  static double get smoothnessPercentage {
    if (totalFrames == 0) return 100.0;
    return ((totalFrames - jankFrames) / totalFrames) * 100.0;
  }
}
