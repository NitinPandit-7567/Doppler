import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '@doppler/db';
import type { ApiError } from '@doppler/types';

interface JwtPayload {
  readonly sub: string;
  readonly steamId: string;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return secret;
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  const cookieToken = (req.cookies as Record<string, string> | undefined)?.token;
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Missing authentication token',
    } satisfies ApiError);
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, steamId: true, plan: true },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found',
      } satisfies ApiError);
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
      } satisfies ApiError);
      return;
    }

    res.status(401).json({
      success: false,
      error: 'Invalid token',
    } satisfies ApiError);
  }
}
