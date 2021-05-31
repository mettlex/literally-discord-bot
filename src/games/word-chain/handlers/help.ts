import { DMChannel, Message, TextChannel } from "discord.js";
import { sendHelpMessage } from "../../../help";

const help = (message: Message) => {
  if (message.channel.type === "text" || message.channel.type === "dm") {
    sendHelpMessage(
      message.author.id,
      message.channel as TextChannel | DMChannel,
      "word_chain",
      message.client,
    );
  }
};

export default help;
