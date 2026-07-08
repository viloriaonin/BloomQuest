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

  bool _loading = false;
  String _error = '';
  String _success = '';

  @override
  void dispose() {
    _fullNameController.dispose();
    _departmentController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submitRequest() async {
    final fullName = _fullNameController.text.trim();
    final department = _departmentController.text.trim();
    final email = _emailController.text.trim();

    if (fullName.isEmpty || department.isEmpty || email.isEmpty) {
      setState(() => _error = 'Full name, department, and email are required.');
      return;
    }

    setState(() {
      _loading = true;
      _error = '';
      _success = '';
    });

    try {
      await ApiService.submitAccountRequest(fullName, department, email);
      if (!mounted) return;
      setState(() {
        _success = 'Request submitted. Please wait for admin approval.';
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
            if (_error.isNotEmpty || _success.isNotEmpty) const SizedBox(height: 16),
            _buildTextField(_fullNameController, 'Full Name'),
            const SizedBox(height: 12),
            _buildTextField(_departmentController, 'Department'),
            const SizedBox(height: 12),
            _buildTextField(
              _emailController,
              'Email Address',
              keyboardType: TextInputType.emailAddress,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _loading ? null : _submitRequest,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF7B1113),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: Text(
                _loading ? 'Submitting...' : 'Send Request',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
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

  Widget _buildTextField(TextEditingController controller, String label,
      {TextInputType keyboardType = TextInputType.text}) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      decoration: InputDecoration(
        labelText: label,
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }
}
