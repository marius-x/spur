export const shortSha = (str: string) => {
  const top = str.substr(0, 4);
  const bottom = str.substr(str.length - 4, 4);
  return `${top}...${bottom}`;
}
