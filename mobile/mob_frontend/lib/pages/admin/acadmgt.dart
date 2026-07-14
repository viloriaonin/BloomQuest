import 'package:flutter/material.dart';
import 'questionbank.dart' show kPrimary, kBg;

class _Department {
  final String name;
  final String code;
  final bool highlighted;
  const _Department(this.name, this.code, {this.highlighted = false});
}

class _Course {
  final String name;
  final String code;
  const _Course(this.name, this.code);
}

class _SubjectGroup {
  final String year;
  final List<_Course> items;
  const _SubjectGroup(this.year, this.items);
}

const List<_Department> _departments = [
  _Department('Computer Science', 'CICS', highlighted: true),
  _Department('Information Technology', 'CICS'),
  _Department('Civil Engineering', 'COE'),
];

const List<_Course> _courses = [
  _Course('Bachelor of Science in Computer Science', 'BSCS'),
];

const List<_SubjectGroup> _subjectGroups = [
  _SubjectGroup('Year 1', [
    _Course('Programming Fundamentals', 'CS101'),
    _Course('Discrete Mathematics', 'CS102'),
  ]),
  _SubjectGroup('Year 2', [
    _Course('Data Structures and Algorithms', 'CS201'),
    _Course('Database Systems', 'CS202'),
  ]),
  _SubjectGroup('Year 3', [_Course('Software Engineering', 'CS301')]),
  _SubjectGroup('Year 4', []),
];

class AdminAcadMgtPage extends StatefulWidget {
  const AdminAcadMgtPage({super.key});

  @override
  State<AdminAcadMgtPage> createState() => _AdminAcadMgtPageState();
}

class _AdminAcadMgtPageState extends State<AdminAcadMgtPage> {
  final Set<String> _expandedYears = {'Year 1', 'Year 2'};

  @override
  Widget build(BuildContext context) {
    return Container(
      color: kBg,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _PanelCard(
            title: 'Departments',
            subtitle: 'Manage academic units and schools',
            onAdd: () {},
            child: Column(
              children: _departments
                  .map(
                    (d) => _ListRow(
                      title: d.name,
                      subtitle: d.code,
                      highlighted: d.highlighted,
                    ),
                  )
                  .toList(),
            ),
          ),
          const SizedBox(height: 16),
          _PanelCard(
            title: 'Courses',
            subtitle: 'Assign courses to departments',
            onAdd: () {},
            child: Column(
              children: _courses
                  .map(
                    (c) => _ListRow(
                      title: c.name,
                      subtitle: c.code,
                      highlighted: true,
                    ),
                  )
                  .toList(),
            ),
          ),
          const SizedBox(height: 16),
          _PanelCard(
            title: 'Subjects',
            subtitle: 'Organize courses by year level',
            onAdd: () {},
            child: Column(
              children: _subjectGroups.map((group) {
                final expanded = _expandedYears.contains(group.year);
                return _SubjectYearGroup(
                  year: group.year,
                  count: group.items.length,
                  expanded: expanded,
                  items: group.items,
                  onToggle: () {
                    setState(() {
                      if (expanded) {
                        _expandedYears.remove(group.year);
                      } else {
                        _expandedYears.add(group.year);
                      }
                    });
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

// ── Panel wrapper (header + "+ Add New" button + content) ──
class _PanelCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final VoidCallback onAdd;
  final Widget child;

  const _PanelCard({
    required this.title,
    required this.subtitle,
    required this.onAdd,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 12,
                        color: Colors.black38,
                      ),
                    ),
                  ],
                ),
              ),
              ElevatedButton(
                onPressed: onAdd,
                style: ElevatedButton.styleFrom(
                  backgroundColor: kPrimary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 10,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
                child: const Text(
                  '+ Add New',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }
}

// ── Simple row card with edit/delete icons ──
class _ListRow extends StatelessWidget {
  final String title;
  final String subtitle;
  final bool highlighted;

  const _ListRow({
    required this.title,
    required this.subtitle,
    this.highlighted = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: highlighted ? const Color(0xFFFDF2F2) : const Color(0xFFFAF7F7),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: highlighted ? const Color(0xFFF7D6D6) : Colors.grey.shade100,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 13, color: Colors.black45),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(
              Icons.edit_outlined,
              size: 18,
              color: Colors.black45,
            ),
            onPressed: () {},
            splashRadius: 18,
          ),
          IconButton(
            icon: const Icon(
              Icons.delete_outline,
              size: 18,
              color: Colors.black45,
            ),
            onPressed: () {},
            splashRadius: 18,
          ),
        ],
      ),
    );
  }
}

// ── Collapsible "Year N (count)" subject group ──
class _SubjectYearGroup extends StatelessWidget {
  final String year;
  final int count;
  final bool expanded;
  final List<_Course> items;
  final VoidCallback onToggle;

  const _SubjectYearGroup({
    required this.year,
    required this.count,
    required this.expanded,
    required this.items,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFAFAFA),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade100),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: onToggle,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '$year ($count)',
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
                Icon(
                  expanded ? Icons.expand_less : Icons.chevron_right,
                  size: 18,
                  color: Colors.black38,
                ),
              ],
            ),
          ),
          if (expanded && items.isNotEmpty) ...[
            const SizedBox(height: 12),
            ...items.map(
              (c) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _ListRow(title: c.name, subtitle: c.code),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
