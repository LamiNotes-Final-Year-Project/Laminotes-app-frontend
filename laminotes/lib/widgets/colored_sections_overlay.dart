import 'package:flutter/material.dart';

class ColoredSectionsOverlay extends StatelessWidget {
  final String content;
  final Map<String, Color> userColors;

  const ColoredSectionsOverlay({
    required this.content,
    required this.userColors,
    Key? key,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: ColoredSectionsPainter(
        content: content,
        userColors: userColors,
      ),
    );
  }
}

class ColoredSectionsPainter extends CustomPainter {
  final String content;
  final Map<String, Color> userColors;

  ColoredSectionsPainter({
    required this.content,
    required this.userColors,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..style = PaintingStyle.fill;
    final paragraphs = content.split('\n\n');
    if (paragraphs.isEmpty) return;

    final height = size.height / paragraphs.length;
    double currentY = 0;

    for (var i = 0; i < paragraphs.length; i++) {
      if (userColors.isNotEmpty) {
        final color = userColors.values.elementAt(i % userColors.length);
        paint.color = color.withOpacity(0.1);
        canvas.drawRect(
          Rect.fromLTWH(0, currentY, size.width, height),
          paint,
        );
      }
      currentY += height;
    }
  }

  @override
  bool shouldRepaint(ColoredSectionsPainter oldDelegate) {
    return content != oldDelegate.content ||
        userColors != oldDelegate.userColors;
  }
}