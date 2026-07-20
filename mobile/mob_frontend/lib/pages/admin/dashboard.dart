import 'package:flutter/material.dart';
import 'package:mob_frontend/models/activity_log.dart';
import 'package:mob_frontend/utils/theme_constants.dart';
import 'package:mob_frontend/widgets/shimmer_box.dart';
import 'acadmgt.dart';
import 'questionbank.dart';
import 'reports.dart';
import 'usermgt.dart';
import 'account.dart'; // IMPORT THE NEW ACCOUNT BAR

class AdminDashboardPage extends StatefulWidget {
  const AdminDashboardPage({super.key});

  @override
  State<AdminDashboardPage> createState() => _AdminDashboardPageState();
}

class _AdminDashboardPageState extends State<AdminDashboardPage>
    with SingleTickerProviderStateMixin {
  int _currentIndex = 0;
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

  // --- Visual analytics data ---
  List<ChartPoint> _bloomsChartData = [];
  List<ChartPoint> _deptChartData = [];
  List<ChartPoint> _dailyTrendChartData = [];
  List<String> _weekLabels = [];
  List<double> _weeklyGenerated = [];
  List<double> _weeklyDownloaded = [];

  @override
  void initState() {
    super.initState();
    _loadDashboardAnalytics();
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
                            .where((row) => row.status?.toLowerCase() == 'success')
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

      // --- Bloom's Taxonomy distribution (descriptive) ---
      final bloomsCounts = <String, int>{};
      for (final row in visibleRows) {
        final level = (row.bloomsLevel ?? '').trim();
        final key = level.isEmpty ? 'Unclassified' : level;
        bloomsCounts[key] = (bloomsCounts[key] ?? 0) + 1;
      }
      const bloomsOrder = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create', 'Unclassified'];
      final bloomsChartData = <ChartPoint>[];
      for (final level in bloomsOrder) {
        if (bloomsCounts.containsKey(level)) {
          bloomsChartData.add(ChartPoint(level, bloomsCounts[level]!.toDouble()));
        }
      }
      // Catch any label spellings not in the known Bloom's order.
      for (final entry in bloomsCounts.entries) {
        if (!bloomsOrder.contains(entry.key)) {
          bloomsChartData.add(ChartPoint(entry.key, entry.value.toDouble()));
        }
      }

      // --- Activity by department (descriptive) ---
      final deptChartData = deptCounts.entries.map((e) => ChartPoint(e.key, e.value.toDouble())).toList()
        ..sort((a, b) => b.value.compareTo(a.value));

      // --- 7-day activity trend (descriptive / feeds the predictive projection) ---
      final now = DateTime.now();
      const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      final dailyTrendChartData = <ChartPoint>[];
      for (int i = 6; i >= 0; i--) {
        final day = DateTime(now.year, now.month, now.day).subtract(Duration(days: i));
        final count = visibleRows.where((row) {
          final d = DateTime.tryParse(row.date);
          return d != null && d.year == day.year && d.month == day.month && d.day == day.day;
        }).length;
        dailyTrendChartData.add(ChartPoint(weekdayLabels[day.weekday - 1], count.toDouble()));
      }

      // --- Question bank growth: generated vs. downloaded, last 4 weeks ---
      final weekLabels = <String>[];
      final weeklyGenerated = <double>[];
      final weeklyDownloaded = <double>[];
      for (int w = 3; w >= 0; w--) {
        final weekEndDay = DateTime(now.year, now.month, now.day).subtract(Duration(days: w * 7));
        final weekStartDay = weekEndDay.subtract(const Duration(days: 6));
        final weekEndBound = DateTime(weekEndDay.year, weekEndDay.month, weekEndDay.day, 23, 59, 59);
        final gen = visibleRows.where((row) {
          final d = DateTime.tryParse(row.date);
          return d != null &&
              row.type?.toLowerCase() == 'generate' &&
              !d.isBefore(weekStartDay) &&
              !d.isAfter(weekEndBound);
        }).length;
        final dl = visibleRows.where((row) {
          final d = DateTime.tryParse(row.date);
          return d != null &&
              row.type?.toLowerCase() == 'download' &&
              !d.isBefore(weekStartDay) &&
              !d.isAfter(weekEndBound);
        }).length;
        weekLabels.add('${weekStartDay.month}/${weekStartDay.day}');
        weeklyGenerated.add(gen.toDouble());
        weeklyDownloaded.add(dl.toDouble());
      }

      setState(() {
        _dashboardActivityLog = visibleRows;
        _totalQuestions = totalQuestions;
        _totalAssessments = totalAssessments;
        _activeFaculty = activeFaculty;
        _avgQuestionsPerFaculty = avgQuestionsPerFaculty;
        _avgAssessmentsPerWeek = avgAssessmentsPerWeek;
        _mostActiveDept = mostActiveDept;
        _successRate = successRate;
        _bloomsChartData = bloomsChartData;
        _deptChartData = deptChartData;
        _dailyTrendChartData = dailyTrendChartData;
        _weekLabels = weekLabels;
        _weeklyGenerated = weeklyGenerated;
        _weeklyDownloaded = weeklyDownloaded;
      });
    } catch (e) {
      setState(() => _analyticsError = e.toString());
    } finally {
      if (mounted) setState(() => _analyticsLoading = false);
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

  Widget _buildPage(int index) {
    switch (index) {
      case 1:
        return const AdminQuestionBankPage();
      case 2:
        return const AdminAcadMgtPage();
      case 3:
        return const AdminUserMgtPage();
      case 4:
        return const AdminReportsPage();
      case 0:
      default:
        return _DashboardHome(
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
          bloomsChartData: _bloomsChartData,
          deptChartData: _deptChartData,
          dailyTrendChartData: _dailyTrendChartData,
          weekLabels: _weekLabels,
          weeklyGenerated: _weeklyGenerated,
          weeklyDownloaded: _weeklyDownloaded,
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kLightBgColor,
      body: _buildPage(_currentIndex),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: kBorderColor, width: 1)),
        ),
        child: NavigationBar(
          selectedIndex: _currentIndex,
          onDestinationSelected: (i) => setState(() => _currentIndex = i),
          backgroundColor: Colors.white,
          elevation: 0,
          indicatorColor: kAccentOrange.withValues(alpha: 0.15),
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.dashboard_outlined),
              selectedIcon: Icon(Icons.dashboard, color: kAccentOrange),
              label: 'Home',
            ),
            NavigationDestination(
              icon: Icon(Icons.quiz_outlined),
              selectedIcon: Icon(Icons.quiz, color: kAccentOrange),
              label: 'Bank',
            ),
            NavigationDestination(
              icon: Icon(Icons.school_outlined),
              selectedIcon: Icon(Icons.school, color: kAccentOrange),
              label: 'Academic',
            ),
            NavigationDestination(
              icon: Icon(Icons.group_outlined),
              selectedIcon: Icon(Icons.group, color: kAccentOrange),
              label: 'Users',
            ),
            NavigationDestination(
              icon: Icon(Icons.bar_chart_outlined),
              selectedIcon: Icon(Icons.bar_chart, color: kAccentOrange),
              label: 'Reports',
            ),
          ],
        ),
      ),
    );
  }
}

