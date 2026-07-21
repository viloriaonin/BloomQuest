import 'package:flutter/material.dart';
import '../../services/api_service.dart';

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

class ContactAdminPage extends StatefulWidget {
  const ContactAdminPage({super.key});

  @override
  State<ContactAdminPage> createState() => _ContactAdminPageState();
}

class _DeptOption {
  final String id;
  final String name;
  final String code;

  _DeptOption({required this.id, required this.name, required this.code});

  factory _DeptOption.fromJson(Map<String, dynamic> json) {
    return _DeptOption(
      id: (json['id'] ?? json['_id']).toString(),
      name: json['name'] ?? '',
      code: json['code'] ?? '',
    );
  }
}

class _ContactAdminPageState extends State<ContactAdminPage> {
  final _fullNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _otpController = TextEditingController();
  final _emailFocusNode = FocusNode();

  List<_DeptOption> _departments = [];
  bool _deptLoading = true;
  String _deptError = '';
  String? _selectedDepartment;

  bool _loading = false;
  String _error = '';
  String _success = '';

  bool _isOtpMode = false;

  @override
  void initState() {
    super.initState();
    _emailFocusNode.addListener(() {
      if (!_emailFocusNode.hasFocus) {
        _handleEmailBlur();
      }
    });
    _loadDepartments();
  }

