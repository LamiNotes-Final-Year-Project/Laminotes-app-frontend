import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:file_picker/file_picker.dart';
import 'dart:io';

/// module imports

import 'api_service.dart';

void main() => runApp(const MyApp());

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    final Color primaryColor = const Color.fromARGB(255, 58, 77, 186); 
    final Color secondaryColor = const Color.fromARGB(255, 111, 74, 52); 
    final Color accentColor = const Color.fromARGB(255, 106, 91, 4); 
    final Color backgroundColor = const Color.fromARGB(255, 235, 229, 167); 
    const Color textColor = Colors.black;

    return MaterialApp(
      title: 'Laminotes',
      theme: ThemeData(
        primaryColor: primaryColor,
        scaffoldBackgroundColor: backgroundColor,
        colorScheme: ColorScheme.fromSwatch().copyWith(
          primary: primaryColor,
          secondary: accentColor,
          background: backgroundColor,
        ),
        appBarTheme: AppBarTheme(
          color: primaryColor,
          titleTextStyle: const TextStyle(color: Colors.black, fontSize: 20),
        ),
        buttonTheme: ButtonThemeData(
          buttonColor: secondaryColor,
          textTheme: ButtonTextTheme.primary,
        ),
        textTheme: const TextTheme(
          bodyLarge: TextStyle(color: textColor),
          bodyMedium: TextStyle(color: textColor),
        ),
      ),
      home: const NoteAppLayout(),
    );
  }
}

class NoteAppLayout extends StatefulWidget {
  const NoteAppLayout({super.key});

  @override
  _NoteAppLayoutState createState() => _NoteAppLayoutState();
}

class _NoteAppLayoutState extends State<NoteAppLayout> {
  final TextEditingController _textController = TextEditingController();
  String _markdownContent = '';
  bool isLeftSidebarOpen = true;
  bool isRightSidebarOpen = false;
  Directory? _currentDirectory;
  List<File> _filesInDirectory = [];
  File? _currentFile;


// Refreshes the file list in the directory for when sync operations happen
void _refreshFileList() {
    if (_currentDirectory != null) {
      setState(() {
        _filesInDirectory = _currentDirectory!
            .listSync()
            .whereType<File>()
            .where((file) => file.path.endsWith('.md') || file.path.endsWith('.txt'))
            .toList();
      });
    }
  }

  // Uploads all files in the current directory to the backend
  Future<void> _uploadAllFiles() async {
    if (_currentDirectory != null) {
      for (File file in _filesInDirectory) {
        String content = await file.readAsString();
        await uploadFile(file.path.split('/').last, content);
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('All files uploaded to backend')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No directory selected')),
      );
    }
  }

