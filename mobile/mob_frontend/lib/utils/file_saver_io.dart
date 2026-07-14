// IO implementation for saving and opening files (mobile/desktop)
import 'dart:typed_data';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:open_filex/open_filex.dart';

Future<void> saveAndOpenFile(Uint8List bytes, String filename) async {
  final dir = await getApplicationDocumentsDirectory();
  final filePath = '${dir.path}/$filename';
  final file = File(filePath);
  await file.writeAsBytes(bytes);
  await OpenFilex.open(filePath);
}
