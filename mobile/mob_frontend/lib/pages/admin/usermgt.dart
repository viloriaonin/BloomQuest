import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../services/api_service.dart';
import '../widgets/adminSidebar.dart';

class AdminUserMgtPage extends StatefulWidget {
  const AdminUserMgtPage({super.key});

  @override
  State<AdminUserMgtPage> createState() => _AdminUserMgtPageState();
}

class _AdminUserMgtPageState extends State<AdminUserMgtPage> {
  bool _loading = true;
  String _error = '';
  List<Map<String, dynamic>> _pendingRequests = [];
  List<Map<String, dynamic>> _activeUsers = [];
  List<Map<String, dynamic>> _archivedUsers = [];

  Map<String, dynamic>? _selectedUser;
  bool _verifyLoading = false;
  bool _credentialsVerified = false;
  String _adminPassword = '';
  String _newPassword = '';
  String _adminAuthError = '';
  Map<String, dynamic>? _verifiedUserCredentials;

  @override
  void initState() {
    super.initState();
    _loadUserManagementData();
  }

  Future<void> _loadUserManagementData() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final pending = await ApiService.fetchPendingContactRequests();
      final usersResponse = await ApiService.fetchAdminUsers();

      final activeUsers = <Map<String, dynamic>>[];
      final archivedUsers = <Map<String, dynamic>>[];

      bool isFaculty(Map<String, dynamic> user) {
        final role = user['role']?.toString().toLowerCase();
        return role != null && role != 'admin';
      }

      if (usersResponse is Map<String, dynamic>) {
        final active = usersResponse['active'];
        final archived = usersResponse['archived'];
        if (active is List) {
          activeUsers.addAll(active
              .map((item) => Map<String, dynamic>.from(item))
              .where(isFaculty));
        }
        if (archived is List) {
          archivedUsers.addAll(archived
              .map((item) => Map<String, dynamic>.from(item))
              .where(isFaculty));
        }
      } else if (usersResponse is List) {
        for (final item in usersResponse) {
          final user = Map<String, dynamic>.from(item as Map);
          if (!isFaculty(user)) continue;
          if (user['archived'] == true || user['is_active'] == false) {
            archivedUsers.add(user);
          } else {
            activeUsers.add(user);
          }
        }
      }

