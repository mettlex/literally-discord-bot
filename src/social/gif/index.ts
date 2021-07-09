/* eslint-disable indent */
import { Message, Client, MessageEmbed } from "discord.js";
import { ButtonStyle, ComponentType, SlashCreator } from "slash-create";
import { Action } from "../../games/types";
import { setupGame } from "../../games/setup";
import { flatColors, prefixes } from "../../config";
import { getLogger } from "../../app";
import { searchGifOnTenor } from "../../utils/search-tenor";
import { oneLine } from "common-tags";
import { EventEmitter } from "events";
import { ExtendedTextChannel } from "../../extension";

const logger = getLogger();

const eventEmitters: { [channelId: string]: EventEmitter | undefined } = {};

const hugTypesForButtons = [
  {
    label: "Bro Hug",
    custom_id: "send_bro_hug",
  },
  {
    label: "Sis Hug",
    custom_id: "send_sis_hug",
  },
  {
    label: "Friendly Hug",
    custom_id: "send_friendly_hug",
  },
  {
    label: "Romantic Hug",
    custom_id: "send_romantic_hug",
  },
] as const;

const actions: Action[] = [
  {
    commands: ["gif", "interact", "give"],
    handler: async (message, commands, messageContentWithoutPrefix) => {
      if (message.channel.type !== "text") {
        return;
      }

      let content = messageContentWithoutPrefix.toLowerCase();

      for (const command of commands) {
        if (content.startsWith(command.toLowerCase())) {
          content = content.replace(command.toLowerCase(), "");
          break;
        }
      }

      const searchTerm = content
        .replace(/<&?#?@?!?\d+>/gi, "")
        .toLowerCase()
        .trim();

      performInteraction({ message, searchTerm, specificText: searchTerm });
    },
  },
  {
    commands: ["hug"],
    handler: async (message, commands, messageContentWithoutPrefix) => {
      if (message.channel.type !== "text") {
        return;
      }

      let content = messageContentWithoutPrefix.toLowerCase();

      for (const command of commands) {
        if (content.startsWith(command.toLowerCase())) {
          content = content.replace(command.toLowerCase(), "");
          break;
        }
      }

      let hugType: HugType | null = null;

      if (content.includes("bro")) {
        hugType = "bro hug";
      } else if (content.includes("sis")) {
        hugType = "girl hug sis";
      } else if (content.includes("friend") || content.includes("fren")) {
        hugType = "hug friend";
      } else if (content.includes("love") || content.includes("roman")) {
        hugType = "romantic hug";
      }

      if (!hugType) {
        const channel = message.channel as ExtendedTextChannel;

        const chooseTypeMessage = await channel.sendWithComponents({
          content: "Select the type of hug:",
          components: [
            {
              components: hugTypesForButtons.map((hug) => ({
                ...hug,
                type: ComponentType.BUTTON,
                style: ButtonStyle.PRIMARY,
              })),
            },
          ],
        });

        hugType = await new Promise((resolve) => {
          let emitter = eventEmitters[message.channel.id];

          if (!emitter) {
            emitter = eventEmitters[message.channel.id] = new EventEmitter();
          }

          emitter.once(
            `received_hug_type_${message.author.id}`,
            (data: HugType) => {
              emitter?.removeAllListeners();
              resolve(data);
            },
          );
        });

        (chooseTypeMessage as Message).delete();
      }

      if (!hugType) {
        return;
      }

      performInteraction({
        message,
        searchTerm: hugType,
        specificText:
          hugType === "bro hug"
            ? "a bro hug"
            : hugType === "girl hug sis"
            ? "a sis hug"
            : hugType === "romantic hug"
            ? "a romantic hug"
            : "a friendly hug",
      });
    },
  },
];

export const performInteraction = async ({
  message,
  searchTerm,
  specificText,
}: {
  message: Message;
  searchTerm: string;
  specificText: string;
}) => {
  try {
    const mentions = message.mentions.users.map((u) => u).slice(0, 5);

    const response = await searchGifOnTenor(searchTerm);

    if (!response || !response.results || response.results.length < 1) {
      return;
    }

    const randomIndex: number = Math.floor(
      Math.random() * response.results.length,
    );

    const url: string = response.results[randomIndex].media[0].gif.url;

    const embed = new MessageEmbed().setColor(flatColors.blue).setImage(url)
      .setDescription(oneLine`
      ${message.author} gives${
      (mentions.length > 0 &&
        `${mentions.map((u) => ` <@${u.id}>`).join(",")}`) ||
      ""
    } ${specificText}.
    `);

    message.channel.send(embed);
  } catch (error) {
    logger.error(error);
  }
};

export const setupGif = (client: Client, creator: SlashCreator) => {
  creator.on("componentInteraction", (ctx) => {
    if (hugTypesForButtons.find((hug) => hug.custom_id === ctx.customID)) {
      const customID =
        ctx.customID as typeof hugTypesForButtons[number]["custom_id"];

      let emitter = eventEmitters[ctx.channelID];

      if (!emitter) {
        emitter = eventEmitters[ctx.channelID] = new EventEmitter();
      }

      const hugType: HugType =
        customID === "send_bro_hug"
          ? "bro hug"
          : customID === "send_sis_hug"
          ? "girl hug sis"
          : customID === "send_romantic_hug"
          ? "romantic hug"
          : "hug friend";

      emitter.emit(`received_hug_type_${ctx.user.id}`, hugType);

      ctx.acknowledge();

      return;
    }
  });

  setupGame(client, prefixes, actions);
};

export type HugType =
  | "bro hug"
  | "girl hug sis"
  | "hug friend"
  | "romantic hug";
