// src/electron.d.ts
interface ElectronAPI {
  saveFile: (data: any) => Promise<any>;
  openFile: () => Promise<any>;
  checkFile: (path: string) => Promise<boolean>;
}

interface Window {
  // For older Electron implementations
  require: (module: string) => any;
  process: {
    type: string;
    [key: string]: any;
  };

  // For modern Electron with contextBridge
  electronAPI: ElectronAPI;
}
