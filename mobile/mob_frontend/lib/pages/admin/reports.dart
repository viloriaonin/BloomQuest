import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../widgets/adminSidebar.dart';

// ---------------------------------------------------------------------------
// API CONFIG
//
// You're running via `flutter run -d chrome`, which compiles to Flutter Web —
// this behaves like a normal browser app, not a physical device. That means:
//   - "localhost" refers to your own computer, same as your React app, so
//     this works as long as FastAPI is running locally.
//   - Because Chrome enforces CORS, your FastAPI backend must explicitly
//     allow requests from whatever origin Flutter Web serves on (check the
//     browser's address bar when the app opens — commonly something like
//     http://localhost:PORT with a random port unless you set one).
//
// Add this to your FastAPI main.py if you haven't already:
//
//   from fastapi.middleware.cors import CORSMiddleware
//   app.add_middleware(
//       CORSMiddleware,
//       allow_origins=["*"],  # or restrict to your Flutter Web origin
//       allow_credentials=True,
//       allow_methods=["*"],
//       allow_headers=["*"],
//   )
// ---------------------------------------------------------------------------
const String kApiBaseUrl = "http://localhost:8000/api";
const String kActivityLogEndpoint = "$kApiBaseUrl/activity-logs";

class ActivityLogEntry {
  final int id;
  final String? name;
  final String? dept;
  final String action;
  final String? detail;
  final String? type;
  final String? status;
  final String date;
  final String time;

  ActivityLogEntry({
    required this.id,
    this.name,
    this.dept,
    required this.action,
    this.detail,
    this.type,
    this.status,
    required this.date,
    required this.time,
  });

  factory ActivityLogEntry.fromJson(Map<String, dynamic> json) {
    return ActivityLogEntry(
      id: json['id'] as int,
      name: json['name'] as String?,
      dept: json['dept'] as String?,
      action: json['action'] as String? ?? '',
      detail: json['detail'] as String?,
      type: json['type'] as String?,
      status: json['status'] as String?,
      date: json['date'] as String? ?? '',
      time: json['time'] as String? ?? '',
    );
  }
}

Future<List<ActivityLogEntry>> fetchActivityLog() async {
  final response = await http.get(Uri.parse(kActivityLogEndpoint));

  if (response.statusCode != 200) {
    throw Exception('Request failed with status ${response.statusCode}');
  }

  final decoded = jsonDecode(response.body);
  final List<dynamic> rows = decoded is List
      ? decoded
      : (decoded['data'] as List<dynamic>? ?? []);
  return rows
      .map((row) => ActivityLogEntry.fromJson(row as Map<String, dynamic>))
      .toList();
}

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

Color _typeColor(String? type) {
  switch (type?.toLowerCase()) {
    case 'generate':
      return const Color(0xFFDBEAFE); // blue-100-ish
    case 'upload':
      return const Color(0xFFFEF3C7); // amber-100-ish
    case 'classify':
      return const Color(0xFFEDE9FE); // purple-100-ish
    case 'login':
      return const Color(0xFFF3F4F6); // gray-100
    default:
      return const Color(0xFFF3F4F6);
  }
}

Color _typeTextColor(String? type) {
  switch (type?.toLowerCase()) {
    case 'generate':
      return const Color(0xFF1D4ED8);
    case 'upload':
      return const Color(0xFFB45309);
    case 'classify':
      return const Color(0xFF6D28D9);
    case 'login':
      return const Color(0xFF4B5563);
    default:
      return const Color(0xFF4B5563);
  }
}

Color _statusColor(String? status) {
  switch (status?.toLowerCase()) {
    case 'success':
      return const Color(0xFFD1FAE5); // emerald-100-ish
    case 'error':
      return const Color(0xFFFEE2E2); // red-100-ish
    case 'info':
      return const Color(0xFFF3F4F6); // gray-100
    default:
      return const Color(0xFFF3F4F6);
  }
}

Color _statusTextColor(String? status) {
  switch (status?.toLowerCase()) {
    case 'success':
      return const Color(0xFF047857);
    case 'error':
      return const Color(0xFFB91C1C);
    case 'info':
      return const Color(0xFF4B5563);
    default:
      return const Color(0xFF4B5563);
  }
}

