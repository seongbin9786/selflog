export const parseOrDefault = (x: string, defaultValue: number) => {
  const parsed = Number.parseInt(x, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};
