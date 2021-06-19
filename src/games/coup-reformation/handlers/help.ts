import { Message } from "discord.js";
import { ButtonStyle, ComponentType } from "slash-create";
import { ExtendedTextChannel, ExtendedDMChannel } from "../../../extension";

export const sendCoupHelpMessage = (message: Message) => {
  const channel = message.channel as ExtendedTextChannel | ExtendedDMChannel;

  channel.sendWithComponents({
    content: "Please press on a button below:",
    components: [
      {
        components: [
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.SECONDARY,
            label: "Show Cheat Sheet",
            custom_id: "coup_cs",
          },
          {
            type: ComponentType.BUTTON,
            // @ts-ignore
            style: ButtonStyle.LINK,
            label: "How To Play",
            url: "https://www.youtube.com/watch?v=a8bY3zI9FL4&list=PLDNi2Csm13eaUpcmveWPzVJ3fIlaFrvZn",
          },
        ],
      },
    ],
  });
};
