let clearCache = () => {};

export const registerApiCacheClearer = (clearer) => {
  clearCache = clearer;
};

export const clearApiResponseCache = () => {
  clearCache();
};
