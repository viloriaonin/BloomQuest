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

  static const primaryColor = Color(0xFF7B1113);

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  Future<void> _loadUserData() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      adminName = prefs.getString('user_name') ?? 'Admin';
      adminEmail = prefs.getString('user_email') ?? '';
    });
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
      _DashboardHome(adminName: adminName),
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
  const _DashboardHome({required this.adminName});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 8),

          // ── Top stat cards: Total Questions / Assessments / Active Faculty ──
          const _WebStatCard(
            label: 'Total Questions',
            value: '520',
            badge: '+12% from last month',
          ),
          const SizedBox(height: 12),
          const _WebStatCard(
            label: 'Total Assessments',
            value: '86',
            badge: '+8% from last month',
          ),
          const SizedBox(height: 12),
          const _WebStatCard(
            label: 'Active Faculty',
            value: '24',
            badge: '+3 this month',
          ),

          const SizedBox(height: 24),

          // ── Descriptive Analytics ──
          const _AnalyticsInfoCard(
            title: 'Descriptive Analytics',
            rows: [
              ('Avg Questions/Faculty', '21.7'),
              ('Avg Assessments/Week', '5.2'),
              ('Most Active Department', 'CICS'),
            ],
          ),
          const SizedBox(height: 12),

          // ── Predictive Analytics ──
          const _AnalyticsInfoCard(
            title: 'Predictive Analytics',
            rows: [
              ('Projected Questions (May)', '590'),
              ('Growth', '+13.5%'),
              ('Expected Assessments', '95'),
            ],
          ),
          const SizedBox(height: 12),

          // ── Prescriptive Recommendations ──
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
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

          // ── Classification Models Performance ──
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Classification Models Performance',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1A1A1A),
                        ),
                      ),
                    ),
                    ElevatedButton(
                      onPressed: () {},
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF7B1113),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 10,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                      child: const Text(
                        'Export Report',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                const Text(
                  'Model accuracy for question and faculty predictions.',
                  style: TextStyle(fontSize: 12, color: Colors.black54),
                ),
                const SizedBox(height: 16),
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
              ],
            ),
          ),

          const SizedBox(height: 16),
        ],
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
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 22),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1A1A1A),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(fontSize: 10, color: Colors.black45),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ─── Web-style Stat Card (value + growth badge) ────────────────────────────────

class _WebStatCard extends StatelessWidget {
  final String label;
  final String value;
  final String badge;

  const _WebStatCard({
    required this.label,
    required this.value,
    required this.badge,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 12, color: Colors.black54),
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                value,
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1A1A1A),
                ),
              ),
              const SizedBox(width: 10),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFE6F4EA),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  badge,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF2E7D32),
                  ),
                ),
              ),
            ],
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
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
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
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
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
  const _RecentActivityCard();

  static const _activities = [
    _ActivityData(
      icon: Icons.person_add_outlined,
      text: 'New user registered',
      sub: 'maria.santos@example.com',
      time: '2 min ago',
    ),
    _ActivityData(
      icon: Icons.quiz_outlined,
      text: 'Question added to Math Bank',
      sub: 'By Prof. Cruz',
      time: '18 min ago',
    ),
    _ActivityData(
      icon: Icons.school_outlined,
      text: 'Course "STEM 101" published',
      sub: 'Academic Management',
      time: '1 hr ago',
    ),
    _ActivityData(
      icon: Icons.bar_chart_outlined,
      text: 'Monthly report generated',
      sub: 'May 2025',
      time: '3 hr ago',
    ),
    _ActivityData(
      icon: Icons.edit_outlined,
      text: 'User role updated',
      sub: 'juan.dela.cruz → Faculty',
      time: '5 hr ago',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: _activities.map((a) => _ActivityRow(data: a)).toList(),
      ),
    );
  }
}

class _ActivityData {
  final IconData icon;
  final String text;
  final String sub;
  final String time;
  const _ActivityData({
    required this.icon,
    required this.text,
    required this.sub,
    required this.time,
  });
}

class _ActivityRow extends StatelessWidget {
  final _ActivityData data;
  const _ActivityRow({required this.data});

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
            child: Icon(data.icon, color: const Color(0xFF7B1113), size: 16),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  data.text,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF222222),
                  ),
                ),
                Text(
                  data.sub,
                  style: const TextStyle(fontSize: 11, color: Colors.black45),
                ),
              ],
            ),
          ),
          Text(
            data.time,
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
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
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
