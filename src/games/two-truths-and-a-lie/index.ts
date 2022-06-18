import { Client } from "discord.js";
import { SlashCreator } from "slash-create";
import { getGuildIds } from "../../utils/shards";
import { makeTwoTruthsAndALieCommand } from "./slash-commands";

const registerCommnads = (creator: SlashCreator, guildIDs: string[]) => {
  creator.registerCommand(makeTwoTruthsAndALieCommand(guildIDs));
};

export const setupTwoTruthsAndALieGame = async (
  client: Client,
  creator: SlashCreator,
) => {
  let guildIDs = await getGuildIds(client);

  registerCommnads(creator, guildIDs);

  setInterval(async () => {
    const newGuildIds = await getGuildIds(client);

    const foundNewGuildIds = newGuildIds.filter((id) => !guildIDs.includes(id));

    if (foundNewGuildIds.length > 0) {
      guildIDs = newGuildIds;

      registerCommnads(creator, foundNewGuildIds);

      creator.syncCommands({ syncGuilds: true });
    }
  }, 3000);
};
