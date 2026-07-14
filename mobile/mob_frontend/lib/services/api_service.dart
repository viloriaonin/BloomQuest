import 'dart:convert';
import 'package:http/http.dart' as http;

const String baseUrl = 'http://127.0.0.1:8000';

class ApiService {
  static Future<Map<String, dynamic>> login(
    String email,
    String password,
  ) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/login'),
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
        Uri.parse('$baseUrl/api/forgot-password/send-otp'),
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
        Uri.parse('$baseUrl/api/forgot-password/verify-otp'),
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
        Uri.parse('$baseUrl/api/forgot-password/reset'),
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
        Uri.parse('$baseUrl/api/contact-admin'),
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
          '$baseUrl/api/contact-admin/check-status?email=${Uri.encodeComponent(email)}',
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
        Uri.parse('$baseUrl/api/contact-admin/pending'),
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
        Uri.parse('$baseUrl/api/contact-admin/users'),
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
        Uri.parse('$baseUrl/api/contact-admin/approve'),
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
        Uri.parse('$baseUrl/api/contact-admin/decline'),
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
        Uri.parse('$baseUrl/api/users/archive'),
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
        Uri.parse('$baseUrl/api/users/restore'),
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
        Uri.parse('$baseUrl/api/users/verify-admin-password'),
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
        Uri.parse('$baseUrl/api/users/update-password'),
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
}
