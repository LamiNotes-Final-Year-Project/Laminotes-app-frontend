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
    return Column(
      children: [
        Expanded(
          child: Stack(
            children: [
              Markdown(
                data: content,
                styleSheet:
                    MarkdownStyleSheet.fromTheme(Theme.of(context)).copyWith(
                  p: const TextStyle(color: Colors.black),
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
      ],
    );
  }
}