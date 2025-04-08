import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as url from 'url';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  console.log('Creating window...');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js'),
    }
  });

  // Create a test HTML file
  const testHtmlPath = path.join(app.getAppPath(), 'test.html');
  fs.writeFileSync(testHtmlPath, `
    <!DOCTYPE html>
    <html>
      <head><title>Electron Test</title></head>
      <body>
        <h1>Electron Test Page</h1>
        <p>If you can see this, Electron is working correctly!</p>
      </body>
    </html>
  `);

  //mainWindow.loadFile(testHtmlPath);

  // Option 2 (comment out if using Option 1): Load Angular app
   mainWindow.loadURL(
     url.format({
       pathname: path.join(__dirname, '../../dist/laminotes-angular/index.html'),
       protocol: 'file:',
       slashes: true,
     })
   );

  // Open dev tools
  mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupIpcHandlers() {
  // Handle file saving
  ipcMain.handle('save-file', async (event, args) => {
    const {content, filePath, saveAs} = args;

    try {
      let savePath = filePath;

      // If saveAs is true or no filePath provided, show save dialog
      if (saveAs || !filePath) {
        const {canceled, filePath: selectedPath} = await dialog.showSaveDialog(mainWindow!, {
          title: 'Save Markdown File',
          defaultPath: filePath || 'untitled.md',
          filters: [
            {name: 'Markdown', extensions: ['md']},
            {name: 'All Files', extensions: ['*']}
          ]
        });

        if (canceled || !selectedPath) {
          return {success: false, message: 'Save cancelled'};
        }

        savePath = selectedPath;
      }

      // Write content to file
      fs.writeFileSync(savePath, content, {encoding: 'utf8'});

      return {
        success: true,
        filePath: savePath,
        message: 'File saved successfully'
      };
    } catch (error) {
      console.error('Error saving file:', error);
      return {
        success: false,
        message: `Error saving file: ${(error as Error).message || 'Unknown error'}`
      };
    }
  });

  // Handle file opening
  ipcMain.handle('open-file', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
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
      const content = fs.readFileSync(filePath, { encoding: 'utf8' });

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
        message: `Error opening file: ${(error as Error).message || 'Unknown error'}`
      };
    }
  });

  // Handle checking if file exists
  ipcMain.handle('check-file', async (event, filePath) => {
    try {
      return fs.existsSync(filePath);
    } catch (error) {
      console.error('Error checking file:', error);
      return false;
    }
  });
}

// PROPER EVENT SEQUENCE
// Set up IPC handlers first, before any windows are created
setupIpcHandlers();

// Wait for the app to be ready, then create window
app.whenReady().then(() => {
  console.log('App is ready');
  createWindow();

  // On macOS, recreate windows when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
