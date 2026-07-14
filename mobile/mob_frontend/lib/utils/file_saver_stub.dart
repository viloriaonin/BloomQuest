// Stub for platforms without dart:io (e.g., web)
import 'dart:typed_data';

Future<void> saveAndOpenFile(Uint8List bytes, String filename) async {
  throw UnsupportedError('File saving not supported on this platform');
}
