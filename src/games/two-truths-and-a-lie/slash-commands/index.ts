/* eslint-disable indent */
import { stripIndents } from "common-tags";
import { differenceInSeconds } from "date-fns";
import { EmbedBuilder, MessageReaction, TextChannel, User } from "discord.js";
import pino from "pino";
import {
  SlashCreator,
  CommandContext,
  SlashCommand,
  CommandOptionType,
  ApplicationCommandOption,
  SlashCommandOptions,
} from "slash-create";
import { getDiscordJSClient } from "../../../app";
import { shuffleArray } from "../../../utils/array";
import { flatColors } from "../../../config";

const logger = pino();

const options: ApplicationCommandOption[] = [
  {
    type: CommandOptionType.STRING,
    name: "1st_truth",
    description: "Write the first truth",
    required: true,
  },
  {
    type: CommandOptionType.STRING,
    name: "2nd_truth",
    description: "Write the second truth",
    required: true,
  },
  {
    type: CommandOptionType.STRING,
    name: "a_lie",
    description: "Write a lie",
    required: true,
  },
];

export const slashCommandOptions: SlashCommandOptions = {
  name: "two_truths_and_a_lie",
  description: "Say two truths and a lie and your friends will guess the lie",
  options,
  throttling: { duration: 60, usages: 1 },
};

export const makeTwoTruthsAndALieCommand = (guildIDs: string[]) => {
  return class TwoTruthsAndALieCommand extends SlashCommand {
    constructor(creator: SlashCreator) {
      super(creator, { ...slashCommandOptions, guildIDs });

      this.filePath = __filename;
    }

    async run(ctx: CommandContext) {
      ctx.defer(true);

      const client = getDiscordJSClient();

      // const channel = client.channels.cache.get(ctx.channelID) as
      //   | TextChannel
      //   | undefined;

      const channel = (await client.channels.fetch(ctx.channelID, {
        cache: false,
      })) as TextChannel | undefined;

      if (!channel) {
        // eslint-disable-next-line max-len
        return "There is an error getting the channel. Please report it to the developer.";
      }

      handleReactions(channel, ctx);

      return "Okay. Now wait for your friends to react.";
    }

    onError(err: Error, ctx: CommandContext) {
      logger.info(ctx);
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };
};

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

  const truthEmojis = emojis.filter((emoji) => emoji !== lieEmoji);

  const timefieldLabel = "Time To React";
  const maxTimeInSeconds = 60;

  const embed = new EmbedBuilder()
    .setColor(flatColors.blue)
    .setTitle("Two Truths & A Lie")
    .setDescription(
      stripIndents`
    **${ctx.user.mention} said:**

    ${emojis[0]} ${choices[0]}

    ${emojis[1]} ${choices[1]}
    
    ${emojis[2]} ${choices[2]}
    `,
    )
    .addFields({
      name: timefieldLabel,
      value: `${maxTimeInSeconds} seconds`,
    })
    .setFooter({
      text: "Which one is a lie?",
    });

  const message = await channel
    .send({ content: "​", embeds: [embed] })
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
    });

  if (!message) {
    return;
  }

  const stopEmoji = "⏹️";

  const promises = [...emojis, stopEmoji].map((emoji) => message.react(emoji));

  await Promise.all(promises).catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
  });

  const oldDateTime = new Date();
  let timeLeft = maxTimeInSeconds;
  let interval2Cleared = false;

  const interval1 = setInterval(() => {
    timeLeft = maxTimeInSeconds - differenceInSeconds(new Date(), oldDateTime);

    if (timeLeft <= 0) {
      clearInterval(interval1);
    }
  }, 900);

  const interval2 = setInterval(() => {
    if (timeLeft >= 0) {
      const field = embed.data.fields?.find((f) => f.name === timefieldLabel);

      field && (field.value = `${timeLeft} seconds`);

      message.edit({ embeds: [embed] });
    } else {
      try {
        interval2Cleared = true;
        clearInterval(interval2);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
      }
    }
  }, 3000);

  const getSingleReaction = () =>
    message
      .awaitReactions({
        filter: (reaction: MessageReaction, user: User) => {
          return (
            !user.bot &&
            ((user.id !== ctx.user.id && reaction.emoji.name !== stopEmoji) ||
              (user.id === ctx.user.id && reaction.emoji.name === stopEmoji))
          );
        },
        time: timeLeft * 1000,
        max: 1,
      })
      .then((c) => c.first())
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
        return undefined;
      });

  const reacttionsArray = [];

  while (timeLeft > 0) {
    const reaction = await getSingleReaction();

    if (!reaction) {
      continue;
    }

    // if (
    //   reaction.emoji.name === stopEmoji &&
    //   reaction.users.cache.find((u) => u.id === ctx.user.id)
    // ) {
    //   break;
    // }

    if (
      reaction.emoji.name === stopEmoji &&
      // must use cache ig
      reaction.users.cache.find((u) => u.id === ctx.user.id)
    ) {
      break;
    }

    reacttionsArray.push(reaction);
  }

  try {
    message.reactions.removeAll().catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
    });

    const tid = setTimeout(() => {
      message.delete().catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });

      clearTimeout(tid);
    }, 15000);

    !interval2Cleared && clearInterval(interval2);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
  }

  const reactions = reacttionsArray.filter((r) => r) as MessageReaction[];

  const lieReactions = reactions.filter((r) => r && r.emoji.name === lieEmoji);

  const truthReactionsArray = reactions.filter((r) =>
    truthEmojis.includes(r.emoji.name || ""),
  );

  const winners = lieReactions
    .map((r) => r.users.cache.first())
    .flat()
    .filter((u) => u && !u.bot && u.id !== ctx.user.id)
    .map((u) => u && u.id);

  if (winners && winners.length > 0 && truthReactionsArray) {
    for (const winner of winners) {
      for (const truthReactions of truthReactionsArray) {
        if (winner && truthReactions.users.cache.get(winner)) {
          winners.splice(winners.indexOf(winner), 1);
        }
      }
    }
  }

  if (!lieReactions || !winners || winners?.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(flatColors.red)
      .setTitle("No Winner | Two Truths & A Lie")
      .setDescription(
        stripIndents`
        No one was able to detect which one is the lie.
        
        ${ctx.user.mention} told this lie:

        **"${lie}"**
        `,
      );

    channel.send({ content: "​", embeds: [embed] }).catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
    });

    return;
  }

  {
    // limiting to 30 winners at most
    const winnerIds = Array.from(new Set(winners)).slice(0, 30);

    const embed = new EmbedBuilder()
      .setColor(flatColors.green)
      .setTitle("Results | Two Truths & A Lie")
      .setDescription(
        stripIndents`
          ${ctx.user.mention} told this lie:

          **"${lie}"**

          __**Winners:**__

          ${winnerIds.map((id) => `<@${id}>`).join(", ")}
        `,
      );

    channel.send({ content: "​", embeds: [embed] }).catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
    });
  }
};
