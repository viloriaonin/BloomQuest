import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class ContactAdminPage extends StatefulWidget {
  const ContactAdminPage({super.key});

  @override
  State<ContactAdminPage> createState() => _ContactAdminPageState();
}

class _ContactAdminPageState extends State<ContactAdminPage> {
  final _fullNameController = TextEditingController();
  final _departmentController = TextEditingController();
  final _emailController = TextEditingController();
  final _emailFocusNode = FocusNode();

  bool _loading = false;
  String _error = '';
  String _success = '';
  // null | 'pending' | 'approved' | 'declined' | 'existing'
  String? _existingRequestStatus;

  @override
  void initState() {
    super.initState();
    _emailFocusNode.addListener(() {
      if (!_emailFocusNode.hasFocus) {
        _handleEmailBlur();
      }
    });
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _departmentController.dispose();
    _emailController.dispose();
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

  Future<void> _handleEmailBlur() async {
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

    if (!_isValidEmail(sanitized)) return;

    try {
      // NOTE: Add this method to ApiService if it doesn't exist yet.
      // It should hit GET /api/contact-admin/check-status?email=... and
      // return a Map like { "exists": true, "status": "pending" }.
      final data = await ApiService.checkContactAdminStatus(sanitized);
      if (data['exists'] == true) {
        setState(() {
          _existingRequestStatus = data['status'] ?? 'existing';
          _error = 'This email is already in use or has an existing request.';
        });
      } else {
        setState(() => _existingRequestStatus = null);
      }
    } catch (e) {
      debugPrint('Backend status check failed: $e');
    }
  }

  Future<void> _submitRequest() async {
    final fullName = _fullNameController.text.trim();
    final department = _departmentController.text.trim();
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

    if (_existingRequestStatus != null) {
      setState(
        () => _error =
            'Cannot submit. This email is already in use or requested.',
      );
      return;
    }

    setState(() => _loading = true);

    try {
      final payloadEmail = _sanitizeEmail(email);
      _emailController.text = payloadEmail;

      await ApiService.submitAccountRequest(fullName, department, payloadEmail);
      if (!mounted) return;
      setState(() {
        _success = 'Request submitted. Please wait for admin approval.';
        _existingRequestStatus = 'pending';
        _fullNameController.clear();
        _departmentController.clear();
      });
    } catch (e) {
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Widget _statusBanner() {
    if (_existingRequestStatus == null) return const SizedBox.shrink();

    final config = {
      'pending': (
        const Color(0xFFFFF7E6),
        const Color(0xFF8A6516),
        'PENDING REVIEW',
      ),
      'approved': (
        const Color(0xFFE6F4EA),
        const Color(0xFF166534),
        'APPROVED',
      ),
      'declined': (
        const Color(0xFFF3F4F6),
        const Color(0xFF374151),
        'DECLINED',
      ),
      'existing': (
        const Color(0xFFF3F4F6),
        const Color(0xFF374151),
        'EXISTING REQUEST',
      ),
    };

    final (bg, text, label) =
        config[_existingRequestStatus] ?? config['existing']!;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        'Existing Request Status: $label',
        style: TextStyle(color: text, fontWeight: FontWeight.bold),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Contact Admin'),
        backgroundColor: const Color(0xFF7B1113),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Submit a request to the administrator to get access to BloomQuest.',
              style: TextStyle(fontSize: 16, color: Colors.black87),
            ),
            const SizedBox(height: 20),
            if (_error.isNotEmpty)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEE2E2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  _error,
                  style: const TextStyle(color: Color(0xFF991B1B)),
                ),
              ),
            if (_success.isNotEmpty)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFE6F4EA),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  _success,
                  style: const TextStyle(color: Color(0xFF166534)),
                ),
              ),
            if (_error.isNotEmpty || _success.isNotEmpty)
              const SizedBox(height: 16),
            _statusBanner(),
            _buildTextField(_fullNameController, 'Full Name'),
            const SizedBox(height: 12),
            _buildTextField(_departmentController, 'Department'),
            const SizedBox(height: 12),
            _buildTextField(
              _emailController,
              'Email Address',
              keyboardType: TextInputType.emailAddress,
              focusNode: _emailFocusNode,
              onChanged: (_) {
                setState(() {
                  _existingRequestStatus = null;
                  _error = '';
                });
              },
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: (_loading || _existingRequestStatus != null)
                  ? null
                  : _submitRequest,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF7B1113),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: Text(
                _loading ? 'Submitting...' : 'Send Request',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            const SizedBox(height: 14),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Back to login'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTextField(
    TextEditingController controller,
    String label, {
    TextInputType keyboardType = TextInputType.text,
    FocusNode? focusNode,
    ValueChanged<String>? onChanged,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      focusNode: focusNode,
      onChanged: onChanged,
      decoration: InputDecoration(
        labelText: label,
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }
}
