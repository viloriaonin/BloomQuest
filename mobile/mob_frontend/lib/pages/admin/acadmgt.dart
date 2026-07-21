import 'package:flutter/material.dart';
import 'package:BloomQuest/utils/theme_constants.dart';
import 'account.dart'; // IMPORT THE ACCOUNT BAR
import '../../services/api_service.dart';

const Color kLightBg = Color(0xFFF8F9FA); // Off-white background

class Department {
  String id;
  String name;
  String code;

  Department({required this.id, required this.name, required this.code});

  factory Department.fromJson(Map<String, dynamic> json) {
    return Department(
      id: (json['id'] ?? json['_id']).toString(),
      name: json['name'] ?? '',
      code: json['code'] ?? '',
    );
  }
}

class Subject {
  String id;
  String name;
  String code;
  String departmentId;

  Subject({
    required this.id,
    required this.name,
    required this.code,
    required this.departmentId,
  });

  factory Subject.fromJson(Map<String, dynamic> json) {
    return Subject(
      id: (json['id'] ?? json['_id']).toString(),
      name: json['name'] ?? '',
      code: json['code'] ?? '',
      departmentId: (json['department_id'] ?? json['departmentId'] ?? '')
          .toString(),
    );
  }
}

class AdminAcadMgtPage extends StatefulWidget {
  const AdminAcadMgtPage({super.key});

  @override
  State<AdminAcadMgtPage> createState() => _AdminAcadMgtPageState();
}

