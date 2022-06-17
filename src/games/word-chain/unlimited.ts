import { stripIndents } from "common-tags";
import { Message, MessageEmbed } from "discord.js";
import pino from "pino";
import { actions } from ".";
import { prefixes } from "./config";
import { flatColors } from "../../config";
import { checkSpell } from "./spell-checker";
import { ActiveUnlimitedWordChains, UnlimitedWordChainGame } from "./types";

const logger = pino({ prettyPrint: process.env.NODE_ENV !== "production" });

const activeWordChains: ActiveUnlimitedWordChains = {};

const fieldNameForTotalWords = "Total Correct Words";
const fieldNameForConnectedWords = "Connected Words";
const fieldNameForLastCorrectMessageId = "Last Correct Message ID";
const fieldNameForLongestWord = "Longest Word";
const fieldNameForLongestWordAuthor = "Longest Word Author";

const numberEmojis = [
  {
    number: 0,
    string: "0",
    emojis: ["0️⃣", "🅾️", "👌", "🌀"],
  },
  {
    number: 1,
    string: "1",
    emojis: ["1️⃣", "🥇", "👆", "☝️"],
  },
  {
    number: 2,
    string: "2",
    emojis: ["2️⃣", "✌️", "🥈", "🤘"],
  },
  {
    number: 3,
    string: "3",
    emojis: ["3️⃣", "🥉", "🤟", "🚦"],
  },
  {
    number: 4,
    string: "4",
    emojis: ["4️⃣", "🍀", "🕓", "👨‍👩‍👧‍👦"],
  },
  {
    number: 5,
    string: "5",
    emojis: ["5️⃣", "🖐", "🤚", "👋"],
  },
  {
    number: 6,
    string: "6",
    emojis: ["6️⃣", "🕕", "🔯", "✡️"],
  },
  {
    number: 7,
    string: "7",
    emojis: ["7️⃣", "🕖", "🕢", "🌈"],
  },
  {
    number: 8,
    string: "8",
    emojis: ["8️⃣", "🎱", "🕗", "✳️"],
  },
  {
    number: 9,
    string: "9",
    emojis: ["9️⃣", "🕘", "🕤"],
  },
];

const findThePinnedMessage = async (message: Message) => {
  const pinnedMessageCollection = await message.channel.messages
    .fetchPinned(false)
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
    });

  if (!pinnedMessageCollection) {
    return;
  }

  const pinnedMessages = pinnedMessageCollection.values();

  for (const pinnedMessage of pinnedMessages) {
    if (pinnedMessage.author.id !== message.client.user?.id) {
      continue;
    }

    const embed = pinnedMessage.embeds[0];

    if (!embed) {
      return;
    }

    const title = embed.title?.toLowerCase();

    const totalWordsField = embed.fields.find(
      (f) => f.name === fieldNameForTotalWords,
    );

    const connectedWordsField = embed.fields.find(
      (f) => f.name === fieldNameForConnectedWords,
    );

    const lastCorrectMessageIdField = embed.fields.find(
      (f) => f.name === fieldNameForLastCorrectMessageId,
    );

    if (
      title?.includes("unlimited") &&
      totalWordsField &&
      connectedWordsField &&
      lastCorrectMessageIdField
    ) {
      return pinnedMessage;
    }
  }
};

