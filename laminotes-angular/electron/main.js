const { app, BrowserWindow } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');

// Default base directory in user's Documents folder
let baseDirectory = path.join(app.getPath('documents'), 'Laminotes');

// Keep a global reference of the window object
let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Get the actual path to the built Angular app
  const angularDistPath = path.join(__dirname, '..', 'dist', 'laminotes-angular', 'browser', 'index.html');
  console.log('Looking for Angular app at:', angularDistPath);

  // Check if the file exists
  if (fs.existsSync(angularDistPath)) {
    console.log('Angular app found, loading from:', angularDistPath);
    mainWindow.loadFile(angularDistPath);
  } else {
    console.log('Angular app not found at expected path, trying alternate path...');

    // Try alternate path without "browser" subdirectory (for older Angular versions)
    const alternatePath = path.join(__dirname, '..', 'dist', 'laminotes-angular', 'index.html');

    if (fs.existsSync(alternatePath)) {
      console.log('Angular app found at alternate path:', alternatePath);
      mainWindow.loadFile(alternatePath);
    } else {
      console.log('Angular app not found, trying development server...');
      mainWindow.loadURL('http://localhost:4200');
    }
  }

  // Open the DevTools
  mainWindow.webContents.openDevTools();

  // Handle window being closed
  mainWindow.on('closed', function() {
    mainWindow = null;
  });
}

// In your electron/main.js file, add or verify these IPC handlers:
const { ipcMain, dialog } = require('electron');

