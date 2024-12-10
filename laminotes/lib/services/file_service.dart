import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'api_service.dart';
import 'metadata_service.dart'; // To handle metadata logic if needed
import '../models/file_metadata.dart';

class FileService {
  static const BASE_URL = "http://localhost:9090";
  Directory? currentDirectory;
  File? currentFile;
  List<File> filesInDirectory = [];

  Future<void> selectDirectory() async {
    String? selectedDirectory = await FilePicker.platform.getDirectoryPath();
    if (selectedDirectory != null) {
      currentDirectory = Directory(selectedDirectory);
      refreshFileList();
    }
  }

  /// Refresh the file list based on the current directory
  void refreshFileList() {
    if (currentDirectory != null) {
      filesInDirectory = currentDirectory!
          .listSync()
          .whereType<File>()
          .where(
              (file) => file.path.endsWith('.md') || file.path.endsWith('.txt'))
          .toList();
    }
  }

  /// Open a file and return its content as a string
  Future<String> openFile(File file) async {
    String content = await file.readAsString();
    currentFile = file;
    return content;
  }

  /// Save the current file with the given content.
  /// If currentFile is null, prompt for a new file name/location unless a [newFilePath] is provided.
  Future<void> saveFile(String content, {String? newFilePath}) async {
    if (currentFile != null) {
      await currentFile!.writeAsString(content);
      return;
    }

    String? outputFilePath = newFilePath ??
        await FilePicker.platform.saveFile(
          dialogTitle: 'Save As',
          fileName: 'Untitled.md',
          type: FileType.custom,
          allowedExtensions: ['md', 'txt'],
        );

    if (outputFilePath != null) {
      File newFile = File(outputFilePath);
      await newFile.writeAsString(content);
      currentFile = newFile;
      refreshFileList();
    }
  }

  /// Create a new file in the current directory
  Future<File?> addNewFile(String fileName, String initialContent) async {
    if (currentDirectory != null) {
      if (fileName.isEmpty) {
        fileName = 'Untitled';
      }
      String newFilePath = '${currentDirectory!.path}/$fileName.md';
      File newFile = File(newFilePath);
      await newFile.writeAsString(initialContent);
      refreshFileList();
      return newFile;
    }
    return null;
  }

  /// Rename an existing file
  Future<File?> renameFile(File file, String newFileName) async {
    if (newFileName.isNotEmpty) {
      String newPath = '${file.parent.path}/$newFileName.md';
      File renamedFile = file.renameSync(newPath);
      if (currentFile == file) {
        currentFile = renamedFile;
      }
      refreshFileList();
      return renamedFile;
    }
    return null;
  }

  /// Upload all files in the current directory to the backend
  Future<void> uploadFileWithMetadata(String filename, String content, FileMetadata? metadata) async {
    final url = Uri.parse('$BASE_URL/upload/$filename');

    final body = {
      'file_content': content,
      'metadata': metadata?.toJson(),
    };

    final response = await http.post(
      url,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to upload file with metadata: ${response.body}');
    }
  }

  /// Download all files from the backend into the current directory
  Future<void> downloadAllFiles() async {
    if (currentDirectory != null) {
      List<String> serverFiles = await listFiles();

      for (String filename in serverFiles) {
        String? content = await getFile(filename);
        if (content != null) {
          File file = File('${currentDirectory!.path}/$filename');
          await file.writeAsString(content);
        }
      }
      refreshFileList();
    }
  }

  String getCurrentDirectoryName() {
    return currentDirectory != null
        ? currentDirectory!.path.split(Platform.pathSeparator).last
        : 'No Directory Selected';
  }
}