const getDataFromThePinnedMessage = async (
  message: Message,
): Promise<UnlimitedWordChainGame | null> => {
  const pinnedMessage = await findThePinnedMessage(message);

  if (!pinnedMessage) {
    return null;
  }

  const embed = pinnedMessage.embeds[0];

  if (!embed) {
    return null;
  }

  const title = embed.title?.toLowerCase();

  const totalWordsField = embed.fields.find(
    (f) => f.name === fieldNameForTotalWords,
  );

  const connectedWordsField = embed.fields.find(
    (f) => f.name === fieldNameForConnectedWords,
  );

  const lastCorrectMessageIdField = embed.fields.find(
    (f) => f.name === fieldNameForLastCorrectMessageId,
  );

  const longestWordField = embed.fields.find(
    (f) => f.name === fieldNameForLongestWord,
  );

  const longestWordAuthorField = embed.fields.find(
    (f) => f.name === fieldNameForLongestWordAuthor,
  );

  if (
    title?.includes("unlimited") &&
    totalWordsField &&
    connectedWordsField &&
    lastCorrectMessageIdField &&
    longestWordField &&
    longestWordAuthorField
  ) {
    const totalCorrectWords = parseInt(totalWordsField.value);
    const connectedChainWords = parseInt(connectedWordsField.value);
    const lastCorrectMessageId = lastCorrectMessageIdField.value;
    const longestWord = longestWordField.value;
    const longestWordAuthor = message.client.users.cache.get(
      longestWordAuthorField.value.replace(/[^0-9]/g, ""),
    )!;

    return {
      totalCorrectWords,
      connectedChainWords,
      lastCorrectMessageId,
      longestWord,
      longestWordAuthor,
    };
  }

  return null;
};

const setDataInThePinnedMessage = async (
  message: Message,
  data: UnlimitedWordChainGame,
): Promise<void> => {
  const {
    totalCorrectWords,
    connectedChainWords,
    lastCorrectMessageId,
    longestWord,
    longestWordAuthor,
  } = data;

  const pinnedMessage = await findThePinnedMessage(message);

  if (!pinnedMessage) {
    return;
  }

  const embed = pinnedMessage.embeds[0];

  if (!embed) {
    return;
  }

  const title = embed.title?.toLowerCase();

  const totalWordsField = embed.fields.find(
    (f) => f.name === fieldNameForTotalWords,
  );

  const connectedWordsField = embed.fields.find(
    (f) => f.name === fieldNameForConnectedWords,
  );

  const lastCorrectMessageIdField = embed.fields.find(
    (f) => f.name === fieldNameForLastCorrectMessageId,
  );

  const longestWordField = embed.fields.find(
    (f) => f.name === fieldNameForLongestWord,
  );

  const longestWordAuthorField = embed.fields.find(
    (f) => f.name === fieldNameForLongestWordAuthor,
  );

  if (
    title?.includes("unlimited") &&
    totalWordsField &&
    connectedWordsField &&
    lastCorrectMessageIdField &&
    longestWordField &&
    longestWordAuthorField
  ) {
    const totalCorrectWordsFieldIndex = embed.fields.findIndex(
      (f) => f.name === fieldNameForTotalWords,
    );

    const connectedWordsFieldIndex = embed.fields.findIndex(
      (f) => f.name === fieldNameForConnectedWords,
    );

    const lastCorrectMessageIdFieldIndex = embed.fields.findIndex(
      (f) => f.name === fieldNameForLastCorrectMessageId,
    );

    const longestWordFieldIndex = embed.fields.findIndex(
      (f) => f.name === fieldNameForLongestWord,
    );

    const longestWordAuthorFieldIndex = embed.fields.findIndex(
      (f) => f.name === fieldNameForLongestWordAuthor,
    );

    embed.fields[totalCorrectWordsFieldIndex] = {
      name: totalWordsField.name,
      value: `${totalCorrectWords}`,
      inline: true,
    };

    embed.fields[connectedWordsFieldIndex] = {
      name: connectedWordsField.name,
      value: `${connectedChainWords}`,
      inline: true,
    };

    embed.fields[lastCorrectMessageIdFieldIndex] = {
      name: lastCorrectMessageIdField.name,
      value: `${lastCorrectMessageId}`,
      inline: true,
    };

    embed.fields[longestWordFieldIndex] = {
      name: longestWordField.name,
      value: `${longestWord}`,
      inline: true,
    };

    embed.fields[longestWordAuthorFieldIndex] = {
      name: longestWordAuthorField.name,
      value: `${longestWordAuthor}`,
      inline: true,
    };

    pinnedMessage.edit({ embeds: [embed] }).catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
    });
  }
};

