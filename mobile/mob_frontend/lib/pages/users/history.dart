import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:BloomQuest/config/api_config.dart';

// TODO: Update this to match your backend's actual reachable address.
// - Flutter web (Chrome): localhost works, since it's a real browser
// - Android emulator: use 10.0.2.2 instead of localhost
// - iOS simulator: localhost works
// - Physical device: use your computer's LAN IP, e.g. http://192.168.1.5:8000

class ActivityLogEntry {
  final int id;
  final String action;
  final String details;
  final String date;
  final String type;
  final String status;

  ActivityLogEntry({
    required this.id,
    required this.action,
    required this.details,
    required this.date,
    required this.type,
    required this.status,
  });

  factory ActivityLogEntry.fromJson(Map<String, dynamic> json) {
    return ActivityLogEntry(
      id: json['id'],
      action: json['action'] ?? '',
      details: json['details'] ?? '',
      date: _formatDate(json['date']),
      type: json['type'] ?? '',
      status: json['status'] ?? 'success',
    );
  }

  static String _formatDate(String? isoString) {
    if (isoString == null) return '';
    final date = DateTime.tryParse(isoString);
    if (date == null) return isoString;

    final now = DateTime.now();
    final isToday =
        date.year == now.year && date.month == now.month && date.day == now.day;
    final yesterday = now.subtract(const Duration(days: 1));
    final isYesterday =
        date.year == yesterday.year &&
        date.month == yesterday.month &&
        date.day == yesterday.day;

    final hour = date.hour % 12 == 0 ? 12 : date.hour % 12;
    final minute = date.minute.toString().padLeft(2, '0');
    final ampm = date.hour >= 12 ? 'PM' : 'AM';
    final time = '$hour:$minute $ampm';

    if (isToday) return 'Today, $time';
    if (isYesterday) return 'Yesterday, $time';
    return '${date.month}/${date.day}/${date.year}, $time';
  }
}

class HistoryPage extends StatefulWidget {
  const HistoryPage({super.key});

  @override
  State<HistoryPage> createState() => _HistoryPageState();
}

class _HistoryPageState extends State<HistoryPage> {
  List<ActivityLogEntry> _history = [];
  bool _loading = true;
  String? _error;
  String _searchTerm = '';

  @override
  void initState() {
    super.initState();
    _fetchHistory();
  }

  Future<void> _fetchHistory() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final response = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/history'),
      );
      if (response.statusCode != 200) {
        throw Exception('Request failed with status ${response.statusCode}');
      }
      final List<dynamic> data = jsonDecode(response.body);
      setState(() {
        _history = data.map((item) => ActivityLogEntry.fromJson(item)).toList();
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Could not load activity history. Please try again later.';
        _loading = false;
      });
    }
  }

  IconData _iconFor(String type, String status) {
    if (status == 'error') return Icons.close;
    switch (type) {
      case 'generate':
        return Icons.description_outlined;
      case 'upload':
        return Icons.cloud_upload_outlined;
      case 'classify':
        return Icons.category_outlined;
      case 'delete':
        return Icons.delete_outline;
      case 'login':
        return Icons.login;
      default:
        return Icons.circle_outlined;
    }
  }

  Color _iconColorFor(String type, String status) {
    if (status == 'error') return Colors.red;
    switch (type) {
      case 'generate':
        return Colors.purple;
      case 'upload':
        return Colors.blue;
      case 'classify':
        return const Color(0xFFB90000);
      case 'delete':
        return Colors.orange;
      case 'login':
        return Colors.grey;
      default:
        return Colors.grey;
    }
  }

  List<ActivityLogEntry> get _filteredHistory {
    if (_searchTerm.isEmpty) return _history;
    final term = _searchTerm.toLowerCase();
    return _history
        .where(
          (item) =>
              item.action.toLowerCase().contains(term) ||
              item.details.toLowerCase().contains(term),
        )
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _fetchHistory,
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Activity History',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Review your recent actions and system logs.',
                        style: TextStyle(color: Colors.grey),
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        onChanged: (value) =>
                            setState(() => _searchTerm = value),
                        decoration: InputDecoration(
                          hintText: 'Search activity...',
                          prefixIcon: const Icon(Icons.search),
                          filled: true,
                          fillColor: Colors.white,
                          contentPadding: const EdgeInsets.symmetric(
                            vertical: 0,
                          ),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: BorderSide(color: Colors.grey.shade300),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (_loading)
                const SliverFillRemaining(
                  child: Center(
                    child: CircularProgressIndicator(color: Color(0xFF7B1113)),
                  ),
                )
              else if (_error != null)
                SliverFillRemaining(
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.error_outline,
                            size: 48,
                            color: Colors.grey,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            _error!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: Colors.grey),
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton(
                            onPressed: _fetchHistory,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF7B1113),
                            ),
                            child: const Text(
                              'Retry',
                              style: TextStyle(color: Colors.white),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                )
              else if (_filteredHistory.isEmpty)
                SliverFillRemaining(
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.history_outlined,
                          size: 48,
                          color: Colors.grey,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          _searchTerm.isEmpty
                              ? 'No activity yet'
                              : 'No activity found matching "$_searchTerm"',
                          style: const TextStyle(color: Colors.grey),
                        ),
                      ],
                    ),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate((context, index) {
                      final item = _filteredHistory[index];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.grey.shade200),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  color: item.status == 'error'
                                      ? Colors.red.shade50
                                      : Colors.grey.shade100,
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  _iconFor(item.type, item.status),
                                  size: 18,
                                  color: _iconColorFor(item.type, item.status),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.spaceBetween,
                                      children: [
                                        Expanded(
                                          child: Text(
                                            item.action,
                                            style: TextStyle(
                                              fontWeight: FontWeight.w600,
                                              color: item.status == 'error'
                                                  ? Colors.red.shade700
                                                  : Colors.black87,
                                            ),
                                          ),
                                        ),
                                        Text(
                                          item.date,
                                          style: TextStyle(
                                            fontSize: 11,
                                            color: Colors.grey.shade500,
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      item.details,
                                      style: TextStyle(
                                        fontSize: 13,
                                        color: Colors.grey.shade700,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }, childCount: _filteredHistory.length),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
