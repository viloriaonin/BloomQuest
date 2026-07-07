// Stub for non-web platforms. These functions are never called on
// mobile/desktop because the calling code branches on kIsWeb first.
void downloadBytes(List<int> bytes, String filename) {
  throw UnsupportedError('downloadBytes is only available on web');
}
