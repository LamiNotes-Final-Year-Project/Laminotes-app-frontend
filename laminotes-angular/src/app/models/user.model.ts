/**
 * User model representing a user account in the application.
 * Contains basic user identification and authentication information.
 */

/**
 * Interface for user data.
 * Provides core user properties used throughout the application.
 */
export interface User {
  /** Unique identifier for the user */
  user_id: string;
  
  /** User's email address, used for authentication and communications */
  email: string;
  
  /** Optional ISO timestamp of when the user account was created */
  created_at?: string;
  
  // TODO: Consider adding additional user profile fields like displayName, avatar, etc.
}
