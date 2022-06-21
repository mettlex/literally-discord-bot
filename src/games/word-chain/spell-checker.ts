import { readFileSync, writeFileSync, existsSync } from "fs";
import got from "got";
import pino from "pino";
import { WiktionaryAPIResponse } from "./types";

const FILE_PATH = "/tmp/spell-checked-words.json";

const logger = pino({ prettyPrint: process.env.NODE_ENV !== "production" });

interface SpellCheckedWordCache {
  [word: string]: boolean | undefined;
}

const spellCheckedWordCache: SpellCheckedWordCache = existsSync(FILE_PATH)
  ? JSON.parse(readFileSync(FILE_PATH, { encoding: "utf8" }))
  : {};

const getSpellCheckedWord = (word: string) => {
  if (spellCheckedWordCache[word] === true) {
    return true;
  } else if (spellCheckedWordCache[word] === false) {
    return false;
  } else {
    return undefined;
  }
};

const setSpellCheckedWord = (word: string, result: boolean) => {
  spellCheckedWordCache[word] = result;

  (async () => {
    let data: SpellCheckedWordCache = {};

    const fileExists = existsSync(FILE_PATH);

    if (fileExists) {
      data = JSON.parse(readFileSync(FILE_PATH, { encoding: "utf8" }));
    }

    data[word] = result;

    writeFileSync(FILE_PATH, JSON.stringify(data), { encoding: "utf8" });
  })().catch((e) => {
    logger.error(e);
  });
};

export const checkSpell = async (word: string): Promise<boolean> => {
  word = word.toLowerCase();

  if (getSpellCheckedWord(word) === true) {
    return true;
  } else if (getSpellCheckedWord(word) === false) {
    return false;
  }

  const url = `https://en.wiktionary.org/w/api.php?action=opensearch&format=json&formatversion=2&search=${encodeURIComponent(
    word.toLowerCase(),
  )}&namespace=0&limit=2`;

  const response = await got(url)
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

    const foundWords = results[1];

    if (
      foundWords instanceof Array &&
      foundWords
        .filter((w) => typeof w === "string")
        .map((w) => w.toLowerCase())
        .includes(word.toLowerCase())
    ) {
      setSpellCheckedWord(word, true);
      return true;
    } else {
      setSpellCheckedWord(word, false);
      return false;
    }
  } catch (error) {
    logger.error(error as Error);
  }

  return false;
};