  Future<void> _loadDepartments() async {
    setState(() {
      _deptLoading = true;
      _deptError = '';
    });
    try {
      final data = await ApiService.fetchDepartments();
      if (!mounted) return;
      setState(() {
        _departments = data
            .map((e) => _DeptOption.fromJson(e as Map<String, dynamic>))
            .toList();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _deptError = 'Could not load departments.');
    } finally {
      if (mounted) setState(() => _deptLoading = false);
    }
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _emailController.dispose();
    _otpController.dispose();
    _emailFocusNode.dispose();
    super.dispose();
  }

  bool _isValidEmail(String value) {
    final emailRegex = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
    return emailRegex.hasMatch(value);
  }

  String _sanitizeEmail(String value) {
    if (value.isEmpty) return value;
    var v = value.trim();
    if (v.contains('@')) {
      final parts = v.split('@');
      final local = parts.first;
      var domain = parts.sublist(1).join('@');
      domain = domain.replaceAll(RegExp(r'[,;\s]+'), '.');
      v = '$local@$domain';
    }
    return v;
  }

  // SECURITY: Removed the backend enumeration check. Now it only formats typos locally.
  void _handleEmailBlur() {
    final email = _emailController.text;
    if (email.trim().isEmpty) return;

    final sanitized = _sanitizeEmail(email);
    if (sanitized != email) {
      setState(() {
        _emailController.text = sanitized;
        _error = 'We corrected a small typo in your email address.';
      });
      Future.delayed(const Duration(seconds: 4), () {
        if (mounted) setState(() => _error = '');
      });
    }
  }

  Future<void> _submitRequest() async {
    final fullName = _fullNameController.text.trim();
    final selectedDept = _departments.where((d) => d.id == _selectedDepartment);
    final department = selectedDept.isNotEmpty ? selectedDept.first.name : '';
    final email = _emailController.text.trim();

    setState(() {
      _error = '';
      _success = '';
    });

    if (fullName.isEmpty || department.isEmpty || email.isEmpty) {
      setState(() => _error = 'Full name, department, and email are required.');
      return;
    }

    if (!_isValidEmail(email)) {
      setState(() => _error = 'Please enter a valid email address.');
      return;
    }

    setState(() => _loading = true);

    try {
      final payloadEmail = _sanitizeEmail(email);
      _emailController.text = payloadEmail;

      // Ensure the backend throws an exception here if the email is already registered/pending
      // SECURITY: No demo OTPs exposed to the client
      await ApiService.requestContactAdminOtp(
        fullName,
        department,
        payloadEmail,
      );

      if (!mounted) return;

      setState(() {
        _success = 'An OTP has been sent to your email. Please verify.';
        _isOtpMode = true;
      });
    } catch (e) {
      setState(() => _error = e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _verifyOtp() async {
    final otp = _otpController.text.trim();
    final email = _emailController.text.trim();

    setState(() {
      _error = '';
      _success = '';
    });

    if (otp.isEmpty) {
      setState(() => _error = 'Please enter the OTP.');
      return;
    }

    setState(() => _loading = true);

    try {
      await ApiService.verifyOtp(email, otp);

      if (!mounted) return;

      setState(() {
        _success =
            'Email verified! Request submitted. Please wait for admin approval.';
        _isOtpMode = false;
        _fullNameController.clear();
        _emailController.clear();
        _otpController.clear();
        _selectedDepartment = null;
      });
    } catch (e) {
      setState(() => _error = e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Widget _messageBanner({
    required String text,
    required Color bg,
    required Color border,
    required Color fg,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: bg,
        border: Border.all(color: border),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(text, style: TextStyle(color: fg, fontSize: 13)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(8, 8, 20, 28),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Color(0xFF9c1c1f), Color(0xFF5c0d0f)],
                  ),
                ),
                child: SafeArea(
                  bottom: false,
                  child: Row(
                    children: [
                      IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(Icons.arrow_back, color: Colors.white),
                        splashRadius: 20,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        'Contact Admin',
                        style: _headlineFont(fontSize: 22, color: Colors.white),
                      ),
                    ],
                  ),
                ),
              ),

              Transform.translate(
                offset: const Offset(0, -20),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
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
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          _isOtpMode
                              ? 'Enter the One-Time Password sent to your email to verify your request.'
                              : 'Submit a request to the administrator to get access to BloomQuest. You\u2019ll be notified once it\u2019s reviewed.',
                          style: const TextStyle(
                            fontSize: 13,
                            color: Colors.black54,
                            height: 1.4,
                          ),
                        ),
                        const SizedBox(height: 20),

                        if (_error.isNotEmpty)
                          _messageBanner(
                            text: _error,
                            bg: const Color(0xFFfef2f2),
                            border: const Color(0xFFfecaca),
                            fg: const Color(0xFF991B1B),
                          ),
                        if (_success.isNotEmpty)
                          _messageBanner(
                            text: _success,
                            bg: const Color(0xFFE6F4EA),
                            border: const Color(0xFFA9D8B7),
                            fg: const Color(0xFF166534),
                          ),

                        if (_isOtpMode) ...[
                          _buildLabeledField(
                            label: 'One-Time Password',
                            hint: 'Enter 6-digit OTP',
                            controller: _otpController,
                            keyboardType: TextInputType.number,
                          ),
                          const SizedBox(height: 24),
                          ElevatedButton(
                            onPressed: _loading ? null : _verifyOtp,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _kAccentRed,
                              foregroundColor: Colors.white,
                              disabledBackgroundColor: _kAccentRed.withValues(
                                alpha: 0.6,
                              ),
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: const StadiumBorder(),
                            ),
                            child: _loading
                                ? const SizedBox(
                                    height: 18,
                                    width: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Text(
                                    'Verify OTP',
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                    ),
                                  ),
                          ),
                          const SizedBox(height: 8),
                          TextButton(
                            onPressed: () {
                              setState(() {
                                _isOtpMode = false;
                                _error = '';
                                _success = '';
                              });
                            },
                            child: const Text(
                              'Cancel verification',
                              style: TextStyle(
                                color: Colors.black54,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ] else ...[
                          _buildLabeledField(
                            label: 'Full Name',
                            hint: 'Enter your full name',
                            controller: _fullNameController,
                          ),
                          const SizedBox(height: 16),
                          _buildDepartmentDropdown(),
                          const SizedBox(height: 16),
                          _buildLabeledField(
                            label: 'Email Address',
                            hint: 'Enter your email',
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            focusNode: _emailFocusNode,
                            onChanged: (_) => setState(() => _error = ''),
                          ),
                          const SizedBox(height: 24),

                          ElevatedButton(
                            onPressed: _loading ? null : _submitRequest,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _kAccentRed,
                              foregroundColor: Colors.white,
                              disabledBackgroundColor: _kAccentRed.withValues(
                                alpha: 0.6,
                              ),
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: const StadiumBorder(),
                            ),
                            child: _loading
                                ? const SizedBox(
                                    height: 18,
                                    width: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Text(
                                    'Send Request',
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                    ),
                                  ),
                          ),
                          const SizedBox(height: 8),
                          TextButton(
                            onPressed: () => Navigator.pop(context),
                            child: const Text(
                              'Back to login',
                              style: TextStyle(
                                color: _kAccentRed,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(top: 4),
                color: const Color(0xFF5c0d0f),
                padding: const EdgeInsets.symmetric(
                  vertical: 16,
                  horizontal: 24,
                ),
                child: const Text(
                  '© 2026 BloomQuest. All rights reserved.',
                  style: TextStyle(color: _kGold, fontSize: 11),
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDepartmentDropdown() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Text(
              'Department',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            ),
            if (_deptLoading) ...[
              const SizedBox(width: 8),
              const SizedBox(
                height: 12,
                width: 12,
                child: CircularProgressIndicator(strokeWidth: 1.5),
              ),
            ],
          ],
        ),
        const SizedBox(height: 6),
        if (_deptError.isNotEmpty)
          Row(
            children: [
              Expanded(
                child: Text(
                  _deptError,
                  style: const TextStyle(fontSize: 12, color: Colors.red),
                ),
              ),
              TextButton(
                onPressed: _loadDepartments,
                child: const Text('Retry', style: TextStyle(fontSize: 12)),
              ),
            ],
          )
        else
          DropdownButtonFormField<String>(
            initialValue: _selectedDepartment,
            isExpanded: true,
            icon: const Icon(Icons.keyboard_arrow_down_rounded),
            style: const TextStyle(fontSize: 13, color: Colors.black87),
            decoration: InputDecoration(
              hintText: _deptLoading
                  ? 'Loading departments…'
                  : 'Select your department',
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
            items: _departments
                .map(
                  (dept) => DropdownMenuItem<String>(
                    value: dept.id,
                    child: Text('${dept.name} (${dept.code})'),
                  ),
                )
                .toList(),
            onChanged: _deptLoading
                ? null
                : (value) => setState(() => _selectedDepartment = value),
          ),
      ],
    );
  }

  Widget _buildLabeledField({
    required String label,
    required String hint,
    required TextEditingController controller,
    TextInputType keyboardType = TextInputType.text,
    FocusNode? focusNode,
    ValueChanged<String>? onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          focusNode: focusNode,
          onChanged: onChanged,
          decoration: InputDecoration(
            hintText: hint,
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
      ],
    );
  }
}
