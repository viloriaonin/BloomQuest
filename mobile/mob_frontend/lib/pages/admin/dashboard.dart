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

class _AdminDashboardPageState extends State<AdminDashboardPage>
    with SingleTickerProviderStateMixin {
  int _currentIndex = 0;
  String adminName = '';
  String adminEmail = '';
  bool _analyticsLoading = true;
  String? _analyticsError;
  late final AnimationController _shimmerController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  )..repeat();

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
          : ((visibleRows
                            .where(
                              (row) => row.status?.toLowerCase() == 'success',
                            )
                            .length /
                        visibleRows.length) *
                    100)
                .round();

      final deptCounts = <String, int>{};
      for (final row in visibleRows) {
        final dept = row.dept ?? 'Unknown';
        deptCounts[dept] = (deptCounts[dept] ?? 0) + 1;
      }
      final mostActiveDept = deptCounts.entries.fold<String>('N/A', (
        current,
        entry,
      ) {
        if (current == 'N/A') return entry.key;
        return (deptCounts[current] ?? 0) >= entry.value ? current : entry.key;
      });

      final downloadsLast30Days = visibleRows
          .where(
            (row) =>
                row.type?.toLowerCase() == 'download' &&
                _withinPeriod(row.date, 30),
          )
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
      setState(() => _analyticsError = e.toString());
    } finally {
      if (mounted) {
        setState(() => _analyticsLoading = false);
      }
    }
  }

  bool _withinPeriod(String dateStr, int? days) {
    if (days == null) return true;
    final entryDate = DateTime.tryParse(dateStr);
    if (entryDate == null) return true;
    return DateTime.now().difference(entryDate).inDays <= days;
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    super.dispose();
  }

  Future<void> _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    if (mounted) {
      Navigator.pushReplacementNamed(context, '/');
    }
  }

  void _showLogoutDialog() async {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 24),
              const Icon(Icons.logout_rounded, size: 48, color: primaryColor),
              const SizedBox(height: 16),
              const Text(
                'Confirm Logout',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Are you sure you want to securely log out of your session?',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.black54),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(ctx),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text(
                        'Cancel',
                        style: TextStyle(color: Colors.black87),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.pop(ctx);
                        _logout();
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: primaryColor,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
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
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> pages = [
      _DashboardHome(
        adminName: adminName,
        adminEmail: adminEmail,
        onLogout: _showLogoutDialog,
        onExportPressed: () => setState(() => _currentIndex = 4),
        analyticsLoading: _analyticsLoading,
        shimmerController: _shimmerController,
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
      backgroundColor: const Color(0xFFF8F9FA),
      body: IndexedStack(index: _currentIndex, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (i) => setState(() => _currentIndex = i),
        backgroundColor: Colors.white,
        elevation: 8,
        indicatorColor: primaryColor.withOpacity(0.15),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard, color: primaryColor),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.quiz_outlined),
            selectedIcon: Icon(Icons.quiz, color: primaryColor),
            label: 'Bank',
          ),
          NavigationDestination(
            icon: Icon(Icons.school_outlined),
            selectedIcon: Icon(Icons.school, color: primaryColor),
            label: 'Academic',
          ),
          NavigationDestination(
            icon: Icon(Icons.group_outlined),
            selectedIcon: Icon(Icons.group, color: primaryColor),
            label: 'Users',
          ),
          NavigationDestination(
            icon: Icon(Icons.bar_chart_outlined),
            selectedIcon: Icon(Icons.bar_chart, color: primaryColor),
            label: 'Reports',
          ),
        ],
      ),
    );
  }
}

