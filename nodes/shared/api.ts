import type {
  IDataObject,
  IExecuteSingleFunctions,
  IHookFunctions,
  IHttpRequestMethods,
  IHttpRequestOptions,
  ILoadOptionsFunctions,
  INodePropertyOptions,
} from "n8n-workflow";

import type { Channel, Reader } from "./parse";
import { readChannels, textIn } from "./parse";

export const credentialName = "pealApi";

/** Peal Cloud's address, which a self-hosted server replaces in the credential. */
export const defaultServer = "https://app.peal.social";

type ApiFunctions =
  | IExecuteSingleFunctions
  | IHookFunctions
  | ILoadOptionsFunctions;

/** The API's root for a server address, with any trailing slash removed. */
export const apiRoot = (server: string): string => {
  const address = server.trim().length > 0 ? server.trim() : defaultServer;

  return `${address.replace(/\/+$/u, "")}/api/v1`;
};

/** One request to Peal's API, relative to its root. */
export interface PealCall {
  readonly body?: IDataObject;
  readonly method: IHttpRequestMethods;
  readonly path: string;
}

/** Sends a request with the node's credential, and reads its answer with `read`. */
export const pealRequest = async <Answer>(
  functions: ApiFunctions,
  call: PealCall,
  read: Reader<Answer>
): Promise<Answer> => {
  const credentials = await functions.getCredentials(credentialName);

  const options: IHttpRequestOptions = {
    headers: { Accept: "application/json" },
    json: true,
    method: call.method,
    url: `${apiRoot(textIn(credentials, "server") ?? defaultServer)}${call.path}`,
  };

  if (call.body !== undefined) {
    options.body = call.body;
  }

  const answer: unknown =
    await functions.helpers.httpRequestWithAuthentication.call(
      functions,
      credentialName,
      options
    );

  return read(answer);
};

const platformNames = new Map<string, string>([
  ["bluesky", "Bluesky"],
  ["devto", "DEV"],
  ["discord", "Discord"],
  ["facebook", "Facebook"],
  ["googleBusiness", "Google Business Profile"],
  ["hashnode", "Hashnode"],
  ["instagram", "Instagram"],
  ["linkedin", "LinkedIn"],
  ["mastodon", "Mastodon"],
  ["pinterest", "Pinterest"],
  ["slack", "Slack"],
  ["telegram", "Telegram"],
  ["threads", "Threads"],
  ["tiktok", "TikTok"],
  ["wordpress", "WordPress"],
  ["wordpressCom", "WordPress.com"],
  ["x", "X"],
  ["youtube", "YouTube"],
]);

/** How a platform is called on screen. */
export const platformName = (platform: string): string =>
  platformNames.get(platform) ?? platform;

const statusNames: Readonly<Record<Channel["status"], string>> = {
  active: "Connected",
  disabled: "Disabled",
  refreshNeeded: "Needs reconnecting",
};

/** Channels as the options of a picker: name, platform and status. */
export const channelOptions = (
  channels: readonly Channel[]
): INodePropertyOptions[] =>
  channels
    .map((channel) => {
      const platform = platformName(channel.platform);

      return {
        description: `${platform}, @${channel.handle}. ${statusNames[channel.status]}.`,
        name: `${channel.name} (${platform})`,
        value: channel.id,
      };
    })
    .toSorted((left, right) => left.name.localeCompare(right.name));

/** Loads the workspace's channels for a channel picker. */
export const getChannels = async function getChannels(
  this: ILoadOptionsFunctions
): Promise<INodePropertyOptions[]> {
  const channels = await pealRequest(
    this,
    { method: "GET", path: "/channels" },
    readChannels
  );

  return channelOptions(channels);
};
