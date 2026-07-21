import 'package:flutter/material.dart';

extension ColorValues on Color {
  Color withValues({double? alpha}) => withOpacity(alpha ?? 1.0);
}

// Core color tokens used across the app
const Color kLightBgColor = Color(0xFFF8F9FA);
const Color kBorderColor = Color(0xFFE6E6E6);
const Color kAccentOrange = Color(0xFFEF6C00);
const Color kDarkButtonColor = Color(0xFF1F2937);
const Color kPrimarySlate = Color(0xFF334155);
const Color kTextDark = Color(0xFF0F172A);
const Color kTextMuted = Color(0xFF6B7280);
const Color kBorderOutline = Color(0xFFE5E7EB);

// Small helpers
const double kDefaultRadius = 12.0;
