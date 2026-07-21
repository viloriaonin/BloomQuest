import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AccountTopBar extends StatefulWidget {
  const AccountTopBar({super.key});

  @override
  State<AccountTopBar> createState() => _AccountTopBarState();
}

class _AccountTopBarState extends State<AccountTopBar> {
  String name = 'Loading...';
  String email = '...';

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  Future<void> _loadUserData() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      name = prefs.getString('user_name') ?? 'Admin';
      email = prefs.getString('user_email') ?? 'admin@bloomquest.edu';
    });
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const AccountSettingsPage()),
          );
        },
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 12.0),
          child: Row(
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: const Color(0xFF2D2D2D),
                child: name != 'Loading...'
                    ? Text(
                        name.isNotEmpty ? name[0].toUpperCase() : '?',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                        ),
                      )
                    : const SizedBox(),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Hello, ${name.split(' ').first}',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF1A1A1A),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      email,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Colors.black54,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// --- ACCOUNT SETTINGS PAGE ---
class AccountSettingsPage extends StatefulWidget {
  const AccountSettingsPage({super.key});

  @override
  State<AccountSettingsPage> createState() => _AccountSettingsPageState();
}

class _AccountSettingsPageState extends State<AccountSettingsPage> {
  String name = 'Admin';
  String email = 'admin@bloomquest.edu';
  
