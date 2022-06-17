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
      // eslint-disable-next-line no-console
      console.error(e);
      return null;
    });

  if (!response) {
    return false;
  }

  try {
    const results: WiktionaryAPIResponse = JSON.parse(response);

    logger.info(results);

    const foundWords = results[1];

    if (
      foundWords instanceof Array &&
      foundWords
        .filter((w) => typeof w === "string")
        .map((w) => w.toLowerCase())
        .includes(word.toLowerCase())
    ) {
      return true;
    }
  } catch (error) {
    logger.error(error as Error);
  }

  return false;
};
