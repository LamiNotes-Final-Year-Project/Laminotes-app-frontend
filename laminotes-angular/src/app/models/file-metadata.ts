/**
 * File metadata models.
 * Handles tracking of file information and serialization for storage and API communication.
 */

/**
 * Interface for file metadata information.
 * Contains essential data about a file used for identification and versioning.
 */
export interface FileMetadata {
  /** Unique identifier for the file */
  fileId: string;
  
  /** Name of the file including extension */
  fileName: string;
  
  /** ISO date string representing when the file was last modified */
  lastModified: string;
  
  /** Optional team ID if the file belongs to a team */
  team_id?: string;
}

/**
 * Implementation class for file metadata.
 * Provides constructor and serialization methods for file metadata objects.
 */
export class FileMetadataImpl implements FileMetadata {
  /** Unique identifier for the file */
  fileId: string;
  
  /** Name of the file including extension */
  fileName: string;
  
  /** ISO date string representing when the file was last modified */
  lastModified: string;
  
  /** Optional team ID if the file belongs to a team */
  team_id?: string;

  /**
   * Creates a new file metadata instance.
   * 
   * @param fileId - Unique identifier for the file
   * @param fileName - Name of the file including extension
   * @param lastModified - Date object representing when the file was last modified
   * @param team_id - Optional team ID if the file belongs to a team
   */
  constructor(fileId: string, fileName: string, lastModified: Date, team_id?: string) {
    this.fileId = fileId;
    this.fileName = fileName;
    this.lastModified = lastModified.toISOString();
    this.team_id = team_id;
  }

  /**
   * Creates a file metadata instance from a JSON object.
   * 
   * @param json - JSON object containing file metadata properties
   * @returns A FileMetadata object
   */
  static fromJson(json: any): FileMetadata {
    return {
      fileId: json.fileId,
      fileName: json.fileName,
      lastModified: json.lastModified,
      team_id: json.team_id,
    };
  }

  /**
   * Converts the file metadata to a JSON object.
   * 
   * @returns A plain object representation of the file metadata
   */
  toJson(): any {
    return {
      fileId: this.fileId,
      fileName: this.fileName,
      lastModified: this.lastModified,
      team_id: this.team_id,
    };
  }
}
