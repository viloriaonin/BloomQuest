import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../widgets/adminSidebar.dart';
import 'package:BloomQuest/config/api_config.dart';
import 'package:BloomQuest/models/activity_log.dart';
import 'package:BloomQuest/utils/theme_constants.dart';
import 'account.dart'; // IMPORT THE ACCOUNT BAR

const List<String> kDepartments = [
  'All Departments',
  'CICS',
  'COE',
  'CAS',
  'CBA',
];
const Map<String, int?> kPeriods = {
  'Last 7 Days': 7,
  'Last 30 Days': 30,
  'Last 90 Days': 90,
  'All Time': null,
};
const List<String> kMonthAbbrs = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

bool withinPeriod(String dateStr, int? days) {
  if (days == null) return true;
  final entryDate = DateTime.tryParse(dateStr);
  if (entryDate == null) return true;
  return DateTime.now().difference(entryDate).inDays <= days;
}

// --- Humanized timestamp: "Today, 4:01 PM" / "Yesterday, 3:56 PM" / "Jul 18, 3:56 PM"
String friendlyTimestamp(String dateStr, String timeStr) {
  final parsed = DateTime.tryParse(dateStr);
  if (parsed == null) return '$dateStr $timeStr'.trim();
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final entryDay = DateTime(parsed.year, parsed.month, parsed.day);
  final diff = today.difference(entryDay).inDays;

  String dayLabel;
  if (diff == 0) {
    dayLabel = 'Today';
  } else if (diff == 1) {
    dayLabel = 'Yesterday';
  } else {
    dayLabel = '${kMonthAbbrs[parsed.month - 1]} ${parsed.day}';
  }
  return timeStr.isEmpty ? dayLabel : '$dayLabel, $timeStr';
}

// --- Action -> icon/color mapping, used by both the log cards and the summary row
IconData iconForAction(String action) {
  final a = action.toLowerCase();
  if (a.contains('logout')) return Icons.logout_rounded;
  if (a.contains('login')) return Icons.login_rounded;
  if (a.contains('delete') || a.contains('remove'))
    return Icons.delete_outline_rounded;
  if (a.contains('assessment') || a.contains('exam') || a.contains('quiz'))
    return Icons.assignment_outlined;
  if (a.contains('question')) return Icons.help_outline_rounded;
  if (a.contains('upload') || a.contains('add') || a.contains('create'))
    return Icons.upload_outlined;
  if (a.contains('update') || a.contains('edit')) return Icons.edit_outlined;
  return Icons.notifications_none_rounded;
}

Color colorForAction(String action) {
  final a = action.toLowerCase();
  if (a.contains('logout')) return Colors.blueGrey;
  if (a.contains('login')) return const Color(0xFF2E9E5B);
  if (a.contains('delete') || a.contains('remove'))
    return const Color(0xFFD64545);
  if (a.contains('assessment') || a.contains('exam') || a.contains('quiz'))
    return const Color(0xFF7B5EC7);
  if (a.contains('question')) return const Color(0xFF1E96A8);
  if (a.contains('upload') || a.contains('add') || a.contains('create'))
    return const Color(0xFF3B82C4);
  if (a.contains('update') || a.contains('edit')) return kAccentOrange;
  return Colors.grey;
}

class AdminReportsPage extends StatefulWidget {
  const AdminReportsPage({super.key});
  @override
  State<AdminReportsPage> createState() => _AdminReportsPageState();
}

