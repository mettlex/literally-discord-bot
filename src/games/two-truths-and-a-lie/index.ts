import { Client } from "discord.js";
import { SlashCreator } from "slash-create";
import { TwoTruthsAndALieCommand } from "./slash-commands";

export const setupTwoTruthsAndALieGame = (
  client: Client,
  creator: SlashCreator,
) => {
  const registerCommnads = () => {
    creator.registerCommands([TwoTruthsAndALieCommand]);
  };

  let guildIds = client.guilds.cache.map((g) => g.id);

  registerCommnads();

  setInterval(() => {
    const newGuildIds = client.guilds.cache.map((g) => g.id);

    const foundNewGuildIds = newGuildIds.filter((id) => !guildIds.includes(id));

    if (foundNewGuildIds.length > 0) {
      guildIds = newGuildIds;

      creator.syncCommands({ syncGuilds: true });
    }
  }, 3000);
};