class _DashboardHome extends StatelessWidget {
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
  final List<ChartPoint> bloomsChartData;
  final List<ChartPoint> deptChartData;
  final List<ChartPoint> dailyTrendChartData;
  final List<String> weekLabels;
  final List<double> weeklyGenerated;
  final List<double> weeklyDownloaded;

  const _DashboardHome({
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
    required this.bloomsChartData,
    required this.deptChartData,
    required this.dailyTrendChartData,
    required this.weekLabels,
    required this.weeklyGenerated,
    required this.weeklyDownloaded,
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          const AccountTopBar(),
          const Divider(height: 1, color: kBorderColor, thickness: 1),
          Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _SectionHeader(title: 'Overview'),
                const SizedBox(height: 16),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  clipBehavior: Clip.none,
                  child: Row(
                    children: analyticsLoading
                        ? [
                            _ShimmerStatCard(shimmerController: shimmerController, width: 150),
                            const SizedBox(width: 16),
                            _ShimmerStatCard(shimmerController: shimmerController, width: 150),
                            const SizedBox(width: 16),
                            _ShimmerStatCard(shimmerController: shimmerController, width: 150),
                          ]
                        : [
                            _StatCard(icon: Icons.quiz_rounded, color: kAccentOrange, value: '$totalQuestions', label: 'Generated Questions'),
                            const SizedBox(width: 16),
                            _StatCard(icon: Icons.assignment_rounded, color: Colors.blueAccent, value: '$totalAssessments', label: 'Downloaded Exams'),
                            const SizedBox(width: 16),
                            _StatCard(icon: Icons.groups_rounded, color: Colors.green, value: '$activeFaculty', label: 'Active Faculty'),
                          ],
                  ),
                ),
                const SizedBox(height: 16),
                const _AvgScoreCard(),
                const SizedBox(height: 32),
                const _SectionHeader(title: 'Analytics'),
                const SizedBox(height: 16),
                _AnalyticsInfoCard(
                  title: 'Descriptive Analytics',
                  icon: Icons.analytics_outlined,
                  isLoading: analyticsLoading,
                  shimmerController: shimmerController,
                  rows: [
                    ('Avg Questions / Faculty', '$avgQuestionsPerFaculty'),
                    ('Avg Assessments / Week', avgAssessmentsPerWeek.toStringAsFixed(1)),
                    ('Most Active Department', mostActiveDept),
                  ],
                ),
                const SizedBox(height: 16),
                _AnalyticsInfoCard(
                  title: 'Predictive Analytics',
                  icon: Icons.trending_up,
                  isLoading: analyticsLoading,
                  shimmerController: shimmerController,
                  rows: [
                    ('Projected Questions (Next Mo)', '${(totalQuestions * 1.1).round()}'),
                    ('Platform Success Rate', '$successRate%'),
                    ('Expected Assessments', '${(avgAssessmentsPerWeek * 4).round()}'),
                  ],
                ),
                const SizedBox(height: 32),
                const _SectionHeader(title: 'Visual Analytics'),
                const SizedBox(height: 4),
                const Text(
                  'Swipe left or right to see more charts',
                  style: TextStyle(fontSize: 12, color: Colors.black45),
                ),
                const SizedBox(height: 16),
                _VisualAnalyticsSection(
                  isLoading: analyticsLoading,
                  shimmerController: shimmerController,
                  bloomsData: bloomsChartData,
                  deptData: deptChartData,
                  dailyTrendData: dailyTrendChartData,
                  weekLabels: weekLabels,
                  weeklyGenerated: weeklyGenerated,
                  weeklyDownloaded: weeklyDownloaded,
                ),
                const SizedBox(height: 32),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: _flatCardDecoration,
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Prescriptive Recommendations',
                        style: TextStyle(fontFamily: 'Georgia', fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1A1A1A)),
                      ),
                      SizedBox(height: 16),
                      _BulletLine('Create level is underrepresented (4.8%).'),
                      SizedBox(height: 12),
                      _BulletLine('Encourage faculty to submit higher-order questions.'),
                      SizedBox(height: 12),
                      _BulletLine('CBA department shows low activity; consider training.'),
                    ],
                  ),
                ),
                const SizedBox(height: 32),
                const _SectionHeader(title: 'Top Courses'),
                const SizedBox(height: 16),
                const _TopCoursesCard(),
                const SizedBox(height: 32),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(24),
                  decoration: _flatCardDecoration,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Model Performance',
                        style: TextStyle(fontFamily: 'Georgia', fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1A1A1A)),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Model accuracy for question and faculty predictions.',
                        style: TextStyle(fontSize: 13, color: Colors.black54),
                      ),
                      const SizedBox(height: 24),
                      const _ModelScoreRow(name: 'Support Vector Machine (SVM)', score: '92.5%'),
                      const SizedBox(height: 16),
                      const _ModelScoreRow(name: 'Naïve Bayes', score: '88.7%'),
                      const SizedBox(height: 16),
                      const _ModelScoreRow(name: 'Logistic Regression', score: '89.3%'),
                      const SizedBox(height: 32),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: onExportPressed,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: kDarkButtonColor,
                            padding: const EdgeInsets.symmetric(vertical: 18),
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: const Text(
                            'Export Report',
                            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600),
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
        ],
      ),
    );
  }
}

