import { Client } from "discord.js";
import { SlashCreator } from "slash-create";
import { TwoTruthsAndALieCommand } from "./slash-commands";

export const setupTwoTruthsAndALieGame = (
  client: Client,
  creator: SlashCreator,
) => {
  creator.registerCommands([TwoTruthsAndALieCommand]);
};
