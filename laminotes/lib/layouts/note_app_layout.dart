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
      appBar: AppBar(
        title: const Text('Laminotes'),
        leading: IconButton(
          icon: Icon(isLeftSidebarOpen ? Icons.close : Icons.menu),
          onPressed: () {
            setState(() {
              isLeftSidebarOpen = !isLeftSidebarOpen;
            });
          },
        ),
        actions: [
          IconButton(
            icon: Icon(isRightSidebarOpen ? Icons.close : Icons.menu),
            onPressed: () {
              setState(() {
                isRightSidebarOpen = !isRightSidebarOpen;
              });
            },
          ),
          IconButton(
            icon: const Icon(Icons.save),
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
                icon: const Icon(Icons.login),
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
      color: Theme.of(context).colorScheme.secondary,
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
                    color: Colors.green,
                    fontSize: 16,
                    fontWeight: FontWeight.bold),
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
                    icon: const Icon(Icons.edit, color: Colors.white),
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
              onPressed: () async {
                await fileService.addNewFile('Untitled.md', '');
                setState(() {
                  _filesInDirectory = fileService.filesInDirectory;
                });
              },
              child: const Text("Add File"),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close, color: Colors.white),
            onPressed: () {
              setState(() {
                isLeftSidebarOpen = false;
              });
            },
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
              child: Column(
                children: [
                  const Text(
                    'Editor',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  Expanded(
                    child: TextField(
                      controller: _textController,
                      maxLines: null,
                      decoration: const InputDecoration(
                        hintText: 'Start typing your text...',
                        border: OutlineInputBorder(),
                      ),
                      onChanged: (text) {
                        setState(() {
                          _markdownContent = text;
                        });
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
          const VerticalDivider(width: 1, color: Colors.grey),
          Expanded(
            flex: 2,
            child: Padding(
              padding: const EdgeInsets.all(8.0),
              child: Column(
                children: [
                  const Text(
                    'Preview',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  Expanded(
                    child: ColoredMarkdownView(
                      content: _markdownContent,
                      userColors: const {
                        'user1': Colors.blue,
                        'user2': Colors.red,
                        'user3': Colors.green,
                      },
                    ),
                  ),
                ],
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
      color: Theme.of(context).colorScheme.secondary,
      child: Column(
        children: [
          DrawerHeader(
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.secondary,
            ),
            child: const Text('Right Sidebar',
                style: TextStyle(color: Colors.white)),
          ),
          ListTile(
            title: const Text('Upload All Files',
                style: TextStyle(color: Colors.white)),
            onTap: () async {
              await fileService.uploadFileWithMetadata(
                _currentFile?.path.split('/').last ??
                    'Untitled.md', // Use the file's name or a default
                _textController.text, // Use the editor's content
                await metadataService.createMetadata(
                    _currentFile!), // Create metadata for the file
              );
            },
          ),
          ListTile(
            title: const Text('Download All Files',
                style: TextStyle(color: Colors.white)),
            onTap: () async {
              await fileService.downloadAllFiles();
              setState(() {
                _filesInDirectory = fileService.filesInDirectory;
              });
            },
          ),
          const Spacer(),
          IconButton(
            icon: const Icon(Icons.close, color: Colors.white),
            onPressed: () {
              setState(() {
                isRightSidebarOpen = false;
              });
            },
          ),
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
