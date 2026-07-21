import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:BloomQuest/config/api_config.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:typed_data';
import '../../utils/file_saver_stub.dart'
    if (dart.library.io) '../../utils/file_saver_io.dart'
    as file_saver;
import 'web_download_stub.dart'
    if (dart.library.html) 'web_download_web.dart'
    as web_download;

// Use ApiConfig.baseUrl for environment-aware API URLs

const primaryColor = Color(0xFF7B1113);

const List<Map<String, dynamic>> bloomsLevels = [
  {'name': 'Remember', 'color': Color(0xFFEF4444)},
  {'name': 'Understand', 'color': Color(0xFFF43F5E)},
  {'name': 'Apply', 'color': Color(0xFFFB923C)},
  {'name': 'Analyze', 'color': Color(0xFF14B8A6)},
  {'name': 'Evaluate', 'color': Color(0xFF3B82F6)},
  {'name': 'Create', 'color': Color(0xFFA855F7)},
];

class QuestionBankPage extends StatefulWidget {
  const QuestionBankPage({super.key});

  @override
  State<QuestionBankPage> createState() => _QuestionBankPageState();
}

class _QuestionBankPageState extends State<QuestionBankPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  List<dynamic> _subjects = [];
  String? _selectedSubjectId;
  String? _selectedSubjectName;
  List<dynamic> _questions = [];
  bool _loadingSubjects = true;
  bool _loadingQuestions = false;
  bool _generating = false;
  String _error = '';

  // Track selected question IDs
  final Set<dynamic> _selectedQuestionIds = {};

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
      } else {
        setState(() {
          _error = 'Failed to load subjects.';
          _loadingSubjects = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Cannot connect to server.';
        _loadingSubjects = false;
      });
    }
  }

  Future<void> _fetchQuestions(String subjectId) async {
    setState(() {
      _loadingQuestions = true;
      _error = '';
      _questions = [];
      _selectedQuestionIds.clear(); // Clear selections when subject changes
    });
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/questions?subject_id=$subjectId'),
      );
      if (res.statusCode == 200) {
        setState(() {
          _questions = jsonDecode(res.body);
        });
      } else {
        setState(() {
          _error = 'Failed to load questions.';
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Cannot connect to server.';
      });
    } finally {
      setState(() {
        _loadingQuestions = false;
      });
    }
  }

  bool _matchesSearch(dynamic q) {
    if (_searchQuery.isEmpty) return true;
    final query = _searchQuery.toLowerCase();

    final questionText = (q['question'] ?? '').toString().toLowerCase();
    if (questionText.contains(query)) return true;

    final options = q['options'];
    if (options is List) {
      for (final opt in options) {
        if (opt.toString().toLowerCase().contains(query)) return true;
      }
    }

    return false;
  }

  List<dynamic> _questionsByLevel(String level) => _questions
      .where((q) => q['bloom_level'] == level && _matchesSearch(q))
      .toList();

  int _countByLevel(String level) => _questionsByLevel(level).length;

  // ── Generate Assessment ──────────────────────────────────────────────────

  void _showGenerateAssessmentSheet() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => SafeArea(
        child: Wrap(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
              child: const Text(
                'Generate Assessment',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Text(
                'Includes ${_selectedQuestionIds.length} selected question(s) + answer key',
                style: const TextStyle(fontSize: 12, color: Colors.grey),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.description, color: primaryColor),
              title: const Text('Word Document (.docx)'),
              onTap: () {
                Navigator.pop(context);
                _generateAssessment('docx');
              },
            ),
            ListTile(
              leading: const Icon(Icons.picture_as_pdf, color: primaryColor),
              title: const Text('PDF Document (.pdf)'),
              onTap: () {
                Navigator.pop(context);
                _generateAssessment('pdf');
              },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Future<void> _generateAssessment(String fileType) async {
    if (_selectedSubjectId == null || _selectedQuestionIds.isEmpty) return;

    setState(() {
      _generating = true;
      _error = '';
    });

    try {
      // Map selected IDs to pass them to your API query (e.g. ?question_ids=1,2,3)
      final idsParam = _selectedQuestionIds.join(',');
      final uri = Uri.parse(
        '${ApiConfig.baseUrl}/assessment/generate?subject_id=$_selectedSubjectId&file_type=$fileType&question_ids=$idsParam',
      );
      final res = await http.get(uri);

      if (res.statusCode == 200) {
        final safeName = (_selectedSubjectName ?? 'Assessment').replaceAll(
          RegExp(r'[^\w\s-]'),
          '',
        );
        final filename = '${safeName}_Assessment.$fileType';

        if (kIsWeb) {
          // Web: trigger a browser download directly, no filesystem access.
          web_download.downloadBytes(res.bodyBytes, filename);
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Assessment downloaded.')),
            );
          }
        } else {
          // Mobile/desktop: save to app documents dir and open it via helper
          await file_saver.saveAndOpenFile(res.bodyBytes, filename);
        }
      } else {
        setState(
          () => _error = 'Failed to generate assessment (${res.statusCode}).',
        );
      }
    } catch (e, stack) {
      debugPrint('Assessment generation error: $e');
      debugPrint('$stack');
      setState(() => _error = 'Error: $e');
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  // ── Edit / Delete Question ───────────────────────────────────────────────

  void _showEditQuestionDialog(dynamic question) {
    final questionController = TextEditingController(
      text: question['question'] ?? '',
    );
    final answerController = TextEditingController(
      text: question['correct_answer'] ?? '',
    );
    final explanationController = TextEditingController(
      text: question['explanation'] ?? '',
    );
    bool saving = false;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          title: const Text('Edit Question'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Question',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 4),
                TextField(
                  controller: questionController,
                  maxLines: 3,
                  style: const TextStyle(fontSize: 13),
                  decoration: _dialogFieldDecoration(),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Correct Answer',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 4),
                TextField(
                  controller: answerController,
                  maxLines: 2,
                  style: const TextStyle(fontSize: 13),
                  decoration: _dialogFieldDecoration(),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Explanation',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 4),
                TextField(
                  controller: explanationController,
                  maxLines: 3,
                  style: const TextStyle(fontSize: 13),
                  decoration: _dialogFieldDecoration(),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: saving ? null : () => Navigator.pop(dialogContext),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryColor,
                foregroundColor: Colors.white,
              ),
              onPressed: saving
                  ? null
                  : () async {
                      if (questionController.text.trim().isEmpty) return;
                      setDialogState(() => saving = true);
                      final success = await _updateQuestion(
                        question['id'],
                        questionController.text.trim(),
                        answerController.text.trim(),
                        explanationController.text.trim(),
                      );
                      if (dialogContext.mounted) Navigator.pop(dialogContext);
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              success
                                  ? 'Question updated.'
                                  : 'Failed to update question.',
                            ),
                          ),
                        );
                      }
                    },
              child: saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _dialogFieldDecoration() {
    return InputDecoration(
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6),
        borderSide: BorderSide(color: Colors.grey.shade300),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6),
        borderSide: BorderSide(color: Colors.grey.shade300),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6),
        borderSide: const BorderSide(color: primaryColor),
      ),
    );
  }

  Future<bool> _updateQuestion(
    dynamic questionId,
    String question,
    String correctAnswer,
    String explanation,
  ) async {
    try {
      final res = await http.put(
        Uri.parse('${ApiConfig.baseUrl}/questions/$questionId'),
        body: {
          'question': question,
          'correct_answer': correctAnswer,
          'explanation': explanation,
        },
      );

      if (res.statusCode == 200) {
        setState(() {
          final index = _questions.indexWhere((q) => q['id'] == questionId);
          if (index != -1) {
            _questions[index] = {
              ..._questions[index],
              'question': question,
              'correct_answer': correctAnswer,
              'explanation': explanation,
            };
          }
        });
        return true;
      }
      return false;
    } catch (e) {
      debugPrint('Update question error: $e');
      return false;
    }
  }

  void _confirmDeleteQuestion(dynamic question) {
    bool deleting = false;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          title: const Text('Delete Question'),
          content: const Text(
            'Are you sure you want to delete this question? This cannot be undone.',
          ),
          actions: [
            TextButton(
              onPressed: deleting ? null : () => Navigator.pop(dialogContext),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red.shade600,
                foregroundColor: Colors.white,
              ),
              onPressed: deleting
                  ? null
                  : () async {
                      setDialogState(() => deleting = true);
                      final success = await _deleteQuestion(question['id']);
                      if (dialogContext.mounted) {
                        Navigator.pop(dialogContext);
                      }
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              success
                                  ? 'Question deleted.'
                                  : 'Failed to delete question.',
                            ),
                          ),
                        );
                      }
                    },
              child: deleting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text('Delete'),
            ),
          ],
        ),
      ),
    );
  }

  Future<bool> _deleteQuestion(dynamic questionId) async {
    try {
      final res = await http.delete(
        Uri.parse('${ApiConfig.baseUrl}/questions/$questionId'),
      );
      if (res.statusCode == 200) {
        setState(() {
          _questions.removeWhere((q) => q['id'] == questionId);
          _selectedQuestionIds.remove(questionId); // Clean selection tracking
        });
        return true;
      }
      return false;
    } catch (e) {
      debugPrint('Delete question error: $e');
      return false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header ──
          Container(
            width: double.infinity,
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Question Bank',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1A1A1A),
                  ),
                ),
                const SizedBox(height: 2),
                const Text(
                  'Browse and manage your questions by subject',
                  style: TextStyle(fontSize: 13, color: Colors.grey),
                ),
                const SizedBox(height: 12),

                // ── Subject Dropdown ──
                _loadingSubjects
                    ? const Padding(
                        padding: EdgeInsets.only(bottom: 12),
                        child: LinearProgressIndicator(color: primaryColor),
                      )
                    : DropdownButtonFormField<String>(
                        initialValue: _selectedSubjectId,
                        hint: const Text(
                          '— Select a subject —',
                          style: TextStyle(fontSize: 13, color: Colors.grey),
                        ),
                        items: _subjects.map<DropdownMenuItem<String>>((s) {
                          final label =
                              s['code'] != null &&
                                  s['code'].toString().isNotEmpty
                              ? '${s['name']} (${s['code']})'
                              : s['name'].toString();
                          return DropdownMenuItem(
                            value: s['id'].toString(),
                            child: Text(
                              label,
                              style: const TextStyle(fontSize: 13),
                            ),
                          );
                        }).toList(),
                        onChanged: (val) {
                          if (val == null) return;
                          final subject = _subjects.firstWhere(
                            (s) => s['id'].toString() == val,
                          );
                          _searchController.clear();
                          setState(() {
                            _selectedSubjectId = val;
                            _selectedSubjectName = subject['name'];
                            _searchQuery = '';
                          });
                          _fetchQuestions(val);
                        },
                        decoration: InputDecoration(
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: BorderSide(color: Colors.grey.shade300),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: BorderSide(color: Colors.grey.shade300),
                          ),
                        ),
                        isExpanded: true,
                      ),
                const SizedBox(height: 12),

                // ── Search Filter ──
                if (_selectedSubjectId != null) ...[
                  TextField(
                    controller: _searchController,
                    onChanged: (val) =>
                        setState(() => _searchQuery = val.trim()),
                    style: const TextStyle(fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Search questions...',
                      hintStyle: const TextStyle(
                        fontSize: 13,
                        color: Colors.grey,
                      ),
                      prefixIcon: const Icon(
                        Icons.search,
                        size: 20,
                        color: Colors.grey,
                      ),
                      suffixIcon: _searchQuery.isNotEmpty
                          ? IconButton(
                              icon: const Icon(
                                Icons.clear,
                                size: 18,
                                color: Colors.grey,
                              ),
                              onPressed: () {
                                _searchController.clear();
                                setState(() => _searchQuery = '');
                              },
                            )
                          : null,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide(color: Colors.grey.shade300),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide(color: Colors.grey.shade300),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: primaryColor),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],

                // ── Bloom's Tabs ──
                if (_selectedSubjectId != null)
                  TabBar(
                    controller: _tabController,
                    isScrollable: true,
                    labelColor: primaryColor,
                    unselectedLabelColor: Colors.grey,
                    indicatorColor: primaryColor,
                    indicatorWeight: 2.5,
                    labelStyle: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                    unselectedLabelStyle: const TextStyle(fontSize: 13),
                    tabAlignment: TabAlignment.start,
                    tabs: bloomsLevels.map<Widget>((level) {
                      final count = _countByLevel(level['name']);
                      return Tab(
                        child: Row(
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: level['color'],
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(level['name']),
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.grey.shade100,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                '$count',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: Colors.grey,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),

                // ── Generate Assessment Button (ONLY appears when questions are selected) ──
                if (_selectedSubjectId != null &&
                    _selectedQuestionIds.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _generating
                          ? null
                          : _showGenerateAssessmentSheet,
                      icon: _generating
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.assignment_outlined),
                      label: Text(
                        'Generate Assessment (${_selectedQuestionIds.length})',
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: primaryColor,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(double.infinity, 48),
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(30),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
              ],
            ),
          ),

          // ── Error ──
          if (_error.isNotEmpty)
            Container(
              margin: const EdgeInsets.all(12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFfef2f2),
                border: Border.all(color: const Color(0xFFfecaca)),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                _error,
                style: const TextStyle(color: Color(0xFF991b1b), fontSize: 13),
              ),
            ),

          // ── Body ──
          Expanded(
            child: _selectedSubjectId == null
                // No subject selected
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 64,
                          height: 64,
                          decoration: BoxDecoration(
                            color: Colors.grey.shade100,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            Icons.filter_list,
                            size: 32,
                            color: Colors.grey.shade300,
                          ),
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'No Subject Selected',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: Colors.grey,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Select a subject above to view questions',
                          style: TextStyle(fontSize: 12, color: Colors.grey),
                        ),
                      ],
                    ),
                  )
                // Loading
                : _loadingQuestions
                ? const Center(
                    child: CircularProgressIndicator(color: primaryColor),
                  )
                // Tabs with questions
                : TabBarView(
                    controller: _tabController,
                    children: bloomsLevels.map<Widget>((level) {
                      final levelQuestions = _questionsByLevel(level['name']);
                      return levelQuestions.isEmpty
                          ? Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    _searchQuery.isNotEmpty
                                        ? Icons.search_off
                                        : Icons.inbox_outlined,
                                    size: 48,
                                    color: Colors.grey.shade300,
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    _searchQuery.isNotEmpty
                                        ? 'No results for "$_searchQuery"'
                                        : 'No ${level['name']} questions',
                                    style: const TextStyle(
                                      color: Colors.grey,
                                      fontSize: 13,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    _searchQuery.isNotEmpty
                                        ? 'in ${level['name']} for $_selectedSubjectName'
                                        : 'for $_selectedSubjectName',
                                    style: const TextStyle(
                                      color: Colors.grey,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.all(12),
                              itemCount: levelQuestions.length,
                              itemBuilder: (context, i) {
                                final q = levelQuestions[i];
                                final isSelected = _selectedQuestionIds
                                    .contains(q['id']);
                                return _QuestionCard(
                                  question: q,
                                  levelColor: level['color'],
                                  isSelected: isSelected,
                                  onSelectedChanged: (bool? val) {
                                    setState(() {
                                      if (val == true) {
                                        _selectedQuestionIds.add(q['id']);
                                      } else {
                                        _selectedQuestionIds.remove(q['id']);
                                      }
                                    });
                                  },
                                  onEdit: () => _showEditQuestionDialog(q),
                                  onDelete: () => _confirmDeleteQuestion(q),
                                );
                              },
                            );
                    }).toList(),
                  ),
          ),
        ],
      ),
    );
  }
}