final BoxDecoration _flatCardDecoration = BoxDecoration(
  color: Colors.white,
  borderRadius: BorderRadius.circular(16),
  border: Border.all(color: kBorderColor),
);

class _StatCard extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String value;
  final String label;

  const _StatCard({required this.icon, required this.color, required this.value, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 150,
      padding: const EdgeInsets.all(20),
      decoration: _flatCardDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 28),
          const SizedBox(height: 24),
          Text(value, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          Text(label, style: const TextStyle(fontSize: 12, color: Colors.black54, height: 1.2)),
        ],
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

  const _AnalyticsInfoCard({required this.title, required this.icon, required this.isLoading, required this.shimmerController, required this.rows});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: _flatCardDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 20, color: kDarkButtonColor),
              const SizedBox(width: 12),
              Text(
                title,
                style: const TextStyle(fontFamily: 'Georgia', fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1A1A1A)),
              ),
            ],
          ),
          const Divider(height: 32, color: kBorderColor),
          if (isLoading)
            ...List.generate(3, (_) => _ShimmerRow(shimmerController: shimmerController))
          else
            ...rows.map(
              (r) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        r.$1,
                        style: const TextStyle(fontSize: 14, color: Colors.black54),
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Flexible(
                      child: Text(
                        r.$2,
                        textAlign: TextAlign.end,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.black87),
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
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

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});
  @override
  Widget build(BuildContext context) {
    return Text(title, style: const TextStyle(fontFamily: 'Georgia', fontSize: 20, fontWeight: FontWeight.bold, color: Colors.black87));
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
        const Text('•  ', style: TextStyle(color: kAccentOrange, fontWeight: FontWeight.bold)),
        Expanded(child: Text(text, style: const TextStyle(fontSize: 14, color: Colors.black54))),
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
      padding: const EdgeInsets.all(24),
      decoration: _flatCardDecoration,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const Icon(Icons.bar_chart_rounded, color: kAccentOrange, size: 36),
          const SizedBox(width: 16),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Avg. Score',
                  style: TextStyle(fontSize: 13, color: Colors.black45),
                ),
                Text(
                  '76.4%',
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1A1A1A),
                  ),
                ),
              ],
            ),
          ),
          Flexible(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerRight,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: const [
                  Icon(Icons.trending_down, size: 16, color: Colors.redAccent),
                  SizedBox(width: 6),
                  Text(
                    '-1.2% vs last month',
                    style: TextStyle(fontSize: 12, color: Colors.grey),
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
      padding: const EdgeInsets.all(24),
      decoration: _flatCardDecoration,
      child: Column(children: _courses.map((c) => _CourseRow(course: c)).toList()),
    );
  }
}

