// src/electron.d.ts
interface ElectronAPI {
  saveFile: (options: {
    content: string;
    filePath?: string;
    saveAs?: boolean;
  }) => Promise<{
    success: boolean;
    filePath?: string;
    message: string;
  }>;

  openFile: () => Promise<{
    success: boolean;
    filePath?: string;
    content?: string;
    message: string;
  }>;

  checkFile: (path: string) => Promise<boolean>;

  deleteFile: (path: string) => Promise<{
    success: boolean;
    message: string;
  }>;

  renameFile: (oldPath: string, newPath: string) => Promise<{
    success: boolean;
    message: string;
  }>;

  showPromptDialog: (options: any) => Promise<any>;
  createDirectory: (path: string) => Promise<any>;
  selectDirectory: (initialPath?: string) => Promise<any>;
}

interface Window {
  process?: any;
  electronAPI?: ElectronAPI;
}
