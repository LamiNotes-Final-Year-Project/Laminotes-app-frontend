export interface FileMetadata {
  fileId: string;
  fileName: string;
  lastModified: string; // ISO date string
  team_id?: string;
}

export class FileMetadataImpl implements FileMetadata {
  fileId: string;
  fileName: string;
  lastModified: string;
  team_id?: string;

  constructor(fileId: string, fileName: string, lastModified: Date, team_id?: string) {
    this.fileId = fileId;
    this.fileName = fileName;
    this.lastModified = lastModified.toISOString();
    this.team_id = team_id;
  }

  static fromJson(json: any): FileMetadata {
    return {
      fileId: json.fileId,
      fileName: json.fileName,
      lastModified: json.lastModified,
      team_id: json.team_id,
    };
  }

  toJson(): any {
    return {
      fileId: this.fileId,
      fileName: this.fileName,
      lastModified: this.lastModified,
      team_id: this.team_id,
    };
  }
}