class _DashboardHome extends StatelessWidget {
  final String adminName;
  final String adminEmail;
  final VoidCallback onLogout;
  final VoidCallback onExportPressed;
  final bool analyticsLoading;
  final AnimationController shimmerController;
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
    required this.adminEmail,
    required this.onLogout,
    required this.onExportPressed,
    required this.analyticsLoading,
    required this.shimmerController,
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
    return CustomScrollView(
      slivers: [
        SliverAppBar(
          expandedHeight: 140.0,
          floating: true,
          pinned: true,
          backgroundColor: const Color(0xFF7B1113),
          elevation: 0,
          actions: [
            IconButton(
              icon: const Icon(Icons.logout, color: Colors.white),
              onPressed: onLogout,
            ),
          ],
          flexibleSpace: FlexibleSpaceBar(
            titlePadding: const EdgeInsets.symmetric(
              horizontal: 20,
              vertical: 16,
            ),
            title: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Welcome back,',
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.8),
                    fontSize: 12,
                    fontWeight: FontWeight.normal,
                  ),
                ),
                Text(
                  adminName,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            background: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF7B1113), Color(0xFFA31E20)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Overview',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1A1A1A),
                  ),
                ),
                const SizedBox(height: 16),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  clipBehavior: Clip.none,
                  child: Row(
                    children: analyticsLoading
                        ? [
                            _ShimmerStatCard(
                              shimmerController: shimmerController,
                              width: 150,
                            ),
                            const SizedBox(width: 16),
                            _ShimmerStatCard(
                              shimmerController: shimmerController,
                              width: 150,
                            ),
                            const SizedBox(width: 16),
                            _ShimmerStatCard(
                              shimmerController: shimmerController,
                              width: 150,
                            ),
                          ]
                        : [
                            _StatCard(
                              icon: Icons.quiz_rounded,
                              color: const Color(0xFF7B1113),
                              value: '$totalQuestions',
                              label: 'Generated Questions',
                            ),
                            const SizedBox(width: 16),
                            _StatCard(
                              icon: Icons.assignment_rounded,
                              color: const Color(0xFF2E7D32),
                              value: '$totalAssessments',
                              label: 'Downloaded Exams',
                            ),
                            const SizedBox(width: 16),
                            _StatCard(
                              icon: Icons.groups_rounded,
                              color: const Color(0xFF1565C0),
                              value: '$activeFaculty',
                              label: 'Active Faculty',
                            ),
                          ],
                  ),
                ),
                const SizedBox(height: 12),
                const _AvgScoreCard(),
                const SizedBox(height: 24),
                const _SectionHeader(title: 'Analytics'),
                const SizedBox(height: 12),
                _AnalyticsInfoCard(
                  title: 'Descriptive Analytics',
                  icon: Icons.analytics_outlined,
                  isLoading: analyticsLoading,
                  shimmerController: shimmerController,
                  rows: [
                    ('Avg Questions / Faculty', '$avgQuestionsPerFaculty'),
                    (
                      'Avg Assessments / Week',
                      avgAssessmentsPerWeek.toStringAsFixed(1),
                    ),
                    ('Most Active Department', mostActiveDept),
                  ],
                ),
                const SizedBox(height: 12),
                _AnalyticsInfoCard(
                  title: 'Predictive Analytics',
                  icon: Icons.trending_up,
                  isLoading: analyticsLoading,
                  shimmerController: shimmerController,
                  rows: [
                    (
                      'Projected Questions (Next Mo)',
                      '${(totalQuestions * 1.1).round()}',
                    ),
                    ('Platform Success Rate', '$successRate%'),
                    (
                      'Expected Assessments',
                      '${(avgAssessmentsPerWeek * 4).round()}',
                    ),
                  ],
                ),
                const SizedBox(height: 12),
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
                      const _ModelScoreRow(name: 'Naïve Bayes', score: '88.7%'),
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
                const SizedBox(height: 40),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _StatCard extends StatefulWidget {
  final IconData icon;
  final Color color;
  final String value;
  final String label;

  const _StatCard({
    required this.icon,
    required this.color,
    required this.value,
    required this.label,
  });

  @override
  State<_StatCard> createState() => _StatCardState();
}