export const startUnlimitedMode = async (message: Message) => {
  const canStart = message.member?.permissions.has("MANAGE_GUILD");

  if (!canStart) {
    message.reply(
      "> Only server managers can start an unlimited word chain in channels.",
    );

    return;
  }

  const channelId = message.channel.id;

  if (activeWordChains[channelId]) {
    message.reply("> Unlimited word chain is already running here.");

    return;
  }

  activeWordChains[channelId] = {
    totalCorrectWords: 0,
    connectedChainWords: 0,
    lastCorrectMessageId: "",
    longestWord: "",
    longestWordAuthor: null,
  };

  const stopUnlimitedAction = actions.find((a) =>
    a.commands.includes("stop unlimited"),
  )!;

  const embed = new MessageEmbed()
    .setColor(flatColors.green)
    .setTitle(`Unlimited Word-Chain Mode Started For This Channel!`)
    .setDescription(
      // eslint-disable-next-line max-len
      `Send the first word! Others should continue sending words starting with the last letter of the previous word.` +
        // eslint-disable-next-line max-len
        `\n\nSend \`${prefixes[0]}${stopUnlimitedAction.commands[0]}\` to stop unlimited mode.`,
    )
    .setFooter("[keep this message pinned to persist]")
    .addField(fieldNameForTotalWords, "0", true)
    .addField(fieldNameForConnectedWords, "0", true)
    .addField(fieldNameForLastCorrectMessageId, "N/A", true)
    .addField(fieldNameForLongestWord, "N/A", true)
    .addField(fieldNameForLongestWordAuthor, "N/A", true);

  const sentMessage = await message.channel
    .send({ embeds: [embed] })
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
    });

  if (!sentMessage) {
    return;
  }

  sentMessage.pin().catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
  });
};

export const stopUnlimitedMode = async (message: Message) => {
  const canStop = message.member?.permissions.has("MANAGE_GUILD");

  if (!canStop) {
    message.reply(
      "> Only server managers can stop an unlimited word chain in channels.",
    );

    return;
  }

  if (activeWordChains[message.channel.id]) {
    activeWordChains[message.channel.id] = undefined;

    const pinnedMessage = await findThePinnedMessage(message);

    if (pinnedMessage) {
      pinnedMessage.unpin().catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });
    }

    message.reply("**Stopped the unlimited word chain.**").catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
    });
  }
};

