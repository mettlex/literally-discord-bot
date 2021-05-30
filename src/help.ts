/* eslint-disable indent */
import { Client, DMChannel, MessageEmbed, TextChannel } from "discord.js";
import {
  ApplicationCommandOption,
  ButtonStyle,
  CommandContext,
  CommandOptionType,
  CommandStringOption,
  ComponentButton,
  GuildInteractionRequestData,
  SlashCommand,
  SlashCreator,
} from "slash-create";
import { getDiscordJSClient, getGuildIds } from "./app";
import packageInfo from "../package.json";
import sleep from "./utils/sleep";
import {
  flatColors,
  prefixes as wordchainPrefixes,
} from "./games/word-chain/config";
import { actions } from "./games/word-chain";
import { stripIndents } from "common-tags";
import pino from "pino";
// prettier-ignore
import {
  slashCommandOptions as slashCommandOptionsForTwoTruthsAndALie,
} from "./games/two-truths-and-a-lie/slash-commands";
import { prefixes } from "./config";
import "./extension";
import { ExtendedDMChannel, ExtendedTextChannel } from "./extension";

const logger = pino({ prettyPrint: process.env.NODE_ENV !== "production" });

const helpButtons: ComponentButton[] = [
  {
    type: 2,
    label: "Word-Chain",
    style: ButtonStyle.SUCCESS,
    custom_id: "help_word_chain",
  },
  {
    type: 2,
    label: "Two Truths & A Lie",
    style: ButtonStyle.SUCCESS,
    custom_id: "help_two_truths_and_a_lie",
  },
];

const registerCommnads = (creator: SlashCreator, guildIDs: string[]) => {
  creator.registerCommand(makeHelpSlashCommand(guildIDs));
};

export const setupHelpMenu = (client: Client, creator: SlashCreator) => {
  creator.on("componentInteraction", async (ctx) => {
    const channel =
      (client.guilds.cache
        .get(ctx.guildID || "")
        ?.channels.cache.get(ctx.channelID) as TextChannel) ||
      (client.channels.cache.get(ctx.channelID) as DMChannel);

    if (ctx.customID === helpButtons[0].custom_id) {
      await ctx.acknowledge();
      sendHelpMessage(ctx.user.id, channel, "word_chain", client);
    } else if (ctx.customID === helpButtons[1].custom_id) {
      await ctx.acknowledge();
      sendHelpMessage(ctx.user.id, channel, "two_truths_and_a_lie", client);
    }
  });

  client.on("message", (message) => {
    if (
      message.author.bot ||
      !prefixes.find((p) => message.content.toLowerCase().startsWith(p)) ||
      !message.content.toLowerCase().trim().endsWith("help")
    ) {
      return;
    }

    const channel = message.channel as ExtendedTextChannel | ExtendedDMChannel;

    channel
      .sendWithComponents({
        content: "**Please press a button below for instructions.**",
        components: [
          {
            components: helpButtons,
          },
        ],
      })
      .catch((e) => {
        logger.error(e);
      });
  });

  let guildIds = getGuildIds();

  registerCommnads(creator, guildIds);

  setInterval(() => {
    const newGuildIds = client.guilds.cache.map((g) => g.id);

    const foundNewGuildIds = newGuildIds.filter((id) => !guildIds.includes(id));

    if (foundNewGuildIds.length > 0) {
      guildIds = newGuildIds;

      registerCommnads(creator, foundNewGuildIds);

      creator.syncCommands({ syncGuilds: true });
    }
  }, 3000);
};

const gameValues = ["word_chain", "two_truths_and_a_lie"] as const;

const options: ApplicationCommandOption[] = [
  {
    type: CommandOptionType.STRING,
    name: "game",
    description: "Select the game name from the options.",
    required: true,
    default: false,
    choices: [
      {
        name: "Word-Chain",
        value: gameValues[0],
      },
      {
        name: "Two Truths & A Lie",
        value: gameValues[1],
      },
    ],
  },
];

