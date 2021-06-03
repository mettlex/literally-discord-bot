import { oneLine } from "common-tags";
import {
  ApplicationCommandOption,
  CommandContext,
  CommandOptionType,
  SlashCommand,
  SlashCommandOptions,
  SlashCreator,
} from "slash-create";
import { getCurrentTWAGame, setCurrentTWAGame } from "..";
import { getDiscordJSClient } from "../../../app";
import { ExtendedTextChannel } from "../../../extension";
import { askToJoinTheWinkingAssassinGame } from "../game-loop";

const options: ApplicationCommandOption[] = [
  {
    type: CommandOptionType.INTEGER,
    name: "time_limit",
    description: "Set the number of minutes this game may continue for",
    required: false,
    choices: [
      {
        name: "5 minutes",
        value: 5,
      },
      {
        name: "15 minutes",
        value: 15,
      },
      {
        name: "30 minutes",
        value: 30,
      },
    ],
  },
];

const slashCommandOptionsForStart1: SlashCommandOptions = {
  name: "the_winking_assassin",
  description: "Start one of 'The Winking Assassin' games",
  options,
  // throttling: { duration: 30, usages: 1 },
};

const slashCommandOptionsForStart2: SlashCommandOptions = {
  ...slashCommandOptionsForStart1,
  name: "twa",
  description: "Short command of 'The Winking Assassin'",
};

const slashCommandOptionsForWitness: SlashCommandOptions = {
  name: "witness",
  description:
    "Witness a player whether he/she is winking in 'The Winking Assassin' Game",

  throttling: { duration: 2, usages: 1 },
  options: [
    {
      type: CommandOptionType.STRING,
      name: "mention_player",
      description: "Mention a player using @",
      required: true,
    },
  ],
};

const processStartCommand = async (ctx: CommandContext) => {
  ctx.defer(true);

  const currentGame = getCurrentTWAGame(ctx.channelID);

  if (currentGame) {
    return "There is a game running. Please wait until this one finishes.";
  }

  const client = getDiscordJSClient();

  const channel = client.channels.cache.get(ctx.channelID) as
    | ExtendedTextChannel
    | undefined;

  if (!channel || channel.type !== "text") {
    // eslint-disable-next-line max-len
    return "There is an error getting the channel. Please report it to the developer.";
  }

  askToJoinTheWinkingAssassinGame(channel, ctx).catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
  });

  return "Okay. Now wait for your friends to join.";
};

export const makeTheWinkingAssassinCommands = (guildIDs: string[]) => {
  class TheWinkingAssassinCommand extends SlashCommand {
    constructor(creator: SlashCreator) {
      super(creator, { ...slashCommandOptionsForStart1, guildIDs });

      this.filePath = __filename;
    }

    async run(ctx: CommandContext) {
      return processStartCommand(ctx);
    }
  }

  class TWACommand extends SlashCommand {
    constructor(creator: SlashCreator) {
      super(creator, { ...slashCommandOptionsForStart2, guildIDs });

      this.filePath = __filename;
    }

    async run(ctx: CommandContext) {
      return processStartCommand(ctx);
    }
  }

  class WitnessCommand extends SlashCommand {
    constructor(creator: SlashCreator) {
      super(creator, { ...slashCommandOptionsForWitness, guildIDs });

      this.filePath = __filename;
    }

    async run(ctx: CommandContext): Promise<string> {
      await ctx.defer(true);

      const game = getCurrentTWAGame(ctx.channelID);

      if (!game) {
        return "No game of 'The Winking Assassin' is running now.";
      }

      const mentionText: string | undefined = ctx.options.mention_player;

      if (!mentionText) {
        return "Oops error! Ping the developer.";
      }

      const userId = mentionText.replace(/[^0-9]/g, "");

      // if (userId === ctx.user.id) {
      //   return "You looked at yourself. You okay?";
      // }

      if (
        !game.alivePlayerIds.includes(ctx.user.id) &&
        !game.deadPlayerIds.includes(ctx.user.id) &&
        !game.assassinIds.includes(ctx.user.id)
      ) {
        return (
          "You're not in the current game. " +
          "Please wait until the next game starts."
        );
      }

      // Not revealing assassin like this:
      // if (
      //   !game.alivePlayerIds.includes(ctx.user.id) ||
      //   game.deadPlayerIds.includes(ctx.user.id)
      // ) {
      //   return "The Assassin winked at you so you must play dead now.";
      // }

      // if (!game.alivePlayerIds.includes(userId)) {
      //   return "The user which you mentioned isn't alive in the game.";
      // }

      let actionText = "";

      const lastAction = game.playerActions[userId].slice(-1)[0];

      if (!lastAction) {
        actionText = oneLine`looking at no one.
        You're now staring at ${mentionText}.`;
      } else if (lastAction.includes("witnessed")) {
        actionText = `looking at <@${lastAction.replace(
          /[^0-9]/g,
          "",
        )}>. You're now staring at ${mentionText}.`;
      } else if (
        lastAction.includes("winked") &&
        game.assassinIds.includes(userId)
      ) {
        const assassinWitnessedActions = game.playerActions[userId].filter(
          (action) => action.includes("witnessed"),
        );

        if (assassinWitnessedActions.length > 0) {
          const lastAction =
            assassinWitnessedActions[assassinWitnessedActions.length - 1];

          actionText = `looking at <@${lastAction.replace(
            /[^0-9]/g,
            "",
          )}>. You're now staring at ${mentionText}.`;
        } else {
          actionText = oneLine`looking at no one.
          You're now staring at ${mentionText}.`;
        }

        if (lastAction.includes(ctx.user.id)) {
          game.alivePlayerIds.splice(
            game.alivePlayerIds.indexOf(ctx.user.id),
            1,
          );

          game.deadPlayerIds = [...game.deadPlayerIds, ctx.user.id];

          setCurrentTWAGame(ctx.channelID, game);
        } else if (!game.deadPlayerIds.includes(ctx.user.id)) {
          actionText = oneLine`**winking** at someone. Hurry up!
          Expose the assassin using \`/expose_assassin\` slash command.`;
        }
      }

      game.playerActions[ctx.user.id] = [
        ...game.playerActions[ctx.user.id],
        `witnessed_${userId}`,
      ];

      const sayIfAssassin = game.assassinIds.includes(ctx.user.id)
        ? " __P.S.__ You're the assassin."
        : "";

      return oneLine`${ctx.user.mention},
      you witnessed ${mentionText}
      ${actionText}${sayIfAssassin}`;
    }
  }

  // class WinkCommand extends SlashCommand {
  //   constructor(creator: SlashCreator) {
  //     super(creator, { ...slashCommandOptionsForStart2, guildIDs });

  //     this.filePath = __filename;
  //   }

  //   async run(ctx: CommandContext) {}
  // }

  // class ExposeAssassinCommand extends SlashCommand {
  //   constructor(creator: SlashCreator) {
  //     super(creator, { ...slashCommandOptionsForStart2, guildIDs });

  //     this.filePath = __filename;
  //   }

  //   async run(ctx: CommandContext) {}
  // }

  return [
    TheWinkingAssassinCommand,
    TWACommand,
    WitnessCommand,
    // WinkCommand,
    // ExposeAssassinCommand,
  ];
};
