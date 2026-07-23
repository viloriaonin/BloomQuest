import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:BloomQuest/config/api_config.dart';

class InputPage extends StatefulWidget {
  const InputPage({super.key});

  @override
  State<InputPage> createState() => _InputPageState();
}

class _InputPageState extends State<InputPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Shared Core Registry States
  List<dynamic> _subjects = [];
  String? _selectedSubjectId;
  bool _loadingSubjects = true;
  String _error = '';
  String _successMessage = '';

  // Inline Add New Subject States
  bool _isAddingNewSubject = false;
  bool _savingSubject = false;
  final TextEditingController _newSubjectNameController =
      TextEditingController();
  final TextEditingController _newSubjectCodeController =
      TextEditingController();

  // Manual Input Tab States
  final TextEditingController _questionController = TextEditingController();
  String _manualQuestionType = 'MCQ';
  bool _classifying = false;
  String _duplicateWarning = '';
  Timer? _debounceTimer;

  // Upload & Auto-Gen Tab States
  Uint8List? _moduleFileBytes;
  String? _moduleFileName;
  Uint8List? _syllabusFileBytes;
  String? _syllabusFileName;
  bool _uploading = false;
  bool _generating = false;
  Map<String, dynamic>? _uploadResult;
  Map<String, dynamic>? _generationResult;
  List<bool> _topicSelected = [];
  List<TextEditingController> _topicHoursControllers = [];

  final TextEditingController _totalPointsController = TextEditingController(
    text: '50',
  );
  final TextEditingController _totalItemsController = TextEditingController();
  final List<String> _selectedQuestionTypes = [];

  // Preview State
  String _previewBloomTab = 'Remember';
  final List<String> _bloomsLevels = [
    'Remember',
    'Understand',
    'Apply',
    'Analyze',
    'Evaluate',
    'Create',
  ];

  static const primaryColor = Color(0xFF7B1113);

  final List<Map<String, String>> _questionTypeOptions = [
    {"label": "Multiple Choice", "value": "MCQ"},
    {"label": "True or False", "value": "True or False"},
    {"label": "Identification", "value": "Identification"},
    {"label": "Matching Type", "value": "Matching Type"},
    {"label": "Enumeration", "value": "Enumeration"},
    {"label": "Essay", "value": "Essay"},
    {"label": "Situational", "value": "Situational"},
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() => setState(() {}));
    _questionController.addListener(_onQuestionTextChanged);
    _fetchSubjects();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _questionController.removeListener(_onQuestionTextChanged);
    _questionController.dispose();
    _newSubjectNameController.dispose();
    _newSubjectCodeController.dispose();
    _totalItemsController.dispose();
    _totalPointsController.dispose();
    for (final c in _topicHoursControllers) {
      c.dispose();
    }
    _debounceTimer?.cancel();
    super.dispose();
  }

  // ─── Fetch Active Subjects from DB ───────────────────────────────────────────
  Future<void> _fetchSubjects() async {
    try {
      final response = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/subjects'),
      );
      if (response.statusCode == 200) {
        setState(() {
          _subjects = jsonDecode(response.body);
          _loadingSubjects = false;
        });
      } else {
        setState(() {
          _error = 'Failed to load active subjects database records.';
          _loadingSubjects = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Cannot connect to backend server framework layers.';
        _loadingSubjects = false;
      });
    }
  }

  // ─── Continuous Lookahead Thought Duplicate Check ────────────────────────────
  void _onQuestionTextChanged() {
    if (_debounceTimer?.isActive ?? false) _debounceTimer!.cancel();

    final text = _questionController.text.trim();
    if (text.length < 10 || _selectedSubjectId == null) {
      setState(() => _duplicateWarning = '');
      return;
    }

    _debounceTimer = Timer(const Duration(milliseconds: 600), () async {
      try {
        final response = await http.get(
          Uri.parse(
            '${ApiConfig.baseUrl}/questions?subject_id=$_selectedSubjectId',
          ),
        );
        if (response.statusCode == 200) {
          final List<dynamic> questionsBank = jsonDecode(response.body);
          final lowerInput = text.toLowerCase();

          final isDuplicate = questionsBank.any((q) {
            final existingQuestionText = (q['question'] ?? '')
                .toString()
                .toLowerCase();
            return existingQuestionText.contains(lowerInput) ||
                lowerInput.contains(existingQuestionText);
          });

          setState(() {
            if (isDuplicate) {
              _duplicateWarning =
                  '⚠️ A question item with this core concept or text already exists.';
            } else {
              _duplicateWarning = '';
            }
          });
        }
      } catch (_) {
        // Safe drop out
      }
    });
    setState(() {});
  }

  // ─── Manual Tab Add Subject Handler ──────────────────────────────────────────
  Future<void> _handleCreateCustomSubject() async {
    final name = _newSubjectNameController.text.trim();
    final code = _newSubjectCodeController.text.trim();
    if (name.isEmpty) return;

    setState(() {
      _error = '';
      _successMessage = '';
      _savingSubject = true;
    });

    try {
      final response = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/subjects'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'name': name, 'code': code.isNotEmpty ? code : null}),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 201) {
        setState(() {
          _subjects.add(data);
          _selectedSubjectId = data['id'].toString();
          _isAddingNewSubject = false;
          _newSubjectNameController.clear();
          _newSubjectCodeController.clear();
          _successMessage =
              '🎉 New course subject framework injected successfully!';
        });
      } else {
        setState(
          () => _error = data['detail'] ?? 'Failed to add custom subject.',
        );
      }
    } catch (e) {
      setState(() => _error = 'Exception logged writing metadata parameters.');
    } finally {
      setState(() => _savingSubject = false);
    }
  }

  // ─── Manual Tab Classification Execution ─────────────────────────────────────
  Future<void> _handleManualClassification() async {
    final questionText = _questionController.text.trim();
    if (_selectedSubjectId == null ||
        questionText.isEmpty ||
        _duplicateWarning.isNotEmpty) {
      return;
    }

    setState(() {
      _error = '';
      _successMessage = '';
      _classifying = true;
    });

    try {
      final response = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/questions/manual'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'question': questionText,
          'question_type': _manualQuestionType,
          'subject_id': int.parse(_selectedSubjectId!),
        }),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 201) {
        setState(() {
          _successMessage =
              '🎉 Success! Assigned item context straight into the "${data['bloom_level']}" bank category tier.';
          _questionController.clear();
        });
      } else {
        setState(
          () => _error = data['detail'] ?? 'Classification sequence rejected.',
        );
      }
    } catch (e) {
      setState(
        () => _error =
            'Network request parsing failure to classifier node entry points.',
      );
    } finally {
      setState(() => _classifying = false);
    }
  }

  // ─── Pick Files ──────────────────────────────────────────────────────────────
  Future<void> _pickModuleFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
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
      }
    } catch (e) {
      setState(() => _error = 'Error picking file: $e');
    }
  }

  Future<void> _pickSyllabusFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
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
      }
    } catch (e) {
      setState(() => _error = 'Error picking file: $e');
    }
  }

  // ─── Upload Files ────────────────────────────────────────────────────────────
  Future<void> _handleUpload() async {
    if (_selectedSubjectId == null || _selectedSubjectId!.isEmpty) {
      setState(
        () => _error = 'Please select a subject before uploading the files.',
      );
      return;
    }

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
        Uri.parse('${ApiConfig.baseUrl}/questions/upload'),
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
        setState(() {
          _uploadResult = data;
          final topics = (data['topics'] as List<dynamic>?) ?? [];
          _topicSelected = List<bool>.filled(topics.length, true);
          _topicHoursControllers = List.generate(
            topics.length,
            (_) => TextEditingController(text: '3.0'),
          );
        });
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
    if (_totalItemsController.text.isEmpty ||
        int.tryParse(_totalItemsController.text) == null) {
      setState(() => _error = 'Please enter a valid total number of items.');
      return;
    }
    if (_selectedQuestionTypes.isEmpty) {
      setState(() => _error = 'Please select at least one question type.');
      return;
    }
    if (_uploadResult == null) {
      setState(() => _error = 'Please upload files first.');
      return;
    }
    if (_topicSelected.where((v) => v).isEmpty) {
      setState(() => _error = 'Please select at least one topic.');
      return;
    }

    setState(() {
      _error = '';
      _generating = true;
      _generationResult = null;
    });

    try {
      final totalItems = int.parse(_totalItemsController.text);
      final totalPoints =
          int.tryParse(_totalPointsController.text) ?? totalItems;
      final selectedIndices = <int>[];
      for (var i = 0; i < _topicSelected.length; i++) {
        if (_topicSelected[i]) selectedIndices.add(i);
      }

      final hoursMap = <String, String>{};
      for (var i = 0; i < _topicHoursControllers.length; i++) {
        hoursMap[i.toString()] = _topicHoursControllers[i].text.isNotEmpty
            ? _topicHoursControllers[i].text
            : '3.0';
      }

      final payload = {
        'upload_id': _uploadResult!['upload_id'].toString(),
        'total_items': totalItems,
        'whole_total_points': totalPoints,
        'question_types': _selectedQuestionTypes,
        'selected_topic_indices': selectedIndices,
        'subcolumn_a_hours': hoursMap,
      };

      final response = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/questions/generate-with-tos'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(payload),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 || response.statusCode == 201) {
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

  // ─── Download Generated Files ──────────────────────────────────────────────────
  Future<void> _downloadFile(String endpoint) async {
    if (_uploadResult == null) return;

    final uploadId = _uploadResult!['upload_id'];
    final url = Uri.parse(
      '${ApiConfig.baseUrl}/questions/export/$endpoint?upload_id=$uploadId',
    );

    try {
      // Bypassing canLaunchUrl as it often returns false negatives on Android 11+
      final launched = await launchUrl(
        url,
        mode: LaunchMode.externalApplication,
      );

      if (!launched) {
        setState(
          () => _error = 'Could not open the browser to download the file.',
        );
      }
    } catch (e) {
      setState(() => _error = 'Download failed: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
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
            const SizedBox(height: 16),

            if (_error.isNotEmpty)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  border: Border.all(color: const Color(0xFFFECACA)),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _error,
                  style: const TextStyle(
                    color: Color(0xFF991B1B),
                    fontSize: 13,
                  ),
                ),
              ),

            if (_successMessage.isNotEmpty)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  border: Border.all(color: const Color(0xFFBBF7D0)),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _successMessage,
                  style: const TextStyle(
                    color: Color(0xFF16A34A),
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
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
                crossAxisAlignment: CrossAxisAlignment.start,
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
                  _tabController.index == 0
                      ? _buildManualTab()
                      : _buildUploadTab(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Manual Tab Implementation ───────────────────────────────────────────────
  Widget _buildManualTab() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'TARGET COURSE SUBJECT',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: Colors.grey,
                      ),
                    ),
                    const SizedBox(height: 6),
                    _loadingSubjects
                        ? const LinearProgressIndicator(color: primaryColor)
                        : DropdownButtonFormField<String>(
                            initialValue: _selectedSubjectId,
                            hint: const Text(
                              '— Select Subject —',
                              style: TextStyle(
                                fontSize: 13,
                                color: Colors.grey,
                              ),
                            ),
                            isExpanded: true,
                            decoration: InputDecoration(
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 10,
                              ),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide: BorderSide(
                                  color: Colors.grey.shade300,
                                ),
                              ),
                            ),
                            items: [
                              ..._subjects.map<DropdownMenuItem<String>>((s) {
                                return DropdownMenuItem(
                                  value: s['id'].toString(),
                                  child: Text(
                                    "${s['name']} ${s['code'] != null ? '(${s['code']})' : ''}",
                                    style: const TextStyle(fontSize: 13),
                                  ),
                                );
                              }),
                              const DropdownMenuItem<String>(
                                value: 'add_new',
                                child: Text(
                                  '+ Add New Subject...',
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: primaryColor,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                            onChanged: (val) {
                              setState(() {
                                if (val == 'add_new') {
                                  _isAddingNewSubject = true;
                                  _selectedSubjectId = null;
                                } else {
                                  _isAddingNewSubject = false;
                                  _selectedSubjectId = val;
                                  _onQuestionTextChanged();
                                }
                              });
                            },
                          ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'ASSESSMENT ITEM TYPE',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: Colors.grey,
                      ),
                    ),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      initialValue: _manualQuestionType,
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
                      items: _questionTypeOptions.map((opt) {
                        return DropdownMenuItem(
                          value: opt['value'],
                          child: Text(
                            opt['label']!,
                            style: const TextStyle(fontSize: 13),
                          ),
                        );
                      }).toList(),
                      onChanged: (val) =>
                          setState(() => _manualQuestionType = val!),
                    ),
                  ],
                ),
              ),
            ],
          ),

          if (_isAddingNewSubject) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'REGISTER CUSTOM SUBJECT',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: Colors.grey,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _newSubjectNameController,
                          decoration: const InputDecoration(
                            hintText: 'Title (e.g. Calculus)',
                            hintStyle: TextStyle(fontSize: 12),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: _newSubjectCodeController,
                          decoration: const InputDecoration(
                            hintText: 'Code (e.g. MATH101)',
                            hintStyle: TextStyle(fontSize: 12),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      TextButton(
                        onPressed: () =>
                            setState(() => _isAddingNewSubject = false),
                        child: const Text('Cancel'),
                      ),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: primaryColor,
                          foregroundColor: Colors.white,
                        ),
                        onPressed: _savingSubject
                            ? null
                            : _handleCreateCustomSubject,
                        child: _savingSubject
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(
                                  color: Colors.white,
                                  strokeWidth: 2,
                                ),
                              )
                            : const Text(
                                'Save Subject',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                ),
                              ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 16),
          const Text(
            'QUESTION INPUT WORKSPACE',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: Colors.grey,
            ),
          ),
          const SizedBox(height: 6),
          Container(
            decoration: BoxDecoration(
              border: Border.all(
                color: _duplicateWarning.isNotEmpty
                    ? Colors.orange.shade400
                    : Colors.grey.shade300,
              ),
              color: _duplicateWarning.isNotEmpty
                  ? Colors.orange.withOpacity(0.02)
                  : Colors.white,
              borderRadius: BorderRadius.circular(8),
            ),
            child: TextField(
              controller: _questionController,
              maxLines: 4,
              maxLength: 500,
              buildCounter:
                  (
                    context, {
                    required currentLength,
                    required isFocused,
                    maxLength,
                  }) => null,
              decoration: const InputDecoration(
                hintText:
                    'Type your draft assessment prompt parameters here...',
                border: InputBorder.none,
                contentPadding: EdgeInsets.all(12),
              ),
            ),
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  _duplicateWarning,
                  style: const TextStyle(
                    color: Colors.orange,
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Text(
                '${_questionController.text.length} / 500',
                style: const TextStyle(color: Colors.grey, fontSize: 11),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Align(
            alignment: Alignment.centerRight,
            child: ElevatedButton(
              onPressed:
                  (_classifying ||
                      _questionController.text.trim().isEmpty ||
                      _selectedSubjectId == null ||
                      _duplicateWarning.isNotEmpty)
                  ? null
                  : _handleManualClassification,
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryColor,
                foregroundColor: Colors.white,
                disabledBackgroundColor: Colors.grey.shade300,
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 14,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: _classifying
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                  : const Text(
                      'Classify & Save Question',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Upload Tab Implementation ───────────────────────────────────────────────
  Widget _buildUploadTab() {
    return Padding(
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
                foregroundColor: Colors.white,
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
            _buildStepHeader(2, 'Question Types Selection'),
            const SizedBox(height: 8),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 3.2,
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
              ),
              itemCount: _questionTypeOptions.length,
              itemBuilder: (context, index) {
                final typeOption = _questionTypeOptions[index];
                final String typeValue = typeOption["value"]!;
                final bool isSelected = _selectedQuestionTypes.contains(
                  typeValue,
                );

                return InkWell(
                  onTap: () {
                    setState(() {
                      if (isSelected) {
                        _selectedQuestionTypes.remove(typeValue);
                      } else {
                        _selectedQuestionTypes.add(typeValue);
                      }
                    });
                  },
                  child: Container(
                    decoration: BoxDecoration(
                      color: isSelected
                          ? const Color(0xFFFFF5F5)
                          : Colors.white,
                      border: Border.all(
                        color: isSelected ? primaryColor : Colors.grey.shade300,
                      ),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    child: Row(
                      children: [
                        Checkbox(
                          activeColor: primaryColor,
                          value: isSelected,
                          onChanged: (bool? checked) {
                            setState(() {
                              if (checked == true) {
                                _selectedQuestionTypes.add(typeValue);
                              } else {
                                _selectedQuestionTypes.remove(typeValue);
                              }
                            });
                          },
                        ),
                        Expanded(
                          child: Text(
                            typeOption["label"]!,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),

            const SizedBox(height: 24),
            _buildStepHeader(3, 'Number of Items & Points'),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Total Points',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey,
                        ),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _totalPointsController,
                        keyboardType: const TextInputType.numberWithOptions(
                          signed: false,
                          decimal: false,
                        ),
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                        ],
                        decoration: InputDecoration(
                          hintText: 'e.g. 50',
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
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Total Items',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey,
                        ),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _totalItemsController,
                        keyboardType: const TextInputType.numberWithOptions(
                          signed: false,
                          decimal: false,
                        ),
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                        ],
                        decoration: InputDecoration(
                          hintText: 'e.g. 50',
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
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 24),
            _buildStepHeader(4, 'Detected Subject & Main Topics'),
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                border: Border.all(color: const Color(0xFFFECACA)),
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
            ...((_uploadResult!['topics'] as List).asMap().entries.map((entry) {
              final index = entry.key;
              final topic = entry.value;
              return Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: _topicSelected.length > index && _topicSelected[index]
                      ? const Color(0xFFF0FDF4)
                      : Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Row(
                  children: [
                    Checkbox(
                      value: _topicSelected.length > index
                          ? _topicSelected[index]
                          : false,
                      activeColor: primaryColor,
                      onChanged: (v) {
                        setState(() {
                          if (_topicSelected.length > index) {
                            _topicSelected[index] = v ?? false;
                          }
                        });
                      },
                    ),
                    Expanded(
                      child: Text(
                        topic['name'],
                        style: const TextStyle(
                          fontSize: 13,
                          color: Color(0xFF1A1A1A),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(
                      width: 70,
                      child: TextField(
                        controller: _topicHoursControllers.length > index
                            ? _topicHoursControllers[index]
                            : TextEditingController(text: '3.0'),
                        keyboardType: const TextInputType.numberWithOptions(
                          signed: false,
                          decimal: true,
                        ),
                        decoration: InputDecoration(
                          hintText: 'hrs',
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 8,
                          ),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(6),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
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
              );
            })),

            const SizedBox(height: 24),
            const Text(
              'Tap the button below once you have configured parameters to generate the TOS matrix.',
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed:
                    (_generating ||
                        _totalItemsController.text.isEmpty ||
                        _selectedQuestionTypes.isEmpty ||
                        _uploadResult == null ||
                        _topicSelected.where((v) => v).isEmpty)
                    ? null
                    : _handleGenerate,
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryColor,
                  foregroundColor: Colors.white,
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
                            'Generating TOS and questions...',
                            style: TextStyle(color: Colors.white),
                          ),
                        ],
                      )
                    : const Text(
                        'Generate TOS & Questions',
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
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDF4),
                border: Border.all(color: const Color(0xFFBBF7D0)),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '✓ Table of Specifications & Question Sheets Matrix Saved',
                    style: TextStyle(
                      color: Color(0xFF166534),
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Items successfully saved inside the primary Question Bank registry rows.',
                    style: TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                  const SizedBox(height: 16),

                  // Download Buttons Row matched to React version
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.blue.shade600,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(6),
                          ),
                          elevation: 1,
                        ),
                        onPressed: () => _downloadFile('tos'),
                        child: const Text(
                          'Download Institutional TOS (.xlsx)',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.purple.shade600,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(6),
                          ),
                          elevation: 1,
                        ),
                        onPressed: () => _downloadFile('assessment/docx'),
                        child: const Text(
                          'Download Test (.docx)',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.red.shade600,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(6),
                          ),
                          elevation: 1,
                        ),
                        onPressed: () => _downloadFile('assessment/pdf'),
                        child: const Text(
                          'Download Test (.pdf)',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 24),

                  // Web-styled TOS Summary Card
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      border: Border.all(color: Colors.grey.shade200),
                      borderRadius: BorderRadius.circular(8),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.03),
                          blurRadius: 4,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Table of Specifications Summary',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.black87,
                                    ),
                                  ),
                                  SizedBox(height: 4),
                                  Text(
                                    'This summary reflects the topic distribution, Bloom\'s taxonomy weights, and item counts used to generate the assessment.',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: Colors.grey,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 12),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                const Text(
                                  'Total Generated Questions',
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: Colors.grey,
                                  ),
                                ),
                                Text(
                                  '${_generationResult!['total_questions']}',
                                  style: const TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF15803D),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),

                        // Render each topic block
                        ...(_generationResult!['tos'] as List).map(
                          (row) => Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.grey.shade50,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.grey.shade200),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            row['topic'],
                                            style: const TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.bold,
                                              color: Colors.black87,
                                            ),
                                          ),
                                          if (row['ilo'] != null &&
                                              row['ilo']
                                                  .toString()
                                                  .isNotEmpty) ...[
                                            const SizedBox(height: 4),
                                            Text(
                                              row['ilo'],
                                              style: const TextStyle(
                                                fontSize: 11,
                                                color: Colors.grey,
                                              ),
                                            ),
                                          ] else ...[
                                            const SizedBox(height: 4),
                                            const Text(
                                              'No ILO provided',
                                              style: TextStyle(
                                                fontSize: 11,
                                                color: Colors.grey,
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'Items: ${row['total_items']}',
                                          style: const TextStyle(
                                            fontSize: 11,
                                            color: Colors.black87,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          'Weight: ${row['weight']}%',
                                          style: const TextStyle(
                                            fontSize: 11,
                                            color: Colors.black87,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),

                                // Bloom's breakdown grid styled like web
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  children:
                                      (row['bloom_breakdown']
                                              as Map<String, dynamic>)
                                          .entries
                                          .map(
                                            (entry) => Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                    horizontal: 10,
                                                    vertical: 6,
                                                  ),
                                              decoration: BoxDecoration(
                                                color: Colors.white,
                                                border: Border.all(
                                                  color: Colors.grey.shade200,
                                                ),
                                                borderRadius:
                                                    BorderRadius.circular(6),
                                              ),
                                              child: Column(
                                                children: [
                                                  Text(
                                                    entry.key,
                                                    style: const TextStyle(
                                                      fontSize: 10,
                                                      fontWeight:
                                                          FontWeight.bold,
                                                      color: Colors.black87,
                                                    ),
                                                  ),
                                                  const SizedBox(height: 2),
                                                  Text(
                                                    '${entry.value['total']} item${entry.value['total'] == 1 ? '' : 's'}',
                                                    style: const TextStyle(
                                                      fontSize: 10,
                                                      color: Colors.grey,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          )
                                          .toList(),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // ─── ADDED: Generated Questions Preview Block ────────────────
                  const SizedBox(height: 24),
                  const Text(
                    'GENERATED PREVIEW SEGMENTED BY COGNITIVE TAXONOMY TIER',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: Colors.grey,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      border: Border.all(color: Colors.grey.shade200),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Column(
                      children: [
                        // Horizontal Bloom's Level Tabs
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.grey.shade50,
                            borderRadius: const BorderRadius.vertical(
                              top: Radius.circular(8),
                            ),
                            border: Border(
                              bottom: BorderSide(color: Colors.grey.shade200),
                            ),
                          ),
                          child: SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            physics: const BouncingScrollPhysics(),
                            child: Row(
                              children: _bloomsLevels.map((level) {
                                final count =
                                    ((_generationResult!['questions_preview'] ??
                                                [])
                                            as List)
                                        .where((q) => q['bloom_level'] == level)
                                        .length;
                                final isSelected = _previewBloomTab == level;

                                return InkWell(
                                  onTap: () =>
                                      setState(() => _previewBloomTab = level),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 16,
                                      vertical: 12,
                                    ),
                                    decoration: BoxDecoration(
                                      color: isSelected
                                          ? Colors.white
                                          : Colors.transparent,
                                      border: Border(
                                        bottom: BorderSide(
                                          color: isSelected
                                              ? primaryColor
                                              : Colors.transparent,
                                          width: 2,
                                        ),
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        Text(
                                          level,
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: isSelected
                                                ? FontWeight.bold
                                                : FontWeight.w500,
                                            color: isSelected
                                                ? primaryColor
                                                : Colors.grey.shade600,
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 6,
                                            vertical: 2,
                                          ),
                                          decoration: BoxDecoration(
                                            color: Colors.grey.shade200,
                                            borderRadius: BorderRadius.circular(
                                              12,
                                            ),
                                          ),
                                          child: Text(
                                            '$count',
                                            style: TextStyle(
                                              fontSize: 10,
                                              color: Colors.grey.shade700,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              }).toList(),
                            ),
                          ),
                        ),
                        // Questions List Preview
                        Container(
                          padding: const EdgeInsets.all(16),
                          height: 320,
                          child: ListView(
                            physics: const BouncingScrollPhysics(),
                            children:
                                ((_generationResult!['questions_preview'] ?? [])
                                        as List)
                                    .where(
                                      (q) =>
                                          q['bloom_level'] == _previewBloomTab,
                                    )
                                    .map((q) {
                                      return Container(
                                        margin: const EdgeInsets.only(
                                          bottom: 12,
                                        ),
                                        padding: const EdgeInsets.all(12),
                                        decoration: BoxDecoration(
                                          color: Colors.grey.shade50,
                                          borderRadius: BorderRadius.circular(
                                            8,
                                          ),
                                          border: Border.all(
                                            color: Colors.grey.shade200,
                                          ),
                                        ),
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              mainAxisAlignment:
                                                  MainAxisAlignment
                                                      .spaceBetween,
                                              children: [
                                                Expanded(
                                                  child: RichText(
                                                    text: TextSpan(
                                                      text:
                                                          'Syllabus Reference: ',
                                                      style: const TextStyle(
                                                        fontSize: 10,
                                                        color: Colors.grey,
                                                      ),
                                                      children: [
                                                        TextSpan(
                                                          text: q['topic_name'],
                                                          style:
                                                              const TextStyle(
                                                                fontWeight:
                                                                    FontWeight
                                                                        .bold,
                                                                color: Colors
                                                                    .black87,
                                                              ),
                                                        ),
                                                      ],
                                                    ),
                                                    overflow:
                                                        TextOverflow.ellipsis,
                                                  ),
                                                ),
                                                Container(
                                                  padding:
                                                      const EdgeInsets.symmetric(
                                                        horizontal: 6,
                                                        vertical: 2,
                                                      ),
                                                  decoration: BoxDecoration(
                                                    color: const Color(
                                                      0xFFFEF2F2,
                                                    ),
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                          4,
                                                        ),
                                                  ),
                                                  child: Text(
                                                    q['type']
                                                        .toString()
                                                        .toUpperCase(),
                                                    style: const TextStyle(
                                                      fontSize: 9,
                                                      fontWeight:
                                                          FontWeight.bold,
                                                      color: Color(0xFF991B1B),
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 8),
                                            Text(
                                              q['question'],
                                              style: const TextStyle(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w500,
                                                color: Colors.black87,
                                              ),
                                            ),
                                            const SizedBox(height: 8),
                                            Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                    horizontal: 8,
                                                    vertical: 4,
                                                  ),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFFF0FDF4),
                                                borderRadius:
                                                    BorderRadius.circular(4),
                                                border: Border.all(
                                                  color: const Color(
                                                    0xFFBBF7D0,
                                                  ),
                                                ),
                                              ),
                                              child: Text(
                                                '✓ Answer Key: ${q['correct_answer']}',
                                                style: const TextStyle(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.bold,
                                                  color: Color(0xFF166534),
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      );
                                    })
                                    .toList(),
                          ),
                        ),
                      ],
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

  // ─── Helper UI Widgets ───────────────────────────────────────────────────────
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
          color: file != null ? const Color(0xFF86EFAC) : Colors.grey.shade300,
        ),
        borderRadius: BorderRadius.circular(10),
        color: file != null ? const Color(0xFFF0FDF4) : Colors.white,
      ),
      child: Column(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: file != null ? const Color(0xFFDCFCE7) : iconBgColor,
              shape: BoxShape.circle,
            ),
            child: Icon(
              file != null ? Icons.check : icon,
              color: file != null ? const Color(0xFF16A34A) : iconColor,
              size: 26,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            file ?? subtitle,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 11,
              color: file != null ? const Color(0xFF16A34A) : Colors.grey,
              fontWeight: file != null ? FontWeight.bold : FontWeight.normal,
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
                          ? const Color(0xFF16A34A)
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
                          ? const Color(0xFF16A34A)
                          : const Color(0xFF1565C0),
                    ),
                  ),
                )
              : ElevatedButton(
                  onPressed: onTap,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: file != null
                        ? const Color(0xFF16A34A)
                        : primaryColor,
                    foregroundColor: Colors.white,
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
