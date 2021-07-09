import got from "got";
import { getLogger } from "../app";
import checkEnv from "./check-env";

checkEnv();

const logger = getLogger();

export const searchGifOnTenor = async (
  query: string,
): Promise<any | undefined> => {
  try {
    const searchTerm = encodeURIComponent(query.substr(0, 20));

    const results = await got
      .get(
        `https://g.tenor.com/v1/search?q=${searchTerm}&key=${process.env.TENOR_API_KEY}&limit=50`,
      )
      .then((r) => JSON.parse(r.body));

    return results;
  } catch (error) {
    logger.error(error);
    return undefined;
  }
};
