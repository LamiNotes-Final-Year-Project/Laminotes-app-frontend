import 'dart:async';

import 'package:http/http.dart' as http;
import 'dart:io';
import 'dart:convert';

const String baseUrl = "http://127.0.0.1:9090"; // TODO: replace with server address

/// uploads file to server and returns the file name
Future<void> uploadFile(String filename, String content) async {
  try {
    final basename = filename.split(Platform.pathSeparator).last; // get the file name
    final url = Uri.parse('$baseUrl/upload/$basename');

    final response = await http.post(
      url,
      headers: { // set headers
        'Content-Type': 'text/plain',
        'Content-Length': content.length.toString(),
        'Accept': '*/*',
      },
      body: content,
    ).timeout(
      const Duration(seconds: 5),
      onTimeout: () {
        throw TimeoutException('Request timed out after 5 seconds');
      },
    );

    if (response.statusCode != 200) {
      throw HttpException("Failed to upload file: ${response.reasonPhrase}");
    }
  } on TimeoutException {
    throw Exception("Connection timed out. Please check if the server is running and accessible.");
  } on SocketException catch (e) {
    throw Exception("Cannot connect to server. Please check if it's running and accessible.");
  } catch (e) {
    throw Exception("Upload failed: $e");
  }
}

/// Fetches a file's content from the server by filename
Future<String?> getFile(String filename) async {
  try {
    final basename = filename.split(Platform.pathSeparator).last;
    final url = Uri.parse('$baseUrl/files/$basename'); // get the file content
    final response = await http.get(url);

    if (response.statusCode == 200) {
      return response.body;
    } else {
      throw HttpException("Failed to get file: ${response.reasonPhrase}");
    }
  } on SocketException {
    throw Exception("Cannot connect to server. Make sure it's running and accessible.");
  } catch (e) {
    throw Exception("Failed to get file: $e");
  }
}


/// Lists all files available on the backend
Future<List<String>> listFiles() async {
  final url = Uri.parse('$baseUrl/list-files');
  try {
    final response = await http.get(url);

    if (response.statusCode == 200) {
      List<dynamic> files = jsonDecode(response.body);
      return files.cast<String>();
    } else {
      throw HttpException("Failed to list files: ${response.reasonPhrase}");
    }
  } on SocketException {
    throw Exception("Cannot connect to server. Make sure it's running and accessible.");
  } catch (e) {
    throw Exception("Failed to list files: $e");
  }
}