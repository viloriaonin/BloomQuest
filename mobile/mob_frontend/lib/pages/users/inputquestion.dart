import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:typed_data';

const String baseUrl = 'http://127.0.0.1:8000';

class InputPage extends StatefulWidget {
  const InputPage({super.key});

  @override
  State<InputPage> createState() => _InputPageState();
}

class _InputPageState extends State<InputPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Manual input state
  final TextEditingController _questionController = TextEditingController();
  String? _selectedSubject;

  // Upload state
  Uint8List? _moduleFileBytes;
  String? _moduleFileName;
  Uint8List? _syllabusFileBytes;
  String? _syllabusFileName;
  bool _uploading = false;
  bool _generating = false;
  Map<String, dynamic>? _uploadResult;
  Map<String, dynamic>? _generationResult;
  final TextEditingController _totalItemsController = TextEditingController();
  String _error = '';

  static const primaryColor = Color(0xFF7B1113);

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _questionController.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _tabController.dispose();
    _questionController.dispose();
    _totalItemsController.dispose();
    super.dispose();
  }

  // ─── Pick Files ──────────────────────────────────────────────────────────────
  Future<void> _pickModuleFile() async {
    try {
      final result = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'pptx', 'ppt', 'docx'],
        withData: true,
        allowMultiple: false,
      );
      if (result != null && result.files.isNotEmpty) {
        final file = result.files.first;
        final bytes = file.bytes;
        if (bytes == null) {
          setState(
            () => _error = 'Could not read module file. Please try again.',
          );
          return;
        }
        setState(() {
          _moduleFileBytes = Uint8List.fromList(bytes);
          _moduleFileName = file.name;
          _error = '';
        });
        print(
          'Module file selected: ${file.name}, size: ${bytes.length} bytes',
        );
      }
    } catch (e) {
      setState(() => _error = 'Error picking file: $e');
    }
  }

  Future<void> _pickSyllabusFile() async {
    try {
      final result = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'docx', 'xlsx', 'xls'],
        withData: true,
        allowMultiple: false,
      );
      if (result != null && result.files.isNotEmpty) {
        final file = result.files.first;
        final bytes = file.bytes;
        if (bytes == null) {
          setState(
            () => _error = 'Could not read syllabus file. Please try again.',
          );
          return;
        }
        setState(() {
          _syllabusFileBytes = Uint8List.fromList(bytes);
          _syllabusFileName = file.name;
          _error = '';
        });
        print(
          'Syllabus file selected: ${file.name}, size: ${bytes.length} bytes',
        );
      }
    } catch (e) {
      setState(() => _error = 'Error picking file: $e');
    }
  }

  // ─── Upload Files ────────────────────────────────────────────────────────────
  Future<void> _handleUpload() async {
    if (_moduleFileBytes == null || _syllabusFileBytes == null) {
      setState(() => _error = 'Please select both module and syllabus files.');
      return;
    }

    setState(() {
      _error = '';
      _uploading = true;
      _uploadResult = null;
      _generationResult = null;
    });

    try {
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/api/upload'),
      );

      request.files.add(
        http.MultipartFile.fromBytes(
          'module_file',
          _moduleFileBytes!,
          filename: _moduleFileName!,
        ),
      );

      request.files.add(
        http.MultipartFile.fromBytes(
          'syllabus_file',
          _syllabusFileBytes!,
          filename: _syllabusFileName!,
        ),
      );

      final response = await request.send();
      final body = await response.stream.bytesToString();
      final data = jsonDecode(body);

      if (response.statusCode == 200) {
        setState(() => _uploadResult = data);
      } else {
        setState(() => _error = data['detail'] ?? 'Upload failed');
      }
    } catch (e) {
      setState(
        () =>
            _error = 'Cannot connect to server. Make sure backend is running.',
      );
    } finally {
      setState(() => _uploading = false);
    }
  }

  // ─── Generate Questions ───────────────────────────────────────────────────────
  Future<void> _handleGenerate() async {
    if (_totalItemsController.text.isEmpty) {
      setState(() => _error = 'Please enter total number of items.');
      return;
    }

    setState(() {
      _error = '';
      _generating = true;
      _generationResult = null;
    });

    try {
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/api/generate'),
      );

      request.fields['upload_id'] = _uploadResult!['upload_id'].toString();
      request.fields['total_items'] = _totalItemsController.text;

      final response = await request.send();
      final body = await response.stream.bytesToString();
      final data = jsonDecode(body);

      if (response.statusCode == 200) {
        setState(() => _generationResult = data);
      } else {
        setState(() => _error = data['detail'] ?? 'Generation failed');
      }
    } catch (e) {
      setState(
        () =>
            _error = 'Cannot connect to server. Make sure backend is running.',
      );
    } finally {
      setState(() => _generating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Input Question',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1A1A1A),
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              "Submit questions for Bloom's Taxonomy classification",
              style: TextStyle(fontSize: 13, color: Colors.grey),
            ),
            const SizedBox(height: 20),

            if (_error.isNotEmpty)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFfef2f2),
                  border: Border.all(color: const Color(0xFFfecaca)),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _error,
                  style: const TextStyle(
                    color: Color(0xFF991b1b),
                    fontSize: 13,
                  ),
                ),
              ),

            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.06),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                children: [
                  TabBar(
                    controller: _tabController,
                    labelColor: primaryColor,
                    unselectedLabelColor: Colors.grey,
                    indicatorColor: primaryColor,
                    indicatorWeight: 2.5,
                    labelStyle: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                    tabs: const [
                      Tab(text: 'Input Manually'),
                      Tab(text: 'Upload File'),
                    ],
                  ),
                  SizedBox(
                    height: _uploadResult != null ? 900 : 420,
                    child: TabBarView(
                      controller: _tabController,
                      children: [_buildManualTab(), _buildUploadTab()],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Manual Tab ──────────────────────────────────────────────────────────────
  Widget _buildManualTab() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: Colors.grey.shade300),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              children: [
                TextField(
                  controller: _questionController,
                  maxLines: 5,
                  maxLength: 500,
                  buildCounter:
                      (
                        context, {
                        required currentLength,
                        required isFocused,
                        maxLength,
                      }) => null,
                  decoration: const InputDecoration(
                    hintText: 'Type your question here...',
                    hintStyle: TextStyle(color: Colors.grey, fontSize: 14),
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.all(12),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(right: 12, bottom: 8),
                  child: Align(
                    alignment: Alignment.centerRight,
                    child: Text(
                      '${_questionController.text.length} / 500',
                      style: const TextStyle(color: Colors.grey, fontSize: 12),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'SUBJECT',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: Colors.grey,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            value: _selectedSubject,
            hint: const Text(
              'Select subject',
              style: TextStyle(fontSize: 13, color: Colors.grey),
            ),
            items: const [],
            onChanged: (val) => setState(() => _selectedSubject = val),
            decoration: InputDecoration(
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 10,
                vertical: 10,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: Colors.grey.shade300),
              ),
            ),
            isExpanded: true,
          ),
          const SizedBox(height: 20),
          Align(
            alignment: Alignment.centerRight,
            child: ElevatedButton(
              onPressed: _questionController.text.trim().isEmpty ? null : () {},
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryColor,
                disabledBackgroundColor: Colors.grey.shade300,
                padding: const EdgeInsets.symmetric(
                  horizontal: 28,
                  vertical: 14,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: const Text(
                'Classify Question',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Upload Tab ───────────────────────────────────────────────────────────────
  Widget _buildUploadTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildStepHeader(1, 'Upload Files'),
          const SizedBox(height: 12),
          _buildUploadCard(
            icon: Icons.upload_outlined,
            iconBgColor: const Color(0xFFFFE5E5),
            iconColor: primaryColor,
            title: 'Upload Modules or PPT',
            subtitle: 'Lesson files, slides, or reading materials',
            tags: const ['PDF', 'PPTX', 'DOCX'],
            file: _moduleFileName,
            buttonOutlined: false,
            onTap: _pickModuleFile,
          ),
          const SizedBox(height: 12),
          _buildUploadCard(
            icon: Icons.description_outlined,
            iconBgColor: const Color(0xFFE8F0FE),
            iconColor: const Color(0xFF1565C0),
            title: 'Upload Course Syllabus',
            subtitle: 'Course outline or curriculum document',
            tags: const ['PDF', 'DOCX', 'XLSX'],
            file: _syllabusFileName,
            buttonOutlined: true,
            onTap: _pickSyllabusFile,
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed:
                  (_uploading ||
                      _moduleFileBytes == null ||
                      _syllabusFileBytes == null)
                  ? null
                  : _handleUpload,
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryColor,
                disabledBackgroundColor: Colors.grey.shade300,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: _uploading
                  ? const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        ),
                        SizedBox(width: 10),
                        Text(
                          'Analyzing files...',
                          style: TextStyle(color: Colors.white),
                        ),
                      ],
                    )
                  : const Text(
                      'Upload & Analyze Files',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
            ),
          ),

          if (_uploadResult != null) ...[
            const SizedBox(height: 24),
            _buildStepHeader(2, 'Detected Subject & Topics'),
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFfef2f2),
                border: Border.all(color: const Color(0xFFfecaca)),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'SUBJECT DETECTED',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: Colors.grey,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _uploadResult!['subject']['name'] ?? '',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                      color: Color(0xFF1A1A1A),
                    ),
                  ),
                  if (_uploadResult!['subject']['code'] != null)
                    Text(
                      _uploadResult!['subject']['code'],
                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                  if (_uploadResult!['subject']['description'] != null)
                    Text(
                      _uploadResult!['subject']['description'],
                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'TOPICS DETECTED',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: Colors.grey,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 8),
            ...(_uploadResult!['topics'] as List).map(
              (topic) => Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        topic['name'],
                        style: const TextStyle(
                          fontSize: 13,
                          color: Color(0xFF1A1A1A),
                        ),
                      ),
                    ),
                    Text(
                      '${((topic['weight'] as num) * 100).round()}%',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: primaryColor,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            _buildStepHeader(3, 'Number of Items'),
            const SizedBox(height: 12),
            TextField(
              controller: _totalItemsController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                hintText: 'Enter total number of questions (e.g. 50)',
                hintStyle: const TextStyle(fontSize: 13, color: Colors.grey),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: Colors.grey.shade300),
                ),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              "Questions will be auto-distributed across all 6 Bloom's Taxonomy levels",
              style: TextStyle(fontSize: 11, color: Colors.grey),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: (_generating || _totalItemsController.text.isEmpty)
                    ? null
                    : _handleGenerate,
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryColor,
                  disabledBackgroundColor: Colors.grey.shade300,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: _generating
                    ? const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          ),
                          SizedBox(width: 10),
                          Text(
                            'Generating questions...',
                            style: TextStyle(color: Colors.white),
                          ),
                        ],
                      )
                    : const Text(
                        'Generate Questions',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                          fontSize: 15,
                        ),
                      ),
              ),
            ),
          ],

          if (_generationResult != null) ...[
            const SizedBox(height: 24),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFf0fdf4),
                border: Border.all(color: const Color(0xFF86efac)),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.check_circle,
                        color: Color(0xFF16a34a),
                        size: 18,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _generationResult!['message'],
                          style: const TextStyle(
                            color: Color(0xFF16a34a),
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'TABLE OF SPECIFICATION',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: Colors.grey,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  ...(_generationResult!['tos'] as List).map(
                    (row) => Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  row['topic'],
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                              Text(
                                '${row['weight']}% • ${row['total_items']} items',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: primaryColor,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Wrap(
                            spacing: 6,
                            runSpacing: 4,
                            children:
                                (row['bloom_breakdown'] as Map<String, dynamic>)
                                    .entries
                                    .map(
                                      (entry) => Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 8,
                                          vertical: 3,
                                        ),
                                        decoration: BoxDecoration(
                                          color: Colors.grey.shade100,
                                          borderRadius: BorderRadius.circular(
                                            4,
                                          ),
                                        ),
                                        child: Text(
                                          '${entry.key}: ${entry.value['total']}',
                                          style: const TextStyle(
                                            fontSize: 10,
                                            color: Colors.grey,
                                          ),
                                        ),
                                      ),
                                    )
                                    .toList(),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '✅ ${_generationResult!['total_questions']} questions saved to Question Bank!',
                    style: const TextStyle(
                      color: Color(0xFF16a34a),
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ─── Helper Widgets ───────────────────────────────────────────────────────────
  Widget _buildStepHeader(int step, String title) {
    return Row(
      children: [
        Container(
          width: 24,
          height: 24,
          decoration: const BoxDecoration(
            color: primaryColor,
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Text(
              '$step',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          title,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 14,
            color: Color(0xFF1A1A1A),
          ),
        ),
      ],
    );
  }

  Widget _buildUploadCard({
    required IconData icon,
    required Color iconBgColor,
    required Color iconColor,
    required String title,
    required String subtitle,
    required List<String> tags,
    required String? file,
    required bool buttonOutlined,
    required VoidCallback onTap,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(
          color: file != null ? const Color(0xFF86efac) : Colors.grey.shade300,
        ),
        borderRadius: BorderRadius.circular(10),
        color: file != null ? const Color(0xFFf0fdf4) : Colors.white,
      ),
      child: Column(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: file != null ? const Color(0xFFdcfce7) : iconBgColor,
              shape: BoxShape.circle,
            ),
            child: Icon(
              file != null ? Icons.check : icon,
              color: file != null ? const Color(0xFF16a34a) : iconColor,
              size: 26,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 13,
              color: Color(0xFF1A1A1A),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            file != null ? file : subtitle,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 11,
              color: file != null ? const Color(0xFF16a34a) : Colors.grey,
              fontWeight: file != null ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
          if (file == null) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              children: tags
                  .map(
                    (tag) => Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: Colors.grey.shade300),
                      ),
                      child: Text(
                        tag,
                        style: const TextStyle(
                          fontSize: 10,
                          color: Colors.grey,
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ],
          const SizedBox(height: 12),
          buttonOutlined
              ? OutlinedButton(
                  onPressed: onTap,
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(
                      color: file != null
                          ? const Color(0xFF16a34a)
                          : const Color(0xFF1565C0),
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(6),
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                  ),
                  child: Text(
                    file != null ? 'Change File' : 'Browse Files',
                    style: TextStyle(
                      fontSize: 12,
                      color: file != null
                          ? const Color(0xFF16a34a)
                          : const Color(0xFF1565C0),
                    ),
                  ),
                )
              : ElevatedButton(
                  onPressed: onTap,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: file != null
                        ? const Color(0xFF16a34a)
                        : primaryColor,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(6),
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                  ),
                  child: Text(
                    file != null ? 'Change File' : 'Browse Files',
                    style: const TextStyle(fontSize: 12, color: Colors.white),
                  ),
                ),
        ],
      ),
    );
  }
}
