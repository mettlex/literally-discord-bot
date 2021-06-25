import { Client } from "discord.js";
import { ButtonStyle, ComponentType } from "slash-create";
import { prefixes as lyPrefixes } from "./config";
import { ExtendedDMChannel, ExtendedTextChannel } from "./extension";
import { hasVoted } from "./top.gg/api";

export const setupVote = (client: Client) => {
  client.on("message", async (message) => {
    if (
      message.author.bot ||
      !lyPrefixes.find((p) => message.content.toLowerCase().startsWith(p)) ||
      !message.content.toLowerCase().trim().endsWith("vote")
    ) {
      return;
    }

    const result = await hasVoted(message.author.id);

    if (result === null) {
      message.reply(
        "Sorry, Top.gg API has failed to check your voting status.",
      );

      return;
    }

    const channel = message.channel as ExtendedTextChannel | ExtendedDMChannel;

    let content = "";

    if (result === true) {
      content = "Thanks! You have voted within last 12 hours.";
    } else {
      content =
        "Please vote every 12 hours to get special abilities Literally!";
    }

    channel
      .sendWithComponents({
        content,
        components: [
          {
            components: [
              {
                label: "Vote for Literally",
                type: ComponentType.BUTTON,
                // @ts-ignore
                style: ButtonStyle.LINK,
                url: "https://top.gg/bot/842397311916310539/vote",
              },
            ],
          },
        ],
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
      });
  });
};
