import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../services/api_service.dart';
import 'contact_admin_page.dart';

const _kPrimary = Color(0xFF7B1113);
const _kAccentRed = Color(0xFFB01C1C);
const _kGold = Color(0xFFD4AF37);

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

  static const int _kMaxAttempts = 5;
  static const Duration _kBaseLockoutDuration = Duration(minutes: 1);
  static const Duration _kMaxLockoutDuration = Duration(minutes: 30);

  Timer? _lockoutTicker;
  DateTime? _lockedUntil;
  int _remainingLockoutSeconds = 0;
  Timer? _emailDebounce;

  @override
  void initState() {
    super.initState();
    emailController.addListener(_onEmailChanged);
  }

  void _onEmailChanged() {
    _emailDebounce?.cancel();
    _emailDebounce = Timer(const Duration(milliseconds: 400), () {
      _refreshLockoutState(emailController.text.trim());
    });
  }

  @override
  void dispose() {
    _lockoutTicker?.cancel();
    _emailDebounce?.cancel();
    emailController.removeListener(_onEmailChanged);
    emailController.dispose();
    passwordController.dispose();
    super.dispose();
  }

  String _attemptsKey(String email) => 'login_attempts_${email.toLowerCase()}';
  String _lockoutKey(String email) => 'login_lockout_${email.toLowerCase()}';
  String _strikesKey(String email) => 'login_strikes_${email.toLowerCase()}';

  Future<bool> _refreshLockoutState(String email) async {
    if (email.isEmpty) return false;
    final prefs = await SharedPreferences.getInstance();
    final lockoutMillis = prefs.getInt(_lockoutKey(email));

    if (lockoutMillis == null) {
      _stopLockoutTicker();
      return false;
    }

    final lockedUntil = DateTime.fromMillisecondsSinceEpoch(lockoutMillis);
    if (DateTime.now().isAfter(lockedUntil)) {
      await prefs.remove(_lockoutKey(email));
      _stopLockoutTicker();
      return false;
    }

    _startLockoutTicker(lockedUntil);
    return true;
  }

  void _startLockoutTicker(DateTime lockedUntil) {
    _lockedUntil = lockedUntil;
    _lockoutTicker?.cancel();
    void tick() {
      final remaining = _lockedUntil!.difference(DateTime.now());
      if (remaining.isNegative || remaining.inSeconds <= 0) {
        _stopLockoutTicker();
        setState(() => error = '');
        return;
      }
      setState(() => _remainingLockoutSeconds = remaining.inSeconds);
    }

    tick();
    _lockoutTicker = Timer.periodic(const Duration(seconds: 1), (_) => tick());
  }

  void _stopLockoutTicker() {
    _lockoutTicker?.cancel();
    _lockoutTicker = null;
    _lockedUntil = null;
    if (mounted) setState(() => _remainingLockoutSeconds = 0);
  }

  Future<void> _recordFailedAttempt(String email) async {
    if (email.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    final attempts = (prefs.getInt(_attemptsKey(email)) ?? 0) + 1;

    if (attempts >= _kMaxAttempts) {
      final strikes = (prefs.getInt(_strikesKey(email)) ?? 0) + 1;
      final multiplier = 1 << (strikes - 1); // 1, 2, 4, 8...
      var duration = _kBaseLockoutDuration * multiplier;
      if (duration > _kMaxLockoutDuration) duration = _kMaxLockoutDuration;

      final lockedUntil = DateTime.now().add(duration);
      await prefs.setInt(_lockoutKey(email), lockedUntil.millisecondsSinceEpoch);
      await prefs.setInt(_strikesKey(email), strikes);
      await prefs.remove(_attemptsKey(email));
      _startLockoutTicker(lockedUntil);
    } else {
      await prefs.setInt(_attemptsKey(email), attempts);
    }
  }

  Future<void> _resetLoginAttempts(String email) async {
    if (email.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_attemptsKey(email));
    await prefs.remove(_lockoutKey(email));
    await prefs.remove(_strikesKey(email));
    _stopLockoutTicker();
  }

  bool get _isLockedOut => _remainingLockoutSeconds > 0;

  String _formatRemaining(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    if (m > 0) return '${m}m ${s.toString().padLeft(2, '0')}s';
    return '${s}s';
  }

  Future<void> handleLogin() async {
    if (loading) return;

    final email = emailController.text.trim();

    setState(() {
      error = '';
      loading = true;
    });

    if (email.isEmpty) {
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

    final isLockedOut = await _refreshLockoutState(email);
    if (isLockedOut) {
      setState(() {
        error =
            'Too many failed attempts. Try again in ${_formatRemaining(_remainingLockoutSeconds)}.';
        loading = false;
      });
      return;
    }

    try {
      final data = await ApiService.login(
        email,
        passwordController.text,
      );

      print('Login response: $data');
      print('Role: ${data['role']}');

      await _resetLoginAttempts(email);

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('token', data['token']);
      await prefs.setString('role', data['role']);
      await prefs.setString('email', data['email']);
      await prefs.setString('user_email', data['email']);
      await prefs.setString('user_name', data['name'] ?? data['email'].split('@').first);

      print('Navigating to: ${data['role']}');

      if (!mounted) return;
      if (data['role'] == 'admin') {
        Navigator.pushReplacementNamed(context, '/admin/dashboard');
      } else if (data['role'] == 'faculty') {
        Navigator.pushReplacementNamed(context, '/users/dashboard');
      }
    } catch (e) {
      print('Error: $e');
      await _recordFailedAttempt(email);

      if (!mounted) return;

      if (_lockedUntil != null) {
        setState(() {
          error =
              'Too many failed attempts. Try again in ${_formatRemaining(_remainingLockoutSeconds)}.';
        });
      } else {
        final prefs = await SharedPreferences.getInstance();
        final attempts = prefs.getInt(_attemptsKey(email)) ?? 0;
        final remaining = _kMaxAttempts - attempts;
        final message = e.toString().replaceAll('Exception: ', '');
        setState(() {
          error = remaining <= 2
              ? '$message ($remaining attempt${remaining == 1 ? '' : 's'} left before temporary lockout.)'
              : message;
        });
      }
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
                      color: Colors.black.withOpacity(0.06),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: _buildLoginForm(),
              ),
            ),
          ),
          Container(
            width: double.infinity,
            margin: const EdgeInsets.only(top: 4),
            color: const Color(0xFF5c0d0f),
            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
            child: const Text(
              '© 2026 BloomQuest. All rights reserved.',
              style: TextStyle(color: _kGold, fontSize: 11),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDesktopLayout() {
    return Row(
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
                Container(width: 60, height: 3, color: _kGold),
                const SizedBox(height: 12),
                const Text(
                  'Empowering students to grow, learn, and lead.',
                  style: TextStyle(color: Color(0xFFe8c97a), fontSize: 14),
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
                        color: Colors.black.withOpacity(0.05),
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
    );
  }

  Widget _buildLoginForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text(
          'Welcome back',
          style: TextStyle(
            fontSize: 26,
            fontWeight: FontWeight.bold,
            color: _kPrimary,
          ),
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
              color: _isLockedOut
                  ? const Color(0xFFFFF7E6)
                  : const Color(0xFFfef2f2),
              border: Border.all(
                color: _isLockedOut
                    ? const Color(0xFFE8C97A)
                    : const Color(0xFFfecaca),
              ),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Icon(
                  _isLockedOut
                      ? Icons.lock_clock_rounded
                      : Icons.error_outline_rounded,
                  size: 18,
                  color: _isLockedOut
                      ? const Color(0xFF8A6516)
                      : const Color(0xFF991b1b),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    error,
                    style: TextStyle(
                      color: _isLockedOut
                          ? const Color(0xFF8A6516)
                          : const Color(0xFF991b1b),
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

        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
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
        ),
        const SizedBox(height: 12),

        ElevatedButton(
          onPressed: (loading || _isLockedOut) ? null : handleLogin,
          style: ElevatedButton.styleFrom(
            backgroundColor: _kAccentRed,
            foregroundColor: Colors.white, // Contrast Fixed
            disabledBackgroundColor: _kAccentRed.withOpacity(0.6),
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
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
              : Text(
                  _isLockedOut
                      ? 'Locked (${_formatRemaining(_remainingLockoutSeconds)})'
                      : 'Login',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                ),
        ),
        const SizedBox(height: 24),

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

        Center(
          child: Text(
            "Don't have an account? Contact your administrator",
            style: TextStyle(color: Colors.grey[500], fontSize: 12),
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(height: 4),
        Center(
          child: Text(
            'Need help signing in? Contact the registrar\'s office.',
            style: TextStyle(color: Colors.grey[400], fontSize: 11),
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(height: 16),

        OutlinedButton(
          onPressed: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => const ContactAdminPage(),
              ),
            );
          },
          style: OutlinedButton.styleFrom(
            foregroundColor: _kPrimary,
            side: const BorderSide(color: _kPrimary, width: 1.3),
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          child: const Text(
            'Contact Admin',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
          ),
        ),
      ],
    );
  }
}

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
  String? debugOtp; 

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
      final data = await ApiService.sendPasswordResetOtp(
        emailController.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        step = _ForgotStep.otp;
        debugOtp = data['otp']?.toString();
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
    if (newPasswordController.text.length < 6) {
      setState(() => error = 'Password must be at least 6 characters.');
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
      contentPadding: const EdgeInsets.symmetric(
        horizontal: 14,
        vertical: 14,
      ),
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
                      color: _kPrimary.withOpacity(0.08),
                      shape: BoxShape.circle,
                      border: Border.all(color: _kGold.withOpacity(0.55)),
                    ),
                    child: Icon(headerIcon, color: _kPrimary, size: 26),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  title,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 19,
                    fontWeight: FontWeight.bold,
                    color: _kPrimary,
                  ),
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
                        const TextSpan(text: 'A verification code was sent to '),
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
                  if (debugOtp != null) ...[
                    const SizedBox(height: 10),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF7E0),
                        border: Border.all(color: const Color(0xFFE8C97A)),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.info_outline,
                            size: 16,
                            color: Color(0xFF8a6d1f),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: RichText(
                              text: TextSpan(
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFF8a6d1f),
                                ),
                                children: [
                                  const TextSpan(text: 'Dev mode — your code is: '),
                                  TextSpan(
                                    text: debugOtp,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
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
                    'Must be at least 6 characters.',
                    style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500),
                  ),
                ],

                const SizedBox(height: 24),

                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: loading ? null : () => Navigator.pop(context),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: _kPrimary,
                          side: const BorderSide(color: _kPrimary, width: 1.2),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
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
                          foregroundColor: Colors.white, // Contrast Fixed
                          disabledBackgroundColor: _kAccentRed.withOpacity(0.6),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
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