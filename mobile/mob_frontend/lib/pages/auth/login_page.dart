import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../services/api_service.dart';
import 'contact_admin_page.dart';

const _kPrimary = Color(0xFF7B1113);
const _kAccentRed = Color(0xFFB01C1C);
const _kGold = Color(0xFFD4AF37);

TextStyle _headlineFont({
  required double fontSize,
  required Color color,
  FontWeight fontWeight = FontWeight.w700,
  double letterSpacing = 0.4,
}) {
  return TextStyle(
    fontFamily: 'serif',
    fontSize: fontSize,
    color: color,
    fontWeight: fontWeight,
    letterSpacing: letterSpacing,
  );
}

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final emailController = TextEditingController();
  final passwordController = TextEditingController();
  final _secureStorage = const FlutterSecureStorage();

  bool showPassword = false;
  bool loading = false;
  String error = '';

  @override
  void dispose() {
    emailController.dispose();
    passwordController.dispose();
    super.dispose();
  }

  Future<void> handleLogin() async {
    if (loading) return;

    final email = emailController.text.trim();

    setState(() {
      error = '';
      loading = true;
    });

    if (email.isEmpty || passwordController.text.isEmpty) {
      setState(() {
        error = 'Email and password are required.';
        loading = false;
      });
      return;
    }

    try {
      final data = await ApiService.login(email, passwordController.text);

      await _secureStorage.write(key: 'token', value: data['token']);
      await _secureStorage.write(key: 'role', value: data['role']);
      await _secureStorage.write(key: 'email', value: data['email']);
      await _secureStorage.write(key: 'user_email', value: data['email']);
      await _secureStorage.write(
        key: 'user_name',
        value: data['name'] ?? data['email'].split('@').first,
      );

      if (!mounted) return;
      if (data['role'] == 'admin') {
        Navigator.pushReplacementNamed(context, '/admin/dashboard');
      } else if (data['role'] == 'faculty') {
        Navigator.pushReplacementNamed(context, '/users/dashboard');
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  void _openForgotPasswordDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const _ForgotPasswordDialog(),
    );
  }

  void _openLegalModal(String type) {
    showDialog(
      context: context,
      builder: (context) => LegalModal(type: type),
    );
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final isMobile = screenWidth < 600;

    return Scaffold(
      body: isMobile ? _buildMobileLayout() : _buildDesktopLayout(),
    );
  }

  Widget _buildMobileLayout() {
    return SingleChildScrollView(
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(24, 48, 24, 40),
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
                  width: 110,
                  height: 110,
                ),
                const SizedBox(height: 10),
                Text(
                  'BloomQuest',
                  style: _headlineFont(fontSize: 24, color: Colors.white),
                ),
                const SizedBox(height: 4),
                Container(width: 40, height: 2, color: _kGold),
                const SizedBox(height: 8),
                const Text(
                  'Empowering students to grow, learn, and lead.',
                  style: TextStyle(color: Color(0xFFe8c97a), fontSize: 12),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
          Transform.translate(
            offset: const Offset(0, -24),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.06),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: _buildLoginForm(),
              ),
            ),
          ),
          _buildFooter(),
        ],
      ),
    );
  }

  Widget _buildDesktopLayout() {
    return Column(
      children: [
        Expanded(
          child: Row(
            children: [
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
                      Text(
                        'BloomQuest',
                        style: _headlineFont(fontSize: 36, color: Colors.white),
                      ),
                      const SizedBox(height: 8),
                      Container(width: 60, height: 3, color: _kGold),
                      const SizedBox(height: 12),
                      const Text(
                        'Empowering students to grow, learn, and lead.',
                        style: TextStyle(
                          color: Color(0xFFe8c97a),
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Expanded(
                child: Container(
                  color: const Color(0xFFF9FAFB),
                  padding: const EdgeInsets.all(48),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 420),
                      child: Container(
                        padding: const EdgeInsets.all(32),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(18),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.05),
                              blurRadius: 20,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: _buildLoginForm(),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        _buildFooter(),
      ],
    );
  }

  Widget _buildFooter() {
    return Container(
      width: double.infinity,
      color: const Color(0xFF5c0d0f),
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 24),
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 12,
        runSpacing: 8,
        children: [
          const Text(
            '© 2026 BloomQuest. All rights reserved.',
            style: TextStyle(color: _kGold, fontSize: 12),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              InkWell(
                onTap: () => _openLegalModal('privacy'),
                child: const Text(
                  'Privacy Policy',
                  style: TextStyle(
                    color: _kGold,
                    fontSize: 12,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              InkWell(
                onTap: () => _openLegalModal('terms'),
                child: const Text(
                  'Terms of Service',
                  style: TextStyle(
                    color: _kGold,
                    fontSize: 12,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLoginForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'Welcome back',
          style: _headlineFont(fontSize: 26, color: _kPrimary),
        ),
        const SizedBox(height: 4),
        const Text(
          'Sign in to access your portal',
          style: TextStyle(color: Colors.grey, fontSize: 13),
        ),
        const SizedBox(height: 24),

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
            child: Row(
              children: [
                const Icon(
                  Icons.error_outline_rounded,
                  size: 18,
                  color: Color(0xFF991b1b),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    error,
                    style: const TextStyle(
                      color: Color(0xFF991b1b),
                      fontSize: 13,
                    ),
                  ),
                ),
              ],
            ),
          ),

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
            filled: true,
            fillColor: const Color(0xFFF9FAFB),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: Colors.grey.shade300),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: Colors.grey.shade300),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: _kPrimary, width: 1.4),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 14,
            ),
          ),
        ),
        const SizedBox(height: 16),

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
            filled: true,
            fillColor: const Color(0xFFF9FAFB),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: Colors.grey.shade300),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: Colors.grey.shade300),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: _kPrimary, width: 1.4),
            ),
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

        Row(
          children: [
            TextButton(
              onPressed: _openForgotPasswordDialog,
              style: TextButton.styleFrom(
                padding: EdgeInsets.zero,
                minimumSize: const Size(0, 0),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text(
                'Forgot Password?',
                style: TextStyle(color: _kAccentRed, fontSize: 12),
              ),
            ),
            const Spacer(),
            TextButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const ContactAdminPage(),
                  ),
                );
              },
              style: TextButton.styleFrom(
                padding: EdgeInsets.zero,
                minimumSize: const Size(0, 0),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text(
                'Contact Admin',
                style: TextStyle(
                  color: _kPrimary,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),

        ElevatedButton(
          onPressed: loading ? null : handleLogin,
          style: ElevatedButton.styleFrom(
            backgroundColor: _kAccentRed,
            foregroundColor: Colors.white,
            disabledBackgroundColor: _kAccentRed.withValues(alpha: 0.6),
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: const StadiumBorder(),
          ),
          child: loading
              ? const SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Text(
                  'Sign in',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                ),
        ),
        const SizedBox(height: 16),
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

// --- LEGAL MODAL COMPONENT ---
class LegalModal extends StatelessWidget {
  final String type; // "privacy" | "terms"

  const LegalModal({super.key, required this.type});

  @override
  Widget build(BuildContext context) {
    final isPrivacy = type == 'privacy';
    final title = isPrivacy ? 'Privacy Policy' : 'Terms of Service';

    return Dialog(
      backgroundColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 550, maxHeight: 600),
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: _kPrimary,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.grey),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const Divider(height: 20),
              Expanded(
                child: SingleChildScrollView(
                  child: isPrivacy ? _buildPrivacyText() : _buildTermsText(),
                ),
              ),
              const SizedBox(height: 16),
              Align(
                alignment: Alignment.centerRight,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _kPrimary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  onPressed: () => Navigator.pop(context),
                  child: const Text(
                    'Close',
                    style: TextStyle(color: Colors.white),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPrivacyText() {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'BloomQuest Privacy Policy',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
        ),
        SizedBox(height: 8),
        Text(
          'At BloomQuest, we respect your privacy and are committed to protecting the personal data of our faculty and administration members.\n\n'
          '1. Information We Collect:\n'
          'We collect email addresses, user roles, and system interaction history necessary for generating assessment tools based on Bloom\'s Taxonomy.\n\n'
          '2. How We Use Information:\n'
          'Your information is strictly used for authentication, platform security, and personalizing your question classification dashboard.\n\n'
          '3. Data Protection:\n'
          'All passwords and session tokens are stored using industry-standard secure storage encryption.',
          style: TextStyle(fontSize: 13, height: 1.5, color: Colors.black87),
        ),
      ],
    );
  }

  Widget _buildTermsText() {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'BloomQuest Terms of Service',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
        ),
        SizedBox(height: 8),
        Text(
          'Welcome to BloomQuest. By logging in, you agree to comply with the following terms:\n\n'
          '1. Acceptable Use:\n'
          'This system is reserved exclusively for authorized institutional staff. Unauthorized distribution of question items or administrative credentials is strictly prohibited.\n\n'
          '2. Intellectual Property:\n'
          'Syllabi and exam item matrices processed within the application remain the property of the institution.\n\n'
          '3. System Integrity:\n'
          'Attempts to bypass role-based access control or automated AI generation parameters will result in immediate account suspension.',
          style: TextStyle(fontSize: 13, height: 1.5, color: Colors.black87),
        ),
      ],
    );
  }
}

