export interface FileMetadata {
  fileId: string;
  fileName: string;
  lastModified: string; // ISO date string
}

export class FileMetadataImpl implements FileMetadata {
  fileId: string;
  fileName: string;
  lastModified: string;

  constructor(fileId: string, fileName: string, lastModified: Date) {
    this.fileId = fileId;
    this.fileName = fileName;
    this.lastModified = lastModified.toISOString();
  }

  static fromJson(json: any): FileMetadata {
    return {
      fileId: json.fileId,
      fileName: json.fileName,
      lastModified: json.lastModified
    };
  }

  toJson(): any {
    return {
      fileId: this.fileId,
      fileName: this.fileName,
      lastModified: this.lastModified
    };
  }
}
