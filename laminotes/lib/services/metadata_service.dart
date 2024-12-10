import 'dart:io';
import '../models/file_metadata.dart';
import 'api_service.dart';
import '../helpers/metadata_manager.dart';
import 'api_service.dart';

class MetadataService {
  Future<FileMetadata?> loadMetadata(File file) async {
    return await MetadataManager.loadMetadata(file);
  }

  Future<FileMetadata> createMetadata(File file) async {
    return await MetadataManager.createMetadata(file);
  }

  /// Save metadata to a local file.
  Future<void> saveMetadata(File file, FileMetadata metadata) async {
    await MetadataManager.saveMetadata(file, metadata);
  }

  Future<FileMetadata> addCommit(File file, String content,
      {FileMetadata? existingMetadata}) async {
    return await MetadataManager.addCommit(file, content,
        existingMetadata: existingMetadata);
  }

  Future<void> uploadFileMetadataToBackend(
      String filename, String content, FileMetadata metadata) async {
    await uploadFile(filename, content, metadata: metadata);
  }

  Future<FileMetadata?> downloadFileMetadata(String filename) async {
    return await getFileMetadata(filename);
  }
}
