import 'package:flutter/material.dart';

const kPrimary = Color(0xFF7B1113);
const kPrimaryDark = Color(0xFF5A0D0F);
const kBg = Color(0xFFF5F0F0);

class AdminSidebar extends StatelessWidget {
  final int selectedIndex;
  final ValueChanged<int> onSelect;

  const AdminSidebar({
    super.key,
    required this.selectedIndex,
    required this.onSelect,
  });

  static const items = [
    _NavItem(icon: Icons.dashboard_outlined, label: 'Dashboard'),
    _NavItem(icon: Icons.quiz_outlined, label: 'Question Bank'),
    _NavItem(icon: Icons.school_outlined, label: 'Academic Management'),
    _NavItem(icon: Icons.group_outlined, label: 'User Management'),
    _NavItem(icon: Icons.bar_chart_outlined, label: 'Reports'),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 210,
      color: kPrimary,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Logo / brand
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 32, 16, 20),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: kPrimaryDark,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  alignment: Alignment.center,
                  child: const Text(
                    'B',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 20,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('BloomQuest',
                        style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 13)),
                    Text('Admin Portal',
                        style: TextStyle(color: Colors.white54, fontSize: 10)),
                  ],
                ),
              ],
            ),
          ),

          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Text(
              'NAVIGATION',
              style: TextStyle(
                color: Colors.white38,
                fontSize: 9,
                letterSpacing: 1.4,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(height: 6),

          // Nav items
          ...List.generate(items.length, (i) {
            final item = items[i];
            final isSelected = i == selectedIndex;
            return InkWell(
              onTap: () => onSelect(i),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                color: isSelected ? kPrimaryDark : Colors.transparent,
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
                child: Row(
                  children: [
                    Icon(item.icon,
                        color:
                            isSelected ? Colors.white : Colors.white60,
                        size: 18),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        item.label,
                        style: TextStyle(
                          color: isSelected ? Colors.white : Colors.white70,
                          fontSize: 13,
                          fontWeight: isSelected
                              ? FontWeight.w600
                              : FontWeight.normal,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),

          const Spacer(),

          // Log out
          InkWell(
            onTap: () => Navigator.pushNamedAndRemoveUntil(
                context, '/', (route) => false),
            child: const Padding(
              padding: EdgeInsets.fromLTRB(16, 12, 16, 32),
              child: Row(
                children: [
                  Icon(Icons.logout, color: Colors.white54, size: 18),
                  SizedBox(width: 10),
                  Text('Log out',
                      style: TextStyle(color: Colors.white54, fontSize: 13)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NavItem {
  final IconData icon;
  final String label;
  const _NavItem({required this.icon, required this.label});
}