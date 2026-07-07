import 'package:flutter/material.dart';
import '../widgets/adminSidebar.dart';

class AdminReportsPage extends StatelessWidget {
  const AdminReportsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: kBg,
      child: const Center(
        child: Text(
          'Reports\n(coming soon)',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.black38, fontSize: 16),
        ),
      ),
    );
  }
}