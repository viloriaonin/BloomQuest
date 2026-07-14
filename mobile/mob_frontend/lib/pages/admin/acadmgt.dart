import 'package:flutter/material.dart';

const Color kPrimaryColor = Color(0xFF7B1113);
const Color kLightBgColor = Color(0xFFFFF5F5);

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

class _AdminAcadMgtPageState extends State<AdminAcadMgtPage> {
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

  void _addOrEditDepartment({Department? department}) {
    final nameController = TextEditingController(text: department?.name ?? '');
    final codeController = TextEditingController(text: department?.code ?? '');

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          department == null ? 'Add New Department' : 'Edit Department',
          style: const TextStyle(color: kPrimaryColor, fontWeight: FontWeight.bold),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              decoration: const InputDecoration(labelText: 'Department Name'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: codeController,
              decoration: const InputDecoration(labelText: 'Code / School (e.g. CICS)'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: kPrimaryColor,
              foregroundColor: Colors.white, // Contrast Fixed
            ),
            onPressed: () {
              if (nameController.text.trim().isEmpty || codeController.text.trim().isEmpty) return;

              setState(() {
                if (department == null) {
                  _departments.add(Department(
                    id: DateTime.now().toString(),
                    name: nameController.text.trim(),
                    code: codeController.text.toUpperCase().trim(),
                  ));
                } else {
                  department.name = nameController.text.trim();
                  department.code = codeController.text.toUpperCase().trim();
                }
              });
              Navigator.pop(context);
            },
            child: Text(
              department == null ? 'Add' : 'Save',
              style: const TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }

  void _deleteDepartment(String id) {
    setState(() {
      _departments.removeWhere((dept) => dept.id == id);
      _courses.removeWhere((course) => course.departmentId == id);
    });
  }

  void _addOrEditCourse({Course? course}) {
    final nameController = TextEditingController(text: course?.name ?? '');
    final codeController = TextEditingController(text: course?.code ?? '');
    String? selectedDeptId = course?.departmentId ?? (_departments.isNotEmpty ? _departments.first.id : null);

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(
            course == null ? 'Assign New Course' : 'Edit Course',
            style: const TextStyle(color: kPrimaryColor, fontWeight: FontWeight.bold),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(labelText: 'Course Name'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: codeController,
                decoration: const InputDecoration(labelText: 'Course Code (e.g. BSCS)'),
              ),
              const SizedBox(height: 12),
              if (_departments.isNotEmpty)
                DropdownButtonFormField<String>(
                  initialValue: selectedDeptId,
                  decoration: const InputDecoration(labelText: 'Assign to Department'),
                  items: _departments.map((dept) {
                    return DropdownMenuItem<String>(
                      value: dept.id,
                      child: Text('${dept.name} (${dept.code})'),
                    );
                  }).toList(),
                  onChanged: (value) {
                    setDialogState(() {
                      selectedDeptId = value;
                    });
                  },
                )
              else
                const Text(
                  'Please create a department first!',
                  style: TextStyle(color: Colors.red, fontSize: 12),
                ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: kPrimaryColor,
                foregroundColor: Colors.white, // Contrast Fixed
              ),
              onPressed: selectedDeptId == null
                  ? null
                  : () {
                      if (nameController.text.trim().isEmpty || codeController.text.trim().isEmpty) return;

                      setState(() {
                        if (course == null) {
                          _courses.add(Course(
                            id: DateTime.now().toString(),
                            name: nameController.text.trim(),
                            code: codeController.text.toUpperCase().trim(),
                            departmentId: selectedDeptId!,
                          ));
                        } else {
                          course.name = nameController.text.trim();
                          course.code = codeController.text.toUpperCase().trim();
                          course.departmentId = selectedDeptId!;
                        }
                      });
                      Navigator.pop(context);
                    },
              child: Text(
                course == null ? 'Add' : 'Save',
                style: const TextStyle(color: Colors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _deleteCourse(String id) {
    setState(() {
      _courses.removeWhere((course) => course.id == id);
    });
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildSectionHeader(
            title: 'Departments',
            subtitle: 'Manage academic units and schools',
            onAddPressed: () => _addOrEditDepartment(),
          ),
          const SizedBox(height: 16),
          _departments.isEmpty
              ? _buildEmptyPlaceholder('No departments added yet.')
              : ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _departments.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final dept = _departments[index];
                    return _buildItemCard(
                      title: dept.name,
                      subtitle: dept.code,
                      onEdit: () => _addOrEditDepartment(department: dept),
                      onDelete: () => _deleteDepartment(dept.id),
                    );
                  },
                ),
          const SizedBox(height: 40),
          const Divider(height: 1, color: Colors.black12),
          const SizedBox(height: 40),
          _buildSectionHeader(
            title: 'Courses',
            subtitle: 'Assign courses to departments',
            onAddPressed: () => _addOrEditCourse(),
          ),
          const SizedBox(height: 16),
          _courses.isEmpty
              ? _buildEmptyPlaceholder('No courses added yet.')
              : ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _courses.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final course = _courses[index];
                    return _buildItemCard(
                      title: course.name,
                      subtitle: course.code,
                      onEdit: () => _addOrEditCourse(course: course),
                      onDelete: () => _deleteCourse(course.id),
                    );
                  },
                ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader({
    required String title,
    required String subtitle,
    required VoidCallback onAddPressed,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.black87),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: const TextStyle(fontSize: 14, color: Colors.grey),
            ),
          ],
        ),
        ElevatedButton.icon(
          onPressed: onAddPressed,
          icon: const Icon(Icons.add, size: 18, color: Colors.white),
          label: const Text('+ Add New', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          style: ElevatedButton.styleFrom(
            backgroundColor: kPrimaryColor,
            foregroundColor: Colors.white, // Contrast Fixed
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          ),
        ),
      ],
    );
  }

  Widget _buildItemCard({
    required String title,
    required String subtitle,
    required VoidCallback onEdit,
    required VoidCallback onDelete,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: kLightBgColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.black87),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 13, color: Colors.black38, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.edit_outlined, color: Colors.grey, size: 20),
                onPressed: onEdit,
              ),
              IconButton(
                icon: const Icon(Icons.delete_outline, color: Colors.grey, size: 20),
                onPressed: () {
                  showDialog(
                    context: context,
                    builder: (context) => AlertDialog(
                      title: const Text('Delete Confirmation'),
                      content: Text('Are you sure you want to delete "$title"?'),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(context),
                          child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
                        ),
                        TextButton(
                          onPressed: () {
                            onDelete();
                            Navigator.pop(context);
                          },
                          child: const Text('Delete', style: TextStyle(color: Colors.red)),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildEmptyPlaceholder(String message) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(12),
      ),
      child: Center(
        child: Text(
          message,
          style: const TextStyle(color: Colors.grey, fontStyle: FontStyle.italic),
        ),
      ),
    );
  }
}