class _AdminReportsPageState extends State<AdminReportsPage> {
  String _period = 'Last 30 Days';
  String _department = 'All Departments';
  String _faculty = 'All Faculty';
  List<ActivityLogEntry> _activityLog = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final rows = await fetchActivityLog();
      setState(() {
        _activityLog = rows;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  // Helper method to aggressively filter out ANY admin or system log
  bool _isAdminOrSystem(ActivityLogEntry row) {
    final role = row.role?.toLowerCase() ?? '';
    final name = row.name?.toLowerCase() ?? '';
    final detail = row.detail?.toLowerCase() ?? '';

    // 1. Exclude if role is explicitly set to admin
    if (role == 'admin') return true;

    // 2. Exclude system logs or accounts named admin
    if (name == 'system' || name == 'admin' || name.contains('admin@'))
      return true;

    // 3. Catch logs where the admin email is embedded in the action details
    // (e.g., "Logged in as admin@bloomquest.com")
    if (detail.contains('admin@')) return true;

    return false;
  }

  List<String> get _facultyOptions {
    final names =
        _activityLog
            .where((row) {
              // EXCLUDE admins and system, keeping everyone else
              if (_isAdminOrSystem(row)) return false;
              // Filter by department
              if (_department != 'All Departments' && row.dept != _department)
                return false;
              return true;
            })
            .map((row) => row.name)
            .where((name) => name != null && name.isNotEmpty)
            .cast<String>()
            .toSet()
            .toList()
          ..sort();

    return ['All Faculty', ...names];
  }

  List<ActivityLogEntry> get _filteredLog {
    final effectiveFaculty = _facultyOptions.contains(_faculty)
        ? _faculty
        : 'All Faculty';
    final days = kPeriods[_period];

    final filtered = _activityLog.where((row) {
      // EXCLUDE admins and system logs from the final list
      if (_isAdminOrSystem(row)) return false;

      return withinPeriod(row.date, days) &&
          (_department == 'All Departments' || row.dept == _department) &&
          (effectiveFaculty == 'All Faculty' || row.name == effectiveFaculty);
    }).toList();

    filtered.sort(
      (a, b) => '${b.date} ${b.time}'.compareTo('${a.date} ${a.time}'),
    );
    return filtered;
  }

  Future<void> _openFilterSheet({
    required String title,
    required List<String> options,
    required String selected,
    required ValueChanged<String> onSelected,
  }) async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: kBorderColor,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 16),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      title,
                      style: const TextStyle(
                        fontFamily: 'Georgia',
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Flexible(
                  child: ListView(
                    shrinkWrap: true,
                    children: options.map((opt) {
                      final isSelected = opt == selected;
                      return ListTile(
                        title: Text(
                          opt,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: isSelected
                                ? FontWeight.bold
                                : FontWeight.normal,
                            color: isSelected ? kAccentOrange : Colors.black87,
                          ),
                        ),
                        trailing: isSelected
                            ? const Icon(
                                Icons.check_rounded,
                                color: kAccentOrange,
                              )
                            : null,
                        onTap: () {
                          onSelected(opt);
                          Navigator.pop(sheetContext);
                        },
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final effectiveFaculty = _facultyOptions.contains(_faculty)
        ? _faculty
        : 'All Faculty';
    final entries = _filteredLog;

    final loginCount = entries
        .where((e) => e.action.toLowerCase().contains('login'))
        .length;
    final assessmentCount = entries.where((e) {
      final a = e.action.toLowerCase();
      return a.contains('assessment') ||
          a.contains('exam') ||
          a.contains('quiz');
    }).length;

    return Scaffold(
      backgroundColor: kLightBgColor,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        titleSpacing: 0,
        title: const AccountTopBar(),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, color: kBorderColor, thickness: 1),
        ),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadData,
          color: kAccentOrange,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 100),
            children: [
              const Text(
                'Reports',
                style: TextStyle(
                  fontFamily: 'Georgia',
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Filter faculty activity, question contributions, and assessment trends.',
                style: TextStyle(fontSize: 14, color: Colors.black54),
              ),
              const SizedBox(height: 20),

              // --- Compact horizontal filter chips (replaces the 3 stacked dropdowns) ---
              SizedBox(
                height: 40,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    _FilterChip(
                      label: _period,
                      onTap: () => _openFilterSheet(
                        title: 'Period',
                        options: kPeriods.keys.toList(),
                        selected: _period,
                        onSelected: (val) => setState(() => _period = val),
                      ),
                    ),
                    const SizedBox(width: 8),
                    _FilterChip(
                      label: _department,
                      onTap: () => _openFilterSheet(
                        title: 'Department',
                        options: kDepartments,
                        selected: _department,
                        onSelected: (val) => setState(() {
                          _department = val;
                          _faculty = 'All Faculty';
                        }),
                      ),
                    ),
                    const SizedBox(width: 8),
                    _FilterChip(
                      label: effectiveFaculty,
                      onTap: () => _openFilterSheet(
                        title: 'Faculty',
                        options: _facultyOptions,
                        selected: effectiveFaculty,
                        onSelected: (val) => setState(() => _faculty = val),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // --- Summary row: quick at-a-glance counts for the selected filters ---
              if (!_isLoading && _error == null)
                Row(
                  children: [
                    Expanded(
                      child: _SummaryCard(
                        icon: Icons.bar_chart_rounded,
                        iconColor: kDarkButtonColor,
                        label: 'Total Activities',
                        value: '${entries.length}',
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _SummaryCard(
                        icon: Icons.login_rounded,
                        iconColor: const Color(0xFF2E9E5B),
                        label: 'Logins',
                        value: '$loginCount',
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _SummaryCard(
                        icon: Icons.assignment_outlined,
                        iconColor: const Color(0xFF7B5EC7),
                        label: 'Assessments',
                        value: '$assessmentCount',
                      ),
                    ),
                  ],
                ),
              const SizedBox(height: 28),

              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'User Activity Log',
                    style: TextStyle(
                      fontFamily: 'Georgia',
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                  if (!_isLoading && _error == null)
                    Text(
                      '${entries.length} ${entries.length == 1 ? 'entry' : 'entries'}',
                      style: const TextStyle(
                        fontSize: 13,
                        color: Colors.black54,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 16),

              if (_isLoading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 40),
                  child: Center(
                    child: CircularProgressIndicator(color: kDarkButtonColor),
                  ),
                )
              else if (_error != null)
                _ErrorCard(message: _error!, onRetry: _loadData)
              else if (entries.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 40),
                  child: Center(
                    child: Text(
                      'No activity matches these filters.',
                      style: TextStyle(color: Colors.black45, fontSize: 14),
                    ),
                  ),
                )
              else
                ...entries.map((entry) => _ActivityCard(entry: entry)),
            ],
          ),
        ),
      ),
    );
  }
}

// --- Pill-shaped filter chip, opens a bottom sheet of options when tapped ---
class _FilterChip extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _FilterChip({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: kBorderColor),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Colors.black87,
              ),
            ),
            const SizedBox(width: 4),
            const Icon(
              Icons.keyboard_arrow_down_rounded,
              size: 18,
              color: Colors.black54,
            ),
          ],
        ),
      ),
    );
  }
}

