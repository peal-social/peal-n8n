import type {
  IDataObject,
  IHookFunctions,
  INodeType,
  INodeTypeDescription,
  IWebhookFunctions,
  IWebhookResponseData,
} from "n8n-workflow";
import { NodeApiError, NodeConnectionTypes } from "n8n-workflow";

import { credentialName, getChannels, pealRequest } from "../shared/api";
import {
  asStrings,
  errorDetailsOf,
  headerIn,
  ignoreAnswer,
  readCreatedEndpoint,
  readEndpoint,
  readHttpStatus,
  readStoredEndpoint,
} from "../shared/parse";
import type { SignedDelivery } from "../shared/signature";
import { verify } from "../shared/signature";
import { eventOptions } from "./events";

// Peal sends each event to a webhook endpoint the trigger creates when the
// workflow is activated, and deletes when it's deactivated. The endpoint's
// secret stays in the node's static data, to verify every delivery.

const notFound = 404;

const sameMembers = (
  left: readonly string[],
  right: readonly string[]
): boolean =>
  left.length === right.length && left.every((entry) => right.includes(entry));

const endpointPath = (id: string): string =>
  `/webhooks/${encodeURIComponent(id)}`;

const deliveryOf = (
  functions: IWebhookFunctions,
  body: Buffer
): SignedDelivery => {
  const headers = functions.getHeaderData();

  return {
    body,
    id: headerIn(headers, "webhook-id"),
    signature: headerIn(headers, "webhook-signature"),
    timestamp: headerIn(headers, "webhook-timestamp"),
  };
};

/** Whether Peal still has the endpoint this node created, for these events. */
const checkExists = async function checkExists(
  this: IHookFunctions
): Promise<boolean> {
  const stored = readStoredEndpoint(this.getWorkflowStaticData("node"));

  if (stored === undefined) {
    return false;
  }

  try {
    const endpoint = await pealRequest(
      this,
      { method: "GET", path: endpointPath(stored.id) },
      readEndpoint
    );

    return (
      endpoint !== undefined &&
      endpoint.url === this.getNodeWebhookUrl("default") &&
      sameMembers(
        endpoint.eventTypes,
        asStrings(this.getNodeParameter("events", []))
      )
    );
  } catch (error) {
    if (readHttpStatus(error) === notFound) {
      return false;
    }

    throw new NodeApiError(this.getNode(), errorDetailsOf(error));
  }
};

/** Creates the endpoint and keeps its id and secret in the node's static data. */
const create = async function create(this: IHookFunctions): Promise<boolean> {
  const channelIds = asStrings(this.getNodeParameter("channelIds", []));
  const workflowName = this.getWorkflow().name ?? "workflow";

  const endpoint: IDataObject = {
    description: `n8n: ${workflowName}`.slice(0, 200),
    eventTypes: asStrings(this.getNodeParameter("events", [])),
    url: this.getNodeWebhookUrl("default") ?? "",
  };

  // Without channels the endpoint hears every channel.
  if (channelIds.length > 0) {
    endpoint.channelIds = channelIds;
  }

  const created = await pealRequest(
    this,
    { body: endpoint, method: "POST", path: "/webhooks" },
    readCreatedEndpoint
  );

  if (created === undefined) {
    return false;
  }

  const data = this.getWorkflowStaticData("node");
  data.endpointId = created.id;
  data.secret = created.secret;

  return true;
};

/** Deletes the endpoint, and forgets it. */
const deleteEndpoint = async function deleteEndpoint(
  this: IHookFunctions
): Promise<boolean> {
  const data = this.getWorkflowStaticData("node");
  const stored = readStoredEndpoint(data);

  if (stored !== undefined) {
    try {
      await pealRequest(
        this,
        { method: "DELETE", path: endpointPath(stored.id) },
        ignoreAnswer
      );
    } catch (error) {
      // An endpoint already deleted in Peal is what deleting asked for.
      if (readHttpStatus(error) !== notFound) {
        throw new NodeApiError(this.getNode(), errorDetailsOf(error));
      }
    }
  }

  delete data.endpointId;
  delete data.secret;

  return true;
};

export class PealTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Peal Trigger",
    credentials: [{ name: credentialName, required: true }],
    defaults: { name: "Peal Trigger" },
    description:
      "Starts the workflow when something happens in a Peal workspace",
    group: ["trigger"],
    icon: {
      dark: "file:../../icons/peal.dark.svg",
      light: "file:../../icons/peal.svg",
    },
    inputs: [],
    name: "pealTrigger",
    outputs: [NodeConnectionTypes.Main],
    properties: [
      {
        displayName:
          "Peal sends events to public HTTPS addresses only, so n8n must be reachable from the internet. A workspace has 10 webhook endpoints at most.",
        default: "",
        name: "notice",
        type: "notice",
      },
      {
        displayName: "Events",
        default: [],
        description: "What happens in the workspace that starts the workflow",
        name: "events",
        options: eventOptions,
        required: true,
        type: "multiOptions",
      },
      {
        displayName: "Channel Names or IDs",
        default: [],
        description:
          'Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
        hint: "Only events about these channels. Empty hears every channel.",
        name: "channelIds",
        type: "multiOptions",
        typeOptions: { loadOptionsMethod: "getChannels" },
      },
    ],
    subtitle: '={{ $parameter["events"].join(", ") }}',
    version: 1,
    webhooks: [
      {
        httpMethod: "POST",
        name: "default",
        path: "webhook",
        responseMode: "onReceived",
      },
    ],
  };

  methods = { loadOptions: { getChannels } };

  webhookMethods = {
    default: { checkExists, create, delete: deleteEndpoint },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const stored = readStoredEndpoint(this.getWorkflowStaticData("node"));
    const request = this.getRequestObject();

    if (request.rawBody === undefined) {
      await request.readRawBody();
    }

    const nowSeconds = Math.floor(Date.now() / 1000);

    const check =
      stored === undefined
        ? undefined
        : verify(stored.secret, deliveryOf(this, request.rawBody), nowSeconds);

    if (check?.valid !== true) {
      this.getResponseObject()
        .status(401)
        .json({ message: "The delivery's signature is not Peal's" });

      return { noWebhookResponse: true };
    }

    return { workflowData: [this.helpers.returnJsonArray(this.getBodyData())] };
  }
}
