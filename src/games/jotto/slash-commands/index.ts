import { oneLine, stripIndents } from "common-tags";
import pino from "pino";
import {
  SlashCreator,
  CommandContext,
  SlashCommand,
  CommandOptionType,
  ApplicationCommandOption,
  SlashCommandOptions,
} from "slash-create";
import { getCurrentJottoGame, setCurrentJottoGame } from "..";
import { getDiscordJSClient } from "../../../app";
import {
  askToJoinJottoGame,
  getInitialMessageAndEmbed,
  getTurnInverval,
  notifyJoined,
  startJottoGame,
} from "../game-loop";
import { JottoData } from "../types";
import { attemptsLeft } from "../config";

const notInProduction = process.env.NODE_ENV !== "production";

const logger = pino({ prettyPrint: notInProduction });

const alphabet = new Array(26)
  .fill("")
  .map((_, i) => String.fromCharCode("A".charCodeAt(0) + i));

const options: ApplicationCommandOption[] = [
  {
    type: CommandOptionType.STRING,
    name: "secret_word",
    description: "Write your secret word",
    required: true,
  },
];

export const slashCommandOptions: SlashCommandOptions = {
  name: "jotto",
  description: "Play Jotto word-game by setting your secret word",
  options,
  throttling: { duration: 15, usages: 2 },
};

export const makeJottoCommands = (guildIDs: string[]) => {
  class JottoCommand extends SlashCommand {
    constructor(creator: SlashCreator) {
      super(creator, { ...slashCommandOptions, guildIDs });

      this.filePath = __filename;
    }

    async run(ctx: CommandContext): Promise<string> {
      ctx.defer(true);

      if (!ctx.guildID || !ctx.member) {
        return "Server not found";
      }

      const log = stripIndents`
      Guild: ${ctx.guildID}
      Channel: ${ctx.channelID}
      User: ${ctx.user.username}#${ctx.user.discriminator} ${ctx.user.id}
      Command: /${ctx.commandName}
      Options: ${JSON.stringify(ctx.options, null, 2)}
      `;

      logger.info(log);

      const game = getCurrentJottoGame(ctx.channelID);
      const word = (ctx.options["secret_word"] as string).trim().toUpperCase();

      if (!game || !game.gameStarted) {
        const existingData = game?.playersData.find(
          (data) => data.user.id === ctx.user.id,
        );

        if (existingData) {
          return oneLine`You already joined and
          set **${existingData.secret}** as your secret word.`;
        }

        if (
          game &&
          !game.gameStarted &&
          game.playersData[0].secret.length !== word.length
        ) {
          return oneLine`The first player chose
            ${game.playersData[0].secret.length}-letter word
            so you also need to give a word with the same number of
            letters for your secret.
          `;
        }

        if (word.length > 6 || word.length < 3) {
          return oneLine`The secret word can't be less than 3
            or more than 6 letters. Please try again.
          `;
        }

        if (word.split("").find((l) => !alphabet.includes(l))) {
          return oneLine`The secret word should contain only letters: A-Z.
            Please try again.
          `;
        }

        if (word.length !== new Set(word.split("")).size) {
          return oneLine`The secret word can't contain repeating letters
            (one letter more than once). Please try again.
          `;
        }

        const client = getDiscordJSClient();

        const user = await client.users.fetch(ctx.user.id, {
          cache: false,
          force: true,
        });

        const newJottoGame: JottoData = {
          playersData: [
            ...(game?.playersData || []),
            {
              attemptsLeft,
              user,
              secret: word,
              availableLetters: alphabet,
              revealedLetters: [],
              removedLetters: [],
              score: 0,
              winner: false,
            },
          ],
          gameStarted: false,
          currentPlayerIndex: 0,
          initialMessageInterval: undefined,
          turnInterval: undefined,
        };

        setCurrentJottoGame(ctx.channelID, newJottoGame);

        if (!game) {
          await askToJoinJottoGame(ctx, newJottoGame);
        } else {
          await notifyJoined(ctx);

          if (game.playersData.length === 30) {
            const initialData = getInitialMessageAndEmbed(ctx.channelID);

            initialData && (await startJottoGame(initialData.message));
          }
        }

        return `Successfully set your secret word.`;
      }

      return oneLine`There is already a running Jotto game in this channel.
      Please wait for it to finish or ask a server manager
      to use \`/stop_jotto\` slash command.`;
    }

    onError(err: Error, ctx: CommandContext) {
      logger.info(ctx);
      logger.error(err);

      ctx.send("Found an error. Please wait. The developer will check logs.");
    }
  }

  class StopJottoCommand extends SlashCommand {
    constructor(creator: SlashCreator) {
      super(creator, {
        name: "stop_jotto",
        description: "Stop the current Jotto game",
        guildIDs,
      });

      this.filePath = __filename;
    }

    async run(ctx: CommandContext): Promise<string> {
      const client = getDiscordJSClient();
      const member = await (
        await client.guilds.fetch(ctx.guildID || "")
      )?.members.fetch({ user: ctx.user.id, limit: 1, cache: false });

      if (!member) {
        return "Server/Member not found.";
      }

      if (!member.permissions.has("MANAGE_GUILD")) {
        return "Manage Server permission is needed to stop the game.";
      }

      const game = getCurrentJottoGame(ctx.channelID);

      if (game) {
        try {
          clearInterval(getTurnInverval(ctx.channelID)!);
        } catch (error) {
          logger.error(error as Error);
        }

        setCurrentJottoGame(ctx.channelID, null);

        return "Stopped the current Jotto game.";
      }

      return "No game found.";
    }

    onError(err: Error, ctx: CommandContext) {
      logger.info(ctx);
      logger.error(err);

      ctx.send("Found an error. Please wait. The developer will check logs.");
    }
  }

  return [JottoCommand, StopJottoCommand];
};