class _StatCardState extends State<_StatCard> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: 150,
        padding: const EdgeInsets.all(20),
        transform: Matrix4.identity()..scale(_isHovered ? 1.02 : 1.0),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: _isHovered
                  ? widget.color.withOpacity(0.14)
                  : Colors.black.withOpacity(0.04),
              blurRadius: _isHovered ? 14 : 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: widget.color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(widget.icon, color: widget.color, size: 24),
            ),
            const SizedBox(height: 20),
            Text(
              widget.value,
              style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            Text(
              widget.label,
              style: const TextStyle(
                fontSize: 12,
                color: Colors.black54,
                height: 1.2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AnalyticsInfoCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final bool isLoading;
  final AnimationController shimmerController;
  final List<(String, String)> rows;

  const _AnalyticsInfoCard({
    required this.title,
    required this.icon,
    required this.isLoading,
    required this.shimmerController,
    required this.rows,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 20, color: const Color(0xFF7B1113)),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1A1A1A),
                ),
              ),
            ],
          ),
          const Divider(height: 32),
          if (isLoading)
            ...List.generate(
              3,
              (_) => _ShimmerRow(shimmerController: shimmerController),
            )
          else
            ...rows.map(
              (r) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      r.$1,
                      style: const TextStyle(
                        fontSize: 14,
                        color: Colors.black54,
                      ),
                    ),
                    Text(
                      r.$2,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Colors.black87,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

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

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Column(children: List.generate(3, (_) => _ShimmerActivityRow())),
      );
    }
    if (error != null) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.red.shade50,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          children: [
            Text(error!, style: TextStyle(color: Colors.red.shade700)),
            const SizedBox(height: 12),
            ElevatedButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      );
    }
    if (entries.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(40),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
        ),
        child: const Center(
          child: Text(
            'No recent activity.',
            style: TextStyle(color: Colors.black54),
          ),
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        children: entries
            .take(5)
            .map(
              (e) => ListTile(
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 8,
                ),
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF7B1113).withOpacity(0.08),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.history,
                    color: Color(0xFF7B1113),
                    size: 20,
                  ),
                ),
                title: Text(
                  e.action,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                subtitle: Padding(
                  padding: const EdgeInsets.only(top: 4.0),
                  child: Text(
                    '${e.name ?? 'Unknown'} • ${e.dept ?? 'N/A'}',
                    style: const TextStyle(fontSize: 12, color: Colors.black54),
                  ),
                ),
                trailing: Text(
                  e.time,
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}

final BoxDecoration _cardDecoration = BoxDecoration(
  color: Colors.white,
  borderRadius: BorderRadius.circular(18),
  boxShadow: [
    BoxShadow(
      color: Colors.black.withOpacity(0.045),
      blurRadius: 10,
      offset: const Offset(0, 3),
    ),
  ],
);

class _ShimmerRow extends StatelessWidget {
  final AnimationController shimmerController;

  const _ShimmerRow({required this.shimmerController});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: shimmerController,
      builder: (context, child) {
        final drift = shimmerController.value;
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                width: 120,
                height: 12,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(999),
                  gradient: LinearGradient(
                    colors: const [
                      Color(0xFFE5E7EB),
                      Color(0xFFF3F4F6),
                      Color(0xFFE5E7EB),
                    ],
                    stops: const [0.0, 0.5, 1.0],
                    begin: Alignment(-1 + drift * 2, 0),
                    end: Alignment(1 + drift * 2, 0),
                  ),
                ),
              ),
              Container(
                width: 80,
                height: 12,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(999),
                  gradient: LinearGradient(
                    colors: const [
                      Color(0xFFE5E7EB),
                      Color(0xFFF3F4F6),
                      Color(0xFFE5E7EB),
                    ],
                    stops: const [0.0, 0.5, 1.0],
                    begin: Alignment(-1 + drift * 2, 0),
                    end: Alignment(1 + drift * 2, 0),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _ShimmerActivityRow extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.grey.shade200,
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 140,
                  height: 12,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  width: 180,
                  height: 10,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(999),
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

class _ShimmerStatCard extends StatelessWidget {
  final AnimationController shimmerController;
  final double width;

  const _ShimmerStatCard({
    required this.shimmerController,
    required this.width,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: shimmerController,
      builder: (context, child) {
        final drift = shimmerController.value;
        return Container(
          width: width,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.04),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  gradient: LinearGradient(
                    colors: const [
                      Color(0xFFE5E7EB),
                      Color(0xFFF3F4F6),
                      Color(0xFFE5E7EB),
                    ],
                    stops: const [0.0, 0.5, 1.0],
                    begin: Alignment(-1 + drift * 2, 0),
                    end: Alignment(1 + drift * 2, 0),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Container(
                width: width * 0.45,
                height: 22,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(999),
                  gradient: LinearGradient(
                    colors: const [
                      Color(0xFFE5E7EB),
                      Color(0xFFF3F4F6),
                      Color(0xFFE5E7EB),
                    ],
                    stops: const [0.0, 0.5, 1.0],
                    begin: Alignment(-1 + drift * 2, 0),
                    end: Alignment(1 + drift * 2, 0),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Container(
                width: width * 0.7,
                height: 12,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(999),
                  gradient: LinearGradient(
                    colors: const [
                      Color(0xFFE5E7EB),
                      Color(0xFFF3F4F6),
                      Color(0xFFE5E7EB),
                    ],
                    stops: const [0.0, 0.5, 1.0],
                    begin: Alignment(-1 + drift * 2, 0),
                    end: Alignment(1 + drift * 2, 0),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

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
