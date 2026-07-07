import 'package:flutter/material.dart';
import '../widgets/adminSidebar.dart';

class AdminAcadMgtPage extends StatelessWidget {
  const AdminAcadMgtPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: kBg,
      child: const Center(
        child: Text(
          'Academic Management\n(coming soon)',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.black38, fontSize: 16),
        ),
      ),
    );
  }
}