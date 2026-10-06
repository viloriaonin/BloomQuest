import { createCachedApiFetch } from "./apiFetch";

const makeResponse = (value, { ok = true, contentType = "application/json", cacheControl = "" } = {}) => ({
  ok,
  status: ok ? 200 : 500,
  headers: new Headers({
    "Content-Type": contentType,
    ...(cacheControl ? { "Cache-Control": cacheControl } : {}),
  }),
  json: async () => value,
  clone() {
    return makeResponse(value, { ok, contentType, cacheControl });
  },
});

test("reuses successful API GET responses until an API mutation succeeds", async () => {
  const networkFetch = jest.fn()
    .mockResolvedValueOnce(makeResponse({ version: 1 }))
    .mockResolvedValueOnce(makeResponse({ updated: true }))
    .mockResolvedValueOnce(makeResponse({ version: 2 }));
  const cachedFetch = createCachedApiFetch(networkFetch, "http://localhost:8000/api");
  const url = "http://localhost:8000/api/departments";

  expect(await (await cachedFetch(url)).json()).toEqual({ version: 1 });
  expect(await (await cachedFetch(url)).json()).toEqual({ version: 1 });
  expect(networkFetch).toHaveBeenCalledTimes(1);

  await cachedFetch(url, { method: "PUT" });
  expect(await (await cachedFetch(url)).json()).toEqual({ version: 2 });
  expect(networkFetch).toHaveBeenCalledTimes(3);
});

test("deduplicates concurrent API GET requests", async () => {
  let resolveFetch;
  const networkFetch = jest.fn(() => new Promise((resolve) => { resolveFetch = resolve; }));
  const cachedFetch = createCachedApiFetch(networkFetch, "http://localhost:8000/api");
  const url = "http://localhost:8000/api/subjects";

  const firstRequest = cachedFetch(url);
  const secondRequest = cachedFetch(url);
  resolveFetch(makeResponse([{ id: 1 }]));

  expect(await (await firstRequest).json()).toEqual([{ id: 1 }]);
  expect(await (await secondRequest).json()).toEqual([{ id: 1 }]);
  expect(networkFetch).toHaveBeenCalledTimes(1);
});

test("does not cache failed, no-store, or non-API requests", async () => {
  const networkFetch = jest.fn()
    .mockResolvedValueOnce(makeResponse({}, { ok: false }))
    .mockResolvedValueOnce(makeResponse({ version: 1 }))
    .mockResolvedValueOnce(makeResponse({ version: 2 }))
    .mockResolvedValueOnce(makeResponse({ version: 3 }));
  const cachedFetch = createCachedApiFetch(networkFetch, "http://localhost:8000/api");
  const url = "http://localhost:8000/api/profile";

  await cachedFetch(url);
  await cachedFetch(url);
  await cachedFetch(url, { cache: "no-store" });
  await cachedFetch("http://localhost:8000/static/data.json");

  expect(networkFetch).toHaveBeenCalledTimes(4);
});

test("separates cached responses when the authenticated account changes", async () => {
  const networkFetch = jest.fn()
    .mockResolvedValueOnce(makeResponse({ user: "first" }))
    .mockResolvedValueOnce(makeResponse({ user: "second" }));
  const cachedFetch = createCachedApiFetch(networkFetch, "http://localhost:8000/api");
  const url = "http://localhost:8000/api/user/profile";

  expect(await (await cachedFetch(url, { headers: { Authorization: "Bearer first" } })).json())
    .toEqual({ user: "first" });
  expect(await (await cachedFetch(url, { headers: { Authorization: "Bearer second" } })).json())
    .toEqual({ user: "second" });
  expect(networkFetch).toHaveBeenCalledTimes(2);
});
