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
      painter: ColoredSectionsPainter(content: content, userColors: userColors),
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
    final lines = content.split('\n');
    final height = size.height / lines.length;

    double currentY = 0;
    for (var i = 0; i < lines.length; i++) {
      final color = userColors.values.elementAt(i % userColors.length);
      paint.color = color.withOpacity(0.15);
      canvas.drawRect(Rect.fromLTWH(0, currentY, size.width, height), paint);
      currentY += height;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}