/**
 * Document metadata models.
 * Handles tracking of document modifications for collaborative editing and versioning.
 */

/**
 * Interface representing a section of text in a document.
 * Used to track specific parts of a document that have been modified.
 */
export interface TextSection {
  /** Starting character index in the document */
  startIndex: number;

  /** Ending character index in the document */
  endIndex: number;

  /** The text content of this section */
  content: string;
}

/**
 * Interface representing a set of changes made to a document.
 * Groups related text modifications with metadata about who made them and when.
 */
export interface DocumentChange {
  /** ID of the user who made the changes */
  userId: string;

  /** Display name of the user who made the changes */
  username: string;

  /** ISO date string of when the changes were made */
  timestamp: string;

  /** Array of text sections that were modified */
  sections: TextSection[];
}

/**
 * Interface for markdown document metadata.
 * Tracks the full history of changes to a document and provides versioning information.
 */
export interface MarkdownMetadata {
  /** Unique identifier for the document */
  documentId: string;

  /** Array of change sets representing the document's modification history */
  changes: DocumentChange[];

  /** Mapping of user IDs to colors for visual representation of authorship */
  userColors: Record<string, string>;

  /** ISO date string of when the document was last modified */
  lastModified: string;
}
