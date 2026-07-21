import 'package:flutter/material.dart';
import 'package:BloomQuest/utils/theme_constants.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../services/api_service.dart';
import 'account.dart'; // IMPORT THE ACCOUNT BAR

const Color kScaffoldBackground = Colors.white;

// Status Pill Colors
const Color kBadgeActive = Color(0xFF22C55E);
const Color kBadgeInactive = Color(0xFF94A3B8);
const Color kBadgeBanned = Color(0xFFEF4444);
const Color kBadgePending = Color(0xFF0F172A);

class AdminUserMgtPage extends StatefulWidget {
  const AdminUserMgtPage({super.key});
  @override
  State<AdminUserMgtPage> createState() => _AdminUserMgtPageState();
}

class _AdminUserMgtPageState extends State<AdminUserMgtPage>
    with SingleTickerProviderStateMixin {
  bool _loading = true;
  bool _actionLoading = false;
  String _error = '';

  List<Map<String, dynamic>> _pendingRequests = [];
  List<Map<String, dynamic>> _activeUsers = [];
  List<Map<String, dynamic>> _archivedUsers = [];

  // Tab and Search Controls
  late TabController _tabController;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadUserManagementData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
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
        if (active is List)
          activeUsers.addAll(
            active
                .map((item) => Map<String, dynamic>.from(item))
                .where(isFaculty),
          );
        if (archived is List)
          archivedUsers.addAll(
            archived
                .map((item) => Map<String, dynamic>.from(item))
                .where(isFaculty),
          );
      } else if (usersResponse is List) {
        for (final item in usersResponse) {
          final user = Map<String, dynamic>.from(item as Map);
          if (!isFaculty(user)) continue;
          if (user['archived'] == true || user['is_active'] == false)
            archivedUsers.add(user);
          else
            activeUsers.add(user);
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

  // Helper method to filter users based on the search query
  bool _matchesSearch(Map<String, dynamic> user) {
    if (_searchQuery.isEmpty) return true;
    final q = _searchQuery.toLowerCase();
    final name = _displayName(user).toLowerCase();
    final email = (user['email']?.toString() ?? '').toLowerCase();
    return name.contains(q) || email.contains(q);
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
    } catch (e) {
      _showError(e.toString());
    } finally {
      if (mounted) setState(() => _actionLoading = false);
    }
  }

  Future<void> _restoreUser(String email) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: const Text(
          'Restore User',
          style: TextStyle(fontWeight: FontWeight.bold, color: kTextDark),
        ),
        content: const Text(
          'Are you sure you want to unarchive this account?',
          style: TextStyle(color: kTextMuted),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel', style: TextStyle(color: kTextMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor:
                  kBadgeActive, // Green to show it's a positive/restorative action
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Restore', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _actionLoading = true);
    try {
      await ApiService.restoreUser(email);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Restored user $email.')));
      await _loadUserManagementData();
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
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: const Text(
          'Delete User',
          style: TextStyle(fontWeight: FontWeight.bold, color: kTextDark),
        ),
        content: const Text(
          'Are you sure you want to continue in deleting this account? This action cannot be undone.',
          style: TextStyle(color: kTextMuted),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel', style: TextStyle(color: kTextMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: kBadgeBanned,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete', style: TextStyle(color: Colors.white)),
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
          backgroundColor: kBadgeBanned,
        ),
      );
      await _loadUserManagementData();
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
      SnackBar(content: Text(text), backgroundColor: kBadgeBanned),
    );
  }

  Future<void> _openManageUser(Map<String, dynamic> user) async {
    final email = user['email']?.toString() ?? '';

    final result = await showModalBottomSheet<dynamic>(
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      context: context,
      builder: (_) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: ManageUserBottomSheet(user: user),
      ),
    );

    if (result == true) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password updated successfully.')),
      );
      _loadUserManagementData();
    } else if (result == 'archive') {
      if (!mounted) return;
      await _archiveUser(email);
    }
  }

  String _displayName(Map<String, dynamic> user) {
    return (user['full_name'] ?? user['name'] ?? user['email'] ?? 'Unknown')
        .toString();
  }

  Widget _buildStatCard(String title, int count, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.15)),
        ),
        child: Column(
          children: [
            Text(
              count.toString(),
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              title,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: color,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    int totalPending = _pendingRequests.length;
    int totalActive = _activeUsers.length;
    int totalArchived = _archivedUsers.length;
    int totalUsers = totalActive + totalArchived;

    return Scaffold(
      backgroundColor: kScaffoldBackground,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        titleSpacing: 0,
        title: const AccountTopBar(), // Sticky top bar
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, color: kBorderOutline, thickness: 1),
        ),
      ),
      body: Stack(
        children: [
          SafeArea(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // PINNED HEADER: Title, Overview Stats, and Search
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'User Management',
                        style: TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.bold,
                          color: kTextDark,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Manage all users in one place. Control access, assign roles, and monitor activity.',
                        style: TextStyle(
                          color: kTextMuted,
                          fontSize: 14,
                          height: 1.4,
                        ),
                      ),

                      const SizedBox(height: 20),
                      // Stats Overview Row
                      Row(
                        children: [
                          _buildStatCard(
                            'Total',
                            totalUsers,
                            Colors.blueAccent,
                          ),
                          const SizedBox(width: 8),
                          _buildStatCard('Active', totalActive, kBadgeActive),
                          const SizedBox(width: 8),
                          _buildStatCard(
                            'Requests',
                            totalPending,
                            const Color(0xFFF59E0B),
                          ),
                          const SizedBox(width: 8),
                          _buildStatCard(
                            'Archived',
                            totalArchived,
                            kBadgeInactive,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // Search Bar
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: TextField(
                    controller: _searchController,
                    onChanged: (val) => setState(() => _searchQuery = val),
                    decoration: InputDecoration(
                      hintText: 'Search by name or email...',
                      hintStyle: const TextStyle(
                        color: Colors.black38,
                        fontSize: 14,
                      ),
                      prefixIcon: const Icon(
                        Icons.search,
                        color: kTextMuted,
                        size: 20,
                      ),
                      filled: true,
                      fillColor: Colors.grey.shade50,
                      contentPadding: const EdgeInsets.symmetric(vertical: 0),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: kBorderOutline),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: kPrimarySlate),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Error Message (if any)
                if (_error.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        border: Border.all(color: Colors.red.shade200),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        _error,
                        style: const TextStyle(
                          color: kBadgeBanned,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ),

                // TAB BAR
                TabBar(
                  controller: _tabController,
                  labelColor: kPrimarySlate,
                  unselectedLabelColor: kTextMuted,
                  indicatorColor: kPrimarySlate,
                  indicatorWeight: 3,
                  dividerColor: kBorderOutline,
                  tabs: [
                    const Tab(
                      child: Text(
                        'Active',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                    Tab(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Text(
                            'Pending',
                            style: TextStyle(fontWeight: FontWeight.w600),
                          ),
                          if (totalPending > 0) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.redAccent,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                '$totalPending',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const Tab(
                      child: Text(
                        'Archived',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),

                // SCROLLABLE LISTS (TAB VIEWS)
                Expanded(
                  child: _loading
                      ? const Center(
                          child: CircularProgressIndicator(
                            color: kPrimarySlate,
                          ),
                        )
                      : TabBarView(
                          controller: _tabController,
                          children: [
                            _buildTabContent(
                              items: _activeUsers,
                              emptyMessage: 'No active users found.',
                              emptyIcon: Icons.people_outline,
                              itemBuilder: (u) => _buildMobileCard(
                                user: u,
                                statusLabel: 'Active',
                                statusColor: kBadgeActive,
                                button1Label: 'Manage',
                                button1Icon: Icons.edit_outlined,
                                onButton1: () => _openManageUser(u),
                                // Archive is moved to the Manage bottom sheet
                              ),
                            ),
                            _buildTabContent(
                              items: _pendingRequests,
                              emptyMessage: 'No pending requests.',
                              emptyIcon: Icons.inbox_outlined,
                              itemBuilder: (u) => _buildMobileCard(
                                user: u,
                                statusLabel: 'Pending',
                                statusColor: kBadgePending,
                                button1Label: 'Approve',
                                button1Icon: Icons.check,
                                onButton1: () =>
                                    _approveRequest(u['email'] ?? ''),
                                button2Label: 'Decline',
                                button2Icon: Icons.close,
                                onButton2: () =>
                                    _declineRequest(u['email'] ?? ''),
                              ),
                            ),
                            _buildTabContent(
                              items: _archivedUsers,
                              emptyMessage: 'No archived users found.',
                              emptyIcon: Icons.inventory_2_outlined,
                              itemBuilder: (u) => _buildMobileCard(
                                user: u,
                                statusLabel: 'Inactive',
                                statusColor: kBadgeInactive,
                                button1Label: 'Restore',
                                button1Icon: Icons.restore_outlined,
                                onButton1: () => _restoreUser(u['email'] ?? ''),
                                button2Label: 'Delete',
                                button2Icon: Icons.delete_outline,
                                button2Color: kBadgeBanned,
                                onButton2: () => _deleteUser(u['email'] ?? ''),
                              ),
                            ),
                          ],
                        ),
                ),
              ],
            ),
          ),

          // Action Loading Overlay
          if (_actionLoading)
            Container(
              color: Colors.white.withOpacity(0.7),
              child: const Center(
                child: CircularProgressIndicator(color: kPrimarySlate),
              ),
            ),
        ],
      ),
    );
  }

  // Helper widget to render the content of a single tab
  Widget _buildTabContent({
    required List<Map<String, dynamic>> items,
    required String emptyMessage,
    required IconData emptyIcon,
    required Widget Function(Map<String, dynamic>) itemBuilder,
  }) {
    final filteredItems = items.where(_matchesSearch).toList();

    return RefreshIndicator(
      onRefresh: _loadUserManagementData,
      color: kPrimarySlate,
      child: filteredItems.isEmpty
          // Stack + ListView ensures pull-to-refresh works even when the list is completely empty
          ? Stack(
              children: [
                ListView(physics: const AlwaysScrollableScrollPhysics()),
                _buildCleanEmptyState(emptyMessage, emptyIcon),
              ],
            )
          : ListView.builder(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 100),
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: filteredItems.length,
              itemBuilder: (context, index) =>
                  itemBuilder(filteredItems[index]),
            ),
    );
  }

  // Refined Empty State
  Widget _buildCleanEmptyState(String message, IconData icon) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: Colors.grey.shade300, size: 64),
          const SizedBox(height: 16),
          Text(
            message,
            style: const TextStyle(color: kTextMuted, fontSize: 15),
          ),
        ],
      ),
    );
  }

  Widget _buildMobileCard({
    required Map<String, dynamic> user,
    required String statusLabel,
    required Color statusColor,
    required String button1Label,
    required IconData button1Icon,
    required VoidCallback? onButton1,
    Color button1Color = kTextDark,
    String? button2Label,
    IconData? button2Icon,
    VoidCallback? onButton2,
    Color button2Color = kTextDark,
  }) {
    final email = user['email']?.toString() ?? 'unknown@email.com';
    final name = _displayName(user);
    final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: kBorderOutline),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 20,
                  backgroundColor: kPrimarySlate,
                  child: Text(
                    initial,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                          color: kTextDark,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        email,
                        style: const TextStyle(color: kTextMuted, fontSize: 13),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: statusColor,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    statusLabel,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const Divider(height: 1, color: kBorderOutline),

          Padding(
            padding: const EdgeInsets.all(12.0),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onButton1,
                    icon: Icon(button1Icon, size: 16, color: button1Color),
                    label: Text(
                      button1Label,
                      style: TextStyle(
                        color: button1Color,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      side: BorderSide(
                        color: button1Color == kTextDark
                            ? kBorderOutline
                            : button1Color.withOpacity(0.5),
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      backgroundColor: Colors.white,
                    ),
                  ),
                ),
                if (button2Label != null && button2Icon != null) ...[
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: onButton2,
                      icon: Icon(button2Icon, size: 16, color: button2Color),
                      label: Text(
                        button2Label,
                        style: TextStyle(
                          color: button2Color,
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        side: BorderSide(
                          color: button2Color == kTextDark
                              ? kBorderOutline
                              : button2Color.withOpacity(0.5),
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                        backgroundColor: Colors.white,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// --- DEDICATED STATEFUL WIDGET FOR BOTTOM SHEET ---
class ManageUserBottomSheet extends StatefulWidget {
  final Map<String, dynamic> user;

  const ManageUserBottomSheet({Key? key, required this.user}) : super(key: key);

  @override
  State<ManageUserBottomSheet> createState() => _ManageUserBottomSheetState();
}

class _ManageUserBottomSheetState extends State<ManageUserBottomSheet> {
  bool _verifyLoading = false;
  bool _savingPassword = false;
  bool _credentialsVerified = false;

  // Visibility State Variables
  bool _obscureAdminPassword = true;
  bool _obscureNewPassword = true;
  bool _obscureCurrentPassword = true;

  String _adminPassword = '';
  String _newPassword = '';
  String _adminAuthError = '';
  Map<String, dynamic>? _verifiedUserCredentials;

  Future<void> _verifyAdminPassword() async {
    if (_adminPassword.trim().isEmpty) {
      setState(
        () => _adminAuthError = 'Enter your admin password to continue.',
      );
      return;
    }

    setState(() {
      _verifyLoading = true;
      _adminAuthError = '';
    });

    try {
      final prefs = await SharedPreferences.getInstance();
      final adminEmail =
          prefs.getString('user_email') ?? prefs.getString('email') ?? '';
      if (adminEmail.isEmpty)
        throw Exception('Admin email missing. Please log in again.');

      final verified = await ApiService.verifyAdminPassword(
        adminEmail,
        _adminPassword,
        widget.user['email']?.toString() ?? '',
      );

      if (mounted) {
        setState(() {
          _credentialsVerified = true;
          _verifiedUserCredentials = verified;
          _adminAuthError = '';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _credentialsVerified = false;
          _verifiedUserCredentials = null;
          _adminAuthError = e.toString().replaceAll('Exception: ', '');
        });
      }
    } finally {
      if (mounted) {
        setState(() => _verifyLoading = false);
      }
    }
  }

  Future<void> _updateUserPassword() async {
    if (_newPassword.trim().isEmpty) {
      setState(() => _adminAuthError = 'Enter a new password before saving.');
      return;
    }

    setState(() => _savingPassword = true);
    final email = widget.user['email']?.toString() ?? '';

    try {
      await ApiService.updateUserPassword(email, _newPassword);
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(
          () => _adminAuthError = e.toString().replaceAll('Exception: ', ''),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _savingPassword = false);
      }
    }
  }

  Future<void> _promptArchive() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: const Text(
          'Archive User',
          style: TextStyle(fontWeight: FontWeight.bold, color: kTextDark),
        ),
        content: const Text(
          'Are you sure you want to continue in archiving this account?',
          style: TextStyle(color: kTextMuted),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: kTextMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: kBadgeInactive,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Archive', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      Navigator.pop(context, 'archive');
    }
  }

  String _displayName(Map<String, dynamic> user) {
    return (user['full_name'] ?? user['name'] ?? user['email'] ?? 'Unknown')
        .toString();
  }

  @override
  Widget build(BuildContext context) {
    final email = widget.user['email']?.toString() ?? '';
    final name = _displayName(widget.user);
    final role = widget.user['role']?.toString() ?? 'faculty';
    final archived = widget.user['archived'] == true;
    final revealedPassword =
        _verifiedUserCredentials?['password']?.toString() ?? '';

    return Container(
      padding: const EdgeInsets.all(24),
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
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: kTextDark,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: kTextMuted),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              name,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: kTextDark,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              email,
              style: const TextStyle(fontSize: 14, color: kTextMuted),
            ),
            const SizedBox(height: 24),

            if (!_credentialsVerified)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: kBorderOutline),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Admin Verification Required',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: kTextDark,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Enter your admin password to view and update credentials.',
                      style: TextStyle(fontSize: 13, color: kTextMuted),
                    ),
                    const SizedBox(height: 20),

                    TextField(
                      obscureText: _obscureAdminPassword,
                      decoration: InputDecoration(
                        labelText: 'Admin Password',
                        labelStyle: const TextStyle(
                          color: kTextMuted,
                          fontSize: 14,
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 16,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: const BorderSide(color: kBorderOutline),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: const BorderSide(
                            color: Color(0xFF333333),
                          ),
                        ),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscureAdminPassword
                                ? Icons.visibility_off
                                : Icons.visibility,
                            color: kTextMuted,
                            size: 20,
                          ),
                          onPressed: () => setState(
                            () =>
                                _obscureAdminPassword = !_obscureAdminPassword,
                          ),
                        ),
                      ),
                      onChanged: (value) =>
                          setState(() => _adminPassword = value),
                    ),
                    if (_adminAuthError.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        _adminAuthError,
                        style: const TextStyle(
                          color: kBadgeBanned,
                          fontSize: 12,
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _verifyLoading ? null : _verifyAdminPassword,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF2D2D2D),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        child: _verifyLoading
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.5,
                                  color: Colors.white,
                                ),
                              )
                            : const Text(
                                'Verify Identity',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
              ),

            AnimatedSize(
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeOut,
              child: (_credentialsVerified && _verifiedUserCredentials != null)
                  ? Column(
                      children: [
                        const SizedBox(height: 24),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: Colors.green.shade50,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.green.shade200),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Verified Credentials',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Colors.green,
                                ),
                              ),
                              const SizedBox(height: 16),
                              _buildMetaRow('Role', role),
                              const SizedBox(height: 8),
                              _buildMetaRow(
                                'Archived',
                                archived ? 'Yes' : 'No',
                              ),
                              const SizedBox(height: 8),
                              // Current Password Row with eye toggle
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text(
                                    'Current password',
                                    style: TextStyle(color: kTextDark),
                                  ),
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        _obscureCurrentPassword
                                            ? '••••••••'
                                            : (revealedPassword.isEmpty
                                                  ? 'Not set'
                                                  : revealedPassword),
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          color: Colors.black,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      InkWell(
                                        onTap: () => setState(
                                          () => _obscureCurrentPassword =
                                              !_obscureCurrentPassword,
                                        ),
                                        borderRadius: BorderRadius.circular(20),
                                        child: Padding(
                                          padding: const EdgeInsets.all(4.0),
                                          child: Icon(
                                            _obscureCurrentPassword
                                                ? Icons.visibility_off
                                                : Icons.visibility,
                                            size: 16,
                                            color: Colors.black54,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),
                        TextField(
                          obscureText: _obscureNewPassword,
                          decoration: InputDecoration(
                            labelText: 'New password',
                            labelStyle: const TextStyle(color: kTextMuted),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 16,
                            ),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: const BorderSide(
                                color: kBorderOutline,
                              ),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: const BorderSide(
                                color: Color(0xFF333333),
                              ),
                            ),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscureNewPassword
                                    ? Icons.visibility_off
                                    : Icons.visibility,
                                color: kTextMuted,
                                size: 20,
                              ),
                              onPressed: () => setState(
                                () =>
                                    _obscureNewPassword = !_obscureNewPassword,
                              ),
                            ),
                          ),
                          onChanged: (value) =>
                              setState(() => _newPassword = value),
                        ),
                        const SizedBox(height: 24),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: _savingPassword
                                ? null
                                : _updateUserPassword,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF2D2D2D),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
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
                                : const Text(
                                    'Save Password',
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                          ),
                        ),

                        // ARCHIVE BUTTON MOVED HERE
                        if (!archived) ...[
                          const SizedBox(height: 24),
                          const Divider(color: kBorderOutline),
                          const SizedBox(height: 24),
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton.icon(
                              onPressed: _promptArchive,
                              icon: const Icon(
                                Icons.archive_outlined,
                                size: 18,
                                color: kTextDark,
                              ),
                              label: const Text(
                                'Archive Account',
                                style: TextStyle(
                                  color: kTextDark,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 14,
                                ),
                                side: const BorderSide(color: kBorderOutline),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ],
                    )
                  : const SizedBox.shrink(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetaRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: kTextDark)),
        Text(
          value,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            color: Colors.black,
          ),
        ),
      ],
    );
  }
}
