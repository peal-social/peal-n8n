import type { INodeType, INodeTypeDescription } from "n8n-workflow";
import { NodeConnectionTypes } from "n8n-workflow";

import { credentialName, getChannels } from "../shared/api";
import { channelFields, channelOperations } from "./resources/channel";
import { mediaFields, mediaOperations } from "./resources/media";
import { postFields, postOperations } from "./resources/post";

export class Peal implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Peal",
    credentials: [{ name: credentialName, required: true }],
    defaults: { name: "Peal" },
    description:
      "Publish, schedule and queue social media posts, and upload their media, with Peal",
    group: ["output"],
    icon: {
      dark: "file:../../icons/peal.dark.svg",
      light: "file:../../icons/peal.svg",
    },
    inputs: [NodeConnectionTypes.Main],
    name: "peal",
    outputs: [NodeConnectionTypes.Main],
    properties: [
      {
        displayName: "Resource",
        default: "post",
        name: "resource",
        noDataExpression: true,
        options: [
          { name: "Channel", value: "channel" },
          { name: "Media", value: "media" },
          { name: "Post", value: "post" },
        ],
        type: "options",
      },
      channelOperations,
      ...channelFields,
      mediaOperations,
      ...mediaFields,
      postOperations,
      ...postFields,
    ],
    requestDefaults: {
      baseURL:
        '={{ ($credentials.server || "https://app.peal.social").replace(/\\/+$/, "") + "/api/v1" }}',
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    },
    subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
    usableAsTool: true,
    version: 1,
  };

  methods = { loadOptions: { getChannels } };
}
