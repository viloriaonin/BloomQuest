import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../services/api_service.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final emailController = TextEditingController();
  final passwordController = TextEditingController();
  bool showPassword = false;
  bool loading = false;
  String error = '';

  Future<void> handleLogin() async {
    setState(() {
      error = '';
      loading = true;
    });

    if (emailController.text.trim().isEmpty) {
      setState(() {
        error = 'Email address is required.';
        loading = false;
      });
      return;
    }
    if (passwordController.text.isEmpty) {
      setState(() {
        error = 'Password is required.';
        loading = false;
      });
      return;
    }

    try {
      final data = await ApiService.login(
        emailController.text.trim(),
        passwordController.text,
      );

      print('Login response: $data'); // ← add this
      print('Role: ${data['role']}'); // ← add this

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('token', data['token']);
      await prefs.setString('role', data['role']);
      await prefs.setString('email', data['email']);

      print('Navigating to: ${data['role']}'); // ← add this

      if (!mounted) return;
      if (data['role'] == 'admin') {
        Navigator.pushReplacementNamed(context, '/admin/dashboard');
      } else if (data['role'] == 'faculty') {
        Navigator.pushReplacementNamed(context, '/users/dashboard'); //
      }
    } catch (e) {
      print('Error: $e'); // ← add this
      setState(() => error = e.toString().replaceAll('Exception: ', ''));
    } finally {
      setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final isMobile = screenWidth < 600;

    return Scaffold(
      body: isMobile ? _buildMobileLayout() : _buildDesktopLayout(),
    );
  }

  // Mobile layout — stacked vertically
  Widget _buildMobileLayout() {
    return SingleChildScrollView(
      child: Column(
        children: [
          // Brand Panel — top
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 60, horizontal: 24),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0xFF9c1c1f), Color(0xFF5c0d0f)],
              ),
            ),
            child: Column(
              children: [
                Image.asset(
                  'assets/images/bloomquest-logo.png',
                  width: 130,
                  height: 130,
                ),
                const SizedBox(height: 12),
                const Text(
                  'BloomQuest',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 4),
                Container(width: 40, height: 2, color: const Color(0xFFD4AF37)),
                const SizedBox(height: 8),
                const Text(
                  'Empowering students to grow, learn, and lead.',
                  style: TextStyle(color: Color(0xFFe8c97a), fontSize: 12),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),

          // Login Form — bottom
          Container(
            width: double.infinity,
            color: const Color(0xFFF9FAFB),
            padding: const EdgeInsets.all(24),
            child: _buildLoginForm(),
          ),

          // Footer
          Container(
            width: double.infinity,
            color: const Color(0xFF5c0d0f),
            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
            child: const Text(
              '© 2026 BloomQuest. All rights reserved.',
              style: TextStyle(color: Color(0xFFD4AF37), fontSize: 11),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }

  // Desktop/Tablet layout — side by side
  Widget _buildDesktopLayout() {
    return Row(
      children: [
        // LEFT: Brand Panel
        Expanded(
          child: Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0xFF9c1c1f), Color(0xFF5c0d0f)],
              ),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Image.asset(
                  'assets/images/bloomquest-logo.png',
                  width: 200,
                  height: 200,
                ),
                const SizedBox(height: 16),
                const Text(
                  'BloomQuest',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 36,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.5,
                  ),
                ),
                const SizedBox(height: 8),
                Container(width: 60, height: 3, color: const Color(0xFFD4AF37)),
                const SizedBox(height: 12),
                const Text(
                  'Empowering students to grow, learn, and lead.',
                  style: TextStyle(color: Color(0xFFe8c97a), fontSize: 14),
                ),
              ],
            ),
          ),
        ),

        // RIGHT: Login Form
        Expanded(
          child: Container(
            color: const Color(0xFFF9FAFB),
            padding: const EdgeInsets.all(48),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 400),
                child: _buildLoginForm(),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLoginForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text(
          'Welcome back',
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.bold,
            color: Color(0xFF7B1113),
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Sign in to access your portal',
          style: TextStyle(color: Colors.grey, fontSize: 13),
        ),
        const SizedBox(height: 24),

        // Error message
        if (error.isNotEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
              color: const Color(0xFFfef2f2),
              border: Border.all(color: const Color(0xFFfecaca)),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              error,
              style: const TextStyle(color: Color(0xFF991b1b), fontSize: 13),
            ),
          ),

        // Email
        const Text(
          'Email Address',
          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: emailController,
          keyboardType: TextInputType.emailAddress,
          onSubmitted: (_) => handleLogin(),
          decoration: InputDecoration(
            hintText: 'Enter your email',
            hintStyle: const TextStyle(fontSize: 13),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 14,
            ),
          ),
        ),
        const SizedBox(height: 16),

        // Password
        const Text(
          'Password',
          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: passwordController,
          obscureText: !showPassword,
          onSubmitted: (_) => handleLogin(),
          decoration: InputDecoration(
            hintText: 'Enter your password',
            hintStyle: const TextStyle(fontSize: 13),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 14,
            ),
            suffixIcon: IconButton(
              icon: Icon(
                showPassword ? Icons.visibility_off : Icons.visibility,
                size: 18,
                color: Colors.grey,
              ),
              onPressed: () => setState(() => showPassword = !showPassword),
            ),
          ),
        ),
        const SizedBox(height: 8),

        // Forgot password
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: () {},
            child: const Text(
              'Forgot Password?',
              style: TextStyle(color: Color(0xFFB01C1C), fontSize: 12),
            ),
          ),
        ),
        const SizedBox(height: 8),

        // Login button
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: loading ? null : handleLogin,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFB01C1C),
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
              disabledBackgroundColor: const Color(0xFFB01C1C).withOpacity(0.6),
            ),
            child: Text(
              loading ? 'Signing in...' : 'Login',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 15,
              ),
            ),
          ),
        ),
        const SizedBox(height: 24),

        // Divider
        Row(
          children: [
            const Expanded(child: Divider()),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Text(
                'OR',
                style: TextStyle(color: Colors.grey[400], fontSize: 12),
              ),
            ),
            const Expanded(child: Divider()),
          ],
        ),
        const SizedBox(height: 16),

        // Contact admin
        Center(
          child: Text(
            "Don't have an account? Contact your administrator",
            style: TextStyle(color: Colors.grey[500], fontSize: 12),
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(height: 8),
        Center(
          child: Text(
            'Need help signing in? Contact the registrar\'s office.',
            style: TextStyle(color: Colors.grey[400], fontSize: 11),
            textAlign: TextAlign.center,
          ),
        ),
      ],
    );
  }
}
