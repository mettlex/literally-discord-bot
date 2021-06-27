import { earlyAccessMode } from "../../config";

export const prefixes = ["jotto.", "jotto/", "jt.", "jt/"].map((p) =>
  earlyAccessMode() ? `_${p}` : p,
);

export const timeToJoinInSeconds = 60;

export const attemptsLeft = 50;

export const turnSeconds = 60;
