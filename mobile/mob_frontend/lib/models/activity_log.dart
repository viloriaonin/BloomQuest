import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:mob_frontend/config/api_config.dart';

final String kApiBaseUrl = ApiConfig.baseUrl;
final String kActivityLogEndpoint = '$kApiBaseUrl/activity-logs';

class ActivityLogEntry {
  final int id;
  final String? name;
  final String? dept;
  final String? role;
  final String action;
  final String? detail;
  final String? type;
  final String? status;
  final String date;
  final String time;
  final String? bloomsLevel;

  ActivityLogEntry({
    required this.id,
    this.name,
    this.dept,
    this.role,
    required this.action,
    this.detail,
    this.type,
    this.status,
    required this.date,
    required this.time,
    this.bloomsLevel,
  });

  factory ActivityLogEntry.fromJson(Map<String, dynamic> json) {
    return ActivityLogEntry(
      id: json['id'] as int,
      name: json['name'] as String?,
      dept: json['dept'] as String?,
      role: json['role'] as String?,
      action: json['action'] as String? ?? '',
      detail: json['detail'] as String?,
      type: json['type'] as String?,
      status: json['status'] as String?,
      date: json['date'] as String? ?? '',
      time: json['time'] as String? ?? '',
      bloomsLevel: json['bloomsLevel'] as String? ?? json['blooms_level'] as String? ?? json['level'] as String?,
    );
  }
}

Future<List<ActivityLogEntry>> fetchActivityLog() async {
  final response = await http.get(Uri.parse(kActivityLogEndpoint));
  if (response.statusCode != 200) {
    throw Exception('Request failed with status ${response.statusCode}');
  }

  final decoded = jsonDecode(response.body);
  final List<dynamic> rows = decoded is List ? decoded : (decoded['data'] as List<dynamic>? ?? []);
  return rows.map((row) => ActivityLogEntry.fromJson(row as Map<String, dynamic>)).toList();
}