      setState(() {
        _pendingRequests = pending.map((item) => Map<String, dynamic>.from(item as Map)).toList();
        _activeUsers = activeUsers;
        _archivedUsers = archivedUsers;
      });
    } catch (e) {
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      setState(() {
        _loading = false;
      });
    }
  }

  Future<void> _approveRequest(String email) async {
    try {
      await ApiService.approveAccountRequest(email);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Approved account request for $email.')),
      );
      await _loadUserManagementData();
    } catch (e) {
      _showError(e.toString());
    }
  }

  Future<void> _declineRequest(String email) async {
    try {
      await ApiService.declineAccountRequest(email);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Declined account request for $email.')),
      );
      await _loadUserManagementData();
    } catch (e) {
      _showError(e.toString());
    }
  }

  Future<void> _archiveUser(String email) async {
    try {
      await ApiService.archiveUser(email);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Archived user $email.')),
      );
      await _loadUserManagementData();
    } catch (e) {
      _showError(e.toString());
    }
  }

  Future<void> _restoreUser(String email) async {
    try {
      await ApiService.restoreUser(email);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Restored user $email.')),
      );
      await _loadUserManagementData();
    } catch (e) {
      _showError(e.toString());
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    final text = message.replaceAll('Exception: ', '');
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(text), backgroundColor: Colors.red.shade700),
    );
  }

  Future<void> _openManageUser(Map<String, dynamic> user) async {
    setState(() {
      _selectedUser = user;
      _credentialsVerified = false;
      _adminPassword = '';
      _newPassword = '';
      _adminAuthError = '';
      _verifiedUserCredentials = null;
    });

    if (!mounted) return;
    await showModalBottomSheet<void>(
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      context: context,
      builder: (_) => _buildManageUserSheet(context),
    );
  }

  Future<void> _verifyAdminPassword() async {
    if (_selectedUser == null) return;
    if (_adminPassword.trim().isEmpty) {
      setState(() => _adminAuthError = 'Enter your admin password to continue.');
      return;
    }

    try {
      setState(() {
        _verifyLoading = true;
        _adminAuthError = '';
      });

      final prefs = await SharedPreferences.getInstance();
      final adminEmail = prefs.getString('user_email') ?? prefs.getString('email') ?? '';
      if (adminEmail.isEmpty) {
        throw Exception('Admin email missing. Please log in again.');
      }

      final verified = await ApiService.verifyAdminPassword(
        adminEmail,
        _adminPassword,
        _selectedUser!['email']?.toString() ?? '',
      );

      setState(() {
        _credentialsVerified = true;
        _verifiedUserCredentials = verified;
        _adminAuthError = '';
      });
    } catch (e) {
      setState(() {
        _credentialsVerified = false;
        _verifiedUserCredentials = null;
        _adminAuthError = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      setState(() => _verifyLoading = false);
    }
  }

  Future<void> _updateUserPassword() async {
    if (_selectedUser == null) return;
    if (_newPassword.trim().isEmpty) {
      _showError('Enter a new password before saving.');
      return;
    }

    try {
      await ApiService.updateUserPassword(
        _selectedUser!['email']?.toString() ?? '',
        _newPassword,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password updated successfully.')),
      );
      await _loadUserManagementData();
      if (mounted) Navigator.pop(context);
    } catch (e) {
      _showError(e.toString());
    }
  }

  Widget _buildManageUserSheet(BuildContext context) {
    final user = _selectedUser;
    if (user == null) return const SizedBox.shrink();

    final email = user['email']?.toString() ?? '';
    final name = _displayName(user);
    final role = user['role']?.toString() ?? 'faculty';
    final archived = user['archived'] == true;
    final revealedPassword = _verifiedUserCredentials?['password']?.toString() ?? '';

    return Container(
      padding: EdgeInsets.only(
        top: 20,
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Manage User', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(name, style: const TextStyle(fontSize: 14, color: Colors.black54)),
            const SizedBox(height: 4),
            Text(email, style: const TextStyle(fontSize: 12, color: Colors.black45)),
            const SizedBox(height: 20),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Admin verification required', style: TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  const Text('Enter your admin password to view and update this user’s credentials.', style: TextStyle(fontSize: 12, color: Colors.black54)),
                  const SizedBox(height: 14),
                  TextField(
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Admin Password',
                      border: OutlineInputBorder(),
                    ),
                    onChanged: (value) => setState(() => _adminPassword = value),
                  ),
                  if (_adminAuthError.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(_adminAuthError, style: const TextStyle(color: Colors.red, fontSize: 12)),
                  ],
                  const SizedBox(height: 14),
                  ElevatedButton(
                    onPressed: _verifyLoading ? null : _verifyAdminPassword,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF7B1113),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    child: _verifyLoading ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Verify Admin Password'),
                  ),
                ],
              ),
            ),
            if (_credentialsVerified && _verifiedUserCredentials != null) ...[
              const SizedBox(height: 20),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Verified credentials', style: TextStyle(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 10),
                    _buildMetaRow('Role', role),
                    const SizedBox(height: 6),
                    _buildMetaRow('Archived', archived ? 'Yes' : 'No'),
                    const SizedBox(height: 6),
                    _buildMetaRow('Current password', revealedPassword.isEmpty ? 'Hidden' : revealedPassword),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              TextField(
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'New password',
                  border: OutlineInputBorder(),
                ),
                onChanged: (value) => setState(() => _newPassword = value),
              ),
              const SizedBox(height: 14),
              ElevatedButton(
                onPressed: _updateUserPassword,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF7B1113),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: const Text('Save Password'),
              ),
            ],
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildMetaRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.black54)),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
      ],
    );
  }

  String _displayName(Map<String, dynamic> user) {
    return (user['full_name'] ?? user['name'] ?? user['email'] ?? 'Unknown').toString();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: kBg,
      padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'User Management',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          const Text(
            'Review pending registration requests, manage active faculty, and restore archived accounts.',
            style: TextStyle(color: Colors.black54),
          ),
          const SizedBox(height: 24),
          if (_error.isNotEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Text(
                _error,
                style: const TextStyle(color: Colors.red),
              ),
            ),
          if (_error.isNotEmpty) const SizedBox(height: 16),
          if (_loading)
            const Expanded(child: Center(child: CircularProgressIndicator()))
          else
            Expanded(
              child: RefreshIndicator(
                onRefresh: _loadUserManagementData,
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: [
                    _buildSummaryRow(),
                    const SizedBox(height: 24),
                    _buildPendingRequestsSection(),
                    const SizedBox(height: 24),
                    _buildActiveUsersSection(),
                    const SizedBox(height: 24),
                    _buildArchivedUsersSection(),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildSummaryRow() {
    return Row(
      children: [
        _buildStatCard('Pending', _pendingRequests.length.toString(), Colors.amber.shade700),
        const SizedBox(width: 12),
        _buildStatCard('Active', _activeUsers.length.toString(), Colors.green.shade700),
        const SizedBox(width: 12),
        _buildStatCard('Archived', _archivedUsers.length.toString(), Colors.grey.shade700),
      ],
    );
  }

  Widget _buildStatCard(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          boxShadow: [
            const BoxShadow(color: Color.fromRGBO(0, 0, 0, 0.04), blurRadius: 16, offset: Offset(0, 8)),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: 12, color: Colors.black54)),
            const SizedBox(height: 10),
            Text(value, style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: color)),
          ],
        ),
      ),
    );
  }

  Widget _buildPendingRequestsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Pending Account Requests', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        const SizedBox(height: 12),
        if (_pendingRequests.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: const Text('No pending registration requests at the moment.'),
          )
        else
          Column(
            children: _pendingRequests.map((request) {
              final email = request['email']?.toString() ?? 'unknown@example.com';
              final name = request['full_name']?.toString() ?? request['name']?.toString() ?? email;
              final department = request['department']?.toString() ?? 'N/A';
              final status = request['status']?.toString() ?? 'pending';
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(child: Text(name, style: const TextStyle(fontWeight: FontWeight.w600))),
                        Text(status.toUpperCase(), style: const TextStyle(fontSize: 12, color: Colors.orange)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(email, style: const TextStyle(color: Colors.black54)),
                    const SizedBox(height: 4),
                    Text('Department: $department', style: const TextStyle(color: Colors.black54)),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton(
                            onPressed: () => _approveRequest(email),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF7B1113),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                            child: const Text('Approve'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => _declineRequest(email),
                            style: OutlinedButton.styleFrom(
                              side: BorderSide(color: Colors.grey.shade300),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                            child: const Text('Decline'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
      ],
    );
  }

  Widget _buildActiveUsersSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Active Users', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        const SizedBox(height: 12),
        if (_activeUsers.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: const Text('No active users found.'),
          )
        else
          Column(
            children: _activeUsers.map((user) {
              final email = user['email']?.toString() ?? 'unknown@example.com';
              final name = _displayName(user);
              final department = user['department']?.toString() ?? 'N/A';
              final status = user['status']?.toString() ?? 'Active';
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CircleAvatar(
                      radius: 22,
                      backgroundColor: const Color(0xFF7B1113),
                      child: Text(
                        name
                            .split(' ')
                            .where((part) => part.isNotEmpty)
                            .map((part) => part[0])
                            .take(2)
                            .join()
                            .toUpperCase(),
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
                          const SizedBox(height: 4),
                          Text(email, style: const TextStyle(color: Colors.black54)),
                          const SizedBox(height: 4),
                          Text('Dept: $department', style: const TextStyle(color: Colors.black54)),
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: Colors.green.shade50,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(status, style: const TextStyle(color: Colors.green)),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => _openManageUser(user),
                        style: OutlinedButton.styleFrom(
                          side: BorderSide(color: Colors.grey.shade300),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        child: const Text('Manage'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => _archiveUser(email),
                        style: OutlinedButton.styleFrom(
                          side: BorderSide(color: Colors.grey.shade300),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        child: const Text('Archive'),
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
      ],
    );
  }

  Widget _buildArchivedUsersSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Archived Users', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        const SizedBox(height: 12),
        if (_archivedUsers.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: const Text('No archived users found.'),
          )
        else
          Column(
            children: _archivedUsers.map((user) {
              final email = user['email']?.toString() ?? 'unknown@example.com';
              final name = _displayName(user);
              final department = user['department']?.toString() ?? 'N/A';
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CircleAvatar(
                      radius: 22,
                      backgroundColor: Colors.grey.shade400,
                      child: Text(
                        name
                            .split(' ')
                            .where((part) => part.isNotEmpty)
                            .map((part) => part[0])
                            .take(2)
                            .join()
                            .toUpperCase(),
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
                          const SizedBox(height: 4),
                          Text(email, style: const TextStyle(color: Colors.black54)),
                          const SizedBox(height: 4),
                          Text('Dept: $department', style: const TextStyle(color: Colors.black54)),
                        ],
                      ),
                    ),
                    ElevatedButton(
                      onPressed: () => _restoreUser(email),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF7B1113),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      child: const Text('Restore'),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
      ],
    );
  }
}
