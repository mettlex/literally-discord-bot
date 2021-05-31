import { Message } from "discord.js";

export interface Action {
  commands: string[];
  handler: (
    message: Message,
    commands: Action["commands"],
    messageContentWithoutPrefix: string,
  ) => void;
  [key: string]: any;
}
