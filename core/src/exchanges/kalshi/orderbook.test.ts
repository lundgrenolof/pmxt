import {
  parseKalshiOrderBookDelta,
  parseKalshiOrderBookSnapshot,
  parseKalshiRestOrderBook,
} from "./orderbook";

describe("parseKalshiRestOrderBook", () => {
  test("prefers fixed-point dollar orderbooks for YES outcomes", () => {
    const orderBook = parseKalshiRestOrderBook(
      {
        orderbook_fp: {
          yes_dollars: [
            ["0.5500", "12.50"],
            ["0.5300", "3.25"],
          ],
          no_dollars: [
            ["0.4400", "4.50"],
            ["0.4000", "1.00"],
          ],
        },
        orderbook: {
          yes: [[55, 99]],
          no: [[45, 99]],
        },
      },
      false,
    );

    expect(orderBook.bids).toEqual([
      { price: 0.55, size: 12.5 },
      { price: 0.53, size: 3.25 },
    ]);
    expect(orderBook.asks).toEqual([
      { price: 0.56, size: 4.5 },
      { price: 0.6, size: 1 },
    ]);
  });

  test("builds the NO outcome book from fixed-point dollar levels", () => {
    const orderBook = parseKalshiRestOrderBook(
      {
        orderbook_fp: {
          yes_dollars: [["0.6200", "8.00"]],
          no_dollars: [
            ["0.3000", "5.50"],
            ["0.2800", "1.25"],
          ],
        },
      },
      true,
    );

    expect(orderBook.bids).toEqual([
      { price: 0.3, size: 5.5 },
      { price: 0.28, size: 1.25 },
    ]);
    expect(orderBook.asks).toEqual([{ price: 0.38, size: 8 }]);
  });

  test("falls back to legacy cent-denominated orderbooks", () => {
    const orderBook = parseKalshiRestOrderBook(
      {
        orderbook: {
          yes: [
            [55, 10],
            [53, 3],
          ],
          no: [
            [44, 4],
            [40, 1],
          ],
        },
      },
      false,
    );

    expect(orderBook.bids).toEqual([
      { price: 0.55, size: 10 },
      { price: 0.53, size: 3 },
    ]);
    expect(orderBook.asks).toEqual([
      { price: 0.56, size: 4 },
      { price: 0.6, size: 1 },
    ]);
  });
});

describe("parseKalshiOrderBookSnapshot", () => {
  test("parses websocket fixed-point snapshots", () => {
    const orderBook = parseKalshiOrderBookSnapshot({
      yes_dollars_fp: [
        ["0.5100", "7.25"],
        ["0.5000", "2.00"],
      ],
      no_dollars_fp: [["0.4700", "1.50"]],
    });

    expect(orderBook).toEqual({
      bids: [
        { price: 0.51, size: 7.25 },
        { price: 0.5, size: 2 },
      ],
      asks: [{ price: 0.53, size: 1.5 }],
      timestamp: expect.any(Number),
    });
  });
});

describe("parseKalshiOrderBookDelta", () => {
  test("parses fixed-point websocket deltas", () => {
    expect(
      parseKalshiOrderBookDelta({
        side: "no",
        price_dollars: "0.4200",
        delta_fp: "-3.75",
      }),
    ).toEqual({
      side: "no",
      price: 0.42,
      delta: -3.75,
    });
  });

  test("parses legacy websocket deltas", () => {
    expect(
      parseKalshiOrderBookDelta({
        side: "yes",
        price: 58,
        delta: 6,
      }),
    ).toEqual({
      side: "yes",
      price: 0.58,
      delta: 6,
    });
  });
});
