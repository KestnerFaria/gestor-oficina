import type { AuthPayload } from "../types";

// Adiciona `req.auth` ao tipo Request do Express. O middleware
// requireAuth preenche esse campo depois de validar o token.
declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export {};
