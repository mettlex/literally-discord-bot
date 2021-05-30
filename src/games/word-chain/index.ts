import { Client } from "discord.js";
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
import { stripIndents } from "common-tags";
import { SlashCreator } from "slash-create";

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
    Check your spelling using Hunspell checker
    `,
  },
];

export const setupWordChainGame = (client: Client, creator: SlashCreator) => {
  creator.on("componentInteraction", async (ctx) => {
    if (ctx.customID === "join_word_chain") {
      await ctx.acknowledge();
      joinUsingButton(ctx, client);
    }
  });

  setupGame(client, prefixes, actions, [handleMessageForUnlimitedMode]);
};
