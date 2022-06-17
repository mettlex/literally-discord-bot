import { ColorResolvable } from "discord.js";
import checkEnv from "./utils/check-env";

checkEnv();

export const earlyAccessMode = () => process.env.EARLY_ACCESS === "true";

export const prefixes = ["ly.", "ly/"].map((p) =>
  earlyAccessMode() ? `_${p}` : p,
);

export const flatColors: {
  [key: string]: ColorResolvable;
} = {
  red: "#f62459",
  green: "#00b16a",
  blue: "#19b5fe",
  yellow: "#fef160",
};
