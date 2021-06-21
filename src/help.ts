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
import { prefixes as wordchainPrefixes } from "./games/word-chain/config";
import { flatColors } from "./config";
import { actions as wcActions } from "./games/word-chain";
import { oneLine, stripIndents } from "common-tags";
// prettier-ignore
import {
  slashCommandOptions as slashCommandOptionsForTwoTruthsAndALie,
} from "./games/two-truths-and-a-lie/slash-commands";
import { prefixes as lyPrefixes } from "./config";
import "./extension";
import { ExtendedDMChannel, ExtendedTextChannel } from "./extension";
import { actions as jottoActions } from "./games/jotto";
import { prefixes as jottoPrefixes } from "./games/jotto/config";

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
  {
    type: 2,
    label: "Jotto",
    style: ButtonStyle.SUCCESS,
    custom_id: "help_jotto",
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
      await ctx.send("Check the message below 👇");
      sendHelpMessage(ctx.user.id, channel, "word_chain", client);
    } else if (ctx.customID === helpButtons[1].custom_id) {
      await ctx.send("Check the message below 👇");
      sendHelpMessage(ctx.user.id, channel, "two_truths_and_a_lie", client);
    } else if (ctx.customID === helpButtons[2].custom_id) {
      await ctx.send("Check the message below 👇");
      sendHelpMessage(ctx.user.id, channel, "jotto", client);
    }
  });

  client.on("message", (message) => {
    if (
      message.author.bot ||
      !lyPrefixes.find((p) => message.content.toLowerCase().startsWith(p)) ||
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
        // eslint-disable-next-line no-console
        console.error(e);
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

const gameValues = ["word_chain", "two_truths_and_a_lie", "jotto"] as const;

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
      {
        name: "Jotto",
        value: gameValues[2],
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

export const sendHelpMessage = (
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
        ${wcActions
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
              action.args
                ? ` ${
                    (action.args as { [key: string]: string })[
                      Object.keys(action.args)[0]
                    ]
                  }`
                : ""
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
  } else if (gameValue === "jotto") {
    embed.setTitle("Jotto - guess the secret word");

    embed.setDescription(stripIndents`
    In Jotto, each player thinks of a secret word.
    Then, you take turns trying to guess your opponent's word.

    ${oneLine`If you get it wrong, you'll at least find out
      how many letters your guess has in common with the correct word.`}
    
    ${oneLine`Use smart guesses to eliminate letters and
      figure out other player's secret word before they figure out yours!`}
    
    ${oneLine`To start the game a player uses the slash command
      \`/jotto\` and sets the secret word. Other players joins
      using the same \`/jotto\` command.
      `}

    \`/stop_jotto\` slash command:
    > Stop the current Jotto game (requires Manage Server permission)

    Additional Commands:

    ${jottoActions
      .map((action) => {
        return stripIndents`${action.commands
          .map((c) => `\`${jottoPrefixes[0]}${c}\``)
          .join(", ")}
          > ${action.description}
        `;
      })
      .join("\n\n")}
    
    Available Prefixes:
    ${jottoPrefixes.map((p) => `\`${p}\``).join(", ")}
    
    `);
  } else {
    return;
  }

  channel.send({ embed, content: `<@${userId}>, here.` }).catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
  });
};
