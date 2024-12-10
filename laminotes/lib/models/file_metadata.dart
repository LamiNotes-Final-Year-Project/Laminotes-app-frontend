class FileMetadata {
  final String fileId;
  final String fileName;
  final DateTime lastModified;

  FileMetadata({
    required this.fileId,
    required this.fileName,
    required this.lastModified,
  });

  Map<String, dynamic> toJson() => {
        'fileId': fileId,
        'fileName': fileName,
        'lastModified': lastModified.toIso8601String(),
      };

  factory FileMetadata.fromJson(Map<String, dynamic> json) {
    return FileMetadata(
      fileId: json['fileId'] as String,
      fileName: json['fileName'] as String,
      lastModified: DateTime.parse(json['lastModified'] as String),
    );
  }
}