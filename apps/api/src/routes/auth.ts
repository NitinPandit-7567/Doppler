import { Router } from 'express';
import crypto from 'node:crypto';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '@doppler/db';

const router = Router();

const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login';
const STEAM_API_BASE = 'https://api.steampowered.com';

const SteamPlayerSchema = z.object({
  response: z.object({
    players: z.array(
      z.object({
        steamid: z.string(),
        personaname: z.string(),
        avatarfull: z.string(),
      }),
    ),
  }),
});

function getWebUrl(): string {
  return process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
}

function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

function getCallbackUrl(): string {
  return `${getApiUrl()}/api/auth/callback`;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return secret;
}

function extractSteamId(claimedId: string): string | null {
  const match = /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/.exec(claimedId);
  return match?.[1] ?? null;
}

function redirectWithError(res: import('express').Response, message: string): void {
  const errorUrl = `${getWebUrl()}/login?error=${encodeURIComponent(message)}`;
  console.error('Auth error:', message);
  res.redirect(errorUrl);
}

router.get('/steam', (_req, res) => {
  const state = crypto.randomBytes(16).toString('hex');

  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/',
  });

  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': `${getCallbackUrl()}?state=${state}`,
    'openid.realm': getApiUrl(),
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });

  res.redirect(`${STEAM_OPENID_URL}?${params.toString()}`);
});

router.get('/callback', async (req, res) => {
  try {
    const query = req.query as Record<string, string>;

    const state = query.state;
    const storedState = (req.cookies as Record<string, string> | undefined)?.oauth_state;
    if (!state || !storedState || state !== storedState) {
      redirectWithError(res, 'Login session expired. Please try again.');
      return;
    }
    res.clearCookie('oauth_state', { path: '/' });

    const returnTo = query['openid.return_to'];
    if (!returnTo?.startsWith(getCallbackUrl())) {
      redirectWithError(res, 'Invalid login redirect. Please try again.');
      return;
    }

    const signed = query['openid.signed'];
    if (!signed) {
      redirectWithError(res, 'Steam login response was incomplete. Please try again.');
      return;
    }
    const signedFields = signed.split(',');
    const requiredFields = ['claimed_id', 'identity', 'return_to'];
    for (const field of requiredFields) {
      if (!signedFields.includes(field)) {
        redirectWithError(res, 'Steam login response was incomplete. Please try again.');
        return;
      }
    }

    const verifyParams = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (key === 'state') continue;
      verifyParams.append(key, value);
    }
    verifyParams.set('openid.mode', 'check_authentication');

    const verifyResponse = await axios.post(STEAM_OPENID_URL, verifyParams.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10_000,
    });

    const isValid = (verifyResponse.data as string).includes('is_valid:true');
    if (!isValid) {
      redirectWithError(res, 'Steam could not verify your login. Please try again.');
      return;
    }

    const claimedId = query['openid.claimed_id'];
    const steamId = claimedId ? extractSteamId(claimedId) : null;
    if (!steamId) {
      redirectWithError(res, 'Could not determine your Steam account. Please try again.');
      return;
    }

    const profileResponse = await axios.get(
      `${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v0002/`,
      {
        params: { key: process.env.STEAM_API_KEY, steamids: steamId },
        timeout: 10_000,
      },
    );

    const parsed = SteamPlayerSchema.safeParse(profileResponse.data);
    if (!parsed.success) {
      redirectWithError(res, 'Steam profile could not be loaded. Please try again later.');
      return;
    }

    const player = parsed.data.response.players[0];
    if (!player) {
      redirectWithError(res, 'Steam profile not found. Please try again later.');
      return;
    }

    const user = await prisma.user.upsert({
      where: { steamId },
      update: {
        displayName: player.personaname,
        avatarUrl: player.avatarfull,
      },
      create: {
        id: steamId,
        steamId,
        displayName: player.personaname,
        avatarUrl: player.avatarfull,
      },
    });

    const token = jwt.sign(
      { sub: user.id, steamId: user.steamId },
      getJwtSecret(),
      { expiresIn: '7d' },
    );

    res.redirect(`${getWebUrl()}/api/auth/callback?token=${token}`);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`Auth callback failed: ${error.config?.url} returned ${error.response?.status}`, error.response?.data);
    } else {
      console.error('Auth callback error:', error instanceof Error ? error.message : error);
    }
    redirectWithError(res, 'Something went wrong during sign in. Please try again.');
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ success: true, data: { message: 'Logged out' } });
});

export { router as authRouter };
