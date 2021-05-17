import got from "got";
import spellChecker from "spellchecker";
import pino from "pino";
import { WiktionaryAPIResponse } from "./types";

const logger = pino({ prettyPrint: process.env.NODE_ENV !== "production" });

export const checkSpell = async (word: string): Promise<boolean> => {
  const misspelled = spellChecker.isMisspelled(word);

  if (!misspelled) {
    return true;
  }

  const response = await got(
    `https://en.wiktionary.org/w/api.php?action=opensearch&format=json&formatversion=2&search=${word.toLowerCase()}&namespace=0&limit=2`,
  )
    .then((r) => r.body)
    .catch((e) => {
      logger.error(e);
      return null;
    });

  if (!response) {
    return false;
  }

  try {
    const results: WiktionaryAPIResponse = JSON.parse(response);

    logger.info(results);

    if (
      results[1] instanceof Array &&
      typeof results[1][0] === "string" &&
      results[1][0].toLowerCase() === word.toLowerCase()
    ) {
      return true;
    }
  } catch (error) {
    logger.error(error);
  }

  return false;
};
