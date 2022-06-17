/* eslint-disable indent */
import path from "path";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { Client, Message, TextChannel } from "discord.js";
import { SlashCreator } from "slash-create";
import { getGuildIds } from "../../app";
import { ActiveJottoGames, JottoData } from "./types";
import { setupGame } from "../setup";
import { Action } from "../types";
import { makeJottoCommands } from "./slash-commands";
import { prefixes, timeToJoinInSeconds } from "./config";
import {
  getInitialMessageAndEmbed,
  startJottoGame,
  changeJottoTurn,
} from "./game-loop";
import { flatColors } from "../../config";
import { oneLine } from "common-tags";
import { sendHelpMessage } from "../../help";

export const sendJottoHelpMessage = (message: Message) => {
  sendHelpMessage(
    message.author.id,
    message.channel as TextChannel,
    "jotto",
    message.client,
  );
};

export const actions: Action[] = [
  {
    commands: ["fs", "force-start", "force start"],
    handler: async (message) => {
      if (!message.member?.permissions.has("MANAGE_GUILD")) {
        return;
      }

      const initialData = getInitialMessageAndEmbed(message.channel.id);

      if (initialData) {
        const { message: initialMessage, embed, interval } = initialData;

        embed.setColor(flatColors.blue);
        embed.setFooter(`0 seconds remaining.`);

        try {
          await initialMessage.edit({ embeds: [embed] });
          clearInterval(interval);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(error);
        }
      }

      const game = getCurrentJottoGame(message.channel.id);

      if (game && !game.gameStarted) {
        startJottoGame(message);
      } else if (game && game.gameStarted) {
        changeJottoTurn(message);
      } else {
        message.reply(
          "there is no initiated game so please use `/jotto` to initiate.",
        );
      }
    },
    description: oneLine`Start the game immediately ignoring
      the ${timeToJoinInSeconds} seconds time to join.`,
  },
  {
    commands: ["h", "help"],
    handler: sendJottoHelpMessage,
    description: "Display help message",
  },
];

const activeJottoGames: ActiveJottoGames = {};

export const gameDataDir = path.resolve(
  process.env.JOTTO_GAME_DATA_DIR || "/tmp/",
);

export const getFileNameForGameData = (channelId: string) =>
  `jotto_${channelId}.json`;

export const getCurrentJottoGame = (
  channelId: string,
): JottoData | undefined | null => {
  const filepath = path.resolve(gameDataDir, getFileNameForGameData(channelId));

  if (!activeJottoGames[channelId] && existsSync(filepath)) {
    const filedata = JSON.parse(readFileSync(filepath, { encoding: "utf-8" }));

    activeJottoGames[channelId] = filedata;
  }

  return activeJottoGames[channelId];
};

export const setCurrentJottoGame = (
  channelId: string,
  gameData: JottoData | null,
) => {
  const filepath = path.resolve(gameDataDir, getFileNameForGameData(channelId));

  activeJottoGames[channelId] = gameData;

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

  return activeJottoGames[channelId];
};

const registerCommnads = (creator: SlashCreator, guildIDs: string[]) => {
  creator.registerCommands(makeJottoCommands(guildIDs));
};

export const setupJottoGame = (client: Client, creator: SlashCreator) => {
  let guildIDs = getGuildIds();

  registerCommnads(creator, guildIDs);

  setInterval(() => {
    const newGuildIds = getGuildIds();

    const foundNewGuildIds = newGuildIds.filter((id) => !guildIDs.includes(id));

    if (foundNewGuildIds.length > 0) {
      guildIDs = newGuildIds;

      registerCommnads(creator, foundNewGuildIds);

      creator.syncCommands({ syncGuilds: true });
    }
  }, 3000);

  setupGame(client, prefixes, [...actions]);
};
