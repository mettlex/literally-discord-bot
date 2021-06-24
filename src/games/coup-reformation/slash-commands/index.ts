import { oneLine } from "common-tags";
import {
  ButtonStyle,
  CommandContext,
  ComponentActionRow,
  ComponentContext,
  ComponentType,
  MessageEmbedOptions,
  SlashCommand,
  SlashCommandOptions,
  SlashCreator,
} from "slash-create";
import {
  getCurrentCoupGame,
  getDescriptionFromCardName,
  getImageURLForInfluenceCard,
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
      await showInfluences(ctx).catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
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

export const showInfluences = async (
  ctx: CommandContext | ComponentContext,
) => {
  await ctx.defer(true);

  const game = getCurrentCoupGame(ctx.channelID);

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

  let components: ComponentActionRow[] | undefined;

  if (player.lostChallenge) {
    components = [
      {
        type: ComponentType.ACTION_ROW,
        components: player.influences.map((inf, i) => ({
          type: ComponentType.BUTTON,
          style: ButtonStyle.DESTRUCTIVE,
          label: `DISMISS ${inf.name.toUpperCase()}`,
          custom_id: `coup_dismiss_influence_${i}`,
          disabled: inf.dismissed,
        })),
      },
    ];
  }

  const influenceEmbedsWithImages: MessageEmbedOptions[] =
    player.influences.map((inf, i) => ({
      author: {
        name: `${i + 1}. ${inf.name.toUpperCase()} ${
          (inf.dismissed && "🚫") || ""
        }`,
      },
      description: getDescriptionFromCardName(inf.name),
      thumbnail: { url: getImageURLForInfluenceCard(inf.name) },
      footer: {
        text:
          (inf.dismissed && "You can't use this dismissed influence.") || "",
      },
    }));

  await ctx.send({
    ephemeral: true,
    content: `__**${player.name}'s Influences**__`,
    embeds: [...influenceEmbedsWithImages],
    components,
  });
};
