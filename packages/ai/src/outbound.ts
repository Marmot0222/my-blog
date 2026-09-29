import { lookup } from "node:dns/promises";
import { Agent } from "undici";
import ipaddr from "ipaddr.js";

export class OutboundRejected extends Error {
  constructor() {
    super("Provider destination is not approved");
  }
}
export function assertPublicAddress(address: string) {
  try {
    const parsed = ipaddr.process(address);
    if (parsed.range() !== "unicast") throw new OutboundRejected();
  } catch {
    throw new OutboundRejected();
  }
}
export function approvedProviderUrl(value: string, env: NodeJS.ProcessEnv = process.env): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new OutboundRejected();
  }
  const allowed = new Set(
    (env.AI_ALLOWED_HOSTS ?? "api.openai.com,generativelanguage.googleapis.com")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    url.hash ||
    url.search ||
    !allowed.has(url.hostname.toLowerCase())
  )
    throw new OutboundRejected();
  if (ipaddr.isValid(url.hostname.replace(/^\[|\]$/g, "")))
    assertPublicAddress(url.hostname.replace(/^\[|\]$/g, ""));
  return url;
}
export function createGuardedFetch(
  baseURL: string,
  env: NodeJS.ProcessEnv = process.env,
): typeof fetch {
  const approved = approvedProviderUrl(baseURL, env);
  const agent = new Agent({
    connect: {
      lookup(hostname, options, callback) {
        // Resolve inside the connector; validate the exact addresses used for the
        // socket, preventing a separate validation/connection DNS rebinding window.
        lookup(hostname, { all: true, verbatim: true })
          .then((addresses) => {
            if (!addresses.length) throw new OutboundRejected();
            addresses.forEach((item) => assertPublicAddress(item.address));
            const chosen =
              addresses.find((item) => !options.family || item.family === options.family) ??
              addresses[0];
            if (options.all) callback(null, addresses);
            else callback(null, chosen.address, chosen.family);
          })
          .catch(() => callback(new OutboundRejected(), "", 4));
      },
    },
  });
  return async (input, init) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    if (url.origin !== approved.origin || url.username || url.password)
      throw new OutboundRejected();
    const guarded: RequestInit & { dispatcher: Agent } = {
      ...init,
      redirect: "error",
      dispatcher: agent,
      signal: init?.signal ?? AbortSignal.timeout(60_000),
    };
    return fetch(input, guarded);
  };
}
