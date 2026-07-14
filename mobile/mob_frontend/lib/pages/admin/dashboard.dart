import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'acadmgt.dart';
import 'questionbank.dart';
import 'reports.dart';
import 'usermgt.dart';

class AdminDashboardPage extends StatefulWidget {
  const AdminDashboardPage({super.key});

  @override
  State<AdminDashboardPage> createState() => _AdminDashboardPageState();
}

class _AdminDashboardPageState extends State<AdminDashboardPage> {
  int _currentIndex = 0;
  String adminName = '';
  String adminEmail = '';
  bool _analyticsLoading = true;
  String? _analyticsError;
  int _totalQuestions = 0;
  int _totalAssessments = 0;
  int _activeFaculty = 0;
  int _avgQuestionsPerFaculty = 0;
  double _avgAssessmentsPerWeek = 0.0;
  String _mostActiveDept = 'N/A';
  int _successRate = 0;
  List<ActivityLogEntry> _dashboardActivityLog = [];

  static const primaryColor = Color(0xFF7B1113);

  @override
  void initState() {
    super.initState();
    _loadUserData();
    _loadDashboardAnalytics();
  }

  Future<void> _loadUserData() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      adminName = prefs.getString('user_name') ?? 'Admin';
      adminEmail = prefs.getString('user_email') ?? '';
    });
  }

  Future<void> _loadDashboardAnalytics() async {
    setState(() {
      _analyticsLoading = true;
      _analyticsError = null;
    });

    try {
      final rows = await fetchActivityLog();
      final visibleRows = rows.where((row) {
        final role = row.role?.toLowerCase();
        final name = row.name?.toLowerCase();
        return role != 'admin' && name != 'system';
      }).toList();

      final totalQuestions = visibleRows
          .where((row) => row.type?.toLowerCase() == 'generate')
          .length;
      final totalAssessments = visibleRows
          .where((row) => row.type?.toLowerCase() == 'download')
          .length;
      final activeFaculty = visibleRows
          .map((row) => row.name?.toLowerCase())
          .where((name) => name != null && name.isNotEmpty)
          .toSet()
          .length;
      final successRate = visibleRows.isEmpty
          ? 0
          : ((visibleRows.where((row) => row.status?.toLowerCase() == 'success').length / visibleRows.length) * 100).round();
      final deptCounts = <String, int>{};
      for (final row in visibleRows) {
        final dept = row.dept ?? 'Unknown';
        deptCounts[dept] = (deptCounts[dept] ?? 0) + 1;
      }
      final mostActiveDept = deptCounts.entries
          .fold<String>('N/A', (current, entry) {
            if (current == 'N/A') return entry.key;
            return (deptCounts[current] ?? 0) >= entry.value ? current : entry.key;
          });
      final downloadsLast30Days = visibleRows
          .where((row) => row.type?.toLowerCase() == 'download' && _withinPeriod(row.date, 30))
          .length;
      final avgAssessmentsPerWeek = downloadsLast30Days / 4.0;
      final avgQuestionsPerFaculty = activeFaculty == 0
          ? 0
          : (totalQuestions / activeFaculty).round();

      setState(() {
        _dashboardActivityLog = visibleRows;
        _totalQuestions = totalQuestions;
        _totalAssessments = totalAssessments;
        _activeFaculty = activeFaculty;
        _avgQuestionsPerFaculty = avgQuestionsPerFaculty;
        _avgAssessmentsPerWeek = avgAssessmentsPerWeek;
        _mostActiveDept = mostActiveDept;
        _successRate = successRate;
      });
    } catch (e) {
      setState(() {
        _analyticsError = e.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _analyticsLoading = false;
        });
      }
    }
  }

  bool _withinPeriod(String dateStr, int? days) {
    if (days == null) return true;
    final entryDate = DateTime.tryParse(dateStr);
    if (entryDate == null) return true;
    return DateTime.now().difference(entryDate).inDays <= days;
  }

  Future<void> _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    if (mounted) {
      Navigator.pushReplacementNamed(context, '/');
    }
  }

  void _showLogoutDialog() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Logout'),
        content: const Text('Are you sure you want to logout?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Logout', style: TextStyle(color: primaryColor)),
          ),
        ],
      ),
    );
    if (confirm == true) _logout();
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> pages = [
      _DashboardHome(
        adminName: adminName,
        onExportPressed: () => setState(() => _currentIndex = 4),
        analyticsLoading: _analyticsLoading,
        totalQuestions: _totalQuestions,
        totalAssessments: _totalAssessments,
        activeFaculty: _activeFaculty,
        avgQuestionsPerFaculty: _avgQuestionsPerFaculty,
        avgAssessmentsPerWeek: _avgAssessmentsPerWeek,
        mostActiveDept: _mostActiveDept,
        successRate: _successRate,
        recentActivities: _dashboardActivityLog,
        analyticsError: _analyticsError,
        onRetryAnalytics: _loadDashboardAnalytics,
      ),
      const AdminQuestionBankPage(),
      const AdminAcadMgtPage(),
      const AdminUserMgtPage(),
      const AdminReportsPage(),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        backgroundColor: primaryColor,
        elevation: 0,
        automaticallyImplyLeading: false,
        title: Row(
          children: [
            const CircleAvatar(
              radius: 18,
              backgroundColor: Colors.white,
              child: Icon(Icons.person, color: primaryColor, size: 20),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Welcome, $adminName',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                if (adminEmail.isNotEmpty)
                  Text(
                    adminEmail,
                    style: const TextStyle(color: Colors.white70, fontSize: 11),
                  ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white),
            tooltip: 'Logout',
            onPressed: _showLogoutDialog,
          ),
        ],
      ),
      body: IndexedStack(index: _currentIndex, children: pages),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (i) => setState(() => _currentIndex = i),
        selectedItemColor: primaryColor,
        unselectedItemColor: Colors.grey,
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard_outlined),
            activeIcon: Icon(Icons.dashboard),
            label: 'Dashboard',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.quiz_outlined),
            activeIcon: Icon(Icons.quiz),
            label: 'Questions',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.school_outlined),
            activeIcon: Icon(Icons.school),
            label: 'Academic',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.group_outlined),
            activeIcon: Icon(Icons.group),
            label: 'Users',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.bar_chart_outlined),
            activeIcon: Icon(Icons.bar_chart),
            label: 'Reports',
          ),
        ],
      ),
    );
  }
}

