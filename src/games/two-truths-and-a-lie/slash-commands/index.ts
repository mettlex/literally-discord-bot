import { stripIndents } from "common-tags";
import { MessageEmbed, TextChannel, User } from "discord.js";
import pino from "pino";
import {
  SlashCreator,
  CommandContext,
  SlashCommand,
  CommandOptionType,
  ApplicationCommandOption,
} from "slash-create";
import { getDiscordJSClient, getGuildIds } from "../../../app";
import { shuffleArray } from "../../../utils/array";
import { flatColors } from "../../word-chain/config";

const notInProduction = process.env.NODE_ENV !== "production";

const logger = pino({ prettyPrint: notInProduction });

const options: ApplicationCommandOption[] = [
  {
    type: CommandOptionType.STRING,
    name: "1st_truth",
    description: "Write the first truth",
    required: true,
    default: false,
  },
  {
    type: CommandOptionType.STRING,
    name: "2nd_truth",
    description: "Write the second truth",
    required: true,
    default: false,
  },
  {
    type: CommandOptionType.STRING,
    name: "a_lie",
    description: "Write a lie",
    required: true,
    default: false,
  },
];

export class TwoTruthsAndALieCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: "two_truths_and_a_lie",
      description:
        "Say two truths and a lie and your friends will guess the lie",
      options,
      guildIDs: getGuildIds(),
      throttling: { duration: 60, usages: 1 },
    });

    this.filePath = __filename;
  }

  async run(ctx: CommandContext) {
    ctx.defer(true);

    const client = getDiscordJSClient();

    const channel = client.channels.cache.get(ctx.channelID) as
      | TextChannel
      | undefined;

    if (!channel) {
      // eslint-disable-next-line max-len
      return "There is an error getting the channel. Please report it to the developer.";
    }

    handleReactions(channel, ctx);

    return "Okay. Now wait for your friends to react.";
  }

  onError(err: Error, ctx: CommandContext) {
    logger.info(ctx);
    logger.error(err);
  }
}

const handleReactions = async (channel: TextChannel, ctx: CommandContext) => {
  const firstTruth = ctx.options[`${options[0]?.name}`] as string | undefined;
  const secondTruth = ctx.options[`${options[1]?.name}`] as string | undefined;
  const lie = ctx.options[`${options[2]?.name}`] as string | undefined;

  if (!firstTruth || !secondTruth || !lie) {
    return;
  }

  const choices = [firstTruth, secondTruth, lie];

  shuffleArray(choices);

  const lieIndex = choices.findIndex((choice) => choice === lie);

  const emojis = ["1️⃣", "2️⃣", "3️⃣"];

  const lieEmoji = emojis[lieIndex];

  const embed = new MessageEmbed()
    .setColor(flatColors.blue)
    .setTitle("Two Truths & A Lie")
    .setAuthor(`${ctx.user.username} said:`)
    .setDescription(
      stripIndents`
    ${emojis[0]} ${choices[0]}

    ${emojis[1]} ${choices[1]}
    
    ${emojis[2]} ${choices[2]}
    `,
    )
    .addField("Time To React", "60 seconds")
    .setFooter("Which one is a lie?");

  const message = await channel.send(embed).catch((e) => {
    logger.error(e);
  });

  if (!message) {
    return;
  }

  const promises = emojis.map((emoji) => message.react(emoji));

  await Promise.all(promises).catch((e) => {
    logger.error(e);
  });

  const collection = await message.awaitReactions(
    (_reaction, user: User) => {
      return !user.bot && user.id !== ctx.user.id;
    },
    { time: 60 * 1000 },
  );

  message.delete().catch((e) => {
    logger.error(e);
  });

  const lieReactions = collection.find((_, key) => key === lieEmoji);

  const winners = lieReactions?.users.cache.filter((u) => !u.bot).array();

  if (!lieReactions || !winners || winners?.length === 0) {
    const embed = new MessageEmbed()
      .setColor(flatColors.red)
      .setTitle("No Winner | Two Truths & A Lie")
      .setDescription(
        stripIndents`
        No one was able to detect which one is the lie.
        __Lie__: ${lie}
        `,
      )
      .setFooter(`Speaker: ${ctx.user.username}#${ctx.user.discriminator}`);

    channel.send(embed).catch((e) => {
      logger.error(e);
    });

    return;
  }

  {
    const embed = new MessageEmbed()
      .setColor(flatColors.green)
      .setTitle("Results | Two Truths & A Lie")
      .setDescription(`__Lie__: ${lie}`)
      .addField("Winners", `${winners.map((u) => `<@${u.id}>`).join(", ")}`)
      .setFooter(`Speaker: ${ctx.user.username}#${ctx.user.discriminator}`);

    channel.send(embed).catch((e) => {
      logger.error(e);
    });
  }
};
