class MarkdownMetadata {
  final String documentId;
  final List<DocumentChange> changes;
  final Map<String, String> userColors; // userId -> color
  final DateTime lastModified;

  MarkdownMetadata({
    required this.documentId,
    required this.changes,
    required this.userColors,
    required this.lastModified,
  });

  /// Convert to JSON for storage or transmission.
  Map<String, dynamic> toJson() => {
        'documentId': documentId,
        'changes': changes.map((c) => c.toJson()).toList(),
        'userColors': userColors,
        'lastModified': lastModified.toIso8601String(),
      };

  /// Deserialize from JSON. Throws an exception if any required field is missing.
  factory MarkdownMetadata.fromJson(Map<String, dynamic> json) {
    try {
      return MarkdownMetadata(
        documentId: json['documentId'],
        changes: (json['changes'] as List)
            .map((c) => DocumentChange.fromJson(c))
            .toList(),
        userColors: Map<String, String>.from(json['userColors']),
        lastModified: DateTime.parse(json['lastModified']),
      );
    } catch (e) {
      throw Exception('Failed to parse MarkdownMetadata: $e');
    }
  }
}

class DocumentChange {
  final String userId;
  final String username;
  final DateTime timestamp;
  final List<TextSection> sections;

  DocumentChange({
    required this.userId,
    required this.username,
    required this.timestamp,
    required this.sections,
  });

  Map<String, dynamic> toJson() => {
        'userId': userId,
        'username': username,
        'timestamp': timestamp.toIso8601String(),
        'sections': sections.map((s) => s.toJson()).toList(),
      };

  factory DocumentChange.fromJson(Map<String, dynamic> json) {
    try {
      return DocumentChange(
        userId: json['userId'],
        username: json['username'],
        timestamp: DateTime.parse(json['timestamp']),
        sections: (json['sections'] as List)
            .map((s) => TextSection.fromJson(s))
            .toList(),
      );
    } catch (e) {
      throw Exception('Failed to parse DocumentChange: $e');
    }
  }
}

class TextSection {
  final int startIndex;
  final int endIndex;
  final String content;

  TextSection({
    required this.startIndex,
    required this.endIndex,
    required this.content,
  });

  Map<String, dynamic> toJson() => {
        'startIndex': startIndex,
        'endIndex': endIndex,
        'content': content,
      };

  factory TextSection.fromJson(Map<String, dynamic> json) {
    try {
      return TextSection(
        startIndex: json['startIndex'],
        endIndex: json['endIndex'],
        content: json['content'],
      );
    } catch (e) {
      throw Exception('Failed to parse TextSection: $e');
    }
  }
}