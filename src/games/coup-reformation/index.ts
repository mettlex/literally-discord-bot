import { oneLine } from "common-tags";
import { Client } from "discord.js";
import { SlashCreator } from "slash-create";
import { setupGame } from "../setup";
import { Action } from "../types";
import { prefixes, timeToJoinInSeconds } from "./config";
import { flatColors } from "../../config";
import {
  getCurrentCoupReformationGame,
  getInitialMessageAndEmbed,
} from "./data";
import { sendCoupHelpMessage } from "./handlers/help";
import { ExtendedTextChannel } from "../../extension";
import { getGuildIds } from "../../app";
import { makeCoupCommands } from "./slash-commands";

export const actions: Action[] = [
  {
    commands: ["fs", "force-start", "force start"],
    handler: async (message) => {
      if (!message.member?.hasPermission("MANAGE_GUILD")) {
        return;
      }

      const initialData = getInitialMessageAndEmbed(message.channel.id);

      if (initialData) {
        const { message: initialMessage, embed, interval } = initialData;

        embed.setColor(flatColors.blue);
        embed.setFooter(`0 seconds remaining.`);

        try {
          await initialMessage.edit(embed);
          clearInterval(interval);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(error);
        }
      }

      const game = getCurrentCoupReformationGame(message.channel.id);

      if (game && !game.gameStarted) {
        // startCoupReformationGame(message);
      } else if (game && game.gameStarted) {
        // changeCoupReformationTurn(message);
      } else {
        message.reply(
          oneLine`there is no initiated game so
          please use \`${prefixes[0]}start\` to initiate.`,
        );
      }
    },
    description: oneLine`Start the game immediately ignoring
      the ${timeToJoinInSeconds} seconds time to join.`,
  },
  {
    commands: ["h", "help"],
    handler: sendCoupHelpMessage,
    description: "Display help message",
  },
  {
    commands: ["c", "check"],
    handler: (message) => {
      if (message.author.bot || message.channel.type !== "text") {
        return;
      }

      const channel = message.channel as ExtendedTextChannel;

      channel
        .send({
          content: oneLine`Use \`/check_cards_in_coup\` slash command to
          check your influence cards secretly.`,
        })
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.error(e);
        });
    },
    description: "Check your own Influence Cards secretly.",
  },
  {
    commands: [],
    handler: () => {},
    description: "Start a new Coup game.",
  },
];

const registerCommnads = (creator: SlashCreator, guildIDs: string[]) => {
  creator.registerCommands(makeCoupCommands(guildIDs));
};

export const setupCoupReformationGame = (
  client: Client,
  creator: SlashCreator,
) => {
  setupGame(client, prefixes, [...actions]);

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
};