// ─── Dashboard Home ───────────────────────────────────────────────────────────

class _DashboardHome extends StatelessWidget {
  final String adminName;
  final VoidCallback onExportPressed;
  final bool analyticsLoading;
  final int totalQuestions;
  final int totalAssessments;
  final int activeFaculty;
  final int avgQuestionsPerFaculty;
  final double avgAssessmentsPerWeek;
  final String mostActiveDept;
  final int successRate;
  final List<ActivityLogEntry> recentActivities;
  final String? analyticsError;
  final VoidCallback onRetryAnalytics;

  const _DashboardHome({
    required this.adminName,
    required this.onExportPressed,
    required this.analyticsLoading,
    required this.totalQuestions,
    required this.totalAssessments,
    required this.activeFaculty,
    required this.avgQuestionsPerFaculty,
    required this.avgAssessmentsPerWeek,
    required this.mostActiveDept,
    required this.successRate,
    required this.recentActivities,
    required this.analyticsError,
    required this.onRetryAnalytics,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Greeting ──
          Text(
            'Welcome back, $adminName',
            style: const TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1A1A1A),
            ),
          ),
          const SizedBox(height: 2),
          const Text(
            'Here\u2019s your academic overview.',
            style: TextStyle(fontSize: 13, color: Colors.black45),
          ),
          const SizedBox(height: 20),

