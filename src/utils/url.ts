/** Validate correctness of a URL */
export const validateUrl = (url: string) => {
  try {
    new URL(url);
  } catch (err) {
    (err as Error).message += `\nURL: "${url}"`;
    throw err;
  }
};

/** Transform relative URL paths to absolute URLs */
export const resolveUrlPath = (urlBase: string, urlPath: string) => {
  const url = new URL(urlBase);
  url.pathname = urlPath;
  return url.href;
};
