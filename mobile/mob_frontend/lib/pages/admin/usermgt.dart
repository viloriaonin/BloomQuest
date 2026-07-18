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
  bool _actionLoading = false; // Global overlay for list actions
  String _error = '';
  List<Map<String, dynamic>> _pendingRequests = [];
  List<Map<String, dynamic>> _activeUsers = [];
  List<Map<String, dynamic>> _archivedUsers = [];

  Map<String, dynamic>? _selectedUser;
  bool _verifyLoading = false;
  bool _savingPassword = false;
  bool _credentialsVerified = false;
  String _adminPassword = '';
  String _newPassword = '';
  String _adminAuthError = '';
  String _lastAction = '';
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
          activeUsers.addAll(
            active
                .map((item) => Map<String, dynamic>.from(item))
                .where(isFaculty),
          );
        }
        if (archived is List) {
          archivedUsers.addAll(
            archived
                .map((item) => Map<String, dynamic>.from(item))
                .where(isFaculty),
          );
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
        _pendingRequests = pending
            .map((item) => Map<String, dynamic>.from(item as Map))
            .toList();
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
    setState(() => _actionLoading = true);
    try {
      await ApiService.approveAccountRequest(email);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Approved account request for $email.')),
      );
      await _loadUserManagementData();
      if (!mounted) return;
      setState(() => _lastAction = 'Approved account request for $email.');
    } catch (e) {
      _showError(e.toString());
    } finally {
      if (mounted) setState(() => _actionLoading = false);
    }
  }

  Future<void> _declineRequest(String email) async {
    setState(() => _actionLoading = true);
    try {
      await ApiService.declineAccountRequest(email);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Declined account request for $email.')),
      );
      await _loadUserManagementData();
      if (!mounted) return;
      setState(() => _lastAction = 'Declined account request for $email.');
    } catch (e) {
      _showError(e.toString());
    } finally {
      if (mounted) setState(() => _actionLoading = false);
    }
  }

  Future<void> _archiveUser(String email) async {
    setState(() => _actionLoading = true);
    try {
      await ApiService.archiveUser(email);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Archived user $email.')));
      await _loadUserManagementData();
      if (!mounted) return;
      setState(() => _lastAction = 'Archived user $email.');
    } catch (e) {
      _showError(e.toString());
    } finally {
      if (mounted) setState(() => _actionLoading = false);
    }
  }

  Future<void> _restoreUser(String email) async {
    setState(() => _actionLoading = true);
    try {
      await ApiService.restoreUser(email);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Restored user $email.')));
      await _loadUserManagementData();
      if (!mounted) return;
      setState(() => _lastAction = 'Restored user $email.');
    } catch (e) {
      _showError(e.toString());
    } finally {
      if (mounted) setState(() => _actionLoading = false);
    }
  }

  Future<void> _deleteUser(String email) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                Icons.delete_forever_outlined,
                color: Colors.red.shade700,
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            const Text(
              'Delete User',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
            ),
          ],
        ),
        content: Text(
          'Are you sure you want to permanently delete "$email"? This action cannot be undone.',
          style: const TextStyle(color: Colors.black54, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red.shade700,
              foregroundColor: Colors.white,
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete Permanently'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _actionLoading = true);
    try {
      await ApiService.deleteUser(email);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Deleted user $email.'),
          backgroundColor: Colors.red.shade700,
        ),
      );
      await _loadUserManagementData();
      if (!mounted) return;
      setState(() => _lastAction = 'Deleted user $email.');
    } catch (e) {
      _showError(e.toString());
    } finally {
      if (mounted) setState(() => _actionLoading = false);
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
      setState(
        () => _adminAuthError = 'Enter your admin password to continue.',
      );
      return;
    }

    try {
      setState(() {
        _verifyLoading = true;
        _adminAuthError = '';
      });

      final prefs = await SharedPreferences.getInstance();
      final adminEmail =
          prefs.getString('user_email') ?? prefs.getString('email') ?? '';
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

    final email = _selectedUser!['email']?.toString() ?? '';
    setState(() => _savingPassword = true);
    try {
      await ApiService.updateUserPassword(email, _newPassword);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password updated successfully.')),
      );
      await _loadUserManagementData();
      if (!mounted) return;
      setState(() => _lastAction = 'Updated password for $email.');
      if (mounted) Navigator.pop(context);
    } catch (e) {
      _showError(e.toString());
    } finally {
      if (mounted) setState(() => _savingPassword = false);
    }
  }

  Widget _buildManageUserSheet(BuildContext context) {
    final user = _selectedUser;
    if (user == null) return const SizedBox.shrink();

    final email = user['email']?.toString() ?? '';
    final name = _displayName(user);
    final role = user['role']?.toString() ?? 'faculty';
    final archived = user['archived'] == true;
    final revealedPassword =
        _verifiedUserCredentials?['password']?.toString() ?? '';

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.88,
        ),
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
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
                  const Text(
                    'Manage User',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                name,
                style: const TextStyle(fontSize: 14, color: Colors.black54),
              ),
              const SizedBox(height: 4),
              Text(
                email,
                style: const TextStyle(fontSize: 12, color: Colors.black45),
              ),
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
                    const Text(
                      'Admin verification required',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Enter your admin password to view and update this user’s credentials.',
                      style: TextStyle(fontSize: 12, color: Colors.black54),
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: 'Admin Password',
                        border: OutlineInputBorder(),
                      ),
                      onChanged: (value) =>
                          setState(() => _adminPassword = value),
                    ),
                    if (_adminAuthError.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        _adminAuthError,
                        style: const TextStyle(color: Colors.red, fontSize: 12),
                      ),
                    ],
                    const SizedBox(height: 14),
                    ElevatedButton(
                      onPressed: _verifyLoading ? null : _verifyAdminPassword,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF7B1113),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: _verifyLoading
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Verify Admin Password'),
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
                      const Text(
                        'Verified credentials',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 10),
                      _buildMetaRow('Role', role),
                      const SizedBox(height: 6),
                      _buildMetaRow('Archived', archived ? 'Yes' : 'No'),
                      const SizedBox(height: 6),
                      _buildMetaRow(
                        'Current password',
                        revealedPassword.isEmpty ? 'Hidden' : revealedPassword,
                      ),
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
                  onPressed: _savingPassword ? null : _updateUserPassword,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF7B1113),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: _savingPassword
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Save Password'),
                ),
              ],
              const SizedBox(height: 20),
            ],
          ),
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
    return (user['full_name'] ?? user['name'] ?? user['email'] ?? 'Unknown')
        .toString();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: kBg,
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'User Management',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1A1A1A),
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Review pending registration requests, manage active faculty, and restore archived accounts.',
            style: TextStyle(color: Colors.black54, fontSize: 13, height: 1.4),
          ),
          const SizedBox(height: 20),
          if (_error.isNotEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Text(_error, style: const TextStyle(color: Colors.red)),
            ),
          if (_error.isNotEmpty) const SizedBox(height: 16),
          if (_lastAction.isNotEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Text(
                'Last action: $_lastAction',
                style: const TextStyle(
                  color: Colors.blueGrey,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          if (_lastAction.isNotEmpty) const SizedBox(height: 16),
          if (_loading)
            const Expanded(child: Center(child: CircularProgressIndicator()))
          else
            Expanded(
              child: Stack(
                children: [
                  RefreshIndicator(
                    onRefresh: _loadUserManagementData,
                    child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.only(bottom: 28),
                      children: [
                        _buildSummaryRow(),
                        const SizedBox(height: 28),
                        _buildPendingRequestsSection(),
                        const SizedBox(height: 28),
                        _buildActiveUsersSection(),
                        const SizedBox(height: 28),
                        _buildArchivedUsersSection(),
                      ],
                    ),
                  ),
                  if (_actionLoading)
                    Container(
                      color: Colors.white.withOpacity(0.6),
                      child: const Center(
                        child: CircularProgressIndicator(
                          color: Color(0xFF7B1113),
                        ),
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildSummaryRow() {
    final total = _activeUsers.length + _archivedUsers.length;
    return Column(
      children: [
        Row(
          children: [
            _buildStatCard('Total Users', total.toString(), const Color(0xFF7B1113), Icons.groups_outlined),
            const SizedBox(width: 12),
            _buildStatCard('Pending', _pendingRequests.length.toString(), Colors.amber.shade700, Icons.hourglass_top_outlined),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            _buildStatCard('Active', _activeUsers.length.toString(), Colors.green.shade700, Icons.check_circle_outline),
            const SizedBox(width: 12),
            _buildStatCard('Archived', _archivedUsers.length.toString(), Colors.grey.shade700, Icons.inventory_2_outlined),
          ],
        ),
      ],
    );
  }

  Widget _buildStatCard(
    String label,
    String value,
    Color color,
    IconData icon,
  ) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            const BoxShadow(color: Color.fromRGBO(0, 0, 0, 0.04), blurRadius: 16, offset: Offset(0, 8)),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 18, color: color),
            ),
            const SizedBox(height: 12),
            Text(value, style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: color)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(fontSize: 12, color: Colors.black54)),
          ],
        ),
      ),
    );
  }

  Widget _buildPendingRequestsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              Icons.hourglass_top_outlined,
              size: 18,
              color: Colors.amber.shade800,
            ),
            const SizedBox(width: 8),
            const Text(
              'Pending Account Requests',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: Color(0xFF1A1A1A),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_pendingRequests.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: Colors.grey.shade200),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.03),
                  blurRadius: 14,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Row(
              children: [
                Icon(
                  Icons.inbox_outlined,
                  color: Colors.grey.shade400,
                  size: 22,
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    'No pending registration requests at the moment.',
                    style: TextStyle(color: Colors.black54),
                  ),
                ),
              ],
            ),
          )
        else
          Column(
            children: _pendingRequests.map((request) {
              final email =
                  request['email']?.toString() ?? 'unknown@example.com';
              final name =
                  request['full_name']?.toString() ??
                  request['name']?.toString() ??
                  email;
              final department = request['department']?.toString() ?? 'N/A';
              final status = request['status']?.toString() ?? 'pending';
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.grey.shade200),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 14, offset: const Offset(0, 6)),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            name,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 15,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.orange.shade50,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            status.toUpperCase(),
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: Colors.orange.shade800,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      email,
                      style: const TextStyle(
                        color: Colors.black54,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'Department: $department',
                      style: const TextStyle(
                        color: Colors.black45,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton(
                            onPressed: _actionLoading
                                ? null
                                : () => _approveRequest(email),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF7B1113),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                            child: const Text('Approve'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton(
                            onPressed: _actionLoading
                                ? null
                                : () => _declineRequest(email),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.black87,
                              side: BorderSide(color: Colors.grey.shade300),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
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
        Row(
          children: [
            Icon(
              Icons.check_circle_outline,
              size: 18,
              color: Colors.green.shade700,
            ),
            const SizedBox(width: 8),
            const Text(
              'Active Users',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: Color(0xFF1A1A1A),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_activeUsers.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: Colors.grey.shade200),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.03),
                  blurRadius: 14,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Row(
              children: [
                Icon(
                  Icons.people_outline,
                  color: Colors.grey.shade400,
                  size: 22,
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    'No active users found.',
                    style: TextStyle(color: Colors.black54),
                  ),
                ),
              ],
            ),
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
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.grey.shade200),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.03),
                      blurRadius: 14,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [Color(0xFF7B1113), Color(0xFFA31E20)],
                            ),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            name
                                .split(' ')
                                .where((part) => part.isNotEmpty)
                                .map((part) => part[0])
                                .take(2)
                                .join()
                                .toUpperCase(),
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                name,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 15,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                email,
                                style: const TextStyle(
                                  color: Colors.black54,
                                  fontSize: 13,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 3),
                              Text(
                                'Dept: $department',
                                style: const TextStyle(
                                  color: Colors.black45,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.green.shade50,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.check_circle,
                                size: 12,
                                color: Colors.green.shade700,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                status,
                                style: const TextStyle(
                                  color: Colors.green,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _actionLoading
                                ? null
                                : () => _openManageUser(user),
                            icon: const Icon(Icons.settings_outlined, size: 16),
                            label: const Text('Manage'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFF7B1113),
                              side: BorderSide(color: Colors.grey.shade300),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _actionLoading
                                ? null
                                : () => _archiveUser(email),
                            icon: const Icon(Icons.archive_outlined, size: 16),
                            label: const Text('Archive'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.black87,
                              side: BorderSide(color: Colors.grey.shade300),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
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

  Widget _buildArchivedUsersSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              Icons.inventory_2_outlined,
              size: 18,
              color: Colors.grey.shade700,
            ),
            const SizedBox(width: 8),
            const Text(
              'Archived Users',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: Color(0xFF1A1A1A),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_archivedUsers.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: Colors.grey.shade200),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.03),
                  blurRadius: 14,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Row(
              children: [
                Icon(
                  Icons.inventory_2_outlined,
                  color: Colors.grey.shade400,
                  size: 22,
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    'No archived users found.',
                    style: TextStyle(color: Colors.black54),
                  ),
                ),
              ],
            ),
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
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.grey.shade200),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.03),
                      blurRadius: 14,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [
                                Colors.grey.shade400,
                                Colors.grey.shade600,
                              ],
                            ),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            name
                                .split(' ')
                                .where((part) => part.isNotEmpty)
                                .map((part) => part[0])
                                .take(2)
                                .join()
                                .toUpperCase(),
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                name,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 15,
                                  color: Colors.black87,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                email,
                                style: const TextStyle(
                                  color: Colors.black54,
                                  fontSize: 13,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 3),
                              Text(
                                'Dept: $department',
                                style: const TextStyle(
                                  color: Colors.black45,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.inventory_2_outlined,
                                size: 12,
                                color: Colors.grey.shade700,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'Archived',
                                style: TextStyle(
                                  color: Colors.grey.shade700,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: _actionLoading
                                ? null
                                : () => _restoreUser(email),
                            icon: const Icon(Icons.restore_outlined, size: 17),
                            label: const Text('Restore'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF7B1113),
                              foregroundColor: Colors.white,
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _actionLoading
                                ? null
                                : () => _deleteUser(email),
                            icon: Icon(
                              Icons.delete_outline,
                              size: 17,
                              color: Colors.red.shade700,
                            ),
                            label: Text(
                              'Delete',
                              style: TextStyle(color: Colors.red.shade700),
                            ),
                            style: OutlinedButton.styleFrom(
                              side: BorderSide(color: Colors.red.shade200),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
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
}
