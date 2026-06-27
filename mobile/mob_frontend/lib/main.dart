import 'package:flutter/material.dart';
import 'pages/auth/login_page.dart';
import 'pages/users/dashboard.dart';
import 'pages/admin/dashboard.dart';

void main() {
  runApp(const BloomQuestApp());
}

class BloomQuestApp extends StatelessWidget {
  const BloomQuestApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BloomQuest',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF7B1113)),
        useMaterial3: true,
      ),
      initialRoute: '/',
      routes: {
        '/': (context) => const LoginPage(),
        '/users/dashboard': (context) => const TeacherDashboardPage(),
        '/admin/dashboard': (context) => const AdminDashboardPage(),
      },
    );
  }
}
