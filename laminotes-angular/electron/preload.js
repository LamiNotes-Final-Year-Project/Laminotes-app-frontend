// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electronAPI', {
    saveFile: (options) => ipcRenderer.invoke('save-file', options),
    openFile: () => ipcRenderer.invoke('open-file'),
    checkFile: (path) => ipcRenderer.invoke('check-file', path),
    showPromptDialog: (options) => ipcRenderer.invoke('show-prompt-dialog', options),
    deleteFile: (path) => ipcRenderer.invoke('delete-file', path),
    renameFile: (oldPath, newPath) => ipcRenderer.invoke('rename-file', oldPath, newPath),
    createDirectory: (path) => ipcRenderer.invoke('create-directory', path),
    selectDirectory: (initialPath = undefined) => ipcRenderer.invoke('select-directory', initialPath),
  }
);
