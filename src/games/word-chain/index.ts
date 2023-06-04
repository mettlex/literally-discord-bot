import { ChannelType, Client, TextChannel } from "discord.js";
import { setupGame } from "../setup";
import { ActiveWordChainGames } from "./types";
import { prefixes } from "./config";
import start, { args as startArgs } from "./handlers/start";
import { join, joinUsingButton } from "./handlers/join";
import check, { args as checkArgs } from "./handlers/check";
import halt from "./handlers/halt";
import {
  handleMessageForUnlimitedMode,
  startUnlimitedMode,
  stopUnlimitedMode,
} from "./unlimited";
import { oneLine, stripIndents } from "common-tags";
import { SlashCreator } from "slash-create";
import help from "./handlers/help";
import { autoAppendMessage } from "./handlers/auto-append";

const activeGames: ActiveWordChainGames = {};

export const getAllActiveGames = () => activeGames;
export const getCurrentGame = (id: string) => activeGames[id];

export const actions = [
  {
    commands: ["stop unlimited", "stop u"],
    handler: stopUnlimitedMode,
    description: stripIndents`
    Stop the unlimited mode of Word-Chain in a channel
    (requires __Manage Server__ Permission)
    `,
  },
  {
    commands: ["stop", "halt", "abandon"],
    handler: halt,
    description: stripIndents`
    Stop the current ongoing game of Word-Chain in a channel
    (requires __Manage Server__ Permission)
    `,
  },
  {
    commands: ["unlimited", "start unlimited", "begin unlimited", "s u"],
    handler: startUnlimitedMode,
    description: stripIndents`
    Start the unlimited mode of Word-Chain in a channel
    (requires __Manage Server__ Permission)
    `,
  },
  {
    commands: ["start", "begin", "s"],
    handler: start,
    args: startArgs,
    description: `Start a Word-Chain game in a channel`,
  },
  {
    commands: ["join", "enter", "j"],
    handler: join,
    description: `Join a Word-Chain game which has been started`,
  },
  {
    commands: ["check", "c"],
    handler: check,
    args: checkArgs,
    description: stripIndents`
    Check your spelling using the spell-checker
    `,
  },
  {
    commands: ["auto-append", "auto append"],
    handler: autoAppendMessage,
    args: { on: "on", off: "off" },
    description:
      oneLine`Whether in-game turn instructions become
    the latest message if someone else messages in the channel` +
      `\n(requires __Manage Server__ Permission)`,
  },
];

const helpAction = { commands: ["help", "help me"], handler: help };

export const setupWordChainGame = (client: Client, creator: SlashCreator) => {
  creator.on("componentInteraction", async (ctx) => {
    if (ctx.customID.startsWith(`wc_start`)) {
      ctx.acknowledge();

      const messageId = ctx.customID.split("_").slice(-1)[0];

      // const channel = client.channels.cache.get(ctx.channelID)
      // as TextChannel;

      const channel = (await client.channels.fetch(ctx.channelID, {
        cache: false,
      })) as TextChannel | undefined;

      if (!channel || channel.type !== ChannelType.GuildText) {
        return;
      }

      const message = await channel.messages.fetch(messageId);

      if (!message || message.author.id !== ctx.user.id) {
        return;
      }

      let mode = "";

      for (const key in startArgs) {
        if (ctx.customID.includes(key)) {
          mode = key;
          break;
        }
      }

      if (!mode) {
        return;
      }

      message.content += `${message.content} ${mode}`;

      start(message);

      return;
    }

    if (ctx.customID === "join_word_chain" && ctx.member) {
      joinUsingButton(ctx, client);
    }
  });

  setupGame(
    client,
    prefixes,
    [...actions, helpAction],
    [handleMessageForUnlimitedMode],
  );
};
