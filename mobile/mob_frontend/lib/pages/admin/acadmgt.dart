import 'package:flutter/material.dart';

const Color kPrimaryColor = Color(0xFF7B1113);
const Color kLightBgColor = Color(0xFFF8F9FA);

class Department {
  String id;
  String name;
  String code;

  Department({required this.id, required this.name, required this.code});
}

class Course {
  String id;
  String name;
  String code;
  String departmentId;

  Course({
    required this.id,
    required this.name,
    required this.code,
    required this.departmentId,
  });
}

class AdminAcadMgtPage extends StatefulWidget {
  const AdminAcadMgtPage({super.key});

  @override
  State<AdminAcadMgtPage> createState() => _AdminAcadMgtPageState();
}

class _AdminAcadMgtPageState extends State<AdminAcadMgtPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  final List<Department> _departments = [
    Department(id: '1', name: 'Computer Science', code: 'CICS'),
    Department(id: '2', name: 'Information Technology', code: 'CICS'),
    Department(id: '3', name: 'Civil Engineering', code: 'COE'),
  ];

  final List<Course> _courses = [
    Course(
      id: '1',
      name: 'Bachelor of Science in Computer Science',
      code: 'BSCS',
      departmentId: '1',
    ),
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
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
      builder: (ctx) => Container(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          left: 24,
          right: 24,
          top: 24,
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
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: kPrimaryColor,
              ),
            ),
            const SizedBox(height: 24),
            TextField(
              controller: nameController,
              decoration: InputDecoration(
                labelText: 'Department Name',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: codeController,
              decoration: InputDecoration(
                labelText: 'Code / School (e.g. CICS)',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            const SizedBox(height: 30),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: kPrimaryColor,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                onPressed: () {
                  if (nameController.text.trim().isEmpty ||
                      codeController.text.trim().isEmpty) {
                    return;
                  }
                  setState(() {
                    if (department == null) {
                      _departments.add(
                        Department(
                          id: DateTime.now().toString(),
                          name: nameController.text.trim(),
                          code: codeController.text.toUpperCase().trim(),
                        ),
                      );
                    } else {
                      department.name = nameController.text.trim();
                      department.code = codeController.text
                          .toUpperCase()
                          .trim();
                    }
                  });
                  Navigator.pop(ctx);
                },
                child: Text(
                  department == null ? 'Add Department' : 'Save Changes',
                  style: const TextStyle(color: Colors.white, fontSize: 16),
                ),
              ),
            ),
            const SizedBox(height: 28),
          ],
        ),
      ),
    );
  }

  void _showCourseSheet({Course? course}) {
    final nameController = TextEditingController(text: course?.name ?? '');
    final codeController = TextEditingController(text: course?.code ?? '');
    String? selectedDeptId =
        course?.departmentId ??
        (_departments.isNotEmpty ? _departments.first.id : null);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Container(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
            left: 24,
            right: 24,
            top: 24,
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
                course == null ? 'Add Course' : 'Edit Course',
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: kPrimaryColor,
                ),
              ),
              const SizedBox(height: 24),
              TextField(
                controller: nameController,
                decoration: InputDecoration(
                  labelText: 'Course Name',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: codeController,
                decoration: InputDecoration(
                  labelText: 'Course Code (e.g. BSCS)',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              if (_departments.isNotEmpty)
                DropdownButtonFormField<String>(
                  value: selectedDeptId,
                  decoration: InputDecoration(
                    labelText: 'Assign to Department',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
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
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    'Please create a department first!',
                    style: TextStyle(color: Colors.red),
                  ),
                ),
              const SizedBox(height: 30),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: kPrimaryColor,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onPressed: selectedDeptId == null
                      ? null
                      : () {
                          if (nameController.text.trim().isEmpty ||
                              codeController.text.trim().isEmpty) {
                            return;
                          }
                          setState(() {
                            if (course == null) {
                              _courses.add(
                                Course(
                                  id: DateTime.now().toString(),
                                  name: nameController.text.trim(),
                                  code: codeController.text
                                      .toUpperCase()
                                      .trim(),
                                  departmentId: selectedDeptId!,
                                ),
                              );
                            } else {
                              course.name = nameController.text.trim();
                              course.code = codeController.text
                                  .toUpperCase()
                                  .trim();
                              course.departmentId = selectedDeptId!;
                            }
                          });
                          Navigator.pop(ctx);
                        },
                  child: Text(
                    course == null ? 'Add Course' : 'Save Changes',
                    style: const TextStyle(color: Colors.white, fontSize: 16),
                  ),
                ),
              ),
              const SizedBox(height: 28),
            ],
          ),
        ),
      ),
    );
  }

  void _deleteDepartment(String id) => setState(() {
    _departments.removeWhere((dept) => dept.id == id);
    _courses.removeWhere((course) => course.departmentId == id);
  });

  void _deleteCourse(String id) => setState(() {
    _courses.removeWhere((course) => course.id == id);
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kLightBgColor,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        automaticallyImplyLeading: false,
        title: const Text(
          'Academic Management',
          style: TextStyle(
            color: Colors.black87,
            fontWeight: FontWeight.bold,
            fontSize: 20,
          ),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(64),
          child: Container(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            color: Colors.white,
            child: Container(
              height: 44,
              decoration: BoxDecoration(
                color: const Color(0xFFF3F4F6),
                borderRadius: BorderRadius.circular(14),
              ),
              child: TabBar(
                controller: _tabController,
                labelColor: kPrimaryColor,
                unselectedLabelColor: Colors.grey,
                indicator: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.05),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                indicatorPadding: const EdgeInsets.all(4),
                dividerColor: Colors.transparent,
                labelStyle: const TextStyle(fontWeight: FontWeight.w700),
                tabs: const [
                  Tab(text: 'Departments'),
                  Tab(text: 'Courses'),
                ],
              ),
            ),
          ),
        ),
      ),
      body: SafeArea(
        child: TabBarView(
          controller: _tabController,
          children: [
            _buildList(isDepartment: true),
            _buildList(isDepartment: false),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: kPrimaryColor,
        onPressed: () {
          if (_tabController.index == 0) {
            _showDepartmentSheet();
          } else {
            _showCourseSheet();
          }
        },
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text(
          'Add New',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }

  Widget _buildList({required bool isDepartment}) {
    final items = isDepartment ? _departments : _courses;

    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isDepartment ? Icons.domain_disabled : Icons.school_outlined,
              size: 72,
              color: Colors.grey.shade300,
            ),
            const SizedBox(height: 16),
            Text(
              'No ${isDepartment ? 'departments' : 'courses'} found.',
              style: TextStyle(color: Colors.grey.shade500, fontSize: 16),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        final title = isDepartment
            ? (item as Department).name
            : (item as Course).name;
        final subtitle = isDepartment
            ? (item as Department).code
            : (item as Course).code;

        return _AcademicCard(
          title: title,
          subtitle: subtitle,
          badge: isDepartment ? 'Department' : 'Course',
          onEdit: () => isDepartment
              ? _showDepartmentSheet(department: item as Department)
              : _showCourseSheet(course: item as Course),
          onDelete: () => isDepartment
              ? _showDeleteConfirm(
                  title,
                  () => _deleteDepartment((item as Department).id),
                )
              : _showDeleteConfirm(
                  title,
                  () => _deleteCourse((item as Course).id),
                ),
        );
      },
    );
  }

  void _showDeleteConfirm(String title, VoidCallback onDelete) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Confirm Delete'),
        content: Text(
          'Are you sure you want to delete "$title"? This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
              elevation: 0,
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

class _AcademicCard extends StatefulWidget {
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
  State<_AcademicCard> createState() => _AcademicCardState();
}

class _AcademicCardState extends State<_AcademicCard> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
        margin: const EdgeInsets.only(bottom: 12),
        transform: Matrix4.identity()
          ..translate(0, _isHovered ? -1 : 0)
          ..scale(_isHovered ? 1.01 : 1.0),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: _isHovered
                ? kPrimaryColor.withOpacity(0.45)
                : Colors.grey.shade200,
          ),
          boxShadow: [
            BoxShadow(
              color: _isHovered
                  ? kPrimaryColor.withOpacity(0.10)
                  : Colors.black.withOpacity(0.03),
              blurRadius: _isHovered ? 14 : 8,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(20),
            onTap: widget.onEdit,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: kPrimaryColor.withOpacity(0.10),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(
                      Icons.school_rounded,
                      color: kPrimaryColor,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.title,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          widget.subtitle,
                          style: const TextStyle(
                            fontSize: 13,
                            color: Colors.black54,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      widget.badge,
                      style: const TextStyle(
                        fontSize: 11,
                        color: Colors.black54,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  PopupMenuButton<String>(
                    icon: const Icon(Icons.more_vert_rounded, color: Colors.grey),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    onSelected: (value) {
                      if (value == 'edit') {
                        widget.onEdit();
                      } else if (value == 'delete') {
                        widget.onDelete();
                      }
                    },
                    itemBuilder: (context) => [
                      const PopupMenuItem(
                        value: 'edit',
                        child: Row(
                          children: [
                            Icon(Icons.edit_outlined, size: 20),
                            SizedBox(width: 12),
                            Text('Edit'),
                          ],
                        ),
                      ),
                      const PopupMenuItem(
                        value: 'delete',
                        child: Row(
                          children: [
                            Icon(Icons.delete_outline, size: 20, color: Colors.red),
                            SizedBox(width: 12),
                            Text('Delete', style: TextStyle(color: Colors.red)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
