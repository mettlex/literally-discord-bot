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
import { oneLine } from "common-tags";

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

export const influenceCardImagesClassic = influenceCardNamesInClassic.reduce<{
  [name: string]: string[];
}>((data, curr) => {
  if (curr === "ambassador") {
    data[curr] = [
      "https://cdn.discordapp.com/attachments/848495134874271764/854028201629188116/ambassador_lg_1.jpg",
    ];
  } else if (curr === "assassin") {
    data[curr] = [
      "https://cdn.discordapp.com/attachments/848495134874271764/854028204376588308/assassin_lg_1.jpg",
    ];
  } else if (curr === "captain") {
    data[curr] = [
      "https://cdn.discordapp.com/attachments/848495134874271764/854028203236524093/captain_lg_1.jpg",
    ];
  } else if (curr === "contessa") {
    data[curr] = [
      "https://cdn.discordapp.com/attachments/848495134874271764/854028202385080340/contessa_lg_1.jpg",
    ];
  } else if (curr === "duke") {
    data[curr] = [
      "https://cdn.discordapp.com/attachments/848495134874271764/854028204082462760/duke_lg_1.jpg",
    ];
  }

  return data;
}, {});

export const getImageURLForInfluenceCard = (
  name: InfluenceCard["name"],
): string | undefined => {
  return influenceCardImagesClassic[name][0];
};

interface CreateDeckParams {
  playersCount: number;
  gameMode: CoupGame["mode"];
}

// prettier-ignore
export const getDescriptionFromCardName = (name: InfluenceCard["name"]) =>
  name === "duke"
    ? oneLine`Takes 3 coins from the treasury. This action can't be blocked.
      Duke can block foreign aid.`
    : name === "captain"
      ? oneLine`Steals 2 coins from any other player.
        This action can be blocked by captain or ambassador.`
      : name === "ambassador"
        ? oneLine`Exchanges cards with the court deck.
        This action can't be blocked.`
        : name === "assassin"
          ? oneLine`Spends 3 coins to assassinate any other player.
          This action can be blocked by contessa.`
          : name === "contessa"
            ? oneLine`Blocks assassinations.`
            : "";

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

        // prettier-ignore
        deck.push({
          name,
          description:
            getDescriptionFromCardName(name),
          imageURL: getImageURLForInfluenceCard(name) || "",
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