bool _withinPeriod(String dateStr, int? days) {
  if (days == null) return true;
  final entryDate = DateTime.tryParse(dateStr);
  if (entryDate == null) return true;
  final diff = DateTime.now().difference(entryDate).inDays;
  return diff <= days;
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

  List<String> get _facultyOptions {
    final names =
        _activityLog
            .where(
              (row) =>
                  _department == 'All Departments' || row.dept == _department,
            )
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
      final matchesPeriod = _withinPeriod(row.date, days);
      final matchesDept =
          _department == 'All Departments' || row.dept == _department;
      final matchesFaculty =
          effectiveFaculty == 'All Faculty' || row.name == effectiveFaculty;
      return matchesPeriod && matchesDept && matchesFaculty;
    }).toList();
    filtered.sort(
      (a, b) => '${b.date} ${b.time}'.compareTo('${a.date} ${a.time}'),
    );
    return filtered;
  }

  @override
  Widget build(BuildContext context) {
    final effectiveFaculty = _facultyOptions.contains(_faculty)
        ? _faculty
        : 'All Faculty';
    final entries = _filteredLog;

    return Container(
      color: kBg,
      child: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadData,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const Text(
                'Reports',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Filter faculty activity, question contributions, and assessment trends.',
                style: TextStyle(fontSize: 13, color: Colors.black54),
              ),
              const SizedBox(height: 16),

              // Filters
              _FilterDropdown(
                label: 'Period',
                value: _period,
                options: kPeriods.keys.toList(),
                onChanged: (val) => setState(() => _period = val),
              ),
              const SizedBox(height: 10),
              _FilterDropdown(
                label: 'Department',
                value: _department,
                options: kDepartments,
                onChanged: (val) => setState(() {
                  _department = val;
                  _faculty = 'All Faculty';
                }),
              ),
              const SizedBox(height: 10),
              _FilterDropdown(
                label: 'Faculty',
                value: effectiveFaculty,
                options: _facultyOptions,
                onChanged: (val) => setState(() => _faculty = val),
              ),
              const SizedBox(height: 20),

              // Activity Log
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'User Activity Log',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Colors.black87,
                    ),
                  ),
                  if (!_isLoading && _error == null)
                    Text(
                      '${entries.length} ${entries.length == 1 ? 'entry' : 'entries'}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Colors.black54,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),

              if (_isLoading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 40),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_error != null)
                _ErrorCard(message: _error!, onRetry: _loadData)
              else if (entries.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 32),
                  child: Center(
                    child: Text(
                      'No activity matches these filters.\nTry widening the date range or department.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.black45, fontSize: 13),
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

class _FilterDropdown extends StatelessWidget {
  final String label;
  final String value;
  final List<String> options;
  final ValueChanged<String> onChanged;

  const _FilterDropdown({
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFFF9FAFB),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 13, color: Colors.black54),
          ),
          DropdownButton<String>(
            value: options.contains(value) ? value : options.first,
            underline: const SizedBox.shrink(),
            items: options
                .map(
                  (opt) => DropdownMenuItem(
                    value: opt,
                    child: Text(opt, style: const TextStyle(fontSize: 13)),
                  ),
                )
                .toList(),
            onChanged: (val) {
              if (val != null) onChanged(val);
            },
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
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  entry.name ?? 'System',
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
              ),
              Text(
                '${entry.date}  ${entry.time}',
                style: const TextStyle(fontSize: 11, color: Colors.black45),
              ),
            ],
          ),
          if (entry.dept != null) ...[
            const SizedBox(height: 2),
            Text(
              entry.dept!,
              style: const TextStyle(fontSize: 12, color: Colors.black54),
            ),
          ],
          const SizedBox(height: 8),
          Text(
            entry.action,
            style: const TextStyle(fontSize: 13, color: Colors.black87),
          ),
          if (entry.detail != null && entry.detail!.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              entry.detail!,
              style: const TextStyle(fontSize: 12, color: Colors.black54),
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              if (entry.type != null)
                _Badge(
                  text: entry.type!,
                  bg: _typeColor(entry.type),
                  fg: _typeTextColor(entry.type),
                ),
              if (entry.type != null && entry.status != null)
                const SizedBox(width: 8),
              if (entry.status != null)
                _Badge(
                  text: entry.status!,
                  bg: _statusColor(entry.status),
                  fg: _statusTextColor(entry.status),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  final String text;
  final Color bg;
  final Color fg;

  const _Badge({required this.text, required this.bg, required this.fg});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.w600),
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
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          const Text(
            "Couldn't load activity data",
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: Color(0xFFB91C1C),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            message,
            style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Try Again')),
        ],
      ),
    );
  }
}
