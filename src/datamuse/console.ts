/* eslint-disable no-console */
import { fetchDatamuseResult } from "./api";

const main = async () => {
  const response = await fetchDatamuseResult({
    StartLetter: {
      kind: "stringValue",
      stringValue: "B",
    },
    number: {
      numberValue: 4,
    },
  });

  console.log(response);
};

main();
