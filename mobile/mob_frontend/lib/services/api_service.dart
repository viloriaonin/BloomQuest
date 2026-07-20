import 'dart:convert';
import 'package:http/http.dart' as http;

import 'package:mob_frontend/config/api_config.dart';

class ApiService {
  static Future<Map<String, dynamic>> login(
    String email,
    String password,
  ) async {
    try {
      final response = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/login'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({'email': email, 'password': password}),
      );

      print('Status code: ${response.statusCode}');
      print('Response body: ${response.body}');

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        final error = jsonDecode(response.body);
        throw Exception(error['detail'] ?? 'Login failed');
      }
    } catch (e) {
      print('API Error: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> sendPasswordResetOtp(String email) async {
    try {
      final response = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/forgot-password/send-otp'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({'email': email}),
      );

      print('Status code: ${response.statusCode}');
      print('Response body: ${response.body}');

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        final error = jsonDecode(response.body);
        throw Exception(error['detail'] ?? 'Failed to send verification code.');
      }
    } catch (e) {
      print('API Error: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> verifyPasswordResetOtp(
    String email,
    String otp,
  ) async {
    try {
      final response = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/forgot-password/verify-otp'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({'email': email, 'otp': otp}),
      );

      print('Status code: ${response.statusCode}');
      print('Response body: ${response.body}');

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        final error = jsonDecode(response.body);
        throw Exception(
          error['detail'] ?? 'Invalid or expired verification code.',
        );
      }
    } catch (e) {
      print('API Error: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> resetPassword(
    String email,
    String otp,
    String newPassword,
  ) async {
    try {
      final response = await http.patch(
        Uri.parse('${ApiConfig.baseUrl}/forgot-password/reset'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({
          'email': email,
          'otp': otp,
          'new_password': newPassword,
        }),
      );

      print('Status code: ${response.statusCode}');
      print('Response body: ${response.body}');

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        final error = jsonDecode(response.body);
        throw Exception(error['detail'] ?? 'Failed to reset password.');
      }
    } catch (e) {
      print('API Error: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> submitAccountRequest(
    String fullName,
    String department,
    String email,
  ) async {
    try {
      final response = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/contact-admin'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({
          'full_name': fullName,
          'department': department,
          'email': email,
        }),
      );

      print('Status code: ${response.statusCode}');
      print('Response body: ${response.body}');

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        final error = jsonDecode(response.body);
        throw Exception(error['detail'] ?? 'Failed to submit admin request.');
      }
    } catch (e) {
      print('API Error: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> checkContactAdminStatus(
    String email,
  ) async {
    try {
      final response = await http.get(
        Uri.parse(
          '${ApiConfig.baseUrl}/contact-admin/check-status?email=${Uri.encodeComponent(email)}',
        ),
        headers: {'Accept': 'application/json'},
      );

      print('Status code: ${response.statusCode}');
      print('Response body: ${response.body}');

      if (response.statusCode == 200) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      } else {
        return {'exists': false};
      }
    } catch (e) {
      print('API Error: $e');
      return {'exists': false};
    }
  }

  static Future<List<dynamic>> fetchPendingContactRequests() async {
    try {
      final response = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/contact-admin/pending'),
        headers: {'Accept': 'application/json'},
      );

      print('Status code: ${response.statusCode}');
      print('Response body: ${response.body}');

      if (response.statusCode == 200) {
        return jsonDecode(response.body) as List<dynamic>;
      } else {
        final error = jsonDecode(response.body);
        throw Exception(error['detail'] ?? 'Failed to load pending requests.');
      }
    } catch (e) {
      print('API Error: $e');
      rethrow;
    }
  }

  static Future<dynamic> fetchAdminUsers() async {
    try {
      final response = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/contact-admin/users'),
        headers: {'Accept': 'application/json'},
      );

      print('Status code: ${response.statusCode}');
      print('Response body: ${response.body}');

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        final error = jsonDecode(response.body);
        throw Exception(error['detail'] ?? 'Failed to load users.');
      }
    } catch (e) {
      print('API Error: $e');
      rethrow;
    }
  }

  static Future<void> approveAccountRequest(String email) async {
    try {
      final response = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/contact-admin/approve'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({'email': email}),
      );

      print('Status code: ${response.statusCode}');
      print('Response body: ${response.body}');

      if (response.statusCode != 200) {
        final error = jsonDecode(response.body);
        throw Exception(error['detail'] ?? 'Failed to approve request.');
      }
    } catch (e) {
      print('API Error: $e');
      rethrow;
    }
  }

  static Future<void> declineAccountRequest(String email) async {
    try {
      final response = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/contact-admin/decline'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({'email': email}),
      );

      print('Status code: ${response.statusCode}');
      print('Response body: ${response.body}');

      if (response.statusCode != 200) {
        final error = jsonDecode(response.body);
        throw Exception(error['detail'] ?? 'Failed to decline request.');
      }
    } catch (e) {
      print('API Error: $e');
      rethrow;
    }
  }

  static Future<void> archiveUser(String email) async {
    try {
      final response = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/users/archive'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({'email': email}),
      );

      print('Status code: ${response.statusCode}');
      print('Response body: ${response.body}');

      if (response.statusCode != 200) {
        final error = jsonDecode(response.body);
        throw Exception(error['detail'] ?? 'Failed to archive user.');
      }
    } catch (e) {
      print('API Error: $e');
      rethrow;
    }
  }

  static Future<void> restoreUser(String email) async {
    try {
      final response = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/users/restore'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({'email': email}),
      );

      print('Status code: ${response.statusCode}');
      print('Response body: ${response.body}');

      if (response.statusCode != 200) {
        final error = jsonDecode(response.body);
        throw Exception(error['detail'] ?? 'Failed to restore user.');
      }
    } catch (e) {
      print('API Error: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> verifyAdminPassword(
    String adminEmail,
    String adminPassword,
    String targetEmail,
  ) async {
    try {
      final response = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/users/verify-admin-password'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({
          'admin_email': adminEmail,
          'admin_password': adminPassword,
          'target_email': targetEmail,
        }),
      );

      print('Status code: ${response.statusCode}');
      print('Response body: ${response.body}');

      if (response.statusCode == 200) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      }

      final error = jsonDecode(response.body);
      throw Exception(error['detail'] ?? 'Failed to verify admin password.');
    } catch (e) {
      print('API Error: $e');
      rethrow;
    }
  }

  static Future<void> updateUserPassword(
    String email,
    String newPassword,
  ) async {
    try {
      final response = await http.put(
        Uri.parse('${ApiConfig.baseUrl}/users/update-password'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({'email': email, 'new_password': newPassword}),
      );

      print('Status code: ${response.statusCode}');
      print('Response body: ${response.body}');

      if (response.statusCode != 200) {
        final error = jsonDecode(response.body);
        throw Exception(error['detail'] ?? 'Failed to update password.');
      }
    } catch (e) {
      print('API Error: $e');
      rethrow;
    }
  }

  // ── Departments ──

  static Future<List<dynamic>> fetchDepartments() async {
    try {
      final response = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/departments'),
        headers: {'Accept': 'application/json'},
      );

      print('Status code: ${response.statusCode}');
      print('Response body: ${response.body}');

      if (response.statusCode == 200) {
        return jsonDecode(response.body) as List<dynamic>;
      } else {
        final error = jsonDecode(response.body);
        throw Exception(error['detail'] ?? 'Failed to load departments.');
      }
    } catch (e) {
      print('API Error: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> createDepartment(
    String name,
    String code,
  ) async {
    try {
      final response = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/departments'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({'name': name, 'code': code}),
      );

      print('Status code: ${response.statusCode}');
      print('Response body: ${response.body}');

      if (response.statusCode == 200 || response.statusCode == 201) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      } else {
        final error = jsonDecode(response.body);
        throw Exception(error['detail'] ?? 'Failed to create department.');
      }
    } catch (e) {
      print('API Error: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> updateDepartment(
    String id,
    String name,
    String code,
  ) async {
    try {
      final response = await http.put(
        Uri.parse('${ApiConfig.baseUrl}/departments/${Uri.encodeComponent(id)}'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({'name': name, 'code': code}),
      );

      print('Status code: ${response.statusCode}');
      print('Response body: ${response.body}');

      if (response.statusCode == 200) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      } else {
        final error = jsonDecode(response.body);
        throw Exception(error['detail'] ?? 'Failed to update department.');
      }
    } catch (e) {
      print('API Error: $e');
      rethrow;
    }
  }

  static Future<void> deleteDepartment(String id) async {
    try {
      final response = await http.delete(
        Uri.parse('${ApiConfig.baseUrl}/departments/${Uri.encodeComponent(id)}'),
        headers: {'Accept': 'application/json'},
      );

      print('Status code: ${response.statusCode}');
      print('Response body: ${response.body}');

      if (response.statusCode != 200 && response.statusCode != 204) {
        try {
          final error = jsonDecode(response.body);
          throw Exception(error['detail'] ?? 'Failed to delete department.');
        } catch (_) {
          throw Exception('Failed to delete department.');
        }
      }
    } catch (e) {
      print('API Error: $e');
      rethrow;
    }
  }

  // ── Subjects ──

  static Future<List<dynamic>> fetchSubjects() async {
    try {
      final response = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/subjects'),
        headers: {'Accept': 'application/json'},
      );

      print('Status code: ${response.statusCode}');
      print('Response body: ${response.body}');

      if (response.statusCode == 200) {
        return jsonDecode(response.body) as List<dynamic>;
      } else {
        final error = jsonDecode(response.body);
        throw Exception(error['detail'] ?? 'Failed to load subjects.');
      }
    } catch (e) {
      print('API Error: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> createSubject(
    String name,
    String code,
    String departmentId,
  ) async {
    try {
      final response = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/subjects'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({
          'name': name,
          'code': code,
          'department_id': departmentId,
        }),
      );

      print('Status code: ${response.statusCode}');
      print('Response body: ${response.body}');

      if (response.statusCode == 200 || response.statusCode == 201) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      } else {
        final error = jsonDecode(response.body);
        throw Exception(error['detail'] ?? 'Failed to create subject.');
      }
    } catch (e) {
      print('API Error: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> updateSubject(
    String id,
    String name,
    String code,
    String departmentId,
  ) async {
    try {
      final response = await http.put(
        Uri.parse('${ApiConfig.baseUrl}/subjects/${Uri.encodeComponent(id)}'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({
          'name': name,
          'code': code,
          'department_id': departmentId,
        }),
      );

      print('Status code: ${response.statusCode}');
      print('Response body: ${response.body}');

      if (response.statusCode == 200) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      } else {
        final error = jsonDecode(response.body);
        throw Exception(error['detail'] ?? 'Failed to update subject.');
      }
    } catch (e) {
      print('API Error: $e');
      rethrow;
    }
  }

  static Future<void> deleteSubject(String id) async {
    try {
      final response = await http.delete(
        Uri.parse('${ApiConfig.baseUrl}/subjects/${Uri.encodeComponent(id)}'),
        headers: {'Accept': 'application/json'},
      );

      print('Status code: ${response.statusCode}');
      print('Response body: ${response.body}');

      if (response.statusCode != 200 && response.statusCode != 204) {
        try {
          final error = jsonDecode(response.body);
          throw Exception(error['detail'] ?? 'Failed to delete subject.');
        } catch (_) {
          throw Exception('Failed to delete subject.');
        }
      }
    } catch (e) {
      print('API Error: $e');
      rethrow;
    }
  }

  static Future<void> deleteUser(String email) async {
    try {
      final response = await http.delete(
        Uri.parse('${ApiConfig.baseUrl}/users/${Uri.encodeComponent(email)}'),
        headers: {
          'Accept': 'application/json',
        },
      );

      print('Status code: ${response.statusCode}');
      print('Response body: ${response.body}');

      if (response.statusCode != 200) {
        try {
          final error = jsonDecode(response.body);
          throw Exception(error['detail'] ?? 'Failed to delete user.');
        } catch (_) {
          throw Exception('Failed to delete user.');
        }
      }
    } catch (e) {
      print('API Error: $e');
      rethrow;
    }
  }
}