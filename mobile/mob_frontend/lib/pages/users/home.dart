import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:fl_chart/fl_chart.dart';
import 'package:mob_frontend/config/api_config.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int _totalSubjects = 0;
  int _totalQuestions = 0;
  final int _assessmentsGenerated = 12;
  bool _loading = true;

  static const primaryColor = Color(0xFF7B1113);

  // Mapping configurations matching web layout exactly
  final Map<String, double> _bloomsData = {
    "Rem": 45, // Remember
    "Und": 30, // Understand
    "App": 22, // Apply
    "Ana": 28, // Analyze
    "Eva": 15, // Evaluate
    "Cre": 10, // Create
  };

  @override
  void initState() {
    super.initState();
    _fetchDashboardAnalytics();
  }

  Future<void> _fetchDashboardAnalytics() async {
    try {
      final subjectsRes = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/subjects'),
      );
      final questionsRes = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/questions'),
      );

      if (subjectsRes.statusCode == 200 && questionsRes.statusCode == 200) {
        final List<dynamic> subjectsData = jsonDecode(subjectsRes.body);
        final List<dynamic> questionsData = jsonDecode(questionsRes.body);

        setState(() {
          _totalSubjects = subjectsData.length;
          _totalQuestions = questionsData.length;
          _loading = false;
        });
      } else {
        setState(() => _loading = false);
      }
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(primaryColor),
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ─── 1. KPI COUNTERS ───
          _buildKpiCard(
            title: "MANAGED SUBJECTS",
            value: "$_totalSubjects",
            icon: Icons.book_outlined,
          ),
          const SizedBox(height: 12),
          _buildKpiCard(
            title: "TOTAL QUESTION POOL",
            value: "$_totalQuestions",
            icon: Icons.quiz_outlined,
          ),
          const SizedBox(height: 12),
          _buildKpiCard(
            title: "ASSESSMENTS EXPORTED",
            value: "$_assessmentsGenerated",
            icon: Icons.assessment_outlined,
          ),

          const SizedBox(height: 24),

          // ─── 2. FL_CHART BAR GRAPH (BLOOM'S) ───
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "COGNITIVE DOMAIN SPREAD (BLOOM'S LEVELS)",
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  height: 200,
                  child: BarChart(
                    BarChartData(
                      alignment: BarChartAlignment.spaceAround,
                      maxY: 50,
                      barTouchData: BarTouchData(enabled: true),
                      titlesData: FlTitlesData(
                        show: true,
                        bottomTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            getTitlesWidget: (double value, TitleMeta meta) {
                              List<String> labels = _bloomsData.keys.toList();
                              if (value.toInt() >= 0 &&
                                  value.toInt() < labels.length) {
                                return SideTitleWidget(
                                  // ✅ Pass meta direct layout structures or drop named contexts to match your fl_chart cache configuration rules
                                  meta: meta,
                                  child: Text(
                                    labels[value.toInt()],
                                    style: const TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.grey,
                                    ),
                                  ),
                                );
                              }
                              return const SizedBox();
                            },
                          ),
                        ),
                        leftTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            reservedSize: 28,
                            interval: 10,
                          ),
                        ),
                        topTitles: AxisTitles(
                          sideTitles: SideTitles(showTitles: false),
                        ),
                        rightTitles: AxisTitles(
                          sideTitles: SideTitles(showTitles: false),
                        ),
                      ),
                      borderData: FlBorderData(show: false),
                      gridData: FlGridData(
                        show: true,
                        drawVerticalLine: false,
                        horizontalInterval: 10,
                      ),
                      barGroups: _bloomsData.values
                          .toList()
                          .asMap()
                          .entries
                          .map((entry) {
                            return BarChartGroupData(
                              x: entry.key,
                              barRods: [
                                BarChartRodData(
                                  toY: entry.value,
                                  color: _getBloomColor(entry.key),
                                  width: 16,
                                  borderRadius: const BorderRadius.only(
                                    topLeft: Radius.circular(4),
                                    topRight: Radius.circular(4),
                                  ),
                                ),
                              ],
                            );
                          })
                          .toList(),
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // ─── 3. FL_CHART PIE GRAPH (QUESTION FORMS) ───
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "QUESTION FORMS SPREAD",
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      flex: 4,
                      child: SizedBox(
                        height: 140,
                        child: PieChart(
                          PieChartData(
                            sectionsSpace: 2,
                            centerSpaceRadius: 30,
                            sections: [
                              PieChartSectionData(
                                color: Colors.blue,
                                value: 65,
                                title: '43%',
                                radius: 40,
                                titleStyle: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                              PieChartSectionData(
                                color: Colors.green,
                                value: 28,
                                title: '18%',
                                radius: 40,
                                titleStyle: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                              PieChartSectionData(
                                color: Colors.amber,
                                value: 32,
                                title: '21%',
                                radius: 40,
                                titleStyle: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                              PieChartSectionData(
                                color: Colors.pink,
                                value: 15,
                                title: '10%',
                                radius: 40,
                                titleStyle: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                              PieChartSectionData(
                                color: Colors.grey,
                                value: 10,
                                title: '7%',
                                radius: 40,
                                titleStyle: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const Expanded(
                      flex: 5,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _ChartIndicator(color: Colors.blue, text: "MCQ (65)"),
                          SizedBox(height: 6),
                          _ChartIndicator(
                            color: Colors.green,
                            text: "True/False (28)",
                          ),
                          SizedBox(height: 6),
                          _ChartIndicator(
                            color: Colors.amber,
                            text: "Identification (32)",
                          ),
                          SizedBox(height: 6),
                          _ChartIndicator(
                            color: Colors.pink,
                            text: "Essay (15)",
                          ),
                          SizedBox(height: 6),
                          _ChartIndicator(
                            color: Colors.grey,
                            text: "Situational (10)",
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Color _getBloomColor(int index) {
    List<Color> colors = [
      Colors.red,
      Colors.pink,
      Colors.orange,
      Colors.teal,
      Colors.blue,
      Colors.purple,
    ];
    return colors[index % colors.length];
  }

  Widget _buildKpiCard({
    required String title,
    required String value,
    required IconData icon,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF1A1A1A),
                  letterSpacing: -0.5,
                  fontFamily: 'Inter',
                ),
              ),
            ],
          ),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF5F5),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: primaryColor, size: 22),
          ),
        ],
      ),
    );
  }
}

class _ChartIndicator extends StatelessWidget {
  final Color color;
  final String text;
  const _ChartIndicator({required this.color, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 8),
        Text(
          text,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w500,
            color: Color(0xFF555555),
          ),
        ),
      ],
    );
  }
}
