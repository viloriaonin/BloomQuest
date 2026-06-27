import 'package:flutter/material.dart';

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
  String? _selectedTopic;
  String? _selectedDifficulty;

  static const primaryColor = Color(0xFF7B1113);

  final List<String> _subjects = ['Math', 'Science', 'English', 'History'];
  final List<String> _topics = ['Topic 1', 'Topic 2', 'Topic 3'];
  final List<String> _difficulties = ['Easy', 'Medium', 'Hard'];

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
    super.dispose();
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
            // Header
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

            // Card with tabs
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
                  // Tab bar
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
                      Tab(text: 'Upload File / Module'),
                    ],
                  ),

                  // Tab content
                  SizedBox(
                    height: 420,
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

  // ─── Manual Input Tab ───────────────────────────────────────────────────────

  Widget _buildManualTab() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Question text area
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

          // Dropdowns row
          Row(
            children: [
              Expanded(
                child: _buildDropdown(
                  label: 'SUBJECT',
                  hint: 'Select subject',
                  value: _selectedSubject,
                  items: _subjects,
                  onChanged: (val) => setState(() => _selectedSubject = val),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildDropdown(
                  label: 'TOPIC',
                  hint: 'Select topic',
                  value: _selectedTopic,
                  items: _topics,
                  onChanged: (val) => setState(() => _selectedTopic = val),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildDropdown(
                  label: 'DIFFICULTY LEVEL',
                  hint: 'Select difficulty',
                  value: _selectedDifficulty,
                  items: _difficulties,
                  onChanged: (val) => setState(() => _selectedDifficulty = val),
                ),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // Classify button
          Align(
            alignment: Alignment.centerRight,
            child: ElevatedButton(
              onPressed: _questionController.text.trim().isEmpty
                  ? null
                  : () {
                      // TODO: call classify API
                    },
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

  Widget _buildDropdown({
    required String label,
    required String hint,
    required String? value,
    required List<String> items,
    required ValueChanged<String?> onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: Colors.grey,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          value: value,
          hint: Text(
            hint,
            style: const TextStyle(fontSize: 13, color: Colors.grey),
          ),
          items: items
              .map(
                (e) => DropdownMenuItem(
                  value: e,
                  child: Text(e, style: const TextStyle(fontSize: 13)),
                ),
              )
              .toList(),
          onChanged: onChanged,
          decoration: InputDecoration(
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 10,
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
          icon: const Icon(Icons.keyboard_arrow_down, size: 20),
        ),
      ],
    );
  }

  // ─── Upload Tab ─────────────────────────────────────────────────────────────

  Widget _buildUploadTab() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // Two upload cards
          Expanded(
            child: Row(
              children: [
                Expanded(
                  child: _buildUploadCard(
                    icon: Icons.upload_outlined,
                    iconBgColor: const Color(0xFFFFE5E5),
                    iconColor: primaryColor,
                    title: 'Upload Modules or PPT',
                    subtitle: 'Lesson files, slides, or reading materials',
                    tags: const ['PDF', 'PPTX', 'DOCX'],
                    buttonOutlined: false,
                    onTap: () {},
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildUploadCard(
                    icon: Icons.description_outlined,
                    iconBgColor: const Color(0xFFE8F0FE),
                    iconColor: const Color(0xFF1565C0),
                    title: 'Upload Course Syllabus',
                    subtitle: 'Course outline or curriculum document',
                    tags: const ['PDF', 'DOCX'],
                    buttonOutlined: true,
                    onTap: () {},
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Generate TOS button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                // TODO: call generate TOS API
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryColor,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: const Text(
                'Generate Table of Specifications',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUploadCard({
    required IconData icon,
    required Color iconBgColor,
    required Color iconColor,
    required String title,
    required String subtitle,
    required List<String> tags,
    required bool buttonOutlined,
    required VoidCallback onTap,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade300),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Icon circle
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: iconBgColor,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: iconColor, size: 26),
          ),
          const SizedBox(height: 12),

          // Title
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

          // Subtitle
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 11, color: Colors.grey),
          ),
          const SizedBox(height: 10),

          // Tags
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
                      style: const TextStyle(fontSize: 10, color: Colors.grey),
                    ),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 12),

          // Browse Files button
          buttonOutlined
              ? OutlinedButton(
                  onPressed: onTap,
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFF1565C0)),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(6),
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                  ),
                  child: const Text(
                    'Browse Files',
                    style: TextStyle(fontSize: 12, color: Color(0xFF1565C0)),
                  ),
                )
              : ElevatedButton(
                  onPressed: onTap,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: primaryColor,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(6),
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                  ),
                  child: const Text(
                    'Browse Files',
                    style: TextStyle(fontSize: 12, color: Colors.white),
                  ),
                ),
        ],
      ),
    );
  }
}
