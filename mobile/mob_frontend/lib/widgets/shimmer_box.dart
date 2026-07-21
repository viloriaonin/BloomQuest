import 'package:flutter/material.dart';

Widget buildShimmerBox(double width, double height, double drift, {double radius = 6}) {
  final base = Colors.grey.shade200;
  final highlight = Colors.grey.shade100;
  final double center = drift.clamp(0.0, 1.0);
  final double left = (center - 0.25).clamp(0.0, 1.0);
  final double right = (center + 0.25).clamp(0.0, 1.0);

  return ClipRRect(
    borderRadius: BorderRadius.circular(radius),
    child: Container(
      width: width.isFinite ? width : double.infinity,
      height: height,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [base, highlight, base],
          stops: [left, center, right],
          begin: Alignment(-1, 0),
          end: Alignment(1, 0),
        ),
      ),
    ),
  );
}
