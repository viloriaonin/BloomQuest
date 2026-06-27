import 'package:flutter/material.dart';

class QuestionBankPage extends StatelessWidget {
  const QuestionBankPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.library_books_outlined,
            size: 64,
            color: Color(0xFF7B1113),
          ),
          SizedBox(height: 16),
          Text(
            'Question Bank',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          Text(
            'Browse and manage your questions',
            style: TextStyle(color: Colors.grey),
          ),
        ],
      ),
    );
  }
}
