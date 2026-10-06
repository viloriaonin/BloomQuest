const MAX_CACHED_RESPONSES = 150;

export const createCachedApiFetch = (fetchImpl, apiBaseUrl) => {
  const responseCache = new Map();
  const inFlightRequests = new Map();
  let cacheGeneration = 0;
  let lastAuthorization = null;

  const clearCache = () => {
    cacheGeneration += 1;
    responseCache.clear();
    inFlightRequests.clear();
  };

  const isApiRequest = (requestUrl) => {
    const apiUrl = new URL(apiBaseUrl);
    const parsedRequestUrl = new URL(requestUrl, apiUrl);
    const apiPath = apiUrl.pathname.replace(/\/$/, "");
    return parsedRequestUrl.origin === apiUrl.origin &&
      (parsedRequestUrl.pathname === apiPath ||
        parsedRequestUrl.pathname.startsWith(`${apiPath}/`));
  };

  const cachedFetch = async (input, init = {}) => {
    const requestUrl = typeof input === "string" ? input : input.url;
    const method = String(init.method || input.method || "GET").toUpperCase();
    const headers = new Headers(init.headers || (typeof input !== "string" ? input.headers : undefined));
    const authorization = headers.get("authorization") || "";
    const requestCacheControl = headers.get("cache-control")?.toLowerCase() || "";
    const requestCacheMode = init.cache || (typeof input !== "string" ? input.cache : "default");
    if (lastAuthorization !== null && authorization !== lastAuthorization) clearCache();
    lastAuthorization = authorization;
    const shouldCache = method === "GET" &&
      isApiRequest(requestUrl) &&
      requestCacheMode === "default" &&
      !requestCacheControl.includes("no-cache") &&
      !requestCacheControl.includes("no-store") &&
      !requestCacheControl.includes("max-age=0") &&
      !init.signal &&
      (typeof input === "string" || !input.signal);

    if (!shouldCache) {
      const response = await fetchImpl(input, init);
      if (method !== "GET" && isApiRequest(requestUrl) && response.ok) clearCache();
      return response;
    }

    const parsedRequestUrl = new URL(requestUrl, apiBaseUrl);
    const cacheKey = [
      parsedRequestUrl.href,
      authorization,
      headers.get("accept") || "",
      init.credentials || (typeof input !== "string" ? input.credentials : ""),
    ].join("::");

    const cachedResponse = responseCache.get(cacheKey);
    if (cachedResponse) {
      responseCache.delete(cacheKey);
      responseCache.set(cacheKey, cachedResponse);
      return cachedResponse.clone();
    }

    const existingRequest = inFlightRequests.get(cacheKey);
    if (existingRequest) return (await existingRequest).clone();

    const requestGeneration = cacheGeneration;
    let networkRequest;
    networkRequest = fetchImpl(input, init)
      .then((response) => {
        const isJson = response.headers.get("content-type")?.toLowerCase().includes("application/json");
        const responseCacheControl = response.headers.get("cache-control")?.toLowerCase() || "";
        const mustNotCache = responseCacheControl.includes("no-store") ||
          responseCacheControl.includes("no-cache") ||
          responseCacheControl.includes("max-age=0");
        if (response.ok && isJson && !mustNotCache && requestGeneration === cacheGeneration) {
          responseCache.set(cacheKey, response.clone());
          if (responseCache.size > MAX_CACHED_RESPONSES) {
            responseCache.delete(responseCache.keys().next().value);
          }
        }
        return response;
      })
      .finally(() => {
        if (inFlightRequests.get(cacheKey) === networkRequest) inFlightRequests.delete(cacheKey);
      });
    inFlightRequests.set(cacheKey, networkRequest);
    return (await networkRequest).clone();
  };

  cachedFetch.clearCache = clearCache;
  return cachedFetch;
};