class _CourseData {
  final String name;
  final int students;
  final double pct;
  const _CourseData({required this.name, required this.students, required this.pct});
}

class _CourseRow extends StatelessWidget {
  final _CourseData course;
  const _CourseRow({required this.course});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(child: Text(course.name, style: const TextStyle(fontSize: 14, color: Color(0xFF222222), fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis)),
              Text('${course.students} students', style: const TextStyle(fontSize: 12, color: Colors.black45)),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(value: course.pct, minHeight: 6, backgroundColor: Colors.grey.shade200, valueColor: const AlwaysStoppedAnimation<Color>(kDarkButtonColor)),
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
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: const Color(0xFFF9F9F9), borderRadius: BorderRadius.circular(12), border: Border.all(color: kBorderColor)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(name, style: const TextStyle(fontSize: 13, color: Colors.black54)),
          const SizedBox(height: 8),
          Text(score, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Color(0xFF1A1A1A))),
        ],
      ),
    );
  }
}

// Shimmer Widgets
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
              buildShimmerBox(120, 12, drift),
              buildShimmerBox(80, 12, drift),
            ],
          ),
        );
      },
    );
  }
}

class _ShimmerStatCard extends StatelessWidget {
  final AnimationController shimmerController;
  final double width;
  const _ShimmerStatCard({required this.shimmerController, required this.width});
  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: shimmerController,
      builder: (context, child) {
        final drift = shimmerController.value;
        return Container(
          width: width,
          padding: const EdgeInsets.all(20),
          decoration: _flatCardDecoration,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              buildShimmerBox(44, 44, drift, radius: 12),
              const SizedBox(height: 24),
              buildShimmerBox(width * 0.45, 22, drift),
              const SizedBox(height: 8),
              buildShimmerBox(width * 0.7, 12, drift),
            ],
          ),
        );
      },
    );
  }
}

// =======================================================================
// VISUAL ANALYTICS — lightweight, dependency-free charts (no fl_chart etc.)
// All charts scroll horizontally when there's more data than fits on screen.
// =======================================================================

class ChartPoint {
  final String label;
  final double value;
  const ChartPoint(this.label, this.value);
}

class _VisualAnalyticsSection extends StatelessWidget {
  final bool isLoading;
  final AnimationController shimmerController;
  final List<ChartPoint> bloomsData;
  final List<ChartPoint> deptData;
  final List<ChartPoint> dailyTrendData;
  final List<String> weekLabels;
  final List<double> weeklyGenerated;
  final List<double> weeklyDownloaded;

