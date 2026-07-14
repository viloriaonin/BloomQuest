import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'dart:typed_data';
import 'package:BloomQuest/config/api_config.dart'; // adjust path/package name
import '../../utils/web_downloader_stub.dart'
    if (dart.library.html) '../../utils/web_downloader_html.dart'
    as web_downloader;

// Colors based on your sidebar and screenshot
const kPrimary = Color(0xFF7B1113);
const kBg = Color(
  0xFFF9F9F9,
); // Slightly off-white background matching the image

const List<Map<String, dynamic>> bloomsLevels = [
  {'name': 'Remember', 'color': Color(0xFFEF4444)},
  {'name': 'Understand', 'color': Color(0xFFF43F5E)},
  {'name': 'Apply', 'color': Color(0xFFFB923C)},
  {'name': 'Analyze', 'color': Color(0xFF14B8A6)},
  {'name': 'Evaluate', 'color': Color(0xFF3B82F6)},
  {'name': 'Create', 'color': Color(0xFFA855F7)},
];

class AdminQuestionBankPage extends StatefulWidget {
  const AdminQuestionBankPage({super.key});

  @override
  State<AdminQuestionBankPage> createState() => _AdminQuestionBankPageState();
}

class _AdminQuestionBankPageState extends State<AdminQuestionBankPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  List<dynamic> _subjects = [];
  String? _selectedSubjectId;
  List<dynamic> _questions = [];
  bool _loadingSubjects = true;
  bool _loadingQuestions = false;
  Set<int> _selectedQuestionIds = {};

  // Add question form controllers
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
          _loadingSubjects = false;
        });
      }
    } catch (e) {
      debugPrint('Error fetching subjects: $e');
      setState(() => _loadingSubjects = false);
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
      .length; // Count ignores search to keep tabs static

  void _showEditQuestionDialog(dynamic question) {
    final questionController = TextEditingController(
      text: question['question']?.toString() ?? '',
    );
    final answerController = TextEditingController(
      text: question['correct_answer']?.toString() ?? '',
    );

    // Grab the existing explanation silently from the database data
    final String existingExplanation =
        question['explanation']?.toString() ?? 'No explanation provided.';

    String selectedBloomLevel = question['bloom_level'] ?? 'Remember';
    bool saving = false;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          backgroundColor: Colors.white,
          title: const Text(
            'Edit Question & Taxonomy',
            style: TextStyle(color: kPrimary),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Bloom\'s Taxonomy Level',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: selectedBloomLevel,
                  items: bloomsLevels.map((level) {
                    return DropdownMenuItem<String>(
                      value: level['name'] as String,
                      child: Text(level['name'] as String),
                    );
                  }).toList(),
                  onChanged: (val) {
                    if (val != null) {
                      setDialogState(() => selectedBloomLevel = val);
                    }
                  },
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Question Text',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: questionController,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Correct Answer',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: answerController,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                  ),
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
              style: ElevatedButton.styleFrom(backgroundColor: kPrimary),
              onPressed: saving
                  ? null
                  : () async {
                      setDialogState(() => saving = true);
                      await _updateQuestion(
                        question['id'],
                        questionController.text,
                        answerController.text,
                        selectedBloomLevel,
                        existingExplanation, // Pass the explanation here!
                      );
                      if (dialogContext.mounted) Navigator.pop(dialogContext);
                    },
              child: saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                  : const Text(
                      'Save Changes',
                      style: TextStyle(color: Colors.white),
                    ),
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
        title: const Text('Delete Question'),
        content: const Text('Are you sure you want to delete this question?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: kPrimary)),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    try {
      final res = await http.delete(
        Uri.parse('${ApiConfig.baseUrl}/questions/$id'),
      );
      if (res.statusCode == 200) {
        setState(() {
          _questions.removeWhere((q) => q['id'] == id);
          _selectedQuestionIds.remove(id);
        });
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Question deleted')));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Delete failed (${res.statusCode})')),
        );
      }
    } catch (e) {
      debugPrint('Delete error: $e');
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Network error')));
    }
  }

  Future<void> _showAddQuestionDialog() async {
    _newQuestionController.clear();
    _newAnswerController.clear();
    _newQuestionType = 'MCQ';

    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Question', style: TextStyle(color: kPrimary)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: _newQuestionController,
                maxLines: 4,
                decoration: const InputDecoration(labelText: 'Question'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _newAnswerController,
                decoration: const InputDecoration(labelText: 'Correct Answer'),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: _newQuestionType,
                items: ['MCQ', 'Short Answer', 'Essay']
                    .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                    .toList(),
                onChanged: (v) => _newQuestionType = v ?? 'MCQ',
                decoration: const InputDecoration(labelText: 'Question Type'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: kPrimary),
            onPressed: () async {
              final qText = _newQuestionController.text.trim();
              if (qText.isEmpty || _selectedSubjectId == null) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Please enter question and select subject'),
                  ),
                );
                return;
              }
              Navigator.pop(ctx);
              await _addQuestion(
                qText,
                _newAnswerController.text.trim(),
                _newQuestionType,
              );
            },
            child: const Text('Add'),
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
        body: jsonEncode({
          'question': qText,
          'question_type': type,
          'subject_id': int.parse(_selectedSubjectId!),
        }),
      );
      if (res.statusCode == 201 || res.statusCode == 200) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Question added')));
        if (_selectedSubjectId != null) _fetchQuestions(_selectedSubjectId!);
      } else {
        debugPrint('Add failed: ${res.statusCode} ${res.body}');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Add failed (${res.statusCode})')),
        );
      }
    } catch (e) {
      debugPrint('Add error: $e');
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Network error')));
    }
  }

  Future<void> _importBank() async {
    try {
      final result = await FilePicker.platform.pickFiles(allowMultiple: true);
      if (result == null || result.files.length < 2) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please pick module and syllabus files'),
          ),
        );
        return;
      }
      final module = result.files[0];
      final syllabus = result.files[1];

      final uri = Uri.parse('${ApiConfig.baseUrl}/upload');
      final request = http.MultipartRequest('POST', uri);
      request.files.add(
        http.MultipartFile.fromBytes(
          'module_file',
          module.bytes!,
          filename: module.name,
        ),
      );
      request.files.add(
        http.MultipartFile.fromBytes(
          'syllabus_file',
          syllabus.bytes!,
          filename: syllabus.name,
        ),
      );

      final streamed = await request.send();
      final res = await http.Response.fromStream(streamed);
      if (res.statusCode == 200) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Files uploaded')));
      } else {
        debugPrint('Upload failed ${res.statusCode} ${res.body}');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed (${res.statusCode})')),
        );
      }
    } catch (e) {
      debugPrint('Import error: $e');
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Import failed')));
    }
  }

  Future<void> _generateAssessmentExport() async {
    if (_selectedQuestionIds.isEmpty || _selectedSubjectId == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Select questions first')));
      return;
    }

    try {
      final uri = Uri.parse('${ApiConfig.baseUrl}/questions/export');
      final request = http.MultipartRequest('POST', uri);
      request.fields['subject_id'] = _selectedSubjectId!;
      request.fields['question_ids'] = _selectedQuestionIds.join(',');
      request.fields['export_format'] = 'pdf';

      final streamed = await request.send();
      if (streamed.statusCode != 200) {
        final text = await streamed.stream.bytesToString();
        debugPrint('Export failed: ${streamed.statusCode} $text');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Export failed (${streamed.statusCode})')),
        );
        return;
      }

      final bytes = await streamed.stream.toBytes();
      final cd = streamed.headers['content-disposition'] ?? '';
      final match = RegExp(r'filename=(?:"?)([^";]+)(?:"?)').firstMatch(cd);
      final filename = match != null
          ? match.group(1)!
          : 'assessment_${DateTime.now().millisecondsSinceEpoch}.pdf';

      if (kIsWeb) {
        web_downloader.downloadFileWeb(bytes, filename, 'application/pdf');
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Assessment downloaded')));
      }
    } catch (e) {
      debugPrint('Export error: $e');
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Export failed')));
    }
  }

  Future<void> _updateQuestion(
    dynamic id,
    String qText,
    String answer,
    String bloom,
    String explanation,
  ) async {
    final String payload = jsonEncode({
      'question': qText,
      'correct_answer': answer,
      'bloom_level': bloom,
      'explanation': explanation,
    });

    debugPrint('🚀 SENDING PAYLOAD TO PYTHON: $payload');

    try {
      final res = await http.put(
        Uri.parse('${ApiConfig.baseUrl}/questions/$id'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        encoding: utf8,
        body: payload,
      );

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
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Taxonomy & Question updated!')),
        );
      } else {
        debugPrint('❌ UPDATE FAILED. Status Code: ${res.statusCode}');
        debugPrint('❌ SERVER RESPONSE: ${res.body}');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error ${res.statusCode}: Check console')),
        );
      }
    } catch (e) {
      debugPrint('Network exception: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      body: Stack(
        children: [
          NestedScrollView(
            headerSliverBuilder: (BuildContext context, bool innerBoxIsScrolled) {
              return <Widget>[
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
                  sliver: SliverList(
                    delegate: SliverChildListDelegate([
                      // ── Header Section ──
                      const Text(
                        'QUESTION BANK',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: kPrimary,
                          letterSpacing: 0.6,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Manage exam questions and bank items',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1A1A1A),
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Browse, create, and manage exam questions by subject and level.',
                        style: TextStyle(color: Colors.grey, fontSize: 13),
                      ),
                      const SizedBox(height: 16),

                      // ── Analytics Cards ──
                      Row(
                        children: [
                          Expanded(
                            child: _AnalyticsCard(
                              label: 'Total questions',
                              value: _selectedSubjectId != null
                                  ? '${_questions.length}'
                                  : '—',
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _AnalyticsCard(
                              label: 'Ready for review',
                              value: _selectedSubjectId != null
                                  ? '${_questions.where((q) => (q['explanation']?.toString() ?? '').trim().isEmpty).length}'
                                  : '—',
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _AnalyticsCard(
                              label: 'High-order items',
                              value: _selectedSubjectId != null
                                  ? '${_questions.where((q) => const ['Analyze', 'Evaluate', 'Create'].contains(q['bloom_level'])).length}'
                                  : '—',
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),

                      // ── Subject Dropdown ──
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: kPrimary, width: 1.5),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            isExpanded: true,
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            value: _selectedSubjectId,
                            icon: const Icon(
                              Icons.arrow_drop_down,
                              color: Colors.grey,
                            ),
                            hint: const Text(
                              'Select a subject...',
                              style: TextStyle(
                                color: Colors.grey,
                                fontSize: 14,
                              ),
                            ),
                            items: _subjects.map<DropdownMenuItem<String>>((s) {
                              return DropdownMenuItem(
                                value: s['id'].toString(),
                                child: Text(
                                  s['name'].toString(),
                                  style: const TextStyle(fontSize: 14),
                                ),
                              );
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

                      // ── Add / Import Buttons ──
                      if (_selectedSubjectId != null) ...[
                        Row(
                          children: [
                            ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: kPrimary,
                                foregroundColor: Colors.white,
                              ),
                              onPressed: _showAddQuestionDialog,
                              icon: const Icon(Icons.add, size: 18),
                              label: const Text('Add Question'),
                            ),
                            const SizedBox(width: 8),
                            OutlinedButton.icon(
                              onPressed: _importBank,
                              icon: const Icon(Icons.upload_file, size: 18),
                              label: const Text('Import Bank'),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                      ],

                      // ── Search Bar ──
                      TextField(
                        controller: _searchController,
                        onChanged: (val) => setState(() => _searchQuery = val),
                        decoration: InputDecoration(
                          hintText: 'Search questions...',
                          hintStyle: const TextStyle(
                            color: Colors.grey,
                            fontSize: 14,
                          ),
                          prefixIcon: const Icon(
                            Icons.search,
                            color: Colors.grey,
                            size: 20,
                          ),
                          filled: true,
                          fillColor: Colors.white,
                          contentPadding: const EdgeInsets.symmetric(
                            vertical: 0,
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(6),
                            borderSide: BorderSide(color: Colors.grey.shade300),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(6),
                            borderSide: BorderSide(color: Colors.grey.shade400),
                          ),
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
                        color: kBg,
                        padding: const EdgeInsets.symmetric(horizontal: 24.0),
                        child: Row(
                          children: [
                            Expanded(
                              child: TabBar(
                                controller: _tabController,
                                isScrollable: true,
                                labelColor: kPrimary,
                                unselectedLabelColor: Colors.grey,
                                indicatorColor: kPrimary,
                                indicatorWeight: 3,
                                tabAlignment: TabAlignment.start,
                                dividerColor: Colors.grey.shade300,
                                tabs: bloomsLevels.map<Widget>((level) {
                                  final count = _countByLevel(level['name']);
                                  return Tab(
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Container(
                                          width: 8,
                                          height: 8,
                                          decoration: BoxDecoration(
                                            color: level['color'],
                                            shape: BoxShape.circle,
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Text(
                                          level['name'],
                                          style: const TextStyle(fontSize: 14),
                                        ),
                                        const SizedBox(width: 8),
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
                                            style: const TextStyle(
                                              fontSize: 11,
                                              color: Colors.black54,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  );
                                }).toList(),
                              ),
                            ),
                            // Maroon Download Button
                            Container(
                              margin: const EdgeInsets.only(left: 8),
                              decoration: BoxDecoration(
                                color: kPrimary,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: IconButton(
                                icon: const Icon(
                                  Icons.download,
                                  color: Colors.white,
                                  size: 20,
                                ),
                                onPressed: _generateAssessmentExport,
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
                        ? const Center(
                            child: CircularProgressIndicator(color: kPrimary),
                          )
                        : TabBarView(
                            controller: _tabController,
                            children: bloomsLevels.map<Widget>((level) {
                              final levelQs = _questionsByLevel(level['name']);
                              if (levelQs.isEmpty) {
                                return const Center(
                                  child: Text(
                                    'No questions match your criteria.',
                                    style: TextStyle(color: Colors.grey),
                                  ),
                                );
                              }
                              return ListView.builder(
                                padding: const EdgeInsets.only(
                                  top: 12,
                                  bottom: 80,
                                ),
                                itemCount: levelQs.length,
                                itemBuilder: (context, i) {
                                  return _QuestionCard(
                                    question: levelQs[i],
                                    levelColor: level['color'],
                                    onEdit: () =>
                                        _showEditQuestionDialog(levelQs[i]),
                                    onDelete: () =>
                                        _deleteQuestion(levelQs[i]['id']),
                                    isSelected: _selectedQuestionIds.contains(
                                      levelQs[i]['id'],
                                    ),
                                    onToggleSelect: (sel) {
                                      setState(() {
                                        if (sel) {
                                          _selectedQuestionIds.add(
                                            levelQs[i]['id'],
                                          );
                                        } else {
                                          _selectedQuestionIds.remove(
                                            levelQs[i]['id'],
                                          );
                                        }
                                      });
                                    },
                                  );
                                },
                              );
                            }).toList(),
                          ),
                  )
                : const Center(
                    child: Text(
                      'Select a subject to begin.',
                      style: TextStyle(color: Colors.grey),
                    ),
                  ),
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
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            const Text('Selected: ', style: TextStyle(color: Colors.black54)),
            Text(
              '${_selectedQuestionIds.length}',
              style: const TextStyle(
                color: kPrimary,
                fontWeight: FontWeight.bold,
              ),
            ),
            const Spacer(),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: kPrimary),
              onPressed: _generateAssessmentExport,
              child: Text(
                'Generate Assessment (${_selectedQuestionIds.length})',
                style: const TextStyle(color: Colors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Helper delegate for sliver tab header pinning behavior
class _SliverAppBarDelegate extends SliverPersistentHeaderDelegate {
  _SliverAppBarDelegate({
    required this.minHeight,
    required this.maxHeight,
    required this.child,
  });
  final double minHeight;
  final double maxHeight;
  final Widget child;

  @override
  double get minExtent => minHeight;
  @override
  double get maxExtent => maxHeight;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    return SizedBox.expand(child: child);
  }

  @override
  bool shouldRebuild(_SliverAppBarDelegate oldDelegate) {
    return maxHeight != oldDelegate.maxHeight ||
        minHeight != oldDelegate.minHeight ||
        child != oldDelegate.child;
  }
}

class _AnalyticsCard extends StatelessWidget {
  final String label;
  final String value;

  const _AnalyticsCard({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF9F9F9),
        border: Border.all(color: Colors.grey.shade200),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 11, color: Colors.black45),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1A1A1A),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuestionCard extends StatelessWidget {
  final dynamic question;
  final Color levelColor;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final bool? isSelected;
  final ValueChanged<bool>? onToggleSelect;

  const _QuestionCard({
    required this.question,
    required this.levelColor,
    required this.onEdit,
    required this.onDelete,
    this.isSelected,
    this.onToggleSelect,
  });

  @override
  Widget build(BuildContext context) {
    final List<dynamic> options =
        question['options'] ??
        ['A. Front-end', 'B. Middleware', 'C. Backend', 'D. Network'];

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (onToggleSelect != null)
                Padding(
                  padding: const EdgeInsets.only(right: 8.0, top: 2),
                  child: Checkbox(
                    value: isSelected ?? false,
                    activeColor: kPrimary,
                    onChanged: (v) => onToggleSelect?.call(v ?? false),
                  ),
                ),
              Expanded(
                child: Text(
                  question['question']?.toString() ?? '',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1A1A1A),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              InkWell(
                onTap: onEdit,
                child: const Icon(Icons.edit, color: Colors.grey, size: 18),
              ),
              const SizedBox(width: 16),
              InkWell(
                onTap: onDelete,
                child: Icon(
                  Icons.delete_outline,
                  color: Colors.red.shade400,
                  size: 18,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: options.map((opt) {
              return Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: Colors.grey.shade300),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  opt.toString(),
                  style: const TextStyle(fontSize: 13, color: Colors.black87),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: levelColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  question['bloom_level']?.toString() ?? 'Unknown',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: levelColor,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  'MCQ',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Colors.black54,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