export const handleMessageForUnlimitedMode = async (message: Message) => {
  if (
    message.author.bot ||
    message.channel.type !== "GUILD_TEXT" ||
    /[^a-z\-]/gi.test(message.content) ||
    message.reference ||
    message.mentions.everyone ||
    message.mentions.users.size > 0
  ) {
    return;
  }

  const content = message.content.toLowerCase();

  for (const prefix of prefixes) {
    if (content.startsWith(prefix)) {
      return;
    }
  }

  const channelId = message.channel.id;

  if (!activeWordChains[channelId]) {
    const data = await getDataFromThePinnedMessage(message);

    if (!data) {
      return;
    }

    activeWordChains[channelId] = data;
  }

  const word = message.content.toLowerCase().split(" ").slice(-1)[0];

  const { lastCorrectMessageId, lastCorrectMessageAuthorId } =
    activeWordChains[channelId]!;

  let isFirstWord = false;

  if (!/^\d+$/gi.test(lastCorrectMessageId)) {
    isFirstWord = true;
  }

  if (!isFirstWord) {
    if (lastCorrectMessageAuthorId === message.author.id) {
      message
        .reply({
          embeds: [
            new MessageEmbed()
              .setColor(flatColors.red)
              .setTitle("One by One Rule")
              .setDescription(
                stripIndents`Wait for another player to send a correct word. 
          After that, you can send another word.`,
              )
              .setFooter("Wait for your turn please."),
          ],
          content: `please check:`,
        })
        .then((repliedMessage) => {
          const tid = setTimeout(() => {
            repliedMessage.delete().catch((e) => {
              logger.error;
            });

            clearTimeout(tid);
          }, 15000);
        })
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.error(e);
        });

      return;
    }

    if (activeWordChains[channelId]!.usedWords?.includes(word.toLowerCase())) {
      message
        .reply({
          embeds: [
            new MessageEmbed()
              .setColor(flatColors.red)
              .setTitle("Not that word again!")
              .setDescription(`This **"${word}"** word has been used before.`)
              .setFooter("Kindly send a new word."),
          ],
          content: `please...`,
        })
        .then((repliedMessage) => {
          const tid = setTimeout(() => {
            repliedMessage.delete().catch((e) => {
              logger.error;
            });

            clearTimeout(tid);
          }, 15000);
        })
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.error(e);
        });

      return;
    }
  }

  const reasonsOfRejection = <const>["spell", "first_letter"];

  let reason: typeof reasonsOfRejection[number] = "spell";

  let lastLetter = "";

  let correct = await checkSpell(word);

  if (!isFirstWord && correct) {
    const lastCorrectMessage = await message.channel.messages
      .fetch(lastCorrectMessageId)
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
        return undefined;
      });

    if (lastCorrectMessage) {
      lastLetter = lastCorrectMessage.content
        .toLowerCase()
        .split(" ")
        .slice(-1)[0]
        .split("")
        .slice(-1)[0];

      if (!word.startsWith(lastLetter)) {
        correct = false;
        reason = "first_letter";
      }
    }
  }

  if (correct) {
    activeWordChains[channelId] = {
      ...activeWordChains[channelId]!,
      totalCorrectWords: activeWordChains[channelId]!.totalCorrectWords + 1,
      connectedChainWords: activeWordChains[channelId]!.connectedChainWords + 1,
      lastCorrectMessageId: message.id,
      lastCorrectMessageAuthorId: message.author.id,
      usedWords: [
        ...(activeWordChains[channelId]!.usedWords || []),
        word.toLowerCase(),
      ],
    };

    const previousLongestWord = activeWordChains[channelId]!.longestWord;

    if (word.length >= previousLongestWord.length) {
      activeWordChains[channelId] = {
        ...activeWordChains[channelId]!,
        longestWord: word,
        longestWordAuthor: message.author,
      };
    }

    const connectedWordCountEmojis: typeof numberEmojis = activeWordChains[
      channelId
    ]!.connectedChainWords.toString()
      .split("")
      .map(
        (numberAsString) =>
          numberEmojis.find((ne) => ne.string === numberAsString)!,
      );

    await message.react("✅").catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
    });

    const usedEmojis: string[] = [];

    for (const ne of connectedWordCountEmojis) {
      for (const emoji of ne.emojis) {
        if (!usedEmojis.includes(emoji)) {
          await message.react(emoji).catch((e) => {
            // eslint-disable-next-line no-console
            console.error(e);
          });

          usedEmojis.push(emoji);

          break;
        }
      }
    }

    setDataInThePinnedMessage(message, activeWordChains[channelId]!);
  } else {
    activeWordChains[channelId] = {
      ...activeWordChains[channelId]!,
      connectedChainWords: 0,
    };

    message.react("❌").catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
    });

    let reasonText =
      // eslint-disable-next-line max-len
      `**"${word}"** is either a wrong spelling or unrecognized by Hunspell & Wikitionary`;

    if (reason === "first_letter") {
      // eslint-disable-next-line max-len
      reasonText = `**"${word}"** doesn't start with **'${lastLetter.toUpperCase()}'** which is the last letter of the previous correct word.`;
    }

    message
      .reply({
        embeds: [
          new MessageEmbed()
            .setColor(flatColors.red)
            .setTitle("Incorrect Word!")
            .setDescription(reasonText),
        ],
        content: `please check:`,
      })
      .then((repliedMessage) => {
        const tid = setTimeout(() => {
          repliedMessage.delete().catch((e) => {
            logger.error;
          });

          clearTimeout(tid);
        }, 15000);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });

    setDataInThePinnedMessage(message, activeWordChains[channelId]!);
  }
};
