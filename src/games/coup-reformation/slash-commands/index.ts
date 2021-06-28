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
    await ctx.send("No Coup game is running now.");
    return;
  }

  const player = game?.players.find((p) => p.id === ctx.user.id);

  if (!player) {
    await ctx.send(oneLine`
      You're not a player in the current Coup game.
      Please wait for the next game.
    `);
    return;
  }

  if (player.influences.length === 0) {
    await ctx.send("You don't have any influence left.");
    return;
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

  if (player.influencesToReturn && player.influencesToReturn > 0) {
    components = [
      {
        type: ComponentType.ACTION_ROW,
        components: player.influences
          .filter((inf) => !inf.dismissed)
          .map((inf, i) => ({
            type: ComponentType.BUTTON,
            style: ButtonStyle.SECONDARY,
            label: `RETURN ${inf.name.toUpperCase()}`,
            custom_id: `coup_return_influence_${i}`,
            disabled: inf.returned,
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
