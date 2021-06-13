import path from "path";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import {
  CoupGame,
  CurrentCoupGames,
  Deck,
  InfluenceCard,
  influenceCardNamesInClassic,
  influenceCardNamesInReformation,
  InitialData,
} from "./types";
import { shuffleArray } from "../../utils/array";

export const gameDataDir = path.resolve(
  process.env.COUP_GAME_DATA_DIR || "/tmp/",
);

const currentCoupReformationGames: CurrentCoupGames = {};

const initialMessages: {
  [channelId: string]: InitialData | undefined;
} = {};

export const getFileNameForGameData = (channelId: string) =>
  `coup_reformation_${channelId}.json`;

export const getCurrentCoupReformationGame = (
  channelId: string,
): CoupGame | undefined | null => {
  const filepath = path.resolve(gameDataDir, getFileNameForGameData(channelId));

  if (!currentCoupReformationGames[channelId] && existsSync(filepath)) {
    const filedata = JSON.parse(readFileSync(filepath, { encoding: "utf-8" }));

    currentCoupReformationGames[channelId] = filedata;
  }

  return currentCoupReformationGames[channelId];
};

export const setCurrentCoupReformationGame = (
  channelId: string,
  gameData: CoupGame | null,
) => {
  const filepath = path.resolve(gameDataDir, getFileNameForGameData(channelId));

  currentCoupReformationGames[channelId] = gameData;

  try {
    if (gameData) {
      writeFileSync(
        filepath,
        JSON.stringify(
          {
            ...gameData,
            initialMessageInterval: undefined,
            turnInterval: undefined,
          },
          null,
          2,
        ),
        {
          encoding: "utf-8",
        },
      );
    } else {
      unlinkSync(filepath);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
  }

  return currentCoupReformationGames[channelId];
};

export const getInitialMessageAndEmbed = (channelId: string) =>
  initialMessages[channelId];

export const setInitialMessageAndEmbed = (data: InitialData) => {
  initialMessages[data.message.channel.id] = data;
};

interface CreateDeckParams {
  playersCount: number;
  gameMode: CoupGame["mode"];
}

const getImageURLForInfluenceCard = (name: InfluenceCard["name"]): string => {
  return name;
};

export const createDeck = ({
  playersCount,
  gameMode,
}: CreateDeckParams): Deck => {
  const deck: Deck = [];

  // prettier-ignore
  const cardNamesCount =
    gameMode === "classic"
      ? influenceCardNamesInClassic.length
      : gameMode === "reformation"
        ? influenceCardNamesInReformation.length
        : 1;

  const addCardsToDeck = (maxCards: number) => {
    const maxCardsForEachInfluence = maxCards / cardNamesCount;

    for (let i = 0; i < maxCards; i += maxCardsForEachInfluence) {
      for (let j = 0; j < maxCardsForEachInfluence; j++) {
        const name =
          influenceCardNamesInClassic[cardNamesCount * (i / maxCards)];

        deck.push({
          name,
          imageURL: getImageURLForInfluenceCard(name),
          performAction: (game, ...args) => {
            return game;
          },
        });
      }
    }
  };

  if (playersCount > 1 && playersCount < 7) {
    addCardsToDeck(15);
  } else if (playersCount > 6 && playersCount < 9) {
    addCardsToDeck(20);
  } else if (playersCount > 8 && playersCount < 13) {
    addCardsToDeck(25);
  }

  shuffleArray(deck);

  return deck;
};
