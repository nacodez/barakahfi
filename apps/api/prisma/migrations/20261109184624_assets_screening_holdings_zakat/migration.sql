-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('STOCK', 'ETF', 'SUKUK', 'GOLD', 'REAL_ESTATE', 'CRYPTO');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('COMPLIANT', 'NON_COMPLIANT', 'DOUBTFUL');

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "symbol" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" "AssetType" NOT NULL,
    "exchange" VARCHAR(20),
    "sector" VARCHAR(60),
    "market_cap" DECIMAL(20,0),
    "current_price" DECIMAL(15,4) NOT NULL,
    "previous_close" DECIMAL(15,4),
    "currency" VARCHAR(3) NOT NULL,
    "last_updated" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screening_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asset_id" UUID NOT NULL,
    "compliance_status" "ComplianceStatus" NOT NULL,
    "debt_ratio" DECIMAL(6,4) NOT NULL,
    "cash_ratio" DECIMAL(6,4) NOT NULL,
    "receivables_ratio" DECIMAL(6,4),
    "revenue_screening" JSONB NOT NULL,
    "purification_percent" DECIMAL(6,4) NOT NULL,
    "screened_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" VARCHAR(50) NOT NULL,

    CONSTRAINT "screening_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holdings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "account_id" UUID,
    "quantity" DECIMAL(15,6) NOT NULL,
    "avg_buy_price" DECIMAL(15,4) NOT NULL,
    "purchase_date" DATE NOT NULL,
    "dividends_received" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zakat_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "hijri_year" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "nisab_method" "NisabMethod" NOT NULL,
    "total_assets" DECIMAL(15,2) NOT NULL,
    "nisab_value" DECIMAL(15,2) NOT NULL,
    "zakat_due" DECIMAL(15,2) NOT NULL,
    "zakat_paid" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "breakdown" JSONB NOT NULL,
    "notes" TEXT,
    "calculated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zakat_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assets_symbol_key" ON "assets"("symbol");

-- CreateIndex
CREATE INDEX "assets_exchange_idx" ON "assets"("exchange");

-- CreateIndex
CREATE INDEX "assets_sector_idx" ON "assets"("sector");

-- CreateIndex
CREATE INDEX "screening_results_asset_id_screened_at_idx" ON "screening_results"("asset_id", "screened_at" DESC);

-- CreateIndex
CREATE INDEX "holdings_asset_id_idx" ON "holdings"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "holdings_user_id_asset_id_key" ON "holdings"("user_id", "asset_id");

-- CreateIndex
CREATE INDEX "zakat_records_user_id_hijri_year_idx" ON "zakat_records"("user_id", "hijri_year");

-- AddForeignKey
ALTER TABLE "screening_results" ADD CONSTRAINT "screening_results_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zakat_records" ADD CONSTRAINT "zakat_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
