import { earlyAccessMode } from "../../config";

export const prefixes = ["coup.", "coup/", "koup.", "koup/"].map((p) =>
  earlyAccessMode() ? `_${p}` : p,
);

export const timeToJoinInSeconds = 60;

export const moveWaitSeconds = 30;

export const turnSeconds = 60;