  // Downloads all files from the backend to the current directory
  Future<void> _downloadAllFiles() async {
    if (_currentDirectory != null) {
      try {
        List<String> serverFiles = await listFiles();
        bool filesDownloaded = false;
        
        // Download each file from the server
        for (String filename in serverFiles) {
          String? content = await getFile(filename);
          if (content != null) {
            File file = File('${_currentDirectory!.path}/$filename');
            await file.writeAsString(content);
            filesDownloaded = true;
          }
        }

        if (filesDownloaded) {
          _refreshFileList(); // Refresh file hierarchy
          
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('All files downloaded from backend')),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('No new files to download')),
          );
        }
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to download files: $e')),
        );
      }
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No directory selected')),
      );
    }
}


  // Allows selection of directory made via user
  Future<void> _selectDirectory() async {
    String? selectedDirectory = await FilePicker.platform.getDirectoryPath();
    if (selectedDirectory != null) {
      setState(() {
        _currentDirectory = Directory(selectedDirectory);
        _filesInDirectory = _currentDirectory!
            .listSync()
            .whereType<File>()
            .where((file) => file.path.endsWith('.md') || file.path.endsWith('.txt'))
            .toList();
      });
    }
  }

  // Allows user to open a file selected in directory
  Future<void> _openFile(File file) async {
    String content = await file.readAsString();
    setState(() {
      _currentFile = file;
      _textController.text = content;
      _markdownContent = content;
    });
  }

  // Saves pre-existing file or prompts user to save file
  Future<void> _saveFile() async {
    if (_currentFile != null) {
      await _currentFile!.writeAsString(_textController.text);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('File saved successfully')),
      );
    } else {
      String? outputFilePath = await FilePicker.platform.saveFile(
        dialogTitle: 'Save As',
        fileName: 'Untitled.md',
        type: FileType.custom,
        allowedExtensions: ['md', 'txt'],
      );

      if (outputFilePath != null) {
        File newFile = File(outputFilePath);
        await newFile.writeAsString(_textController.text);
        setState(() {
          _currentFile = newFile;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('File saved successfully')),
        );
      }
    }
  }

  // Allows user to create a new file 
  Future<void> _addNewFile() async {
    if (_currentDirectory != null) {
      String? fileName = await showDialog<String>(
        context: context,
        builder: (BuildContext context) {
          TextEditingController fileNameController = TextEditingController();
          return AlertDialog(
            title: const Text("Enter File Name"),
            content: TextField(
              controller: fileNameController,
              decoration: const InputDecoration(hintText: "File name"),
            ),
            actions: [
              TextButton(
                child: const Text("Cancel"),
                onPressed: () {
                  Navigator.of(context).pop();
                },
              ),
              TextButton(
                child: const Text("Create"),
                onPressed: () {
                  Navigator.of(context).pop(fileNameController.text);
                },
              ),
            ],
          );
        },
      );

      if (fileName == null || fileName.isEmpty) {
        fileName = 'Untitled';
      }
      String newFilePath = '${_currentDirectory!.path}/$fileName.md';
      File newFile = File(newFilePath);
      await newFile.writeAsString('# New File\nStart editing...');

      _refreshFileList(); // Refresh file hierarchy
      _openFile(newFile);
    }
  }


  // Renames file based on user input
   Future<void> _renameFile(File file) async {
    String? newFileName = await showDialog<String>(
      context: context,
      builder: (BuildContext context) {
        TextEditingController renameController = TextEditingController();
        return AlertDialog(
          title: const Text("Rename File"),
          content: TextField(
            controller: renameController,
            decoration: const InputDecoration(hintText: "New file name"),
          ),
          actions: [
            TextButton(
              child: const Text("Cancel"),
              onPressed: () {
                Navigator.of(context).pop();
              },
            ),
            TextButton(
              child: const Text("Rename"),
              onPressed: () {
                Navigator.of(context).pop(renameController.text);
              },
            ),
          ],
        );
      },
    );

    if (newFileName != null && newFileName.isNotEmpty) {
      String newPath = '${file.parent.path}/$newFileName.md';
      File renamedFile = file.renameSync(newPath);
      if (_currentFile == file) {
        _currentFile = renamedFile;
      }
      _refreshFileList(); // Refresh file hierarchy
    }
  }

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
            onPressed: _saveFile,
          ),
        ],
      ),
      body: Row(
        children: [
          // Left sidebar
          if (isLeftSidebarOpen)
            AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              width: isLeftSidebarOpen ? 250 : 0,
              color: Theme.of(context).colorScheme.secondary,
              child: Column(
                children: [
                  GestureDetector(
                    onTap: _selectDirectory,
                    child: Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Text(
                        displayDirectoryName,
                        style: const TextStyle(color: Colors.green, fontSize: 16, fontWeight: FontWeight.bold),
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
                          title: Text(fileName, style: const TextStyle(color: Colors.white)),
                          onTap: () => _openFile(file),
                          trailing: IconButton(
                            icon: const Icon(Icons.edit, color: Colors.white),
                            onPressed: () => _renameFile(file),
                          ),
                        );
                      },
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(8.0),
                    child: ElevatedButton(
                      onPressed: _addNewFile,
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
            ),

          // Main content (Editor + Preview)
          Expanded(
            flex: 5,
            child: Row(
              children: [
                // Text Editor
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
                const VerticalDivider(
                  width: 1,
                  color: Colors.grey,
                ),
                // Preview Window
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
                          child: Markdown(
                            data: _markdownContent,
                            styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context)).copyWith(
                              p: const TextStyle(color: Colors.black),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Right sidebar
          if (isRightSidebarOpen)
            AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            width: 250,
            color: Theme.of(context).colorScheme.secondary,
            child: Column(
              children: [
                DrawerHeader(
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.secondary,
                  ),
                  child: const Text('Right Sidebar', style: TextStyle(color: Colors.white)),
                ),
                ListTile(
                  title: const Text('Upload All Files', style: TextStyle(color: Colors.white)),
                  onTap: _uploadAllFiles,
                ),
                ListTile(
                  title: const Text('Download All Files', style: TextStyle(color: Colors.white)),
                  onTap: _downloadAllFiles,
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
      )],
      ),
    );
  }
}