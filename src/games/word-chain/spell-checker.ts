/* eslint-disable no-console */
import { readFileSync, writeFileSync, existsSync } from "fs";
import got from "got";
import pino from "pino";
import { WiktionaryAPIResponse } from "./types";

const FILE_PATH = "/tmp/spell-checked-words.json";

const logger = pino();

interface SpellCheckedWordCache {
  [word: string]: boolean | undefined;
}

const spellCheckedWordCache: SpellCheckedWordCache = existsSync(FILE_PATH)
  ? JSON.parse(readFileSync(FILE_PATH, { encoding: "utf8" }))
  : {};

const getSpellCheckedWordFromCache = (word: string) => {
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

export const getResultFromOldWiktionaryAPI = async (
  word: string,
): Promise<boolean> => {
  const url = `https://en.wiktionary.org/w/api.php?action=opensearch&format=json&formatversion=2&search=${encodeURIComponent(
    word.toLowerCase(),
  )}&namespace=0&limit=2`;

  const response = await got(url)
    .then((r) => r.body)
    .catch((e) => {
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
      const tid = setTimeout(() => {
        try {
          setSpellCheckedWord(word, true);
          clearTimeout(tid);
        } catch (error) {
          console.error(error);
        }
      }, 300);
      return true;
    } else {
      return false;
    }
  } catch (error) {
    logger.error(error as Error);
  }

  return false;
};

export const getResultFromNewWiktionaryAPI = async (
  word: string,
): Promise<boolean> => {
  const url = `https://en.wiktionary.org/w/api.php?action=query&titles=${encodeURIComponent(
    word,
  )}&format=json`;

  const response = await got(url)
    .then((r) => r.body)
    .catch((e) => {
      console.error(e);
      return null;
    });

  if (!response) {
    return false;
  }

  try {
    const result: NewWiktionaryAPIResponse = JSON.parse(response);

    if (!result || !result.query || !result.query.pages) {
      return false;
    }

    const isMissing = result.query.pages["-1"];

    if (!isMissing) {
      const pageId = parseInt(Object.keys(result.query.pages)[0]);

      if (!isNaN(pageId) && pageId > 0) {
        return true;
      }
    }

    return false;
  } catch (error) {
    logger.error(error as Error);
  }

  return false;
};

export const checkSpell = async (word: string): Promise<boolean> => {
  word = word.toLowerCase();

  if (getSpellCheckedWordFromCache(word) === true) {
    return true;
  }

  if ((await getResultFromNewWiktionaryAPI(word)) === true) {
    return true;
  }

  const result = await getResultFromOldWiktionaryAPI(word);

  return result;
};

export interface NewWiktionaryAPIResponse {
  batchcomplete?: string;
  query?: Query;
}

interface Query {
  pages?: Pages;
}

type Pages =
  | { "-1": MissingPage }
  | {
      [key: string]: Page;
    };

interface Page {
  pageid?: number;
  ns?: number;
  title?: string;
}

interface MissingPage {
  ns?: number;
  title?: string;
  missing?: string;
}
