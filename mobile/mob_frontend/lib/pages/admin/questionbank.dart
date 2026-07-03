import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
// import '../widgets/adminSidebar.dart'; // Ensure this points to your sidebar

const String baseUrl = 'http://127.0.0.1:8000/api';

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
      final res = await http.get(Uri.parse('$baseUrl/subjects'));
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
        Uri.parse('$baseUrl/questions?subject_id=$subjectId'),
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

  // 1. Add 'explanation' as a required parameter here
  Future<void> _updateQuestion(
    dynamic id,
    String qText,
    String answer,
    String bloom,
    String explanation,
  ) async {
    // 1. Build the JSON tracker
    final String payload = jsonEncode({
      'question': qText,
      'correct_answer': answer,
      'bloom_level': bloom,
      'explanation': explanation,
    });

    // 2. Print it to the console to PROVE it exists
    debugPrint('🚀 SENDING PAYLOAD TO PYTHON: $payload');

    try {
      final res = await http.put(
        Uri.parse('$baseUrl/questions/$id'),
        headers: {
          'Content-Type':
              'application/json', // Removed the manual charset from here
          'Accept': 'application/json',
        },
        encoding:
            utf8, // Explicitly tell the browser how to package the JSON string
        body: jsonEncode({
          'question': qText,
          'correct_answer': answer,
          'bloom_level': bloom,
          'explanation': explanation,
        }),
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
    return Container(
      color: kBg,
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header Section ──
          const Text(
            'Question Bank',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1A1A1A),
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Browse and manage your questions by subject',
            style: TextStyle(color: Colors.grey, fontSize: 13),
          ),
          const SizedBox(height: 20),

          // ── Subject Dropdown (Maroon Border as pictured) ──
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
                icon: const Icon(Icons.arrow_drop_down, color: Colors.grey),
                hint: const Text(
                  'Select a subject...',
                  style: TextStyle(color: Colors.grey, fontSize: 14),
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

          // ── Search Bar (Light Grey Border) ──
          TextField(
            controller: _searchController,
            onChanged: (val) => setState(() => _searchQuery = val),
            decoration: InputDecoration(
              hintText: 'Search questions...',
              hintStyle: const TextStyle(color: Colors.grey, fontSize: 14),
              prefixIcon: const Icon(
                Icons.search,
                color: Colors.grey,
                size: 20,
              ),
              filled: true,
              fillColor: Colors.white,
              contentPadding: const EdgeInsets.symmetric(vertical: 0),
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
          const SizedBox(height: 20),

          // ── Tabs & Download Button ──
          if (_selectedSubjectId != null) ...[
            Row(
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
                    tabs: bloomsLevels.map((level) {
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
                                borderRadius: BorderRadius.circular(12),
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
                  margin: const EdgeInsets.only(left: 8, bottom: 8),
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
                    onPressed: () {
                      // Add your generate assessment logic here
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Downloading Assessment...'),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // ── Tab Views (Question List) ──
            Expanded(
              child: _loadingQuestions
                  ? const Center(
                      child: CircularProgressIndicator(color: kPrimary),
                    )
                  : TabBarView(
                      controller: _tabController,
                      children: bloomsLevels.map((level) {
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
                          itemCount: levelQs.length,
                          itemBuilder: (context, i) {
                            return _QuestionCard(
                              question: levelQs[i],
                              levelColor: level['color'],
                              onEdit: () => _showEditQuestionDialog(levelQs[i]),
                              onDelete: () {
                                // Add delete confirmation logic
                              },
                            );
                          },
                        );
                      }).toList(),
                    ),
            ),
          ] else ...[
            const Expanded(
              child: Center(
                child: Text(
                  'Select a subject to begin.',
                  style: TextStyle(color: Colors.grey),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Question Card Component ──
class _QuestionCard extends StatelessWidget {
  final dynamic question;
  final Color levelColor;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _QuestionCard({
    required this.question,
    required this.levelColor,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    // Assuming options come as a list from your Python backend.
    // If they are just text, you can parse them or render a static list for now.
    final List<dynamic> options =
        question['options'] ??
        ['A. Front-end', 'B. Middleware', 'C. Backend', 'D. Network'];

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
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
              // Edit Icon
              InkWell(
                onTap: onEdit,
                child: const Icon(Icons.edit, color: Colors.grey, size: 18),
              ),
              const SizedBox(width: 16),
              // Delete Icon
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

          // Options Chips
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

          // Bottom Tags
          Row(
            children: [
              // Bloom's Level Tag
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
              // MCQ Tag
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
