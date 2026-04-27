-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'TRADER', 'INVESTOR', 'PRO');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('HOLDING', 'WATCHING', 'SELL_TARGET', 'SOLD');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "steamId" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "autoApproveEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maxBuyPerTransaction" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "maxSellDiscountPct" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "dailySpendLimit" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "confirmAbove" DOUBLE PRECISION NOT NULL DEFAULT 25.0,
    "browserPushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "mobilePushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "discordWebhookUrl" TEXT,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "csFloatApiKey" TEXT,
    "fcmDeviceToken" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "purchasePrice" DOUBLE PRECISION,
    "purchasedAt" TIMESTAMP(3),
    "currentValue" DOUBLE PRECISION,
    "status" "ItemStatus" NOT NULL DEFAULT 'HOLDING',
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_steamId_key" ON "users"("steamId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_userId_key" ON "user_settings"("userId");

-- CreateIndex
CREATE INDEX "inventory_snapshots_userId_capturedAt_idx" ON "inventory_snapshots"("userId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_items_userId_assetId_key" ON "portfolio_items"("userId", "assetId");

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_snapshots" ADD CONSTRAINT "inventory_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