// --- FORGOT PASSWORD DIALOG ---
enum _ForgotStep { email, otp, newPassword }

class _ForgotPasswordDialog extends StatefulWidget {
  const _ForgotPasswordDialog();

  @override
  State<_ForgotPasswordDialog> createState() => _ForgotPasswordDialogState();
}

class _ForgotPasswordDialogState extends State<_ForgotPasswordDialog> {
  _ForgotStep step = _ForgotStep.email;
  bool loading = false;
  String error = '';

  final emailController = TextEditingController();
  final otpController = TextEditingController();
  final newPasswordController = TextEditingController();
  final confirmPasswordController = TextEditingController();
  bool showPassword = false;

  @override
  void dispose() {
    emailController.dispose();
    otpController.dispose();
    newPasswordController.dispose();
    confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _sendOtp() async {
    if (emailController.text.trim().isEmpty) {
      setState(() => error = 'Email address is required.');
      return;
    }
    setState(() {
      loading = true;
      error = '';
    });
    try {
      await ApiService.sendPasswordResetOtp(emailController.text.trim());
      if (!mounted) return;
      setState(() {
        step = _ForgotStep.otp;
      });
    } catch (e) {
      setState(() => error = e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _verifyOtp() async {
    if (otpController.text.trim().isEmpty) {
      setState(() => error = 'Verification code is required.');
      return;
    }
    setState(() {
      loading = true;
      error = '';
    });
    try {
      await ApiService.verifyPasswordResetOtp(
        emailController.text.trim(),
        otpController.text.trim(),
      );
      if (!mounted) return;
      setState(() => step = _ForgotStep.newPassword);
    } catch (e) {
      setState(() => error = e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _resetPassword() async {
    if (newPasswordController.text.isEmpty) {
      setState(() => error = 'New password is required.');
      return;
    }

    final passwordRegex = RegExp(
      r'^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$',
    );
    if (!passwordRegex.hasMatch(newPasswordController.text)) {
      setState(
        () => error =
            'Password must be at least 8 characters long, and include an uppercase letter, a number, and a special character.',
      );
      return;
    }

    if (newPasswordController.text != confirmPasswordController.text) {
      setState(() => error = 'Passwords do not match.');
      return;
    }

    setState(() {
      loading = true;
      error = '';
    });
    try {
      await ApiService.resetPassword(
        emailController.text.trim(),
        otpController.text.trim(),
        newPasswordController.text,
      );
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Password reset successfully. Please log in.'),
        ),
      );
    } catch (e) {
      setState(() => error = e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  InputDecoration _fieldDecoration(
    String hint, {
    IconData? prefixIcon,
    Widget? suffixIcon,
  }) {
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(fontSize: 13, color: Colors.grey.shade400),
      prefixIcon: prefixIcon != null
          ? Icon(prefixIcon, size: 18, color: Colors.grey.shade500)
          : null,
      suffixIcon: suffixIcon,
      filled: true,
      fillColor: const Color(0xFFF9FAFB),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: Colors.grey.shade300),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: Colors.grey.shade300),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: _kPrimary, width: 1.4),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    );
  }

  int get _stepIndex => switch (step) {
    _ForgotStep.email => 0,
    _ForgotStep.otp => 1,
    _ForgotStep.newPassword => 2,
  };

  Widget _buildStepDots() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(3, (i) {
        final active = i <= _stepIndex;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          margin: const EdgeInsets.symmetric(horizontal: 3),
          width: i == _stepIndex ? 22 : 6,
          height: 6,
          decoration: BoxDecoration(
            color: active ? _kAccentRed : Colors.grey.shade300,
            borderRadius: BorderRadius.circular(3),
          ),
        );
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    final headerIcon = switch (step) {
      _ForgotStep.email => Icons.mail_outline_rounded,
      _ForgotStep.otp => Icons.password_rounded,
      _ForgotStep.newPassword => Icons.lock_reset_rounded,
    };
    final title = switch (step) {
      _ForgotStep.email => 'Forgot Password',
      _ForgotStep.otp => 'Enter Verification Code',
      _ForgotStep.newPassword => 'Set New Password',
    };
    final primaryLabel = switch (step) {
      _ForgotStep.email => 'Send Code',
      _ForgotStep.otp => 'Verify',
      _ForgotStep.newPassword => 'Reset Password',
    };
    final onPrimaryPressed = switch (step) {
      _ForgotStep.email => _sendOtp,
      _ForgotStep.otp => _verifyOtp,
      _ForgotStep.newPassword => _resetPassword,
    };

    return Dialog(
      backgroundColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 400),
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(28, 30, 28, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: _kPrimary.withValues(alpha: 0.08),
                      shape: BoxShape.circle,
                      border: Border.all(color: _kGold.withValues(alpha: 0.55)),
                    ),
                    child: Icon(headerIcon, color: _kPrimary, size: 26),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  title,
                  textAlign: TextAlign.center,
                  style: _headlineFont(fontSize: 19, color: _kPrimary),
                ),
                const SizedBox(height: 10),
                _buildStepDots(),
                const SizedBox(height: 20),

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
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(
                          Icons.error_outline_rounded,
                          size: 18,
                          color: Color(0xFF991b1b),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            error,
                            style: const TextStyle(
                              color: Color(0xFF991b1b),
                              fontSize: 12.5,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                if (step == _ForgotStep.email) ...[
                  Text(
                    'Enter your account email address. We\'ll send a verification code to reset your password.',
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.grey.shade600,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 18),
                  const Text(
                    'Email Address',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: emailController,
                    keyboardType: TextInputType.emailAddress,
                    onSubmitted: (_) => loading ? null : _sendOtp(),
                    decoration: _fieldDecoration(
                      'Enter your email',
                      prefixIcon: Icons.mail_outline_rounded,
                    ),
                  ),
                ],

                if (step == _ForgotStep.otp) ...[
                  Text.rich(
                    TextSpan(
                      style: TextStyle(
                        fontSize: 13,
                        color: Colors.grey.shade600,
                        height: 1.4,
                      ),
                      children: [
                        const TextSpan(
                          text: 'A verification code was sent to ',
                        ),
                        TextSpan(
                          text: emailController.text.trim(),
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            color: _kPrimary,
                          ),
                        ),
                        const TextSpan(text: '.'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  const Text(
                    'Verification Code',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: otpController,
                    keyboardType: TextInputType.number,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 18,
                      letterSpacing: 6,
                      fontWeight: FontWeight.w600,
                      color: _kPrimary,
                    ),
                    onSubmitted: (_) => loading ? null : _verifyOtp(),
                    decoration: _fieldDecoration('••••••'),
                  ),
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: loading ? null : _sendOtp,
                      style: TextButton.styleFrom(
                        padding: EdgeInsets.zero,
                        minimumSize: const Size(0, 0),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: const Text(
                        'Resend code',
                        style: TextStyle(
                          color: _kAccentRed,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],

                if (step == _ForgotStep.newPassword) ...[
                  const Text(
                    'New Password',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: newPasswordController,
                    obscureText: !showPassword,
                    decoration:
                        _fieldDecoration(
                          'Enter new password',
                          prefixIcon: Icons.lock_outline_rounded,
                        ).copyWith(
                          suffixIcon: IconButton(
                            icon: Icon(
                              showPassword
                                  ? Icons.visibility_off
                                  : Icons.visibility,
                              size: 18,
                              color: Colors.grey,
                            ),
                            onPressed: () =>
                                setState(() => showPassword = !showPassword),
                          ),
                        ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Confirm Password',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: confirmPasswordController,
                    obscureText: !showPassword,
                    onSubmitted: (_) => loading ? null : _resetPassword(),
                    decoration: _fieldDecoration(
                      'Re-enter new password',
                      prefixIcon: Icons.lock_outline_rounded,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Min 8 chars, 1 uppercase, 1 number, 1 special character.',
                    style: TextStyle(
                      fontSize: 11.5,
                      color: Colors.grey.shade500,
                    ),
                  ),
                ],

                const SizedBox(height: 24),

                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: loading
                            ? null
                            : () => Navigator.pop(context),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: _kPrimary,
                          side: const BorderSide(color: _kPrimary, width: 1.2),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: const StadiumBorder(),
                        ),
                        child: const Text(
                          'Cancel',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _kAccentRed,
                          foregroundColor: Colors.white,
                          disabledBackgroundColor: _kAccentRed.withValues(
                            alpha: 0.6,
                          ),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: const StadiumBorder(),
                          elevation: 0,
                        ),
                        onPressed: loading ? null : onPrimaryPressed,
                        child: loading
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : Text(
                                primaryLabel,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