// ── Question Card ─────────────────────────────────────────────────────────────

class _QuestionCard extends StatelessWidget {
  final dynamic question;
  final Color levelColor;
  final bool isSelected;
  final ValueChanged<bool?> onSelectedChanged;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _QuestionCard({
    required this.question,
    required this.levelColor,
    required this.isSelected,
    required this.onSelectedChanged,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final options = question['options'];
    final hasOptions = options != null && options is List && options.isNotEmpty;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Checkbox for selection
          Checkbox(
            value: isSelected,
            onChanged: onSelectedChanged,
            activeColor: primaryColor,
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(right: 14.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Question text + actions
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          question['question'] ?? '',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF1A1A1A),
                          ),
                        ),
                      ),
                      InkWell(
                        onTap: onEdit,
                        borderRadius: BorderRadius.circular(4),
                        child: const Padding(
                          padding: EdgeInsets.all(4),
                          child: Icon(
                            Icons.edit_outlined,
                            size: 18,
                            color: Colors.grey,
                          ),
                        ),
                      ),
                      InkWell(
                        onTap: onDelete,
                        borderRadius: BorderRadius.circular(4),
                        child: const Padding(
                          padding: EdgeInsets.all(4),
                          child: Icon(
                            Icons.delete_outline,
                            size: 18,
                            color: Colors.red,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),

                  // MCQ Options (no answer highlighted)
                  if (hasOptions) ...[
                    ...List.generate(options.length, (i) {
                      return Container(
                        margin: const EdgeInsets.only(bottom: 4),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 7,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade50,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: Colors.grey.shade200),
                        ),
                        child: Text(
                          options[i].toString(),
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey.shade700,
                          ),
                        ),
                      );
                    }),
                    const SizedBox(height: 8),
                  ],

                  // Tags
                  Row(
                    children: [
                      _Tag(
                        label: question['bloom_level'] ?? '',
                        color: levelColor,
                      ),
                      const SizedBox(width: 6),
                      _Tag(
                        label: question['question_type'] ?? '',
                        color: Colors.grey.shade400,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  final String label;
  final Color color;

  const _Tag({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          color: color,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
