import 'package:flutter/material.dart';
import '../widgets/adminSidebar.dart';

class AdminQuestionBankPage extends StatelessWidget {
  const AdminQuestionBankPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: kBg,
      child: const Center(
        child: Text(
          'Question Bank\n(coming soon)',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.black38, fontSize: 16),
        ),
      ),
    );
  }
}