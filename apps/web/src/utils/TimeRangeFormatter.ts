// format: [hh:mm -> hh:mm] (+|-) text
const TIME_RANGE_AND_TEXT_REGEXP = new RegExp(
  /\[((?:[0-9|:])+) -> ((?:[0-9|:])+)\] ([+|-]) (.+)/,
);

// format: [hh:mm] (+|-) text
const TIME_AND_TEXT_REGEXP = new RegExp(/\[((?:[0-9|:])+)\] (.+)/);

const extractUsingRegExp = (regExp: RegExp) => (str: string) => {
  const extracted = regExp.exec(str);

  if (!extracted) {
    throw new Error(`extractUsingRegExp - bad format: ${str}`);
  }
  return extracted;
};

export const extractTimeRangeAndText = extractUsingRegExp(
  TIME_RANGE_AND_TEXT_REGEXP,
);

export const extractTimeAndText = extractUsingRegExp(TIME_AND_TEXT_REGEXP);
