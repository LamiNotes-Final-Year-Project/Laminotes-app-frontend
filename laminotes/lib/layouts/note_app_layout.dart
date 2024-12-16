import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../widgets/auth_tabs.dart';
import '../widgets/colored_sections_overlay.dart';
import '../widgets/colored_markdown_view.dart';
import '../services/auth_service.dart';
import '../services/file_service.dart';
import '../services/metadata_service.dart';

final _storage = FlutterSecureStorage();

class NoteAppLayout extends StatefulWidget {
  const NoteAppLayout({super.key});
  @override
  NoteAppLayoutState createState() => NoteAppLayoutState();
}

class NoteAppLayoutState extends State<NoteAppLayout> {
  File? _currentFile;
  Directory? _currentDirectory;
  List<File> _filesInDirectory = [];
  String _markdownContent = '';
  bool isLeftSidebarOpen = true;
  bool isRightSidebarOpen = false;

  final TextEditingController _textController = TextEditingController();
  final AuthService authService = AuthService();
  final FileService fileService = FileService();
  final MetadataService metadataService = MetadataService();

  @override
  Widget build(BuildContext context) {
    String displayDirectoryName = _currentDirectory != null
        ? _currentDirectory!.path.split(Platform.pathSeparator).last
        : 'No Directory Selected';

    return Scaffold(
      backgroundColor: Colors.grey.shade100,
      appBar: AppBar(
        backgroundColor: Colors.grey.shade900,
        title: const Text(
          'Laminotes',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
        ),
        leading: IconButton(
          icon: Icon(
            isLeftSidebarOpen ? Icons.close : Icons.menu,
            color: Colors.white,
          ),
          onPressed: () {
            setState(() {
              isLeftSidebarOpen = !isLeftSidebarOpen;
            });
          },
        ),
        actions: [
          IconButton(
            icon: Icon(
              isRightSidebarOpen ? Icons.close : Icons.menu,
              color: Colors.white,
            ),
            onPressed: () {
              setState(() {
                isRightSidebarOpen = !isRightSidebarOpen;
              });
            },
          ),
          IconButton(
            icon: const Icon(Icons.save, color: Colors.white),
            onPressed: () async {
              await fileService.saveFile(_textController.text);
              setState(() {});
            },
          ),
          FutureBuilder<String?>(
            future: authService.getToken(),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const SizedBox.shrink();
              }
              if (snapshot.data != null) {
                return const SizedBox.shrink();
              }
              return IconButton(
                icon: const Icon(Icons.login, color: Colors.white),
                onPressed: _openAuthPopup,
              );
            },
          ),
        ],
      ),
      body: Row(
        children: [
          if (isLeftSidebarOpen) _buildLeftSidebar(displayDirectoryName),
          _buildEditorAndPreview(),
          if (isRightSidebarOpen) _buildRightSidebar(),
        ],
      ),
    );
  }

  Widget _buildLeftSidebar(String displayDirectoryName) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      width: 250,
      decoration: BoxDecoration(
        color: Colors.grey.shade800,
        borderRadius: const BorderRadius.only(
          topRight: Radius.circular(12),
          bottomRight: Radius.circular(12),
        ),
      ),
      child: Column(
        children: [
          GestureDetector(
            onTap: () async {
              await fileService.selectDirectory();
              setState(() {
                _filesInDirectory = fileService.filesInDirectory;
                _currentDirectory = fileService.currentDirectory;
              });
            },
            child: Padding(
              padding: const EdgeInsets.all(8.0),
              child: Text(
                displayDirectoryName,
                style: const TextStyle(
                  color: Colors.tealAccent,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: _filesInDirectory.length,
              itemBuilder: (context, index) {
                File file = _filesInDirectory[index];
                String fileName = file.path.split('/').last;
                return ListTile(
                  title: Text(
                    fileName,
                    style: const TextStyle(color: Colors.white),
                  ),
                  onTap: () async {
                    final content = await fileService.openFile(file);
                    setState(() {
                      _currentFile = file;
                      _markdownContent = content;
                      _textController.text = content;
                    });
                  },
                  trailing: IconButton(
                    icon: const Icon(Icons.edit, color: Colors.tealAccent),
                    onPressed: () async {
                      // Handle renaming the file
                    },
                  ),
                );
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.teal,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onPressed: () async {
                await fileService.addNewFile('Untitled.md', '');
                setState(() {
                  _filesInDirectory = fileService.filesInDirectory;
                });
              },
              child: const Text("Add File"),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEditorAndPreview() {
    return Expanded(
      flex: 5,
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Padding(
              padding: const EdgeInsets.all(8.0),
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black26,
                      blurRadius: 4,
                      offset: Offset(0, 2),
                    )
                  ],
                ),
                child: TextField(
                  controller: _textController,
                  maxLines: null,
                  decoration: const InputDecoration(
                    hintText: 'Start typing your text...',
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.all(12),
                  ),
                  onChanged: (text) {
                    setState(() {
                      _markdownContent = text;
                    });
                  },
                ),
              ),
            ),
          ),
          Expanded(
            flex: 2,
            child: Container(
              margin: const EdgeInsets.all(8.0),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black26,
                    blurRadius: 4,
                    offset: Offset(0, 2),
                  )
                ],
              ),
              child: ColoredMarkdownView(
                content: _markdownContent,
                userColors: const {
                  'user1': Colors.teal,
                  'user2': Colors.orangeAccent,
                  'user3': Colors.deepPurpleAccent,
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRightSidebar() {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      width: 250,
      decoration: BoxDecoration(
        color: Colors.grey.shade800,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(12),
          bottomLeft: Radius.circular(12),
        ),
      ),
      child: Column(
        children: [
          const DrawerHeader(
            decoration: BoxDecoration(color: Colors.teal),
            child: Text(
              'Right Sidebar',
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          ListTile(
            title: const Text('Upload All Files',
                style: TextStyle(color: Colors.tealAccent)),
            onTap: () async {
              await fileService.uploadFileWithMetadata(
                _currentFile?.path.split('/').last ?? 'Untitled.md',
                _textController.text,
                await metadataService.createMetadata(_currentFile!),
              );
            },
          ),
          ListTile(
            title: const Text('Download All Files',
                style: TextStyle(color: Colors.tealAccent)),
            onTap: () async {
              await fileService.downloadAllFiles();
              setState(() {
                _filesInDirectory = fileService.filesInDirectory;
              });
            },
          ),
          const Spacer(),
        ],
      ),
    );
  }

  void _openAuthPopup() {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return const Dialog(
          child: SizedBox(
            height: 400,
            child: Column(
              children: [
                Expanded(
                  child: TabBarViewWidget(),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}