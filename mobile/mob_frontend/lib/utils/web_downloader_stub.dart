// Stub for non-web platforms
import 'dart:typed_data';

void downloadFileWeb(Uint8List bytes, String filename, String mime) {
  throw UnsupportedError('Web downloader not available on this platform');
}
