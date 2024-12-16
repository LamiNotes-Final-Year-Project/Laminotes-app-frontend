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