import path from "path";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import {
  CoupReformationGame,
  CurrentCoupReformationGames,
  InitialData,
} from "./types";

export const gameDataDir = path.resolve(
  process.env.COUP_GAME_DATA_DIR || "/tmp/",
);

const currentCoupReformationGames: CurrentCoupReformationGames = {};

const initialMessages: {
  [channelId: string]: InitialData | undefined;
} = {};

export const getFileNameForGameData = (channelId: string) =>
  `coup_reformation_${channelId}.json`;

export const getCurrentCoupReformationGame = (
  channelId: string,
): CoupReformationGame | undefined | null => {
  const filepath = path.resolve(gameDataDir, getFileNameForGameData(channelId));

  if (!currentCoupReformationGames[channelId] && existsSync(filepath)) {
    const filedata = JSON.parse(readFileSync(filepath, { encoding: "utf-8" }));

    currentCoupReformationGames[channelId] = filedata;
  }

  return currentCoupReformationGames[channelId];
};

export const setCurrentCoupReformationGame = (
  channelId: string,
  gameData: CoupReformationGame | null,
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
