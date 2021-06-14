import { oneLine } from "common-tags";
import {
  CommandContext,
  SlashCommand,
  SlashCommandOptions,
  SlashCreator,
} from "slash-create";
import {
  getCurrentCoupReformationGame,
  getDescriptionFromCardName,
} from "../data";

export const slashCommandOptionsForCheckCards: SlashCommandOptions = {
  name: "check_influences",
  description: "See your cards secretly in the current Coup game",
  deferEphemeral: true,
  throttling: { duration: 15, usages: 1 },
};

export const makeCoupCommands = (guildIDs: string[]) => {
  class CoupCheckCardsCommand extends SlashCommand {
    constructor(creator: SlashCreator) {
      super(creator, { ...slashCommandOptionsForCheckCards, guildIDs });

      this.filePath = __filename;
    }

    async run(ctx: CommandContext) {
      await ctx.defer(true);

      const game = getCurrentCoupReformationGame(ctx.channelID);

      if (!game) {
        return "No Coup game is running now.";
      }

      const player = game?.players.find((p) => p.id === ctx.user.id);

      if (!player) {
        return oneLine`You're not a player in the current Coup game.
        Please wait for the next game.`;
      }

      if (player.influences.length === 0) {
        return "You don't have any influence left.";
      }

      await ctx.send({
        ephemeral: true,
        embeds: [
          {
            title: `${ctx.member?.nick || ctx.user.username}'s influences`,
            description: `Your current influences are ${player.influences
              .map((inf) => `**${inf.name.toUpperCase()}**`)
              .join(" & ")}`,
            fields: player.influences.map((inf) => ({
              name: inf.name.toUpperCase(),
              value: getDescriptionFromCardName(inf.name),
              inline: true,
            })),
          },
        ],
      });
    }

    onError(err: Error, ctx: CommandContext) {
      // eslint-disable-next-line no-console
      console.log(ctx);
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }

  return [CoupCheckCardsCommand];
};
