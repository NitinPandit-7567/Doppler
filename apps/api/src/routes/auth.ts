import { Router } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { prisma } from '@doppler/db';

const router = Router();

const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login';
const STEAM_API_BASE = 'https://api.steampowered.com';

function getCallbackUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  return `${apiUrl}/api/auth/callback`;
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

router.get('/steam', (_req, res) => {
  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': getCallbackUrl(),
    'openid.realm': process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });

  res.redirect(`${STEAM_OPENID_URL}?${params.toString()}`);
});

router.get('/callback', async (req, res) => {
  try {
    const query = req.query as Record<string, string>;

    const verifyParams = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      verifyParams.append(key, value);
    }
    verifyParams.set('openid.mode', 'check_authentication');

    const verifyResponse = await axios.post(STEAM_OPENID_URL, verifyParams.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10_000,
    });

    const isValid = (verifyResponse.data as string).includes('is_valid:true');
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Steam OpenID validation failed' });
      return;
    }

    const claimedId = query['openid.claimed_id'];
    if (!claimedId) {
      res.status(400).json({ success: false, error: 'Missing claimed_id' });
      return;
    }

    const steamId = extractSteamId(claimedId);
    if (!steamId) {
      res.status(400).json({ success: false, error: 'Invalid Steam ID in claimed_id' });
      return;
    }

    const profileResponse = await axios.get(
      `${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v0002/`,
      {
        params: { key: process.env.STEAM_API_KEY, steamids: steamId },
        timeout: 10_000,
      },
    );

    const players = (profileResponse.data as Record<string, unknown>).response as
      | { players: Array<{ steamid: string; personaname: string; avatarfull: string }> }
      | undefined;

    const player = players?.players[0];
    if (!player) {
      res.status(500).json({ success: false, error: 'Failed to fetch Steam profile' });
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

    const webUrl = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.redirect(`${webUrl}/overview`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Auth callback failed';
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ success: true, data: { message: 'Logged out' } });
});

export { router as authRouter };