          // ── Top stat row: Total Questions / Assessments / Active Faculty ──
          Row(
            children: [
              Expanded(
                child: _StatCard(
                  icon: Icons.quiz_rounded,
                  iconColor: const Color(0xFF7B1113),
                  iconBg: const Color(0xFFF5E8E8),
                  value: analyticsLoading ? '...' : '$totalQuestions',
                  label: 'Generated Questions',
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _StatCard(
                  icon: Icons.assignment_rounded,
                  iconColor: const Color(0xFF2E7D32),
                  iconBg: const Color(0xFFE6F4EA),
                  value: analyticsLoading ? '...' : '$totalAssessments',
                  label: 'Downloaded Assessments',
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _StatCard(
                  icon: Icons.groups_rounded,
                  iconColor: const Color(0xFF1565C0),
                  iconBg: const Color(0xFFE3EDFB),
                  value: analyticsLoading ? '...' : '$activeFaculty',
                  label: 'Active Faculty',
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // ── Avg. Score summary ──
          const _AvgScoreCard(),

          const SizedBox(height: 24),
          const _SectionHeader(title: 'Analytics'),
          const SizedBox(height: 12),

          // ── Descriptive Analytics ──
          _AnalyticsInfoCard(
            title: 'Descriptive Analytics',
            rows: [
              ('Avg Questions/Faculty', analyticsLoading ? '...' : '$avgQuestionsPerFaculty'),
              ('Avg Assessments/Week', analyticsLoading ? '...' : avgAssessmentsPerWeek.toStringAsFixed(1)),
              ('Most Active Department', analyticsLoading ? '...' : mostActiveDept),
            ],
          ),
          const SizedBox(height: 12),

          // ── Predictive Analytics ──
          _AnalyticsInfoCard(
            title: 'Predictive Analytics',
            rows: [
              ('Projected Questions (Next Month)', analyticsLoading ? '...' : '${(totalQuestions * 1.1).round()}'),
              ('Success Rate', analyticsLoading ? '...' : '$successRate%'),
              ('Expected Assessments', analyticsLoading ? '...' : '${(avgAssessmentsPerWeek * 4).round()}'),
            ],
          ),
          const SizedBox(height: 12),

          // ── Prescriptive Recommendations ──
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: _cardDecoration,
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Prescriptive Recommendations',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1A1A1A),
                  ),
                ),
                SizedBox(height: 10),
                _BulletLine('Create level is underrepresented (4.8%).'),
                SizedBox(height: 8),
                _BulletLine(
                  'Encourage faculty to submit higher-order questions.',
                ),
                SizedBox(height: 8),
                _BulletLine(
                  'CBA department shows low activity; consider training.',
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),
          const _SectionHeader(title: 'Recent Activity'),
          const SizedBox(height: 12),
          _RecentActivityCard(
            entries: recentActivities,
            isLoading: analyticsLoading,
            error: analyticsError,
            onRetry: onRetryAnalytics,
          ),

          const SizedBox(height: 24),
          const _SectionHeader(title: 'Top Courses'),
          const SizedBox(height: 12),
          const _TopCoursesCard(),

          const SizedBox(height: 24),

          // ── Classification Models Performance ──
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: _cardDecoration,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Model Performance',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1A1A1A),
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Model accuracy for question and faculty predictions.',
                  style: TextStyle(fontSize: 12, color: Colors.black54),
                ),
                const SizedBox(height: 14),
                const _ModelScoreRow(
                  name: 'Support Vector Machine (SVM)',
                  score: '92.5%',
                ),
                const SizedBox(height: 10),
                const _ModelScoreRow(name: 'Na\u00efve Bayes', score: '88.7%'),
                const SizedBox(height: 10),
                const _ModelScoreRow(
                  name: 'Logistic Regression',
                  score: '89.3%',
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: onExportPressed,
                    icon: const Icon(Icons.ios_share_rounded, size: 16),
                    label: const Text(
                      'Export Report',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF7B1113),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(999),
                      ),
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
}

// ─── Shared card decoration (used across dashboard home) ──────────────────────

final BoxDecoration _cardDecoration = BoxDecoration(
  color: Colors.white,
  borderRadius: BorderRadius.circular(18),
  boxShadow: [
    const BoxShadow(
      color: Color.fromRGBO(0, 0, 0, 0.045),
      blurRadius: 10,
      offset: Offset(0, 3),
    ),
  ],
);

// ─── Small section label used to separate dashboard groups ────────────────────

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w700,
        color: Color(0xFF1A1A1A),
      ),
    );
  }
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

class _StatCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final Color iconBg;
  final String value;
  final String label;

  const _StatCard({
    required this.icon,
    required this.iconColor,
    required this.iconBg,
    required this.value,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
      decoration: _cardDecoration,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 19),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1A1A1A),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(fontSize: 10, color: Colors.black45),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

// ─── Descriptive / Predictive analytics card ───────────────────────────────────

class _AnalyticsInfoCard extends StatelessWidget {
  final String title;
  final List<(String, String)> rows;

  const _AnalyticsInfoCard({required this.title, required this.rows});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: _cardDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1A1A1A),
            ),
          ),
          const SizedBox(height: 10),
          ...rows.map(
            (r) => Padding(
              padding: const EdgeInsets.only(top: 6),
              child: RichText(
                text: TextSpan(
                  style: const TextStyle(fontSize: 13, color: Colors.black54),
                  children: [
                    TextSpan(text: '${r.$1}: '),
                    TextSpan(
                      text: r.$2,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF1A1A1A),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Bullet line for recommendations ───────────────────────────────────────────

class _BulletLine extends StatelessWidget {
  final String text;
  const _BulletLine(this.text);

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('•  ', style: TextStyle(color: Colors.black54)),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(fontSize: 13, color: Colors.black54),
          ),
        ),
      ],
    );
  }
}

