export interface TextSection {
  startIndex: number;
  endIndex: number;
  content: string;
}

export interface DocumentChange {
  userId: string;
  username: string;
  timestamp: string; // ISO date string
  sections: TextSection[];
}

export interface MarkdownMetadata {
  documentId: string;
  changes: DocumentChange[];
  userColors: Record<string, string>; // userId -> color
  lastModified: string; // ISO date string
}
