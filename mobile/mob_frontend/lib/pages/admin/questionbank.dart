import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:typed_data';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:mob_frontend/config/api_config.dart'; // adjust path/package name
import 'package:mob_frontend/utils/theme_constants.dart';
import 'package:mob_frontend/widgets/shimmer_box.dart';
import '../../utils/web_downloader_stub.dart'
    if (dart.library.html) '../../utils/web_downloader_html.dart'
    as web_downloader;
import 'account.dart'; // IMPORT THE ACCOUNT BAR

const List<Map<String, dynamic>> bloomsLevels = [
  {'name': 'Remember', 'color': Color(0xFF4B5563)}, // Clean modern colors for taxonomy
  {'name': 'Understand', 'color': Color(0xFF3B82F6)},
  {'name': 'Apply', 'color': Color(0xFF10B981)},
  {'name': 'Analyze', 'color': Color(0xFFF59E0B)},
  {'name': 'Evaluate', 'color': Color(0xFF6366F1)},
  {'name': 'Create', 'color': Color(0xFF8B5CF6)},
];

class AdminQuestionBankPage extends StatefulWidget {
  const AdminQuestionBankPage({super.key});
  @override
  State<AdminQuestionBankPage> createState() => _AdminQuestionBankPageState();
}

class _AdminQuestionBankPageState extends State<AdminQuestionBankPage>
    with TickerProviderStateMixin {
  late TabController _tabController;
  late final AnimationController _shimmerController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  )..repeat();

  List<dynamic> _subjects = [];
  String? _selectedSubjectId;
  List<dynamic> _questions = [];
  bool _loadingQuestions = false;
  bool _isGeneratingAssessment = false;
  bool _showImportBankPanel = false;
  bool _importingBank = false;
  Uint8List? _moduleFileBytes;
  String? _moduleFileName;
  Uint8List? _syllabusFileBytes;
  String? _syllabusFileName;
  final Set<int> _selectedQuestionIds = {};

  final TextEditingController _newQuestionController = TextEditingController();
  final TextEditingController _newAnswerController = TextEditingController();
  String _newQuestionType = 'MCQ';

  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: bloomsLevels.length, vsync: this);
    _fetchSubjects();
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    _tabController.dispose();
    _searchController.dispose();
    _newQuestionController.dispose();
    _newAnswerController.dispose();
    super.dispose();
  }

  Future<void> _fetchSubjects() async {
    try {
      final res = await http.get(Uri.parse('${ApiConfig.baseUrl}/subjects'));
      if (res.statusCode == 200) {
        setState(() {
          _subjects = jsonDecode(res.body);
        });
      }
    } catch (e) {
      debugPrint('Error fetching subjects: $e');
    }
  }

  Future<void> _fetchQuestions(String subjectId) async {
    setState(() {
      _loadingQuestions = true;
      _questions = [];
    });
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/questions?subject_id=$subjectId'),
      );
      if (res.statusCode == 200) {
        setState(() {
          _questions = jsonDecode(res.body);
        });
      }
    } catch (e) {
      debugPrint('Error fetching questions: $e');
    } finally {
      setState(() => _loadingQuestions = false);
    }
  }

  bool _matchesSearch(dynamic q) {
    if (_searchQuery.isEmpty) return true;
    final query = _searchQuery.toLowerCase();
    final questionText = (q['question']?.toString() ?? '').toLowerCase();
    return questionText.contains(query);
  }

  List<dynamic> _questionsByLevel(String level) => _questions
      .where((q) => q['bloom_level'] == level && _matchesSearch(q))
      .toList();

  int _countByLevel(String level) => _questions
      .where((q) => q['bloom_level'] == level)
      .length;

  Widget _buildImportBankCard({
    required String title,
    required String subtitle,
    required String? fileName,
    required IconData icon,
    required Color iconBgColor,
    required Color iconColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: kBorderColor),
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: iconBgColor,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: iconColor, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Color(0xFF1A1A1A))),
                  const SizedBox(height: 4),
                  Text(subtitle, style: const TextStyle(fontSize: 12, color: Colors.black54)),
                  if (fileName != null && fileName.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(fileName, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: kAccentOrange), overflow: TextOverflow.ellipsis),
                  ],
                ],
              ),
            ),
            const Icon(Icons.add_circle_outline, size: 20, color: Colors.black54),
          ],
        ),
      ),
    );
  }

  Future<void> _pickBankFile({required bool isModule}) async {
    try {
      final result = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: isModule ? ['pdf', 'pptx', 'ppt', 'docx'] : ['pdf', 'docx', 'xlsx', 'xls'],
        withData: true,
        allowMultiple: false,
      );

      if (result == null || result.files.isEmpty) return;

      if (!mounted) return;

      final file = result.files.first;
      final bytes = file.bytes;
      if (bytes == null) {
        if (!mounted) return;
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not read the selected file. Please try again.')));
        return;
      }

      setState(() {
        if (isModule) {
          _moduleFileBytes = Uint8List.fromList(bytes);
          _moduleFileName = file.name;
        } else {
          _syllabusFileBytes = Uint8List.fromList(bytes);
          _syllabusFileName = file.name;
        }
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error picking file: $e')));
    }
  }

  Future<void> _applyImportedBank() async {
    if (_selectedSubjectId == null || _selectedSubjectId!.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please select a subject before importing the bank files.')));
      return;
    }

    if (_moduleFileBytes == null || _syllabusFileBytes == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please select both module and syllabus files.')));
      return;
    }

    setState(() => _importingBank = true);

    try {
      final uri = Uri.parse('${ApiConfig.baseUrl}/upload');
      final request = http.MultipartRequest('POST', uri);
      request.fields['subject_id'] = _selectedSubjectId!;
      request.files.add(http.MultipartFile.fromBytes('module_file', _moduleFileBytes!, filename: _moduleFileName!));
      request.files.add(http.MultipartFile.fromBytes('syllabus_file', _syllabusFileBytes!, filename: _syllabusFileName!));

      final streamed = await request.send();
      final res = await http.Response.fromStream(streamed);
      if (!mounted) return;
      if (res.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Bank files uploaded successfully')));
        setState(() {
          _showImportBankPanel = false;
          _moduleFileBytes = null;
          _moduleFileName = null;
          _syllabusFileBytes = null;
          _syllabusFileName = null;
        });
      } else {
        final responseBody = res.body.trim();
        final message = responseBody.isNotEmpty ? 'Upload failed (${res.statusCode}): $responseBody' : 'Upload failed (${res.statusCode})';
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
      }
    } catch (e) {
      debugPrint('Import bank error: $e');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Import failed: $e')));
    } finally {
      if (mounted) setState(() => _importingBank = false);
    }
  }

  void _showEditQuestionDialog(dynamic question) {
    final questionController = TextEditingController(text: question['question']?.toString() ?? '');
    final answerController = TextEditingController(text: question['correct_answer']?.toString() ?? '');
    final String existingExplanation = question['explanation']?.toString() ?? 'No explanation provided.';
    String selectedBloomLevel = question['bloom_level'] ?? 'Remember';
    bool saving = false;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('Edit Question & Taxonomy', style: TextStyle(fontFamily: 'Georgia', fontWeight: FontWeight.bold)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Bloom\'s Taxonomy Level', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: selectedBloomLevel,
                  items: bloomsLevels.map((level) => DropdownMenuItem<String>(value: level['name'] as String, child: Text(level['name'] as String))).toList(),
                  onChanged: (val) {
                    if (val != null) setDialogState(() => selectedBloomLevel = val);
                  },
                  decoration: InputDecoration(border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: kBorderColor))),
                ),
                const SizedBox(height: 16),
                const Text('Question Text', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                const SizedBox(height: 8),
                TextField(
                  controller: questionController,
                  maxLines: 3,
                  decoration: InputDecoration(border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: kBorderColor))),
                ),
                const SizedBox(height: 16),
                const Text('Correct Answer', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                const SizedBox(height: 8),
                TextField(
                  controller: answerController,
                  decoration: InputDecoration(border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: kBorderColor))),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: saving ? null : () => Navigator.pop(dialogContext),
              child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: kDarkButtonColor, elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
              onPressed: saving
                  ? null
                  : () async {
                      setDialogState(() => saving = true);
                      await _updateQuestion(question['id'], questionController.text, answerController.text, selectedBloomLevel, existingExplanation);
                      if (dialogContext.mounted) Navigator.pop(dialogContext);
                    },
              child: saving ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : const Text('Save Changes', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _deleteQuestion(dynamic id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Delete Question', style: TextStyle(fontFamily: 'Georgia', fontWeight: FontWeight.bold)),
        content: const Text('Are you sure you want to delete this question?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel', style: TextStyle(color: Colors.grey))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red, elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    try {
      final res = await http.delete(Uri.parse('${ApiConfig.baseUrl}/questions/$id'));
      if (!mounted) return;
      if (res.statusCode == 200) {
        setState(() {
          _questions.removeWhere((q) => q['id'] == id);
          _selectedQuestionIds.remove(id);
        });
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Question deleted')));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Delete failed (${res.statusCode})')));
      }
    } catch (e) {
      debugPrint('Delete error: $e');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Network error')));
    }
  }

  Future<void> _showAddQuestionDialog() async {
    _newQuestionController.clear();
    _newAnswerController.clear();
    _newQuestionType = 'MCQ';

    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Add Question', style: TextStyle(fontFamily: 'Georgia', fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: _newQuestionController,
                maxLines: 4,
                decoration: InputDecoration(labelText: 'Question', border: OutlineInputBorder(borderRadius: BorderRadius.circular(12))),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _newAnswerController,
                decoration: InputDecoration(labelText: 'Correct Answer', border: OutlineInputBorder(borderRadius: BorderRadius.circular(12))),
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: _newQuestionType,
                items: ['MCQ', 'Short Answer', 'Essay'].map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
                onChanged: (v) => _newQuestionType = v ?? 'MCQ',
                decoration: InputDecoration(labelText: 'Question Type', border: OutlineInputBorder(borderRadius: BorderRadius.circular(12))),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel', style: TextStyle(color: Colors.grey))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: kDarkButtonColor, elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
            onPressed: () async {
              final qText = _newQuestionController.text.trim();
              if (qText.isEmpty || _selectedSubjectId == null) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter question and select subject')));
                return;
              }
              Navigator.pop(ctx);
              await _addQuestion(qText, _newAnswerController.text.trim(), _newQuestionType);
            },
            child: const Text('Add Question', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Future<void> _addQuestion(String qText, String answer, String type) async {
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/questions/manual'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'question': qText, 'question_type': type, 'subject_id': int.parse(_selectedSubjectId!)}),
      );
      if (!mounted) return;
      if (res.statusCode == 201 || res.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Question added')));
        if (_selectedSubjectId != null) _fetchQuestions(_selectedSubjectId!);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Add failed (${res.statusCode})')));
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Network error')));
    }
  }

  Future<void> _importBank() async {
    setState(() => _showImportBankPanel = !_showImportBankPanel);
  }

  Future<void> _generateAssessmentExport() async {
    if (_isGeneratingAssessment) return;
    if (_selectedQuestionIds.isEmpty || _selectedSubjectId == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Select questions first')));
      return;
    }

    setState(() => _isGeneratingAssessment = true);

    try {
      final uri = Uri.parse('${ApiConfig.baseUrl}/questions/export');
      final request = http.MultipartRequest('POST', uri);
      request.fields['subject_id'] = _selectedSubjectId!;
      request.fields['question_ids'] = _selectedQuestionIds.join(',');
      request.fields['export_format'] = 'pdf';

      final streamed = await request.send();
      if (!mounted) return;
      if (streamed.statusCode != 200) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Export failed (${streamed.statusCode})')));
        return;
      }

      final bytes = await streamed.stream.toBytes();
      final cd = streamed.headers['content-disposition'] ?? '';
      final match = RegExp(r'filename=(?:"?)([^";]+)(?:"?)').firstMatch(cd);
      final filename = match != null ? match.group(1)! : 'assessment_${DateTime.now().millisecondsSinceEpoch}.pdf';

      if (kIsWeb) {
        web_downloader.downloadFileWeb(bytes, filename, 'application/pdf');
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Assessment downloaded')));
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Export failed')));
    } finally {
      if (mounted) setState(() => _isGeneratingAssessment = false);
    }
  }

  Future<void> _updateQuestion(dynamic id, String qText, String answer, String bloom, String explanation) async {
    final String payload = jsonEncode({'question': qText, 'correct_answer': answer, 'bloom_level': bloom, 'explanation': explanation});
    try {
      final res = await http.put(
        Uri.parse('${ApiConfig.baseUrl}/questions/$id'),
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        encoding: utf8,
        body: payload,
      );

      if (!mounted) return;
      if (res.statusCode == 200) {
        setState(() {
          final index = _questions.indexWhere((q) => q['id'] == id);
          if (index != -1) {
            _questions[index]['question'] = qText;
            _questions[index]['correct_answer'] = answer;
            _questions[index]['bloom_level'] = bloom;
            _questions[index]['explanation'] = explanation;
          }
        });
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Taxonomy & Question updated!')));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error ${res.statusCode}: Check console')));
      }
    } catch (e) {
      debugPrint('Network exception: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kLightBgColor,
      body: Stack(
        children: [
          NestedScrollView(
            headerSliverBuilder: (BuildContext context, bool innerBoxIsScrolled) {
              return <Widget>[
                // --- INJECTED ACCOUNT TOP BAR ---
                const SliverAppBar(
                  floating: true,
                  pinned: true,
                  backgroundColor: Colors.white,
                  elevation: 0,
                  titleSpacing: 0,
                  title: AccountTopBar(),
                  bottom: PreferredSize(
                    preferredSize: Size.fromHeight(1),
                    child: Divider(height: 1, color: kBorderColor, thickness: 1),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
                  sliver: SliverList(
                    delegate: SliverChildListDelegate([
                      const Text(
                        'Question Bank',
                        style: TextStyle(fontFamily: 'Georgia', fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF1A1A1A)),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Browse, create, and manage exam questions by subject and level.',
                        style: TextStyle(color: Colors.grey, fontSize: 14),
                      ),
                      const SizedBox(height: 24),

                      // Analytics Cards - Flatter style
                      Row(
                        children: [
                          Expanded(
                            child: _AnalyticsCard(
                              icon: Icons.library_books_rounded,
                              label: 'Total questions',
                              value: _selectedSubjectId != null ? '${_questions.length}' : '—',
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _AnalyticsCard(
                              icon: Icons.pending_actions_rounded,
                              label: 'Ready for review',
                              value: _selectedSubjectId != null ? '${_questions.where((q) => (q['explanation']?.toString() ?? '').trim().isEmpty).length}' : '—',
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _AnalyticsCard(
                              icon: Icons.psychology_rounded,
                              label: 'High-order items',
                              value: _selectedSubjectId != null ? '${_questions.where((q) => const ['Analyze', 'Evaluate', 'Create'].contains(q['bloom_level'])).length}' : '—',
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),

                      // Subject Dropdown
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: kBorderColor, width: 1.5),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            isExpanded: true,
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                            value: _selectedSubjectId,
                            icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Colors.black87),
                            hint: const Text('Select a subject...', style: TextStyle(color: Colors.grey, fontSize: 15)),
                            items: _subjects.map<DropdownMenuItem<String>>((s) {
                              return DropdownMenuItem(value: s['id'].toString(), child: Text(s['name'].toString(), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)));
                            }).toList(),
                            onChanged: (val) {
                              if (val != null) {
                                setState(() {
                                  _selectedSubjectId = val;
                                  _searchController.clear();
                                  _searchQuery = '';
                                });
                                _fetchQuestions(val);
                              }
                            },
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      if (_selectedSubjectId != null) ...[
                        Row(
                          children: [
                            ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: kDarkButtonColor,
                                foregroundColor: Colors.white,
                                elevation: 0,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
                              ),
                              onPressed: _showAddQuestionDialog,
                              icon: const Icon(Icons.add, size: 18),
                              label: const Text('Add Question'),
                            ),
                            const SizedBox(width: 12),
                            OutlinedButton.icon(
                              onPressed: _importBank,
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(color: kBorderColor),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
                              ),
                              icon: const Icon(Icons.upload_file, size: 18, color: Colors.black87),
                              label: const Text('Import Bank', style: TextStyle(color: Colors.black87)),
                            ),
                          ],
                        ),
                        if (_showImportBankPanel) ...[
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: kBorderColor),
                            ),
                            child: Column(
                              children: [
                                _buildImportBankCard(
                                  title: 'Module File',
                                  subtitle: 'Pick the lesson/module file',
                                  fileName: _moduleFileName,
                                  icon: Icons.upload_file_rounded,
                                  iconBgColor: const Color(0xFFFFE5E5),
                                  iconColor: kAccentOrange,
                                  onTap: () => _pickBankFile(isModule: true),
                                ),
                                const SizedBox(height: 12),
                                _buildImportBankCard(
                                  title: 'Syllabus File',
                                  subtitle: 'Pick the syllabus/curriculum file',
                                  fileName: _syllabusFileName,
                                  icon: Icons.description_outlined,
                                  iconBgColor: const Color(0xFFE8F0FE),
                                  iconColor: const Color(0xFF1565C0),
                                  onTap: () => _pickBankFile(isModule: false),
                                ),
                                const SizedBox(height: 16),
                                SizedBox(
                                  width: double.infinity,
                                  child: ElevatedButton(
                                    onPressed: (_importingBank || _selectedSubjectId == null || _selectedSubjectId!.isEmpty || _moduleFileBytes == null || _syllabusFileBytes == null)
                                        ? null
                                        : _applyImportedBank,
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: kDarkButtonColor,
                                      foregroundColor: Colors.white,
                                      disabledBackgroundColor: Colors.grey.shade300,
                                      padding: const EdgeInsets.symmetric(vertical: 16),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                    ),
                                    child: _importingBank
                                        ? const Row(
                                            mainAxisAlignment: MainAxisAlignment.center,
                                            children: [
                                              SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)),
                                              SizedBox(width: 10),
                                              Text('Applying import...'),
                                            ],
                                          )
                                        : const Text('Apply Selected Files'),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                        const SizedBox(height: 16),
                      ],

                      TextField(
                        controller: _searchController,
                        onChanged: (val) => setState(() => _searchQuery = val),
                        decoration: InputDecoration(
                          hintText: 'Search questions...',
                          hintStyle: const TextStyle(color: Colors.grey, fontSize: 14),
                          prefixIcon: const Icon(Icons.search, color: Colors.grey, size: 20),
                          filled: true,
                          fillColor: Colors.white,
                          contentPadding: const EdgeInsets.symmetric(vertical: 16),
                          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: kBorderColor)),
                          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: kAccentOrange)),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ]),
                  ),
                ),
                if (_selectedSubjectId != null)
                  SliverPersistentHeader(
                    pinned: true,
                    delegate: _SliverAppBarDelegate(
                      minHeight: 60.0,
                      maxHeight: 60.0,
                      child: Container(
                        color: kLightBgColor,
                        padding: const EdgeInsets.symmetric(horizontal: 24.0),
                        child: Row(
                          children: [
                            Expanded(
                              child: TabBar(
                                controller: _tabController,
                                isScrollable: true,
                                labelColor: kAccentOrange,
                                unselectedLabelColor: Colors.grey.shade500,
                                indicatorColor: kAccentOrange,
                                indicatorWeight: 3,
                                tabAlignment: TabAlignment.start,
                                dividerColor: kBorderColor,
                                tabs: bloomsLevels.map<Widget>((level) {
                                  final count = _countByLevel(level['name']);
                                  return Tab(
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Text(level['name'], style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                                        const SizedBox(width: 8),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                          decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(12)),
                                          child: Text('$count', style: const TextStyle(fontSize: 11, color: Colors.black54)),
                                        ),
                                      ],
                                    ),
                                  );
                                }).toList(),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ];
            },
            body: _selectedSubjectId != null
                ? Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24.0),
                    child: _loadingQuestions
                        ? TabBarView(
                            controller: _tabController,
                            children: bloomsLevels.map<Widget>((level) {
                              return ListView.builder(
                                padding: const EdgeInsets.only(top: 12, bottom: 80),
                                itemCount: 4,
                                itemBuilder: (context, index) => _ShimmerQuestionCard(shimmerController: _shimmerController),
                              );
                            }).toList(),
                          )
                        : TabBarView(
                            controller: _tabController,
                            children: bloomsLevels.map<Widget>((level) {
                              final levelQs = _questionsByLevel(level['name']);
                              if (levelQs.isEmpty) {
                                return const Center(child: Text('No questions match your criteria.', style: TextStyle(color: Colors.grey)));
                              }
                              return ListView.builder(
                                padding: const EdgeInsets.only(top: 12, bottom: 100), // padding for bottom bar
                                itemCount: levelQs.length,
                                itemBuilder: (context, i) {
                                  return _QuestionCard(
                                    question: levelQs[i],
                                    levelColor: level['color'],
                                    onEdit: () => _showEditQuestionDialog(levelQs[i]),
                                    onDelete: () => _deleteQuestion(levelQs[i]['id']),
                                    isSelected: _selectedQuestionIds.contains(levelQs[i]['id']),
                                    onToggleSelect: (sel) {
                                      setState(() {
                                        if (sel) {
                                          _selectedQuestionIds.add(levelQs[i]['id']);
                                        } else {
                                          _selectedQuestionIds.remove(levelQs[i]['id']);
                                        }
                                      });
                                    },
                                  );
                                },
                              );
                            }).toList(),
                          ),
                  )
                : const Center(child: Text('Select a subject to begin.', style: TextStyle(color: Colors.grey))),
          ),
          _buildSelectionBar(),
        ],
      ),
    );
  }

  Widget _buildSelectionBar() {
    if (_selectedQuestionIds.isEmpty) return const SizedBox.shrink();
    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      child: Container(
        color: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        decoration: const BoxDecoration(border: Border(top: BorderSide(color: kBorderColor))),
        child: Row(
          children: [
            const Text('Selected: ', style: TextStyle(color: Colors.black54, fontSize: 16)),
            Text('${_selectedQuestionIds.length}', style: const TextStyle(color: kAccentOrange, fontWeight: FontWeight.bold, fontSize: 18)),
            const Spacer(),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: kDarkButtonColor,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: _isGeneratingAssessment ? null : _generateAssessmentExport,
              child: _isGeneratingAssessment
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Generate Assessment', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }
}

class _SliverAppBarDelegate extends SliverPersistentHeaderDelegate {
  _SliverAppBarDelegate({required this.minHeight, required this.maxHeight, required this.child});
  final double minHeight, maxHeight;
  final Widget child;
  @override double get minExtent => minHeight;
  @override double get maxExtent => maxHeight;
  @override Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) => SizedBox.expand(child: child);
  @override bool shouldRebuild(_SliverAppBarDelegate oldDelegate) => maxHeight != oldDelegate.maxHeight || minHeight != oldDelegate.minHeight || child != oldDelegate.child;
}

class _AnalyticsCard extends StatelessWidget {
  final String label, value;
  final IconData icon;

  const _AnalyticsCard({required this.label, required this.value, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: kBorderColor)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: kDarkButtonColor, size: 24),
          const SizedBox(height: 12),
          Text(label, style: const TextStyle(fontSize: 12, color: Colors.black54)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF1A1A1A))),
        ],
      ),
    );
  }
}

