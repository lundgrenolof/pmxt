import { OrderBook, OrderLevel } from "../../types";
import { fromKalshiCents, invertKalshiUnified } from "./price";

type PriceFormat = "cents" | "dollars";

interface KalshiSideLevels {
  yes: any[];
  no: any[];
  priceFormat: PriceFormat;
}

interface KalshiOrderBookDelta {
  side: "yes" | "no";
  price: number;
  delta: number;
}

function toFiniteNumber(value: any): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function extractSideLevels(
  payload: any,
  candidates: Array<{
    yes: string;
    no: string;
    priceFormat: PriceFormat;
  }>,
): KalshiSideLevels | null {
  for (const candidate of candidates) {
    const yes = payload?.[candidate.yes];
    const no = payload?.[candidate.no];

    if (Array.isArray(yes) && Array.isArray(no)) {
      return {
        yes,
        no,
        priceFormat: candidate.priceFormat,
      };
    }
  }

  return null;
}

function extractRawPrice(level: any, priceFormat: PriceFormat): number {
  if (Array.isArray(level)) {
    return toFiniteNumber(level[0]);
  }

  if (priceFormat === "dollars") {
    return toFiniteNumber(level?.price_dollars ?? level?.price);
  }

  return toFiniteNumber(level?.price ?? level?.price_dollars);
}

function extractSize(level: any): number {
  if (Array.isArray(level)) {
    return toFiniteNumber(level[1]);
  }

  return toFiniteNumber(
    level?.delta_fp ??
      level?.quantity_fp ??
      level?.size_fp ??
      level?.count_fp ??
      level?.delta ??
      level?.quantity ??
      level?.size ??
      level?.count,
  );
}

function toUnifiedPrice(level: any, priceFormat: PriceFormat): number {
  const rawPrice = extractRawPrice(level, priceFormat);
  return priceFormat === "cents" ? fromKalshiCents(rawPrice) : rawPrice;
}

function mapLevels(
  levels: any[],
  priceFormat: PriceFormat,
  invertPrice = false,
): OrderLevel[] {
  return levels.map((level) => {
    const price = toUnifiedPrice(level, priceFormat);
    return {
      price: invertPrice ? invertKalshiUnified(price) : price,
      size: extractSize(level),
    };
  });
}

function buildOrderBook(
  sideLevels: KalshiSideLevels,
  isNoOutcome: boolean,
): OrderBook {
  const bids = mapLevels(
    isNoOutcome ? sideLevels.no : sideLevels.yes,
    sideLevels.priceFormat,
  ).sort((a, b) => b.price - a.price);

  const asks = mapLevels(
    isNoOutcome ? sideLevels.yes : sideLevels.no,
    sideLevels.priceFormat,
    true,
  ).sort((a, b) => a.price - b.price);

  return {
    bids,
    asks,
    timestamp: Date.now(),
  };
}

function getRestSideLevels(response: any): KalshiSideLevels | null {
  return (
    extractSideLevels(response?.orderbook_fp, [
      { yes: "yes_dollars", no: "no_dollars", priceFormat: "dollars" },
    ]) ||
    extractSideLevels(response?.orderbook, [
      { yes: "yes_dollars", no: "no_dollars", priceFormat: "dollars" },
      { yes: "yes", no: "no", priceFormat: "cents" },
    ])
  );
}

function getSnapshotSideLevels(data: any): KalshiSideLevels | null {
  return extractSideLevels(data, [
    { yes: "yes_dollars_fp", no: "no_dollars_fp", priceFormat: "dollars" },
    { yes: "yes_dollars", no: "no_dollars", priceFormat: "dollars" },
    { yes: "yes", no: "no", priceFormat: "cents" },
  ]);
}

export function parseKalshiRestOrderBook(
  response: any,
  isNoOutcome: boolean,
): OrderBook {
  const sideLevels = getRestSideLevels(response);

  if (!sideLevels) {
    throw new Error(
      "Unexpected Kalshi orderbook response shape. Expected orderbook_fp.yes_dollars/no_dollars or legacy orderbook fields.",
    );
  }

  return buildOrderBook(sideLevels, isNoOutcome);
}

export function parseKalshiOrderBookSnapshot(data: any): OrderBook | null {
  const sideLevels = getSnapshotSideLevels(data);
  return sideLevels ? buildOrderBook(sideLevels, false) : null;
}

export function parseKalshiOrderBookDelta(
  data: any,
): KalshiOrderBookDelta | null {
  const side = data?.side;
  if (side !== "yes" && side !== "no") {
    return null;
  }

  const priceFormat: PriceFormat | null =
    data?.price_dollars !== undefined
      ? "dollars"
      : data?.price !== undefined
        ? "cents"
        : null;

  if (!priceFormat) {
    return null;
  }

  return {
    side,
    price: toUnifiedPrice(
      {
        price: data.price,
        price_dollars: data.price_dollars,
      },
      priceFormat,
    ),
    delta: toFiniteNumber(
      data?.delta_fp ??
        data?.quantity_fp ??
        data?.size_fp ??
        data?.delta ??
        data?.quantity ??
        data?.size,
    ),
  };
}
