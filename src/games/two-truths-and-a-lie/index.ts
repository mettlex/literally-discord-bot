import { Client } from "discord.js";
import { SlashCreator } from "slash-create";
import { getGuildIds } from "../../app";
import { makeTwoTruthsAndALieCommand } from "./slash-commands";

const registerCommnads = (creator: SlashCreator, guildIDs: string[]) => {
  creator.registerCommand(makeTwoTruthsAndALieCommand(guildIDs));
};

export const setupTwoTruthsAndALieGame = (
  _client: Client,
  creator: SlashCreator,
) => {
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