  const _VisualAnalyticsSection({
    required this.isLoading,
    required this.shimmerController,
    required this.bloomsData,
    required this.deptData,
    required this.dailyTrendData,
    required this.weekLabels,
    required this.weeklyGenerated,
    required this.weeklyDownloaded,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 420,
      child: ListView(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        children: isLoading
            ? [
                _ShimmerStatCard(shimmerController: shimmerController, width: 280),
                const SizedBox(width: 16),
                _ShimmerStatCard(shimmerController: shimmerController, width: 280),
                const SizedBox(width: 16),
                _ShimmerStatCard(shimmerController: shimmerController, width: 280),
              ]
            : [
                _ChartCard(
                  title: "Bloom's Taxonomy",
                  subtitle: 'Question levels generated',
                  chart: SimpleBarChart(data: bloomsData, color: kAccentOrange),
                ),
                const SizedBox(width: 16),
                _ChartCard(
                  title: 'Activity by Department',
                  subtitle: 'All logged actions',
                  chart: SimpleBarChart(data: deptData, color: Colors.blueAccent),
                ),
                const SizedBox(width: 16),
                _ChartCard(
                  title: '7-Day Activity Trend',
                  subtitle: 'Logged actions per day',
                  chart: SimpleLineChart(data: dailyTrendData, color: Colors.green),
                ),
                const SizedBox(width: 16),
                _ChartCard(
                  title: 'Question Bank Growth',
                  subtitle: 'Generated vs. downloaded, weekly',
                  chart: GroupedBarChart(
                    labels: weekLabels,
                    seriesA: weeklyGenerated,
                    seriesB: weeklyDownloaded,
                  ),
                  legend: const _ChartLegend(items: [
                    ('Generated', kAccentOrange),
                    ('Downloaded', Colors.blueAccent),
                  ]),
                ),
              ],
      ),
    );
  }
}

class _ChartCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final Widget chart;
  final Widget? legend;
  const _ChartCard({required this.title, required this.subtitle, required this.chart, this.legend});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 290,
      padding: const EdgeInsets.all(18),
      decoration: _flatCardDecoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontFamily: 'Georgia', fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF1A1A1A))),
          const SizedBox(height: 2),
          Text(subtitle, style: const TextStyle(fontSize: 12, color: Colors.black54)),
          const SizedBox(height: 16),
          SizedBox(height: 230, child: chart),
          if (legend != null) ...[
            const SizedBox(height: 8),
            legend!,
          ],
        ],
      ),
    );
  }
}

class _ChartLegend extends StatelessWidget {
  final List<(String, Color)> items;
  const _ChartLegend({required this.items});

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 16,
      runSpacing: 4,
      children: items.map((item) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 8, height: 8, decoration: BoxDecoration(color: item.$2, shape: BoxShape.circle)),
            const SizedBox(width: 6),
            Text(item.$1, style: const TextStyle(fontSize: 11, color: Colors.black54)),
          ],
        );
      }).toList(),
    );
  }
}

