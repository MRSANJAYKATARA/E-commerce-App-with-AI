import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'core/performance/frame_budget_monitor.dart';
import 'core/storage/offline_store.dart';
import 'presentation/screens/home_screen.dart';

void main() async {
  // Ensure engine binding is ready
  WidgetsFlutterBinding.ensureInitialized();

  // 1. Initialize Frame Budget Monitor (120 FPS / 8.33ms jank detection)
  FrameBudgetMonitor.initialize();

  // 2. Initialize Snappy Offline Store (0ms read time)
  await OfflineStore.init();

  // 3. Set System UI overlay style for seamless edge-to-edge rendering
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Color(0xFF0B1020),
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  runApp(const ExamLegacyFlutterApp());
}

class ExamLegacyFlutterApp extends StatelessWidget {
  const ExamLegacyFlutterApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ExamLegacy',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.dark,
      darkTheme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFF0B1020),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF4F46E5),
          brightness: Brightness.dark,
        ),
      ),
      home: const HomeScreen(),
    );
  }
}