const makeHelpSlashCommand = (guildIDs: string[]) =>
  class HelpSlashCommand extends SlashCommand {
    constructor(creator: SlashCreator) {
      super(creator, {
        name: "help",
        description: `Display help menu for ${packageInfo.displayName} bot`,
        options,
        guildIDs,
        throttling: { duration: 60, usages: 1 },
      });

      this.filePath = __filename;
    }

    async run(ctx: CommandContext) {
      ctx.defer();

      const interactionData = ctx.data as GuildInteractionRequestData;

      if (!interactionData.guild_id) {
        return;
      }

      const game = interactionData.data.options?.find(
        (option) => option.name === options[0].name,
      ) as CommandStringOption | undefined;

      if (!game) {
        return;
      }

      const gameValue = game.value as typeof gameValues[number];

      const client = getDiscordJSClient();

      const channel = client.guilds.cache
        .get(interactionData.guild_id)
        ?.channels.cache.find((c) => c.id === ctx.channelID);

      if (!channel || channel.type !== "text") {
        return;
      }

      await sendHelpMessage(
        ctx.user.id,
        channel as TextChannel,
        gameValue,
        client,
      );

      const tmpMessage = await ctx
        .send("Check the help menu below 👇")
        .catch((_e) => {
          return false;
        });

      if (typeof tmpMessage === "boolean") {
        return "Some errors showed up!";
      }

      await sleep(3000);

      await tmpMessage.delete();
    }
  };

const sendHelpMessage = (
  userId: string,
  channel: TextChannel | DMChannel,
  gameValue: typeof gameValues[number],
  client: Client,
) => {
  const embed = new MessageEmbed().setColor(flatColors.blue);

  if (gameValue === "word_chain") {
    embed
      .setDescription(
        stripIndents`
        ${actions
          .sort((a, b) => {
            if (a.commands[0].charCodeAt(0) > b.commands[0].charCodeAt(0)) {
              return 1;
            } else if (
              a.commands[0].charCodeAt(0) < b.commands[0].charCodeAt(0)
            ) {
              return -1;
            } else {
              return 0;
            }
          })
          .map(
            (action) => stripIndents`
              ${action.commands.map((c) => `\`${c}\``).join(" / ")}${
              action.args
                ? `\nArgument${
                    Object.keys(action.args).length > 1 ? "s" : ""
                  }: ${Object.keys(action.args)
                    .map((a) => `\`${a}\``)
                    .join(" | ")}`
                : ""
            }
              ${
                action.description
                  ? `> ${action.description.replace("\n", "\n> ")}`
                  : ""
              }
              > e.g. \`${wordchainPrefixes[0]}${action.commands[0]}${
              action.args ? ` ${action.args[Object.keys(action.args)[0]]}` : ""
            }\`
            `,
          )
          .join("\n\n")}

        `,
      )
      .setTitle("Word-Chain Game Commands")
      .addFields([
        {
          name: "Prefixes",
          value: wordchainPrefixes.map((p) => `\`${p}\``).join(", "),
          inline: false,
        },
      ]);
  } else if (gameValue === "two_truths_and_a_lie") {
    embed.setTitle("Two Truths & A Lie | Instructions").setDescription(
      stripIndents`
        You can play this game simply using [Slash Commands](https://support.discord.com/hc/en-us/articles/1500000368501-Slash-Commands-FAQ).
        
        Start typing \`/${slashCommandOptionsForTwoTruthsAndALie.name}\` then \
        you'll see a suggestion from ${client.user} bot.

        > 1. Select the suggestion to get the input options.
        > 2. Select and type true sentences for \`${
          slashCommandOptionsForTwoTruthsAndALie.options![0].name
        }\` & \`${
        slashCommandOptionsForTwoTruthsAndALie.options![1].name
      }\` options
        > 3. Select and type a false sentence for \`${
          slashCommandOptionsForTwoTruthsAndALie.options![2].name
        }\` option
        > 4. Send it and wait for others to react on the question!
        `,
    );
  } else {
    return;
  }

  channel.send(embed).catch((e) => {
    logger.error(e);
  });
};
