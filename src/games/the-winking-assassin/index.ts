import { Client } from "discord.js";
import { SlashCreator } from "slash-create";
import { getGuildIds } from "../../app";
import { startTWAGame } from "./game-loop";
import { makeTheWinkingAssassinCommands } from "./slash-commands";
import { ActiveTWAGames, TheWinkingAssassinGame } from "./types";

const activeTWAGames: ActiveTWAGames = {};

export const getCurrentTWAGame = (channelId: string) =>
  activeTWAGames[channelId];

export const setCurrentTWAGame = (
  channelId: string,
  gameData: TheWinkingAssassinGame | undefined,
) => {
  activeTWAGames[channelId] = gameData;
  return activeTWAGames[channelId];
};

const registerCommnads = (creator: SlashCreator, guildIDs: string[]) => {
  creator.registerCommands(makeTheWinkingAssassinCommands(guildIDs));
};

export const setupTheWinkingAssassinGame = (
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

  creator.on("componentInteraction", async (ctx) => {
    if (ctx.customID === "join_twa") {
      const currentGame = getCurrentTWAGame(ctx.channelID);

      if (!currentGame) {
        await ctx.send(`${ctx.user.mention}, there is no running game.`);
        return;
      }

      if (currentGame.alivePlayerIds.includes(ctx.user.id)) {
        await ctx.send(`${ctx.user.mention} has joined the game.`);
        return;
      }

      currentGame.alivePlayerIds = [...currentGame.alivePlayerIds, ctx.user.id];
      currentGame.playerActions[ctx.user.id] = [];

      setCurrentTWAGame(ctx.channelID, currentGame);

      await ctx.send(`${ctx.user.mention} has joined the game.`);

      if (currentGame.alivePlayerIds.length > 9) {
        startTWAGame(ctx);
        return;
      }

      return;
    }

    ctx.acknowledge();
    return;
  });
};
