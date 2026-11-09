/**
 * SAMPLE DATA. Tickers, names, exchanges and prices are real (prices were fetched from Yahoo
 * on the seed date and are refreshed live by the price ticker). The screening ratios and the
 * "main business" flags are ILLUSTRATIVE PLACEHOLDERS so the screener can be demonstrated:
 * they are NOT real screening results and must not be used for investment or religious
 * decisions. In production, replace the data source with Musaffa, Zoya or IdealRatings.
 */

export interface SeedAsset {
  symbol: string;
  name: string;
  sector: string;
  exchange: 'NASDAQ' | 'NYSE' | 'DFM';
  currency: 'USD' | 'AED';
  price: number;
  previousClose: number;
  /** Approximate shares outstanding in millions, only used to estimate market cap. */
  sharesMn: number;
  /** Sample ratios as fractions of market cap / revenue. */
  debt: number;
  cash: number;
  receivables: number | null;
  haramRevenue: number;
  haramSources: string[];
  /** Set when the main business is prohibited. */
  prohibited?: string;
}

const interest = ['interest income'];
const ads = ['interest income', 'advertising from prohibited categories'];
const goods = ['sale of prohibited goods'];

// prettier-ignore
export const SEED_ASSETS: SeedAsset[] = [
  // ---- Technology ----
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', exchange: 'NASDAQ', currency: 'USD', price: 350.03, previousClose: 342.37, sharesMn: 14800, debt: 0.02, cash: 0.02, receivables: 0.03, haramRevenue: 0.01, haramSources: interest },
  { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', exchange: 'NASDAQ', currency: 'USD', price: 543.67, previousClose: 530.61, sharesMn: 7430, debt: 0.01, cash: 0.02, receivables: 0.03, haramRevenue: 0.01, haramSources: interest },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', exchange: 'NASDAQ', currency: 'USD', price: 176.94, previousClose: 186.64, sharesMn: 24300, debt: 0.005, cash: 0.01, receivables: 0.02, haramRevenue: 0.005, haramSources: interest },
  { symbol: 'AVGO', name: 'Broadcom Inc.', sector: 'Technology', exchange: 'NASDAQ', currency: 'USD', price: 318.97, previousClose: 293.69, sharesMn: 4700, debt: 0.03, cash: 0.01, receivables: 0.02, haramRevenue: 0.01, haramSources: interest },
  { symbol: 'ADBE', name: 'Adobe Inc.', sector: 'Technology', exchange: 'NASDAQ', currency: 'USD', price: 239.588, previousClose: 239.3, sharesMn: 425, debt: 0.005, cash: 0.01, receivables: 0.03, haramRevenue: 0.01, haramSources: interest },
  { symbol: 'CRM', name: 'Salesforce, Inc.', sector: 'Technology', exchange: 'NYSE', currency: 'USD', price: 216.52, previousClose: 213.65, sharesMn: 960, debt: 0.01, cash: 0.02, receivables: 0.06, haramRevenue: 0.02, haramSources: interest },
  { symbol: 'ORCL', name: 'Oracle Corporation', sector: 'Technology', exchange: 'NYSE', currency: 'USD', price: 118.94, previousClose: 116.1, sharesMn: 2850, debt: 0.08, cash: 0.01, receivables: 0.05, haramRevenue: 0.01, haramSources: interest },
  { symbol: 'INTC', name: 'Intel Corporation', sector: 'Technology', exchange: 'NASDAQ', currency: 'USD', price: 58.305, previousClose: 56.28, sharesMn: 4350, debt: 0.28, cash: 0.13, receivables: 0.05, haramRevenue: 0.01, haramSources: interest },
  { symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology', exchange: 'NASDAQ', currency: 'USD', price: 505.725, previousClose: 449.04, sharesMn: 1630, debt: 0.005, cash: 0.01, receivables: 0.03, haramRevenue: 0.005, haramSources: interest },
  { symbol: 'QCOM', name: 'QUALCOMM Incorporated', sector: 'Technology', exchange: 'NASDAQ', currency: 'USD', price: 175.12, previousClose: 165.41, sharesMn: 1090, debt: 0.05, cash: 0.03, receivables: 0.04, haramRevenue: 0.01, haramSources: interest },
  { symbol: 'TXN', name: 'Texas Instruments', sector: 'Technology', exchange: 'NASDAQ', currency: 'USD', price: 292.555, previousClose: 277.36, sharesMn: 910, debt: 0.02, cash: 0.01, receivables: 0.02, haramRevenue: 0.005, haramSources: interest },
  // ---- Communication ----
  { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Communication Services', exchange: 'NASDAQ', currency: 'USD', price: 290.04, previousClose: 284.78, sharesMn: 12100, debt: 0.02, cash: 0.03, receivables: 0.05, haramRevenue: 0.015, haramSources: ads },
  { symbol: 'META', name: 'Meta Platforms, Inc.', sector: 'Communication Services', exchange: 'NASDAQ', currency: 'USD', price: 642.08, previousClose: 610.15, sharesMn: 2520, debt: 0.015, cash: 0.02, receivables: 0.03, haramRevenue: 0.02, haramSources: ads },
  { symbol: 'DIS', name: 'The Walt Disney Company', sector: 'Communication Services', exchange: 'NYSE', currency: 'USD', price: 118.62, previousClose: 116.75, sharesMn: 1800, debt: 0.09, cash: 0.015, receivables: 0.04, haramRevenue: 0.047, haramSources: ['entertainment content', 'interest income'] },
  // ---- Consumer ----
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', sector: 'Consumer Discretionary', exchange: 'NASDAQ', currency: 'USD', price: 267.985, previousClose: 259.3, sharesMn: 10700, debt: 0.03, cash: 0.02, receivables: 0.05, haramRevenue: 0.01, haramSources: goods },
  { symbol: 'TSLA', name: 'Tesla, Inc.', sector: 'Consumer Discretionary', exchange: 'NASDAQ', currency: 'USD', price: 377.03, previousClose: 358.22, sharesMn: 3200, debt: 0.01, cash: 0.02, receivables: 0.01, haramRevenue: 0.01, haramSources: interest },
  { symbol: 'HD', name: 'The Home Depot, Inc.', sector: 'Consumer Discretionary', exchange: 'NYSE', currency: 'USD', price: 355.58, previousClose: 343.47, sharesMn: 995, debt: 0.03, cash: 0.005, receivables: 0.01, haramRevenue: 0.01, haramSources: interest },
  { symbol: 'NKE', name: 'NIKE, Inc.', sector: 'Consumer Discretionary', exchange: 'NYSE', currency: 'USD', price: 40.06, previousClose: 38.59, sharesMn: 1480, debt: 0.01, cash: 0.02, receivables: 0.02, haramRevenue: 0.005, haramSources: interest },
  { symbol: 'MCD', name: "McDonald's Corporation", sector: 'Consumer Discretionary', exchange: 'NYSE', currency: 'USD', price: 282.675, previousClose: 276.52, sharesMn: 715, debt: 0.06, cash: 0.005, receivables: 0.02, haramRevenue: 0.03, haramSources: ['sale of prohibited goods', 'interest income'] },
  { symbol: 'SBUX', name: 'Starbucks Corporation', sector: 'Consumer Discretionary', exchange: 'NASDAQ', currency: 'USD', price: 109.96, previousClose: 105.41, sharesMn: 1140, debt: 0.05, cash: 0.01, receivables: 0.02, haramRevenue: 0.02, haramSources: goods },
  { symbol: 'WMT', name: 'Walmart Inc.', sector: 'Consumer Staples', exchange: 'NASDAQ', currency: 'USD', price: 125.52, previousClose: 125.52, sharesMn: 8000, debt: 0.04, cash: 0.01, receivables: 0.02, haramRevenue: 0.02, haramSources: goods },
  { symbol: 'COST', name: 'Costco Wholesale Corporation', sector: 'Consumer Staples', exchange: 'NASDAQ', currency: 'USD', price: 1059.305, previousClose: 1053.56, sharesMn: 443, debt: 0.01, cash: 0.01, receivables: 0.01, haramRevenue: 0.02, haramSources: goods },
  { symbol: 'PG', name: 'The Procter & Gamble Company', sector: 'Consumer Staples', exchange: 'NYSE', currency: 'USD', price: 168.14, previousClose: 165.4, sharesMn: 2340, debt: 0.03, cash: 0.01, receivables: 0.02, haramRevenue: 0.01, haramSources: interest },
  { symbol: 'KO', name: 'The Coca-Cola Company', sector: 'Consumer Staples', exchange: 'NYSE', currency: 'USD', price: 95.815, previousClose: 95.67, sharesMn: 4300, debt: 0.04, cash: 0.035, receivables: 0.03, haramRevenue: 0.02, haramSources: interest },
  { symbol: 'PEP', name: 'PepsiCo, Inc.', sector: 'Consumer Staples', exchange: 'NASDAQ', currency: 'USD', price: 142.97, previousClose: 141.34, sharesMn: 1370, debt: 0.06, cash: 0.03, receivables: 0.04, haramRevenue: 0.03, haramSources: interest },
  { symbol: 'BUD', name: 'Anheuser-Busch InBev', sector: 'Consumer Staples', exchange: 'NYSE', currency: 'USD', price: 84.8, previousClose: 83.96, sharesMn: 2000, debt: 0.25, cash: 0.01, receivables: 0.05, haramRevenue: 0.9, haramSources: ['alcohol'], prohibited: 'its main business is alcohol' },
  { symbol: 'STZ', name: 'Constellation Brands', sector: 'Consumer Staples', exchange: 'NYSE', currency: 'USD', price: 145.645, previousClose: 141.97, sharesMn: 180, debt: 0.3, cash: 0.01, receivables: 0.03, haramRevenue: 0.9, haramSources: ['alcohol'], prohibited: 'its main business is alcohol' },
  { symbol: 'MO', name: 'Altria Group, Inc.', sector: 'Consumer Staples', exchange: 'NYSE', currency: 'USD', price: 75.645, previousClose: 76.12, sharesMn: 1680, debt: 0.2, cash: 0.01, receivables: 0.02, haramRevenue: 0.95, haramSources: ['tobacco'], prohibited: 'its main business is tobacco' },
  { symbol: 'PM', name: 'Philip Morris International', sector: 'Consumer Staples', exchange: 'NYSE', currency: 'USD', price: 194.419, previousClose: 197.88, sharesMn: 1555, debt: 0.15, cash: 0.01, receivables: 0.03, haramRevenue: 0.95, haramSources: ['tobacco'], prohibited: 'its main business is tobacco' },
  { symbol: 'LVS', name: 'Las Vegas Sands Corp.', sector: 'Consumer Discretionary', exchange: 'NYSE', currency: 'USD', price: 40.924, previousClose: 40.73, sharesMn: 700, debt: 0.4, cash: 0.05, receivables: 0.05, haramRevenue: 0.9, haramSources: ['gambling'], prohibited: 'its main business is gambling' },
  { symbol: 'MGM', name: 'MGM Resorts International', sector: 'Consumer Discretionary', exchange: 'NYSE', currency: 'USD', price: 32.95, previousClose: 32.34, sharesMn: 275, debt: 0.6, cash: 0.08, receivables: 0.05, haramRevenue: 0.85, haramSources: ['gambling'], prohibited: 'its main business is gambling' },
  { symbol: 'DKNG', name: 'DraftKings Inc.', sector: 'Consumer Discretionary', exchange: 'NASDAQ', currency: 'USD', price: 18.615, previousClose: 18.51, sharesMn: 500, debt: 0.08, cash: 0.05, receivables: 0.03, haramRevenue: 0.99, haramSources: ['gambling'], prohibited: 'its main business is gambling' },
  // ---- Financials ----
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financials', exchange: 'NYSE', currency: 'USD', price: 342.52, previousClose: 334.49, sharesMn: 2750, debt: 0.45, cash: 0.8, receivables: 0.9, haramRevenue: 0.6, haramSources: ['interest-based lending'], prohibited: 'it is a conventional interest-based bank' },
  { symbol: 'BAC', name: 'Bank of America Corporation', sector: 'Financials', exchange: 'NYSE', currency: 'USD', price: 50.815, previousClose: 49.42, sharesMn: 7600, debt: 0.5, cash: 0.85, receivables: 0.9, haramRevenue: 0.6, haramSources: ['interest-based lending'], prohibited: 'it is a conventional interest-based bank' },
  { symbol: 'UNH', name: 'UnitedHealth Group', sector: 'Healthcare', exchange: 'NYSE', currency: 'USD', price: 397.11, previousClose: 394.15, sharesMn: 910, debt: 0.06, cash: 0.05, receivables: 0.1, haramRevenue: 0.9, haramSources: ['conventional insurance'], prohibited: 'its main business is conventional insurance' },
  { symbol: 'V', name: 'Visa Inc.', sector: 'Financials', exchange: 'NYSE', currency: 'USD', price: 424.8, previousClose: 422.65, sharesMn: 1930, debt: 0.015, cash: 0.025, receivables: 0.05, haramRevenue: 0.03, haramSources: ['interest and fee income'] },
  { symbol: 'MA', name: 'Mastercard Incorporated', sector: 'Financials', exchange: 'NYSE', currency: 'USD', price: 659.855, previousClose: 652.7, sharesMn: 910, debt: 0.012, cash: 0.02, receivables: 0.05, haramRevenue: 0.035, haramSources: ['interest and fee income'] },
  // ---- Healthcare ----
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', exchange: 'NYSE', currency: 'USD', price: 282.13, previousClose: 276.22, sharesMn: 2400, debt: 0.02, cash: 0.015, receivables: 0.02, haramRevenue: 0.01, haramSources: interest },
  { symbol: 'PFE', name: 'Pfizer Inc.', sector: 'Healthcare', exchange: 'NYSE', currency: 'USD', price: 29.515, previousClose: 29.39, sharesMn: 5700, debt: 0.08, cash: 0.02, receivables: 0.03, haramRevenue: 0.01, haramSources: interest },
  { symbol: 'LLY', name: 'Eli Lilly and Company', sector: 'Healthcare', exchange: 'NYSE', currency: 'USD', price: 1410.73, previousClose: 1354.0, sharesMn: 900, debt: 0.02, cash: 0.005, receivables: 0.02, haramRevenue: 0.005, haramSources: interest },
  { symbol: 'MRK', name: 'Merck & Co., Inc.', sector: 'Healthcare', exchange: 'NYSE', currency: 'USD', price: 148.63, previousClose: 146.73, sharesMn: 2510, debt: 0.03, cash: 0.02, receivables: 0.03, haramRevenue: 0.01, haramSources: interest },
  { symbol: 'ABBV', name: 'AbbVie Inc.', sector: 'Healthcare', exchange: 'NYSE', currency: 'USD', price: 293.575, previousClose: 291.31, sharesMn: 1770, debt: 0.09, cash: 0.02, receivables: 0.03, haramRevenue: 0.01, haramSources: interest },
  { symbol: 'TMO', name: 'Thermo Fisher Scientific', sector: 'Healthcare', exchange: 'NYSE', currency: 'USD', price: 712.34, previousClose: 694.76, sharesMn: 380, debt: 0.03, cash: 0.01, receivables: 0.03, haramRevenue: 0.005, haramSources: interest },
  { symbol: 'ABT', name: 'Abbott Laboratories', sector: 'Healthcare', exchange: 'NYSE', currency: 'USD', price: 110.58, previousClose: 109.93, sharesMn: 1740, debt: 0.02, cash: 0.01, receivables: 0.03, haramRevenue: 0.005, haramSources: interest },
  // ---- Energy ----
  { symbol: 'XOM', name: 'Exxon Mobil Corporation', sector: 'Energy', exchange: 'NYSE', currency: 'USD', price: 164.245, previousClose: 165.87, sharesMn: 4300, debt: 0.03, cash: 0.01, receivables: 0.03, haramRevenue: 0.005, haramSources: interest },
  { symbol: 'CVX', name: 'Chevron Corporation', sector: 'Energy', exchange: 'NYSE', currency: 'USD', price: 210.43, previousClose: 212.61, sharesMn: 1950, debt: 0.025, cash: 0.01, receivables: 0.02, haramRevenue: 0.005, haramSources: interest },
  // ---- Industrials ----
  { symbol: 'CAT', name: 'Caterpillar Inc.', sector: 'Industrials', exchange: 'NYSE', currency: 'USD', price: 594.42, previousClose: 558.63, sharesMn: 470, debt: 0.05, cash: 0.01, receivables: 0.1, haramRevenue: 0.04, haramSources: ['financial products interest income'] },
  { symbol: 'DE', name: 'Deere & Company', sector: 'Industrials', exchange: 'NYSE', currency: 'USD', price: 695.205, previousClose: 671.65, sharesMn: 270, debt: 0.2, cash: 0.02, receivables: 0.3, haramRevenue: 0.12, haramSources: ['financial services interest income'] },
  { symbol: 'HON', name: 'Honeywell International', sector: 'Industrials', exchange: 'NASDAQ', currency: 'USD', price: 230.17, previousClose: 220.05, sharesMn: 640, debt: 0.035, cash: 0.01, receivables: 0.03, haramRevenue: 0.01, haramSources: interest },
  { symbol: 'GE', name: 'GE Aerospace', sector: 'Industrials', exchange: 'NYSE', currency: 'USD', price: 333.998, previousClose: 323.24, sharesMn: 1070, debt: 0.02, cash: 0.01, receivables: 0.03, haramRevenue: 0.01, haramSources: interest },
  { symbol: 'BA', name: 'The Boeing Company', sector: 'Industrials', exchange: 'NYSE', currency: 'USD', price: 172.54, previousClose: 173.4, sharesMn: 760, debt: 0.31, cash: 0.05, receivables: 0.08, haramRevenue: 0.01, haramSources: interest },
  { symbol: 'UPS', name: 'United Parcel Service', sector: 'Industrials', exchange: 'NYSE', currency: 'USD', price: 111.19, previousClose: 108.3, sharesMn: 850, debt: 0.06, cash: 0.01, receivables: 0.03, haramRevenue: 0.01, haramSources: interest },
  { symbol: 'LMT', name: 'Lockheed Martin Corporation', sector: 'Industrials', exchange: 'NYSE', currency: 'USD', price: 587.3, previousClose: 567.08, sharesMn: 235, debt: 0.03, cash: 0.01, receivables: 0.04, haramRevenue: 0.85, haramSources: ['weapons'], prohibited: 'its main business is weapons' },
  { symbol: 'RTX', name: 'RTX Corporation', sector: 'Industrials', exchange: 'NYSE', currency: 'USD', price: 196.02, previousClose: 189.53, sharesMn: 1340, debt: 0.05, cash: 0.01, receivables: 0.05, haramRevenue: 0.6, haramSources: ['weapons'], prohibited: 'a major part of its business is weapons' },
  // ---- Dubai Financial Market ----
  { symbol: 'EMAAR.AE', name: 'Emaar Properties', sector: 'Real Estate', exchange: 'DFM', currency: 'AED', price: 12.8, previousClose: 12.5, sharesMn: 8840, debt: 0.12, cash: 0.08, receivables: 0.2, haramRevenue: 0.03, haramSources: interest },
  { symbol: 'DEWA.AE', name: 'Dubai Electricity & Water Authority', sector: 'Utilities', exchange: 'DFM', currency: 'AED', price: 2.73, previousClose: 2.73, sharesMn: 50000, debt: 0.33, cash: 0.05, receivables: 0.15, haramRevenue: 0.01, haramSources: interest },
  { symbol: 'SALIK.AE', name: 'Salik Company', sector: 'Industrials', exchange: 'DFM', currency: 'AED', price: 5.51, previousClose: 5.45, sharesMn: 7500, debt: 0.22, cash: 0.02, receivables: 0.08, haramRevenue: 0.01, haramSources: interest },
  { symbol: 'DU.AE', name: 'Emirates Integrated Telecommunications (du)', sector: 'Communication Services', exchange: 'DFM', currency: 'AED', price: 12.88, previousClose: 12.82, sharesMn: 4530, debt: 0.05, cash: 0.03, receivables: 0.1, haramRevenue: 0.02, haramSources: interest },
  { symbol: 'AIRARABIA.AE', name: 'Air Arabia', sector: 'Industrials', exchange: 'DFM', currency: 'AED', price: 5.08, previousClose: 4.99, sharesMn: 4660, debt: 0.04, cash: 0.1, receivables: 0.08, haramRevenue: 0.01, haramSources: interest },
  { symbol: 'ARMX.AE', name: 'Aramex', sector: 'Industrials', exchange: 'DFM', currency: 'AED', price: 1.73, previousClose: 1.735, sharesMn: 1460, debt: 0.09, cash: 0.04, receivables: 0.2, haramRevenue: 0.01, haramSources: interest },
  { symbol: 'DIB.AE', name: 'Dubai Islamic Bank', sector: 'Financials', exchange: 'DFM', currency: 'AED', price: 7.37, previousClose: 7.26, sharesMn: 7240, debt: 0.03, cash: 0.25, receivables: 0.55, haramRevenue: 0.01, haramSources: ['non-compliant income'] },
  { symbol: 'EMIRATESNBD.AE', name: 'Emirates NBD', sector: 'Financials', exchange: 'DFM', currency: 'AED', price: 32.24, previousClose: 31.6, sharesMn: 6320, debt: 0.4, cash: 0.7, receivables: 0.85, haramRevenue: 0.6, haramSources: ['interest-based lending'], prohibited: 'it is a conventional interest-based bank' },
  { symbol: 'DFM.AE', name: 'Dubai Financial Market', sector: 'Financials', exchange: 'DFM', currency: 'AED', price: 1.31, previousClose: 1.25, sharesMn: 8000, debt: 0.02, cash: 0.45, receivables: 0.5, haramRevenue: 0.03, haramSources: interest },
];
