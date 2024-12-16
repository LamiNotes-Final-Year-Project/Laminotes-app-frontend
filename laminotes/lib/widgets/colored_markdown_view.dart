import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'colored_sections_overlay.dart';

class ColoredMarkdownView extends StatelessWidget {
  final String content;
  final Map<String, Color> userColors;

  const ColoredMarkdownView({
    Key? key,
    required this.content,
    required this.userColors,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.grey[900],
      child: Container(
        margin: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.3),
              blurRadius: 6,
              offset: const Offset(2, 2),
            )
          ],
        ),
        child: Stack(
          children: [
            Markdown(
              data: content,
              styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context)).copyWith(
                p: const TextStyle(color: Colors.white70, fontSize: 16),
              ),
            ),
            if (userColors.isNotEmpty)
              Positioned.fill(
                child: ColoredSectionsOverlay(
                  content: content,
                  userColors: userColors,
                ),
              ),
          ],
        ),
      ),
    );
  }
}