class _AdminAcadMgtPageState extends State<AdminAcadMgtPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  List<Department> _departments = [];
  List<Subject> _subjects = [];

  bool _loading = true;
  String _loadError = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      setState(() {});
    });
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _loadError = '';
    });
    try {
      final results = await Future.wait([
        ApiService.fetchDepartments(),
        ApiService.fetchSubjects(),
      ]);
      final departments = results[0]
          .map((e) => Department.fromJson(e as Map<String, dynamic>))
          .toList();
      final subjects = results[1]
          .map((e) => Subject.fromJson(e as Map<String, dynamic>))
          .toList();
      if (!mounted) return;
      setState(() {
        _departments = departments;
        _subjects = subjects;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _showDepartmentSheet({Department? department}) {
    final nameController = TextEditingController(text: department?.name ?? '');
    final codeController = TextEditingController(text: department?.code ?? '');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          bool submitting = false;
          String sheetError = '';

          Future<void> handleSubmit() async {
            if (nameController.text.trim().isEmpty ||
                codeController.text.trim().isEmpty) {
              return;
            }
            setSheetState(() {
              submitting = true;
              sheetError = '';
            });
            try {
              final name = nameController.text.trim();
              final code = codeController.text.toUpperCase().trim();
              if (department == null) {
                final created = await ApiService.createDepartment(name, code);
                setState(() {
                  _departments.add(Department.fromJson(created));
                });
              } else {
                await ApiService.updateDepartment(department.id, name, code);
                setState(() {
                  department.name = name;
                  department.code = code;
                });
              }
              if (ctx.mounted) Navigator.pop(ctx);
            } catch (e) {
              setSheetState(() {
                sheetError = e.toString().replaceAll('Exception: ', '');
                submitting = false;
              });
            }
          }

          return Container(
            padding: EdgeInsets.only(
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
              left: 24,
              right: 24,
              top: 32,
            ),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  department == null ? 'Add Department' : 'Edit Department',
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: kTextDark,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Enter the department details below.',
                  style: TextStyle(fontSize: 14, color: kTextMuted),
                ),
                const SizedBox(height: 32),
                if (sheetError.isNotEmpty) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.red.shade100),
                    ),
                    child: Text(
                      sheetError,
                      style: TextStyle(color: Colors.red.shade700),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                TextField(
                  controller: nameController,
                  decoration: InputDecoration(
                    labelText: 'Department Name',
                    labelStyle: const TextStyle(color: kTextMuted),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: kBorderOutline),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: kPrimarySlate),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                TextField(
                  controller: codeController,
                  decoration: InputDecoration(
                    labelText: 'Code / School (e.g. CICS)',
                    labelStyle: const TextStyle(color: kTextMuted),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: kBorderOutline),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: kPrimarySlate),
                    ),
                  ),
                ),
                const SizedBox(height: 40),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: kPrimarySlate,
                      padding: const EdgeInsets.symmetric(vertical: 18),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      elevation: 0,
                    ),
                    onPressed: submitting ? null : handleSubmit,
                    child: submitting
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(
                            department == null ? 'Proceed' : 'Save Changes',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                  ),
                ),
                const SizedBox(height: 20),
              ],
            ),
          );
        },
      ),
    );
  }

  void _showSubjectSheet({Subject? subject}) {
    final nameController = TextEditingController(text: subject?.name ?? '');
    final codeController = TextEditingController(text: subject?.code ?? '');
    String? selectedDeptId =
        subject?.departmentId ??
        (_departments.isNotEmpty ? _departments.first.id : null);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          bool submitting = false;
          String sheetError = '';

          Future<void> handleSubmit() async {
            if (selectedDeptId == null ||
                nameController.text.trim().isEmpty ||
                codeController.text.trim().isEmpty) {
              return;
            }
            setSheetState(() {
              submitting = true;
              sheetError = '';
            });
            try {
              final name = nameController.text.trim();
              final code = codeController.text.toUpperCase().trim();
              if (subject == null) {
                final created = await ApiService.createSubject(
                  name,
                  code,
                  selectedDeptId!,
                );
                setState(() {
                  _subjects.add(Subject.fromJson(created));
                });
              } else {
                await ApiService.updateSubject(
                  subject.id,
                  name,
                  code,
                  selectedDeptId!,
                );
                setState(() {
                  subject.name = name;
                  subject.code = code;
                  subject.departmentId = selectedDeptId!;
                });
              }
              if (ctx.mounted) Navigator.pop(ctx);
            } catch (e) {
              setSheetState(() {
                sheetError = e.toString().replaceAll('Exception: ', '');
                submitting = false;
              });
            }
          }

          return Container(
            padding: EdgeInsets.only(
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
              left: 24,
              right: 24,
              top: 32,
            ),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  subject == null ? 'Add Subject' : 'Edit Subject',
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: kTextDark,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Assign the subject to an existing department.',
                  style: TextStyle(fontSize: 14, color: kTextMuted),
                ),
                const SizedBox(height: 32),
                if (sheetError.isNotEmpty) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.red.shade100),
                    ),
                    child: Text(
                      sheetError,
                      style: TextStyle(color: Colors.red.shade700),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                TextField(
                  controller: nameController,
                  decoration: InputDecoration(
                    labelText: 'Subject Name',
                    labelStyle: const TextStyle(color: kTextMuted),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: kBorderOutline),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: kPrimarySlate),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                TextField(
                  controller: codeController,
                  decoration: InputDecoration(
                    labelText: 'Subject Code (e.g. CS201)',
                    labelStyle: const TextStyle(color: kTextMuted),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: kBorderOutline),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: kPrimarySlate),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                if (_departments.isNotEmpty)
                  DropdownButtonFormField<String>(
                    initialValue: selectedDeptId,
                    decoration: InputDecoration(
                      labelText: 'Assign to Department',
                      labelStyle: const TextStyle(color: kTextMuted),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: kBorderOutline),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: kPrimarySlate),
                      ),
                    ),
                    items: _departments
                        .map(
                          (dept) => DropdownMenuItem<String>(
                            value: dept.id,
                            child: Text('${dept.name} (${dept.code})'),
                          ),
                        )
                        .toList(),
                    onChanged: (value) =>
                        setSheetState(() => selectedDeptId = value),
                  )
                else
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.red.shade100),
                    ),
                    child: const Text(
                      'Please create a department first!',
                      style: TextStyle(color: Colors.red),
                    ),
                  ),
                const SizedBox(height: 40),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: kPrimarySlate,
                      padding: const EdgeInsets.symmetric(vertical: 18),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      elevation: 0,
                    ),
                    onPressed: (selectedDeptId == null || submitting)
                        ? null
                        : handleSubmit,
                    child: submitting
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(
                            subject == null ? 'Proceed' : 'Save Changes',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                  ),
                ),
                const SizedBox(height: 20),
              ],
            ),
          );
        },
      ),
    );
  }

  Future<void> _deleteDepartment(String id) async {
    final removedDept = _departments.firstWhere((dept) => dept.id == id);
    final removedSubjects = _subjects
        .where((subject) => subject.departmentId == id)
        .toList();
    setState(() {
      _departments.removeWhere((dept) => dept.id == id);
      _subjects.removeWhere((subject) => subject.departmentId == id);
    });
    try {
      await ApiService.deleteDepartment(id);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _departments.add(removedDept);
        _subjects.addAll(removedSubjects);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Failed to delete department: ${e.toString().replaceAll('Exception: ', '')}',
          ),
        ),
      );
    }
  }

  Future<void> _deleteSubject(String id) async {
    final removedSubject = _subjects.firstWhere((subject) => subject.id == id);
    setState(() {
      _subjects.removeWhere((subject) => subject.id == id);
    });
    try {
      await ApiService.deleteSubject(id);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _subjects.add(removedSubject);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Failed to delete subject: ${e.toString().replaceAll('Exception: ', '')}',
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kLightBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        automaticallyImplyLeading: false,
        titleSpacing: 0,
        title: const AccountTopBar(), // INJECTED HERE
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(60),
          child: Column(
            children: [
              const Divider(height: 1, color: kBorderOutline, thickness: 1),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 8,
                ),
                color: Colors.white,
                child: TabBar(
                  controller: _tabController,
                  labelColor: kPrimarySlate,
                  unselectedLabelColor: kTextMuted,
                  indicatorColor: kPrimarySlate,
                  indicatorWeight: 3,
                  dividerColor: Colors.transparent,
                  labelStyle: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                  tabs: const [
                    Tab(text: 'Departments'),
                    Tab(text: 'Subjects'),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _loadError.isNotEmpty
            ? Center(
                child: Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        _loadError,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: kTextMuted),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: kPrimarySlate,
                        ),
                        onPressed: _loadData,
                        child: const Text(
                          'Retry',
                          style: TextStyle(color: Colors.white),
                        ),
                      ),
                    ],
                  ),
                ),
              )
            : Column(
                children: [
                  Expanded(
                    child: TabBarView(
                      controller: _tabController,
                      children: [
                        _buildList(isDepartment: true),
                        _buildList(isDepartment: false),
                      ],
                    ),
                  ),
                ],
              ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: kPrimarySlate,
              padding: const EdgeInsets.symmetric(vertical: 18),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
              elevation: 0,
            ),
            onPressed: () {
              if (_tabController.index == 0) {
                _showDepartmentSheet();
              } else {
                _showSubjectSheet();
              }
            },
            child: Text(
              _tabController.index == 0 ? '+ Add Department' : '+ Add Subject',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildList({required bool isDepartment}) {
    final items = isDepartment ? _departments : _subjects;

    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isDepartment ? Icons.domain_disabled : Icons.menu_book_outlined,
              size: 64,
              color: Colors.grey.shade300,
            ),
            const SizedBox(height: 16),
            Text(
              'No ${isDepartment ? 'departments' : 'subjects'} found.',
              style: const TextStyle(color: kTextMuted, fontSize: 16),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 40),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        final title = isDepartment
            ? (item as Department).name
            : (item as Subject).name;
        final subtitle = isDepartment
            ? (item as Department).code
            : (item as Subject).code;

        return _AcademicCard(
          title: title,
          subtitle: subtitle,
          badge: isDepartment ? 'Department' : 'Subject',
          onEdit: () => isDepartment
              ? _showDepartmentSheet(department: item as Department)
              : _showSubjectSheet(subject: item as Subject),
          onDelete: () => isDepartment
              ? _showDeleteConfirm(
                  title,
                  () => _deleteDepartment((item as Department).id),
                )
              : _showDeleteConfirm(
                  title,
                  () => _deleteSubject((item as Subject).id),
                ),
        );
      },
    );
  }

  void _showDeleteConfirm(String title, VoidCallback onDelete) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: const Text(
          'Confirm Delete',
          style: TextStyle(fontWeight: FontWeight.bold, color: kTextDark),
        ),
        content: Text(
          'Are you sure you want to delete "$title"? This action cannot be undone.',
          style: const TextStyle(color: kTextMuted),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: kTextMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC3545), // Danger red
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            onPressed: () {
              onDelete();
              Navigator.pop(ctx);
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}

class _AcademicCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final String badge;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _AcademicCard({
    required this.title,
    required this.subtitle,
    required this.badge,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: kBorderOutline),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: kTextDark,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: kPrimarySlate.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          badge,
                          style: const TextStyle(
                            fontSize: 11,
                            color: kPrimarySlate,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        subtitle,
                        style: const TextStyle(fontSize: 13, color: kTextMuted),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 16),
            Row(
              children: [
                IconButton(
                  icon: const Icon(
                    Icons.edit_outlined,
                    color: kTextMuted,
                    size: 20,
                  ),
                  onPressed: onEdit,
                  splashRadius: 20,
                ),
                IconButton(
                  icon: const Icon(
                    Icons.delete_outline,
                    color: Color(0xFFDC3545),
                    size: 20,
                  ),
                  onPressed: onDelete,
                  splashRadius: 20,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
