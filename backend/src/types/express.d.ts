// Augment Express Request so we can attach the authenticated user.
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: 'user' | 'admin';
      };
    }
  }
}
export {};
