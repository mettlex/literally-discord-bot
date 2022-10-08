/* eslint-disable indent */
import got from "got";
import { DatamuseResult, IntentParam, IntentParams } from "./types";

const getValue = (param: IntentParam | undefined) =>
  (param instanceof Array && (param[0] as string)) ||
  (param?.listValue &&
    (param.listValue.values[0]?.stringValue ||
      param.listValue.values[0]?.numberValue)) ||
  param?.stringValue ||
  param?.numberValue;

const buildUrl = (params: IntentParams): string => {
  let endpoint = "words";

  const searchParams = new URLSearchParams();

  const mlslsp = getValue(params.Meaning)
    ? "ml"
    : getValue(params.SoundLike)
    ? "sl"
    : getValue(params.SpelledLike) &&
      !getValue(params.StartLetter) &&
      !getValue(params.EndLetter)
    ? "sp"
    : undefined;

  if (mlslsp) {
    searchParams.append(mlslsp, getValue(params.Word) as string);
  }

  const sug = !mlslsp && getValue(params.Suggestion);

  if (sug) {
    endpoint = "sug";
  }

  const rhymeWith = getValue(params.RhymeWith);

  if (rhymeWith && getValue(params.Word)) {
    searchParams.append("rel_rhy", `${getValue(params.Word)}`);
  }

  const startWithOnly =
    !getValue(params.EndLetter) && getValue(params.StartLetter);

  if (startWithOnly) {
    searchParams.set("sp", `${startWithOnly}*`);
  }

  const endWithOnly =
    !getValue(params.StartLetter) && getValue(params.EndLetter);

  if (endWithOnly) {
    searchParams.set("sp", `*${endWithOnly}`);
  }

  const startAndEndWithNumbers =
    getValue(params.StartLetter) &&
    getValue(params.EndLetter) &&
    getValue(params.number);

  if (startAndEndWithNumbers) {
    searchParams.set(
      "sp",
      `${getValue(params.StartLetter)}${new Array(getValue(params.number))
        .fill("0")
        .map((_) => "?")
        .join("")}${getValue(params.EndLetter)}`,
    );
  }

  const startAndEndWithNoNumbers =
    getValue(params.StartLetter) &&
    getValue(params.EndLetter) &&
    !getValue(params.number);

  if (startAndEndWithNoNumbers) {
    searchParams.set(
      "sp",
      `${getValue(params.StartLetter)}*${getValue(params.EndLetter)}`,
    );
  }

  const adjectiveToDescribe = getValue(params.AdjectiveToDescribe);

  if (adjectiveToDescribe && getValue(params.Word)) {
    searchParams.append("rel_jjb", getValue(params.Word) as string);
  }

  const nounToDescribe = getValue(params.NounToDescribe);

  if (nounToDescribe && getValue(params.Word)) {
    searchParams.append("rel_jja", getValue(params.Word) as string);
  }

  const askingTopic = getValue(params.AskingTopic);

  if (askingTopic && getValue(params.Topic)) {
    searchParams.set("topics", getValue(params.Topic) as string);
  } else if (askingTopic && !getValue(params.Topic) && getValue(params.Word)) {
    searchParams.set("topics", getValue(params.Word) as string);
  }

  if (
    !searchParams.has("topics") &&
    !searchParams.has("ml") &&
    !searchParams.has("sl") &&
    !searchParams.has("rel_rhy") &&
    (getValue(params.Topic) || getValue(params.Word))
  ) {
    const topic = getValue(params.Topic);
    const word = getValue(params.Word);

    if (topic) {
      searchParams.append("topics", topic as string);
    }

    if (word) {
      searchParams.append("ml", word as string);
    }
  }

  const sp = searchParams.get("sp");

  if (typeof sp === "string" && !sp.includes("*") && !sp.includes("?")) {
    searchParams.delete("ml");
  }

  if (
    getValue(params.StartLetter) &&
    !getValue(params.EndLetter) &&
    (getValue(params.number) as string)
  ) {
    const startLetter = getValue(params.StartLetter);
    const count = getValue(params.number) as string;

    searchParams.set(
      "sp",
      `${startLetter}${new Array(count)
        .fill("0")
        .map((_) => "?")
        .join("")}`,
    );
  } else if (
    getValue(params.EndLetter) &&
    !getValue(params.StartLetter) &&
    (getValue(params.number) as string)
  ) {
    const endLetter = getValue(params.EndLetter);
    const count = getValue(params.number) as string;

    searchParams.set(
      "sp",
      `${new Array(count)
        .fill("0")
        .map((_) => "?")
        .join("")}${endLetter}`,
    );
  }

  const url = `https://api.datamuse.com/${endpoint}?${searchParams.toString()}&max=50`;

  return url;
};

export const fetchDatamuseResult = async (params: IntentParams) => {
  const url = buildUrl(params);
  const result = JSON.parse((await got(url)).body);
  return result as DatamuseResult[] | undefined;
};