// For opening files
ipcMain.handle('open-file', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, message: 'Open cancelled' };
    }

    const filePath = filePaths[0];
    const content = fs.readFileSync(filePath, 'utf8');

    return {
      success: true,
      filePath,
      content,
      message: 'File opened successfully'
    };
  } catch (error) {
    console.error('Error opening file:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

// For saving files
ipcMain.handle('save-file', async (event, { content, filePath, saveAs, getPathOnly }) => {
  try {
    console.log('Save-file handler called with:', { 
      content: content ? `Content provided (${content.length} chars)` : 'No content', 
      filePath, 
      saveAs,
      getPathOnly 
    });
    let targetPath = filePath;

    // ALWAYS show save dialog if saveAs is true (regardless of path)
    // or if no path provided or path doesn't look like a real file path
    if (saveAs || !targetPath || !targetPath.includes('/')) {
      console.log('Showing save dialog, saveAs:', saveAs, 'targetPath:', targetPath);
      
      // Use a default filename if none is provided
      let defaultPath = targetPath || 'untitled.md';
      
      // If it might be a UUID-based path from localStorage, extract just the filename
      if (defaultPath.includes('/')) {
        defaultPath = defaultPath.split('/').pop();
      }
      
      // For paths that don't have directory structure, use our base directory
      defaultPath = path.join(baseDirectory, defaultPath);
      
      // Ensure proper extension
      if (!defaultPath.toLowerCase().endsWith('.md')) {
        defaultPath += '.md';
      }
      
      console.log('Using default path for save dialog:', defaultPath);
      
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Save File',
        defaultPath: defaultPath,
        filters: [
          { name: 'Markdown', extensions: ['md'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['createDirectory', 'showOverwriteConfirmation']
      });

      console.log('Save dialog result:', result);

      if (result.canceled || !result.filePath) {
        console.log('Save was canceled by user');
        return { success: false, message: 'Save cancelled' };
      }

      targetPath = result.filePath;
      
      // If we're just getting the path, return it now
      if (getPathOnly) {
        console.log('Returning path only:', targetPath);
        return {
          success: true,
          filePath: targetPath,
          message: 'Path selected successfully'
        };
      }
    }

    // Make sure we have content to save
    if (!content && !getPathOnly) {
      console.error('No content provided for save');
      return {
        success: false,
        message: 'No content provided to save'
      };
    }

    // Make sure the directory exists
    const dirPath = path.dirname(targetPath);
    if (!fs.existsSync(dirPath)) {
      console.log('Creating directory:', dirPath);
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Write the file (skip if we're just getting the path)
    if (!getPathOnly) {
      console.log('Writing file to:', targetPath);
      fs.writeFileSync(targetPath, content);
      console.log('File saved successfully');
    }
    
    return {
      success: true,
      filePath: targetPath,
      message: getPathOnly ? 'Path selected successfully' : 'File saved successfully'
    };
  } catch (error) {
    console.error('Error saving file:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

// For checking if file exists
ipcMain.handle('check-file', (event, filePath) => {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    console.error('Error checking file:', error);
    return false;
  }
});

ipcMain.handle('show-prompt-dialog', async (event, options) => {
  const { title, label, value } = options;

  // In Electron we need to use custom dialog for input
  try {
    // Create an input dialog using BrowserWindow
    const promptWindow = new BrowserWindow({
      width: 400,
      height: 200,
      parent: mainWindow,
      modal: true,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${title || 'Input'}</title>
        <style>
          body { font-family: sans-serif; padding: 20px; }
          button { margin-top: 10px; margin-right: 10px; padding: 5px 10px; }
          input { width: 100%; padding: 5px; }
        </style>
      </head>
      <body>
        <h3>${label || 'Please enter a value:'}</h3>
        <input type="text" id="inputField" value="${value || ''}" />
        <div>
          <button id="okButton">OK</button>
          <button id="cancelButton">Cancel</button>
        </div>
        <script>
          const { ipcRenderer } = require('electron');
          document.getElementById('okButton').addEventListener('click', () => {
            const value = document.getElementById('inputField').value;
            ipcRenderer.send('prompt-response', { success: true, value });
          });
          document.getElementById('cancelButton').addEventListener('click', () => {
            ipcRenderer.send('prompt-response', { success: false, value: null });
          });
          document.getElementById('inputField').focus();
          document.getElementById('inputField').addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
              const value = document.getElementById('inputField').value;
              ipcRenderer.send('prompt-response', { success: true, value });
            }
            if (e.key === 'Escape') {
              ipcRenderer.send('prompt-response', { success: false, value: null });
            }
          });
        </script>
      </body>
      </html>
    `;

    // Create a temporary HTML file
    const tempPath = path.join(app.getPath('temp'), 'prompt-dialog.html');
    fs.writeFileSync(tempPath, htmlContent);
    
    promptWindow.loadFile(tempPath);
    promptWindow.once('ready-to-show', () => {
      promptWindow.show();
    });

    return new Promise((resolve) => {
      ipcMain.once('prompt-response', (event, result) => {
        promptWindow.close();
        // Clean up temp file
        try { fs.unlinkSync(tempPath); } catch (e) { /* ignore */ }
        resolve(result);
      });
      
      promptWindow.on('closed', () => {
        resolve({ success: false, value: null });
        // Clean up temp file
        try { fs.unlinkSync(tempPath); } catch (e) { /* ignore */ }
      });
    });
  } catch (error) {
    console.error('Error showing prompt dialog:', error);
    // Fallback to basic dialog
    const { response } = await dialog.showMessageBox(mainWindow, {
      title: title || 'Input',
      message: `${label || 'Please enter a value:'} (Cannot show input field due to error)`,
      buttons: ['OK', 'Cancel'],
      defaultId: 0,
      cancelId: 1
    });
    
    if (response === 0) {
      return { success: true, value: value || '' };
    } else {
      return { success: false, value: null };
    }
  }
});

ipcMain.handle('create-directory', async (event, dirPath) => {
  try {
    if (fs.existsSync(dirPath)) {
      return { success: false, message: 'Directory already exists' };
    }

    fs.mkdirSync(dirPath, { recursive: true });
    return {
      success: true,
      message: 'Directory created successfully'
    };
  } catch (error) {
    console.error('Error creating directory:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

// IPC handler for deleting files
ipcMain.handle('delete-file', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, message: 'File does not exist' };
    }

    fs.unlinkSync(filePath);
    return {
      success: true,
      message: 'File deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting file:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

// IPC handler for renaming files
ipcMain.handle('rename-file', async (event, oldPath, newPath) => {
  try {
    console.log(`Attempting to rename file from "${oldPath}" to "${newPath}"`);
    
    if (!fs.existsSync(oldPath)) {
      console.log(`Source file does not exist: ${oldPath}`);
      return { success: false, message: 'Source file does not exist' };
    }

    // Create destination directory if it doesn't exist
    const destDir = path.dirname(newPath);
    if (!fs.existsSync(destDir)) {
      console.log(`Creating destination directory: ${destDir}`);
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Handle the case where destination file exists
    if (fs.existsSync(newPath)) {
      console.log(`Destination file already exists: ${newPath}`);
      // Ask user if they want to overwrite
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Overwrite', 'Cancel'],
        title: 'File Already Exists',
        message: 'The destination file already exists. Do you want to overwrite it?'
      });
      
      if (response === 1) { // Cancel
        return { success: false, message: 'Rename cancelled - destination file exists' };
      }
      
      // If overwrite, delete the existing file first
      fs.unlinkSync(newPath);
    }

    // Perform the rename
    fs.renameSync(oldPath, newPath);
    console.log(`File successfully renamed from "${oldPath}" to "${newPath}"`);
    
    return {
      success: true,
      message: 'File renamed successfully'
    };
  } catch (error) {
    console.error('Error renaming file:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

// Directory selection dialog
ipcMain.handle('select-directory', async (event, initialPath) => {
  try {
    console.log('Select directory handler called', initialPath ? `with initial path: ${initialPath}` : '');
    
    // Use either the provided initialPath, the base directory, or the user's documents folder
    const startPath = initialPath || baseDirectory;
    
    // If initialPath is provided but directory selection UI should be skipped
    // (this is used for refreshing an existing directory without showing the dialog)
    if (initialPath && fs.existsSync(initialPath)) {
      // Just read the directory contents and return them
      console.log(`Reading directory contents from: ${initialPath}`);
      
      // List the files in the selected directory with .md extension
      const files = fs.readdirSync(initialPath)
        .filter(fileName => fileName.endsWith('.md'))
        .map(fileName => ({
          path: `${initialPath}/${fileName}`,
          name: fileName
        }));
        
      console.log(`Found ${files.length} files in directory`);
      
      return {
        success: true,
        dirPath: initialPath,
        files: files,
        message: 'Directory contents read successfully'
      };
    }
    
    // Otherwise show the directory selection dialog
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Directory for Notes',
      defaultPath: startPath, // Use provided path or our default base directory
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Select This Folder'
    });

    console.log('Directory selection result:', { canceled, filePaths });

    if (canceled || filePaths.length === 0) {
      return { success: false, message: 'No directory selected' };
    }

    // Get the selected directory path
    const dirPath = filePaths[0];
    console.log('Selected directory:', dirPath);
    
    // Ensure the directory exists
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    // List the files in the selected directory with .md extension
    const files = fs.readdirSync(dirPath)
      .filter(fileName => fileName.endsWith('.md'))
      .map(fileName => ({
        path: `${dirPath}/${fileName}`,
        name: fileName
      }));
      
    console.log('Found files:', files);

    return {
      success: true,
      dirPath: dirPath,
      files: files,
      message: 'Directory selected successfully'
    };
  } catch (error) {
    console.error('Error selecting directory:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

// Add an IPC listener for the prompt-response event
ipcMain.on('prompt-response', (event, arg) => {
  // This is handled in the dialog promise in show-prompt-dialog
  console.log('Prompt response received:', arg);
});

// Create window when Electron has finished initialization
app.whenReady().then(() => {
  // Ensure base directory exists
  if (!fs.existsSync(baseDirectory)) {
    try {
      fs.mkdirSync(baseDirectory, { recursive: true });
      console.log(`Created base directory at: ${baseDirectory}`);
    } catch (error) {
      console.error('Error creating base directory:', error);
    }
  }
  createWindow();
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', function() {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function() {
  if (mainWindow === null) createWindow();
});