// --- Small stat card used in the summary row ---
class _SummaryCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;
  const _SummaryCard({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: kBorderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: iconColor),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(fontSize: 11, color: Colors.black54),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _ActivityCard extends StatelessWidget {
  final ActivityLogEntry entry;
  const _ActivityCard({required this.entry});

  @override
  Widget build(BuildContext context) {
    final displayName = entry.name ?? 'Faculty Member';
    final initial = displayName.trim().isNotEmpty
        ? displayName.trim()[0].toUpperCase()
        : '?';
    final accentColor = colorForAction(entry.action);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kBorderColor),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Action icon badge
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: accentColor.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(
              iconForAction(entry.action),
              size: 18,
              color: accentColor,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 10,
                            backgroundColor: kDarkButtonColor,
                            child: Text(
                              initial,
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              displayName,
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 15,
                                color: Colors.black87,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      friendlyTimestamp(entry.date, entry.time),
                      style: const TextStyle(
                        fontSize: 12,
                        color: Colors.black45,
                      ),
                    ),
                  ],
                ),
                if (entry.dept != null) ...[
                  const SizedBox(height: 2),
                  Padding(
                    padding: const EdgeInsets.only(left: 28),
                    child: Text(
                      entry.dept!,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Colors.black54,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 10),
                Padding(
                  padding: const EdgeInsets.only(left: 28),
                  child: Text(
                    entry.action,
                    style: const TextStyle(fontSize: 14, color: Colors.black87),
                  ),
                ),
                if (entry.detail != null && entry.detail!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Padding(
                    padding: const EdgeInsets.only(left: 28),
                    child: Text(
                      entry.detail!,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Colors.black54,
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

class _ErrorCard extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorCard({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.red.shade200),
      ),
      child: Column(
        children: [
          const Text(
            "Couldn't load activity data",
            style: TextStyle(fontWeight: FontWeight.bold, color: Colors.red),
          ),
          const SizedBox(height: 8),
          Text(
            message,
            style: const TextStyle(fontSize: 13, color: Colors.redAccent),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          OutlinedButton(
            onPressed: onRetry,
            style: OutlinedButton.styleFrom(
              side: BorderSide(color: Colors.red.shade200),
            ),
            child: const Text('Try Again', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }
}
