import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthenticatedRequest extends Request {
  adminId?: string;
  organizationId?: string;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' });
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { adminId: string; organizationId: string };
    // Super-admin tokeni bilan oddiy workspace API'larga kirishga yol qoymaymiz — ikkala
    // rol butunlay alohida token turlariga ega (pastga qarang).
    if (!payload.adminId || !payload.organizationId) {
      return res.status(401).json({ error: 'Token yaroqsiz yoki muddati tugagan' });
    }
    req.adminId = payload.adminId;
    req.organizationId = payload.organizationId;
    return next();
  } catch {
    return res.status(401).json({ error: 'Token yaroqsiz yoki muddati tugagan' });
  }
}

export interface SuperAuthenticatedRequest extends Request {
  superAdminId?: string;
}

// Super-admin uchun butunlay alohida token/rol — workspace admin tokenlari bilan aralashib
// ketmasligi uchun payloadda maxsus `scope: 'super-admin'` belgisi tekshiriladi.
export function requireSuperAuth(req: SuperAuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' });
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { superAdminId?: string; scope?: string };
    if (!payload.superAdminId || payload.scope !== 'super-admin') {
      return res.status(401).json({ error: 'Token yaroqsiz yoki muddati tugagan' });
    }
    req.superAdminId = payload.superAdminId;
    return next();
  } catch {
    return res.status(401).json({ error: 'Token yaroqsiz yoki muddati tugagan' });
  }
}
