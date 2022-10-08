const intentParams = {
  StartLetter: {
    stringValue: "starts with",
    kind: "stringValue",
  },
  EndLetter: {
    stringValue: "ends with",
    kind: "stringValue",
  },
  Word: {
    listValue: {
      values: [
        {
          stringValue: "",
          kind: "stringValue",
        },
      ],
    },
    kind: "listValue",
    stringValue: "",
  },
  Meaning: {
    stringValue: "means like",
    kind: "stringValue",
  },
  SoundLike: {
    stringValue: "sounds like",
    kind: "stringValue",
  },
  SpelledLike: {
    stringValue: "spelled like",
    kind: "stringValue",
  },
  RhymeWith: {
    listValue: {
      values: [
        {
          stringValue: "",
          kind: "stringValue",
        },
      ],
    },
    kind: "listValue",
    stringValue: "",
  },
  AdjectiveToDescribe: {
    listValue: {
      values: [
        {
          stringValue: "",
          kind: "stringValue",
        },
      ],
    },
    kind: "listValue",
    stringValue: "",
  },
  NounToDescribe: {
    listValue: {
      values: [
        {
          stringValue: "",
          kind: "stringValue",
        },
      ],
    },
    kind: "listValue",
    stringValue: "",
  },
  AskingTopic: {
    listValue: {
      values: [
        {
          stringValue: "",
          kind: "stringValue",
        },
      ],
    },
    kind: "listValue",
    stringValue: "",
  },
  Topic: {
    listValue: {
      values: [
        {
          stringValue: "",
          kind: "stringValue",
        },
      ],
    },
    kind: "listValue",
    stringValue: "",
  },
  Suggestion: {
    stringValue: "suggest me",
    kind: "stringValue",
  },
  number: {
    numberValue: 3,
  },
};

export type IntentParamValue = {
  stringValue?: string;
  kind?: string;
  numberValue?: number;
};

export interface IntentParam extends IntentParamValue {
  listValue?: {
    values: IntentParamValue[];
  };
}

export type IntentParams = Partial<typeof intentParams>;

export type DatamuseResult = {
  word: string;
  score: number;
  tags?: string[];
};
