import axios from "axios";
import { OrderBook } from "../../types";
import { validateIdFormat } from "../../utils/validation";
import { kalshiErrorMapper } from "./errors";
import { getMarketsUrl } from "./config";
import { parseKalshiRestOrderBook } from "./orderbook";

export async function fetchOrderBook(
  baseUrl: string,
  id: string,
): Promise<OrderBook> {
  validateIdFormat(id, "OrderBook");

  try {
    // Check if this is a NO outcome request
    const isNoOutcome = id.endsWith("-NO");
    const ticker = id.replace(/-NO$/, "");
    const url = getMarketsUrl(baseUrl, ticker, ["orderbook"]);
    const response = await axios.get(url);
    return parseKalshiRestOrderBook(response.data, isNoOutcome);
  } catch (error: any) {
    throw kalshiErrorMapper.mapError(error);
  }
}
