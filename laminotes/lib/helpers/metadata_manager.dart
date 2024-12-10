import 'dart:io';
import 'dart:convert';
import '../models/file_metadata.dart';
import 'package:uuid/uuid.dart';

class MetadataManager {
  static const String metaExtension = '.meta';
  static final uuid = Uuid();

  /// Create initial metadata for a new file
  static Future<FileMetadata> createMetadata(File file) async {
    final metadata = FileMetadata(
      fileId: uuid.v4(),
      fileName: file.path.split(Platform.pathSeparator).last,
      lastModified: DateTime.now(),
    );

    await saveMetadata(file, metadata);
    return metadata;
  }

  /// Save metadata to a `.meta` file next to the file
  static Future<void> saveMetadata(File file, FileMetadata metadata) async {
    final metaFile = File('${file.path}$metaExtension');
    await metaFile.writeAsString(json.encode(metadata.toJson()));
  }

  /// Load metadata for a file
  static Future<FileMetadata?> loadMetadata(File file) async {
    final metaFile = File('${file.path}$metaExtension');
    if (await metaFile.exists()) {
      final content = await metaFile.readAsString();
      return FileMetadata.fromJson(json.decode(content));
    }
    return null;
  }

  /// Update metadata with a new last modified timestamp
  static Future<FileMetadata> updateLastModified(File file,
      {FileMetadata? existingMetadata}) async {
    final metadata = existingMetadata ??
        await loadMetadata(file) ??
        await createMetadata(file);

    final updatedMetadata = FileMetadata(
      fileId: metadata.fileId,
      fileName: metadata.fileName,
      lastModified: DateTime.now(),
    );

    await saveMetadata(file, updatedMetadata);
    return updatedMetadata;
  }

  static Future<FileMetadata> addCommit(
    File file,
    String content, {
    FileMetadata? existingMetadata,
  }) async {
    final metadata = existingMetadata ??
        await loadMetadata(file) ??
        await createMetadata(file);

    // Update the last modified timestamp
    final updatedMetadata = FileMetadata(
      fileId: metadata.fileId,
      fileName: metadata.fileName,
      lastModified: DateTime.now(),
    );

    // Save the updated metadata
    await saveMetadata(file, updatedMetadata);
    return updatedMetadata;
  }
}