/// A simple vertical bar chart. Scrolls horizontally on its own if the
/// number of bars doesn't fit the available width.
class SimpleBarChart extends StatelessWidget {
  final List<ChartPoint> data;
  final Color color;
  final double barWidth;
  const SimpleBarChart({super.key, required this.data, this.color = kAccentOrange, this.barWidth = 44});

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) {
      return const Center(child: Text('No data yet', style: TextStyle(color: Colors.black45, fontSize: 13)));
    }
    final maxValue = data.map((d) => d.value).fold<double>(0, (a, b) => b > a ? b : a);
    final safeMax = maxValue <= 0 ? 1.0 : maxValue;

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: data.map((point) {
          return Container(
            width: barWidth,
            margin: const EdgeInsets.symmetric(horizontal: 6),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Text(
                  point.value == point.value.roundToDouble()
                      ? point.value.toStringAsFixed(0)
                      : point.value.toStringAsFixed(1),
                  style: const TextStyle(fontSize: 10, color: Colors.black54),
                ),
                const SizedBox(height: 4),
                SizedBox(
                  height: 140,
                  child: Align(
                    alignment: Alignment.bottomCenter,
                    child: Container(
                      height: ((point.value / safeMax) * 140).clamp(4.0, 140.0).toDouble(),
                      decoration: BoxDecoration(
                        color: color,
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(6)),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: barWidth,
                  child: Text(
                    point.label,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 10, color: Colors.black54),
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }
}

/// Two bars per label (e.g. generated vs. downloaded). Scrolls horizontally.
class GroupedBarChart extends StatelessWidget {
  final List<String> labels;
  final List<double> seriesA;
  final List<double> seriesB;
  final Color colorA;
  final Color colorB;
  const GroupedBarChart({
    super.key,
    required this.labels,
    required this.seriesA,
    required this.seriesB,
    this.colorA = kAccentOrange,
    this.colorB = Colors.blueAccent,
  });

  @override
  Widget build(BuildContext context) {
    if (labels.isEmpty) {
      return const Center(child: Text('No data yet', style: TextStyle(color: Colors.black45, fontSize: 13)));
    }
    final maxValue = [...seriesA, ...seriesB].fold<double>(0, (a, b) => b > a ? b : a);
    final safeMax = maxValue <= 0 ? 1.0 : maxValue;

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: List.generate(labels.length, (i) {
          final aHeight = ((seriesA[i] / safeMax) * 140).clamp(4.0, 140.0).toDouble();
          final bHeight = ((seriesB[i] / safeMax) * 140).clamp(4.0, 140.0).toDouble();
          return Container(
            width: 64,
            margin: const EdgeInsets.symmetric(horizontal: 6),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  height: 140,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Container(width: 16, height: aHeight, decoration: BoxDecoration(color: colorA, borderRadius: const BorderRadius.vertical(top: Radius.circular(4)))),
                      const SizedBox(width: 4),
                      Container(width: 16, height: bHeight, decoration: BoxDecoration(color: colorB, borderRadius: const BorderRadius.vertical(top: Radius.circular(4)))),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(width: 64, child: Text(labels[i], textAlign: TextAlign.center, style: const TextStyle(fontSize: 10, color: Colors.black54))),
              ],
            ),
          );
        }),
      ),
    );
  }
}

/// A simple line/trend chart drawn with CustomPainter. Scrolls horizontally
/// once there are more points than comfortably fit on screen.
class SimpleLineChart extends StatelessWidget {
  final List<ChartPoint> data;
  final Color color;
  final double pointSpacing;
  const SimpleLineChart({super.key, required this.data, this.color = kAccentOrange, this.pointSpacing = 56});

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) {
      return const Center(child: Text('No data yet', style: TextStyle(color: Colors.black45, fontSize: 13)));
    }
    final maxValue = data.map((d) => d.value).fold<double>(0, (a, b) => b > a ? b : a);
    final safeMax = maxValue <= 0 ? 1.0 : maxValue;

    return LayoutBuilder(builder: (context, constraints) {
      final neededWidth = pointSpacing * data.length;
      final width = neededWidth < constraints.maxWidth ? constraints.maxWidth : neededWidth;
      return SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        child: SizedBox(
          width: width,
          height: 170,
          child: CustomPaint(
            painter: _LineChartPainter(data: data, maxValue: safeMax, color: color),
          ),
        ),
      );
    });
  }
}

class _LineChartPainter extends CustomPainter {
  final List<ChartPoint> data;
  final double maxValue;
  final Color color;
  _LineChartPainter({required this.data, required this.maxValue, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final chartHeight = size.height - 28; // reserve space for x-axis labels
    final stepX = data.length > 1 ? size.width / (data.length - 1) : size.width;

    final linePaint = Paint()
      ..color = color
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    final dotPaint = Paint()..color = color;
    const labelStyle = TextStyle(fontSize: 10, color: Colors.black54);

    final points = <Offset>[];
    for (int i = 0; i < data.length; i++) {
      final x = data.length > 1 ? stepX * i : size.width / 2;
      final y = chartHeight - (data[i].value / maxValue) * (chartHeight - 16);
      points.add(Offset(x, y));
    }

    final path = Path();
    for (int i = 0; i < points.length; i++) {
      if (i == 0) {
        path.moveTo(points[i].dx, points[i].dy);
      } else {
        path.lineTo(points[i].dx, points[i].dy);
      }
    }
    canvas.drawPath(path, linePaint);

    for (int i = 0; i < points.length; i++) {
      canvas.drawCircle(points[i], 3.5, dotPaint);
      final tp = TextPainter(
        text: TextSpan(text: data[i].label, style: labelStyle),
        textDirection: TextDirection.ltr,
      )..layout(minWidth: 0, maxWidth: 60);
      tp.paint(canvas, Offset(points[i].dx - tp.width / 2, chartHeight + 8));
    }
  }

  @override
  bool shouldRepaint(covariant _LineChartPainter oldDelegate) =>
      oldDelegate.data != data || oldDelegate.maxValue != maxValue || oldDelegate.color != color;
}

