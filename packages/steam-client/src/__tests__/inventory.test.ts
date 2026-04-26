import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SteamInventoryItemSchema } from '@doppler/types';

describe('inventory mapping', () => {
  it('validates a correctly mapped inventory item', () => {
    const mapped = {
      assetId: '123456',
      classId: '789',
      instanceId: '0',
      marketHashName: 'AK-47 | Redline (Field-Tested)',
      iconUrl: 'https://community.cloudflare.steamstatic.com/economy/image/xxx',
      tradable: true,
      marketable: true,
      tags: [
        {
          category: 'Type',
          internalName: 'CSGO_Type_Rifle',
          localizedCategoryName: 'Type',
          localizedTagName: 'Rifle',
        },
      ],
    };

    expect(() => SteamInventoryItemSchema.parse(mapped)).not.toThrow();
  });

  it('rejects inventory item with wrong tradable type', () => {
    const bad = {
      assetId: '123',
      classId: '456',
      instanceId: '0',
      marketHashName: 'test',
      iconUrl: 'https://example.com',
      tradable: 1,
      marketable: true,
      tags: [],
    };

    expect(() => SteamInventoryItemSchema.parse(bad)).toThrow();
  });

  it('rejects item missing marketHashName', () => {
    const bad = {
      assetId: '123',
      classId: '456',
      instanceId: '0',
      iconUrl: 'https://example.com',
      tradable: true,
      marketable: true,
      tags: [],
    };

    expect(() => SteamInventoryItemSchema.parse(bad)).toThrow();
  });
});