  // Notification States matching the provided image mockup
  bool _globalNotifications = true;
  bool _accountRequestsAlerts = true;
  bool _securityAlerts = false;
  bool _platformUpdates = false;

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  Future<void> _loadUserData() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      name = prefs.getString('user_name') ?? 'Admin';
      email = prefs.getString('user_email') ?? 'admin@bloomquest.edu';
    });
  }

  void _showChangePasswordDialog() {
    final currentPasswordController = TextEditingController();
    final newPasswordController = TextEditingController();
    final confirmPasswordController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Change Password', style: TextStyle(fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: currentPasswordController,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Current Password',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: newPasswordController,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'New Password',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: confirmPasswordController,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Confirm New Password',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: Colors.black54)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2D2D2D),
              foregroundColor: Colors.white,
            ),
            onPressed: () {
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Password updated successfully.')),
              );
            },
            child: const Text('Update'),
          ),
        ],
      ),
    );
  }

  Future<void> _logout(BuildContext context) async {
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.logout_rounded, size: 48, color: Color(0xFF2D2D2D)),
              const SizedBox(height: 16),
              const Text(
                'Confirm Logout',
                style: TextStyle(fontFamily: 'Georgia', fontSize: 22, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Are you sure you want to securely log out of your session?',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.black54),
              ),
              const SizedBox(height: 32),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        side: const BorderSide(color: Color(0xFFEAEAEA)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Cancel', style: TextStyle(color: Colors.black87)),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(ctx, true),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF2D2D2D),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Logout'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    if (confirmed == true) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.clear();

      const secureStorage = FlutterSecureStorage();
      await secureStorage.deleteAll();

      if (context.mounted) Navigator.pushReplacementNamed(context, '/');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9F9F9),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        automaticallyImplyLeading: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Account Settings', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFEAEAEA), height: 1),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24.0),
          children: [
            // ── 1. ACCOUNT PROFILE CARD ──
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFEAEAEA)),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: const Color(0xFF2D2D2D),
                    child: Text(
                      name.isNotEmpty ? name[0].toUpperCase() : 'A',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 22,
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF1A1A1A),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          email,
                          style: const TextStyle(
                            fontSize: 13,
                            color: Colors.black54,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // ── 2. SECURITY CARD ──
            const Padding(
              padding: EdgeInsets.only(left: 4, bottom: 8),
              child: Text('Security', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.black54)),
            ),
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFEAEAEA)),
              ),
              child: Material(
                color: const Color(0xFFF7F7F7),
                borderRadius: BorderRadius.circular(16),
                child: Theme(
                  data: Theme.of(context).copyWith(
                    splashColor: const Color(0xFFE7E7E7),
                  ),
                  child: ListTile(
                    tileColor: const Color(0xFFF7F7F7),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
                    leading: const Icon(Icons.lock_outline, color: Color(0xFF2D2D2D)),
                    title: const Text(
                      'Change Password',
                      style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                    ),
                    trailing: const Icon(Icons.chevron_right, color: Colors.black45),
                    onTap: _showChangePasswordDialog,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),

            // ── 3. SYSTEM NOTIFICATIONS CARD (Matches Mockup) ──
            const Padding(
              padding: EdgeInsets.only(left: 4, bottom: 8),
              child: Text('System Notifications', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Colors.black54)),
            ),
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFEAEAEA)),
              ),
              child: Theme(
                data: Theme.of(context).copyWith(
                  splashColor: const Color(0xFFE7E7E7),
                ),
                child: Column(
                  children: [
                    Material(
                      color: const Color(0xFFF7F7F7),
                      child: SwitchListTile(
                        tileColor: const Color(0xFFF7F7F7),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                        secondary: const Icon(Icons.notifications_none_outlined, color: Color(0xFF2D2D2D)),
                        title: const Text(
                          'Enable All Notifications',
                          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: Colors.black87),
                        ),
                        value: _globalNotifications,
                        activeThumbColor: const Color(0xFF2D2D2D),
                        activeTrackColor: Colors.grey.shade300,
                        inactiveThumbColor: const Color(0xFFBCAAA4),
                        inactiveTrackColor: const Color(0xFFF3EBEB),
                        onChanged: (bool value) {
                          setState(() {
                            _globalNotifications = value;
                            if (!value) {
                              _accountRequestsAlerts = false;
                              _securityAlerts = false;
                              _platformUpdates = false;
                            }
                          });
                        },
                      ),
                    ),
                    const Divider(height: 1, color: Color(0xFFEAEAEA)),
                    Material(
                      color: const Color(0xFFF7F7F7),
                      child: SwitchListTile(
                        tileColor: const Color(0xFFF7F7F7),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                        secondary: const Icon(Icons.person_add_outlined, color: Color(0xFF2D2D2D)),
                        title: const Text(
                          'Account Requests',
                          style: TextStyle(fontWeight: FontWeight.w400, fontSize: 14, color: Colors.black87),
                        ),
                        subtitle: const Text(
                          'Alerts when a new user requests access',
                          style: TextStyle(fontSize: 12, color: Colors.black45),
                        ),
                        value: _accountRequestsAlerts,
                        activeThumbColor: const Color(0xFF2D2D2D),
                        activeTrackColor: Colors.grey.shade300,
                        inactiveThumbColor: const Color(0xFFBCAAA4),
                        inactiveTrackColor: const Color(0xFFF3EBEB),
                        onChanged: _globalNotifications
                            ? (bool value) {
                                setState(() => _accountRequestsAlerts = value);
                              }
                            : null,
                      ),
                    ),
                    const Divider(height: 1, color: Color(0xFFEAEAEA)),
                    Material(
                      color: const Color(0xFFF7F7F7),
                      child: SwitchListTile(
                        tileColor: const Color(0xFFF7F7F7),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                        secondary: const Icon(Icons.shield_outlined, color: Color(0xFF2D2D2D)),
                        title: const Text(
                          'Security Alerts',
                          style: TextStyle(fontWeight: FontWeight.w400, fontSize: 14, color: Colors.black87),
                        ),
                        subtitle: const Text(
                          'Alerts for failed logins or system errors',
                          style: TextStyle(fontSize: 12, color: Colors.black45),
                        ),
                        value: _securityAlerts,
                        activeThumbColor: const Color(0xFF2D2D2D),
                        activeTrackColor: Colors.grey.shade300,
                        inactiveThumbColor: const Color(0xFFBCAAA4),
                        inactiveTrackColor: const Color(0xFFF3EBEB),
                        onChanged: _globalNotifications
                            ? (bool value) {
                                setState(() => _securityAlerts = value);
                              }
                            : null,
                      ),
                    ),
                    const Divider(height: 1, color: Color(0xFFEAEAEA)),
                    Material(
                      color: const Color(0xFFF7F7F7),
                      child: SwitchListTile(
                        tileColor: const Color(0xFFF7F7F7),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                        secondary: const Icon(Icons.system_update_alt_outlined, color: Color(0xFF2D2D2D)),
                        title: const Text(
                          'Platform Updates',
                          style: TextStyle(fontWeight: FontWeight.w400, fontSize: 14, color: Colors.black87),
                        ),
                        subtitle: const Text(
                          'News and changelogs regarding BloomQuest',
                          style: TextStyle(fontSize: 12, color: Colors.black45),
                        ),
                        value: _platformUpdates,
                        activeThumbColor: const Color(0xFF2D2D2D),
                        activeTrackColor: Colors.grey.shade300,
                        inactiveThumbColor: const Color(0xFFBCAAA4),
                        inactiveTrackColor: const Color(0xFFF3EBEB),
                        onChanged: _globalNotifications
                            ? (bool value) {
                                setState(() => _platformUpdates = value);
                              }
                            : null,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 32),

            // ── 4. LOGOUT BUTTON ──
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => _logout(context),
                icon: const Icon(Icons.logout),
                label: const Text('Logout', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2D2D2D),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}