import { Message } from "discord.js";
import pino from "pino";
import { checkSpell } from "../spell-checker";

const logger = pino({ prettyPrint: process.env.NODE_ENV !== "production" });

const testSpell = (
  message: Message,
  commands: string[],
  messageContentWithoutPrefix: string,
) => {
  for (const command of commands) {
    if (messageContentWithoutPrefix.startsWith(command)) {
      const words = messageContentWithoutPrefix
        .toLowerCase()
        .replace(command, "")
        .split(" ");

      const lastWord = words[words.length - 1];

      if (lastWord) {
        const correct = checkSpell(lastWord);

        logger.info({ lastWord, correct });

        if (correct) {
          message.react("✅").catch((e) => {
            logger.error(e);
          });
        } else {
          message.react("❌").catch((e) => {
            logger.error(e);
          });
        }
      }

      break;
    }
  }
};

export default testSpell;
