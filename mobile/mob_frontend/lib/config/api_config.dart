import 'package:flutter/foundation.dart' show kIsWeb;

class ApiConfig {
  // 👇 This is the ONLY line you change when your network/IP changes
  static const String _lanIp = '192.168.194.158';
  static const int _port = 8000;

  static String get baseUrl {
    if (kIsWeb) {
      // Chrome runs on your dev machine, so localhost works fine
      return 'http://localhost:$_port/api';
    } else {
      // Physical device (or emulator) needs your machine's LAN IP
      return 'http://$_lanIp:$_port/api';
    }
  }
}
