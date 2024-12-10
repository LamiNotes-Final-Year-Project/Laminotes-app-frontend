import 'dart:async';

import 'package:http/http.dart' as http;
import 'dart:io';
import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/file_metadata.dart';

final _storage = FlutterSecureStorage();

const String baseUrl = "http://127.0.0.1:9090"; // TODO: replace with server address

/// uploads file to server and returns the file name
Future<void> uploadFile(String filename, String content, {FileMetadata? metadata}) async {
  try {
    final url = Uri.parse('$baseUrl/upload/$filename');
    final response = await http.post(
      url,
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'file_content': content, // Use "file_content" to match backend
        'metadata': metadata?.toJson(), // Optional metadata
      }),
    );

    if (response.statusCode != 200) {
      throw HttpException("Failed to upload file: ${response.reasonPhrase}");
    }
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

Future<void> registerUser(String email, String password) async {
  final url = Uri.parse('$baseUrl/auth/register');
  final body = json.encode({'email': email, 'password': password});

  final response = await http.post(
    url,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body,
  );

  if (response.statusCode != 200) {
    throw Exception("Failed to register user: ${response.body}");
  }
}

Future<FileMetadata?> getFileMetadata(String filename) async {
  try {
    final url = Uri.parse('$baseUrl/metadata/$filename');
    final response = await http.get(url);

    if (response.statusCode == 200) {
      return FileMetadata.fromJson(json.decode(response.body));
    }
    return null;
  } catch (e) {
    throw Exception("Failed to get metadata: $e");
  }
}

/// Logs in a user and returns the JWT token
Future<String> loginUser(String email, String password) async {
  final url = Uri.parse('$baseUrl/auth/login');
  final body = json.encode({'email': email, 'password': password});

  final response = await http.post(
    url,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body,
  );

  print("Response status: ${response.statusCode}");
  print("Response headers: ${response.headers}");

  if (response.statusCode == 200) {
    // Extract the token from the 'Authorization' header
    final token = response.headers['authorization'];
    if (token == null || !token.startsWith("Bearer ")) {
      throw Exception("Token not found in response headers.");
    }

    return token.substring(7); // Strip the 'Bearer ' prefix
  } else if (response.statusCode == 401) {
    throw Exception("Invalid credentials. Please check your email and password.");
  } else {
    throw Exception("Failed to login: ${response.body}");
  }
}

Future<void> saveToken(String token) async {
  await _storage.write(key: 'auth_token', value: token);
}

Future<String?> getToken() async {
  return await _storage.read(key: 'auth_token');
}

Future<void> deleteToken() async {
  await _storage.delete(key: 'auth_token');
}