// ─── Classification model score row ────────────────────────────────────────────

class _ModelScoreRow extends StatelessWidget {
  final String name;
  final String score;
  const _ModelScoreRow({required this.name, required this.score});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFAFAFA),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade100),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            name,
            style: const TextStyle(fontSize: 12, color: Colors.black54),
          ),
          const SizedBox(height: 8),
          Text(
            score,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1A1A1A),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Avg Score Card ───────────────────────────────────────────────────────────

class _AvgScoreCard extends StatelessWidget {
  const _AvgScoreCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
      decoration: _cardDecoration,
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFFFFF3E0),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.bar_chart_rounded,
              color: Color(0xFFE65100),
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Avg. Score',
                style: TextStyle(fontSize: 11, color: Colors.black45),
              ),
              Text(
                '76.4%',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1A1A1A),
                ),
              ),
            ],
          ),
          const Spacer(),
          Row(
            children: [
              const Icon(
                Icons.trending_down,
                size: 14,
                color: Colors.redAccent,
              ),
              const SizedBox(width: 3),
              Text(
                '-1.2% vs last month',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── Recent Activity ──────────────────────────────────────────────────────────

class _RecentActivityCard extends StatelessWidget {
  final List<ActivityLogEntry> entries;
  final bool isLoading;
  final String? error;
  final VoidCallback onRetry;

  const _RecentActivityCard({
    required this.entries,
    required this.isLoading,
    required this.error,
    required this.onRetry,
  });

  IconData _activityIcon(ActivityLogEntry entry) {
    switch (entry.type?.toLowerCase()) {
      case 'upload':
        return Icons.upload_file;
      case 'download':
        return Icons.download;
      case 'generate':
        return Icons.auto_awesome;
      case 'classify':
        return Icons.analytics;
      case 'login':
        return Icons.login;
      default:
        return Icons.history;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: _cardDecoration,
        child: const Center(child: CircularProgressIndicator()),
      );
    }

    if (error != null) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: _cardDecoration,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Unable to load recent activity.', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text(error!, style: const TextStyle(color: Colors.redAccent)),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: onRetry,
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF7B1113)),
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (entries.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: _cardDecoration,
        child: const Center(
          child: Text('No recent activity yet.', style: TextStyle(color: Colors.black54)),
        ),
      );
    }

    final items = entries.take(5).toList();
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: _cardDecoration,
      child: Column(
        children: items.map((entry) => _ActivityRow(entry: entry, icon: _activityIcon(entry))).toList(),
      ),
    );
  }
}

class _ActivityRow extends StatelessWidget {
  final ActivityLogEntry entry;
  final IconData icon;

  const _ActivityRow({required this.entry, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: const Color(0xFFF5E8E8),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: const Color(0xFF7B1113), size: 16),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.action,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF222222),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${entry.name ?? 'Unknown'} • ${entry.dept ?? 'No Dept'}',
                  style: const TextStyle(fontSize: 11, color: Colors.black45),
                ),
              ],
            ),
          ),
          Text(
            entry.time,
            style: const TextStyle(fontSize: 10, color: Colors.black38),
          ),
        ],
      ),
    );
  }
}

// ─── Top Courses ──────────────────────────────────────────────────────────────

class _TopCoursesCard extends StatelessWidget {
  const _TopCoursesCard();

  static const _courses = [
    _CourseData(name: 'Mathematics 101', students: 312, pct: 0.88),
    _CourseData(name: 'Science & Tech', students: 278, pct: 0.74),
    _CourseData(name: 'English Comp', students: 245, pct: 0.68),
    _CourseData(name: 'Filipino Studies', students: 198, pct: 0.55),
    _CourseData(name: 'PE & Health', students: 165, pct: 0.46),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: _cardDecoration,
      child: Column(
        children: _courses.map((c) => _CourseRow(course: c)).toList(),
      ),
    );
  }
}

class _CourseData {
  final String name;
  final int students;
  final double pct;
  const _CourseData({
    required this.name,
    required this.students,
    required this.pct,
  });
}

class _CourseRow extends StatelessWidget {
  final _CourseData course;
  const _CourseRow({required this.course});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  course.name,
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF222222),
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Text(
                '${course.students} students',
                style: const TextStyle(fontSize: 11, color: Colors.black45),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: course.pct,
              minHeight: 5,
              backgroundColor: const Color(0xFFF0E0E0),
              valueColor: const AlwaysStoppedAnimation<Color>(
                Color(0xFF7B1113),
              ),
            ),
          ),
        ],
      ),
    );
  }
}