class _QuestionCard extends StatelessWidget {
  final dynamic question;
  final Color levelColor;
  final VoidCallback onEdit, onDelete;
  final bool? isSelected;
  final ValueChanged<bool>? onToggleSelect;

  const _QuestionCard({required this.question, required this.levelColor, required this.onEdit, required this.onDelete, this.isSelected, this.onToggleSelect});

  @override
  Widget build(BuildContext context) {
    final List<dynamic> options = question['options'] ?? ['A. Option', 'B. Option', 'C. Option', 'D. Option'];
    final bool active = isSelected ?? false;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: active ? kAccentOrange : kBorderColor, width: active ? 2 : 1),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onToggleSelect != null ? () => onToggleSelect?.call(!active) : null,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (onToggleSelect != null)
                    Padding(
                      padding: const EdgeInsets.only(right: 12.0, top: 2),
                      child: Container(
                        width: 20, height: 20,
                        decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: active ? kAccentOrange : Colors.grey.shade400, width: 2), color: active ? kAccentOrange : Colors.transparent),
                        child: active ? const Icon(Icons.check, size: 12, color: Colors.white) : null,
                      ),
                    ),
                  Expanded(
                    child: Text(
                      question['question']?.toString() ?? '',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(0xFF1A1A1A)),
                    ),
                  ),
                  const SizedBox(width: 16),
                  InkWell(onTap: onEdit, child: const Padding(padding: EdgeInsets.all(4), child: Icon(Icons.edit_outlined, color: Colors.grey, size: 20))),
                  const SizedBox(width: 8),
                  InkWell(onTap: onDelete, child: const Padding(padding: EdgeInsets.all(4), child: Icon(Icons.delete_outline, color: Colors.red, size: 20))),
                ],
              ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 8, runSpacing: 8,
                children: options.map((opt) => Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(color: Colors.grey.shade50, border: Border.all(color: kBorderColor), borderRadius: BorderRadius.circular(8)),
                  child: Text(opt.toString(), style: const TextStyle(fontSize: 13, color: Colors.black87)),
                )).toList(),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(color: levelColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
                    child: Text(question['bloom_level']?.toString() ?? 'Unknown', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: levelColor)),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ShimmerQuestionCard extends StatelessWidget {
  final AnimationController shimmerController;
  const _ShimmerQuestionCard({required this.shimmerController});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: shimmerController,
      builder: (context, child) {
        final shimmerOffset = shimmerController.value;
        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: kBorderColor)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              buildShimmerBox(double.infinity, 16, shimmerOffset),
              const SizedBox(height: 8),
              buildShimmerBox(200, 16, shimmerOffset),
              const SizedBox(height: 20),
              Row(children: [ buildShimmerBox(80, 24, shimmerOffset, radius: 8), const SizedBox(width: 8), buildShimmerBox(80, 24, shimmerOffset, radius: 8) ]),
            ],
          ),
        );
      },
    );
  }
}