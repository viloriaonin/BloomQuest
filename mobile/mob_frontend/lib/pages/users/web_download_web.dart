// Web-only implementation using dart:html to trigger a browser download.
// This file is only compiled when dart.library.html is available (web builds).
import 'dart:html' as html;

void downloadBytes(List<int> bytes, String filename) {
  final blob = html.Blob([bytes]);
  final url = html.Url.createObjectUrlFromBlob(blob);
  final anchor = html.AnchorElement(href: url)
    ..setAttribute('download', filename)
    ..click();
  html.Url.revokeObjectUrl(url);
}
