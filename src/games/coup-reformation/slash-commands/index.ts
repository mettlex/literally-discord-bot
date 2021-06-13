import {
  CommandContext,
  SlashCommand,
  SlashCommandOptions,
  SlashCreator,
} from "slash-create";

const slashCommandOptionsForCheckCards: SlashCommandOptions = {
  name: "check_cards_in_coup",
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
      ctx.defer(true);

      return "Not done yet.";
    }

    onError(err: Error, ctx: CommandContext) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }

  return [CoupCheckCardsCommand];
};
