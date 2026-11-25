import type { INodeProperties } from "n8n-workflow";

import {
  createPost,
  listPostsQuery,
  paginateByCursor,
  reschedulePost,
} from "../hooks";

const showFor = (operation: string[]) => ({
  show: { operation, resource: ["post"] },
});

const postIdPath = "{{ encodeURIComponent($parameter.postId) }}";

export const postOperations: INodeProperties = {
  displayName: "Operation",
  default: "create",
  displayOptions: { show: { resource: ["post"] } },
  name: "operation",
  noDataExpression: true,
  options: [
    {
      action: "Cancel a post",
      description: "Cancel a draft or a scheduled post",
      name: "Cancel",
      routing: {
        request: { method: "POST", url: `=/posts/${postIdPath}/cancel` },
      },
      value: "cancel",
    },
    {
      action: "Create a post",
      description:
        "Publish a post now, schedule it, queue it or save it as a draft",
      name: "Create",
      routing: {
        request: {
          method: "POST",
          url: '={{ $parameter.when === "draft" ? "/posts/drafts" : "/posts" }}',
        },
        send: { preSend: [createPost] },
      },
      value: "create",
    },
    {
      action: "Get a post",
      description: "Get a post and the state of each of its channels",
      name: "Get",
      routing: { request: { method: "GET", url: `=/posts/${postIdPath}` } },
      value: "get",
    },
    {
      action: "Get the analytics of a post",
      description: "Get the counts of a post on each channel it went live on",
      name: "Get Analytics",
      routing: {
        request: { method: "GET", url: `=/analytics/posts/${postIdPath}` },
      },
      value: "getAnalytics",
    },
    {
      action: "Get many posts",
      description: "List the workspace's posts, with filters",
      name: "Get Many",
      routing: {
        operations: { pagination: paginateByCursor },
        request: { method: "GET", url: "/posts" },
        send: { preSend: [listPostsQuery] },
      },
      value: "getAll",
    },
    {
      action: "Get the outcome of a post",
      description:
        "Wait until a post has gone out on every channel, then get how it went",
      name: "Get Outcome",
      routing: {
        request: { method: "GET", url: `=/posts/${postIdPath}/outcome` },
      },
      value: "getOutcome",
    },
    {
      action: "Reschedule a post",
      description: "Move a scheduled post to another time, or schedule a draft",
      name: "Reschedule",
      routing: {
        request: { method: "POST", url: `=/posts/${postIdPath}/reschedule` },
        send: { preSend: [reschedulePost] },
      },
      value: "reschedule",
    },
    {
      action: "Unschedule a post",
      description: "Take a scheduled post back to draft",
      name: "Unschedule",
      routing: {
        request: { method: "POST", url: `=/posts/${postIdPath}/unschedule` },
      },
      value: "unschedule",
    },
  ],
  type: "options",
};

const createFields: INodeProperties[] = [
  {
    displayName: "Channel Names or IDs",
    default: [],
    description:
      'Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
    displayOptions: showFor(["create"]),
    name: "channelIds",
    required: true,
    type: "multiOptions",
    typeOptions: { loadOptionsMethod: "getChannels" },
  },
  {
    displayName: "Text",
    default: "",
    description:
      "What the post says. Peal counts it against each platform's limit.",
    displayOptions: showFor(["create"]),
    name: "text",
    required: true,
    type: "string",
    typeOptions: { rows: 4 },
  },
  {
    displayName: "Publish",
    default: "now",
    description: "When the post goes out",
    displayOptions: showFor(["create"]),
    name: "when",
    options: [
      {
        description: "Schedule it for a date and time",
        name: "At a Time",
        value: "at",
      },
      {
        description: "Put it on the next free slot of a queue",
        name: "In the Next Queue Slot",
        value: "queue",
      },
      { description: "Publish it at once", name: "Now", value: "now" },
      {
        description: "Keep it as a draft, to schedule later",
        name: "Save as Draft",
        value: "draft",
      },
    ],
    type: "options",
  },
  {
    displayName: "Date and Time",
    default: "",
    description: "When the post goes out, read in the time zone below",
    displayOptions: {
      show: { operation: ["create"], resource: ["post"], when: ["at"] },
    },
    name: "scheduledAt",
    required: true,
    type: "dateTime",
  },
  {
    displayName: "Time Zone",
    default: "",
    description:
      "The IANA time zone the post is scheduled in, such as Europe/Paris. Empty uses the workflow's time zone.",
    displayOptions: {
      show: { operation: ["create"], resource: ["post"], when: ["at", "now"] },
    },
    name: "timeZone",
    placeholder: "Europe/Paris",
    type: "string",
  },
  {
    displayName: "Queue ID",
    default: "",
    description:
      "The queue whose next free slot the post takes. Empty uses the default queue.",
    displayOptions: {
      show: { operation: ["create"], resource: ["post"], when: ["queue"] },
    },
    name: "queueId",
    type: "string",
  },
  {
    displayName: "Additional Fields",
    default: {},
    displayOptions: showFor(["create"]),
    name: "additionalFields",
    options: [
      {
        displayName: "Allow Duplicate",
        default: false,
        description:
          "Whether to send the post even when the same text went to one of its channels recently",
        name: "allowDuplicate",
        type: "boolean",
      },
      {
        displayName: "Channel Sets",
        default: "",
        description:
          "Channel sets to send the post to as well, by ID or name, separated by commas",
        name: "channelSets",
        type: "string",
      },
      {
        displayName: "Default Signatures",
        default: false,
        description:
          "Whether to put each channel's default signature under its text",
        name: "defaultSignatures",
        type: "boolean",
      },
      {
        displayName: "Follow-Ups",
        default: {},
        description:
          "Replies that follow the post, such as the next posts of a thread",
        name: "followUps",
        options: [
          {
            displayName: "Follow-Up",
            name: "followUp",
            values: [
              {
                displayName: "Text",
                default: "",
                description: "What the follow-up says",
                name: "text",
                type: "string",
                typeOptions: { rows: 2 },
              },
              {
                displayName: "Delay (Seconds)",
                default: 0,
                description:
                  "How long after the post before or the follow-up before it",
                name: "delaySeconds",
                type: "number",
                typeOptions: { maxValue: 86_400, minValue: 0 },
              },
            ],
          },
        ],
        placeholder: "Add Follow-Up",
        type: "fixedCollection",
        typeOptions: { multipleValues: true },
      },
      {
        displayName: "Idempotency Key",
        default: "",
        description:
          "A key that makes sending this request again safe: Peal answers the first post instead of creating another",
        name: "idempotencyKey",
        type: "string",
      },
      {
        displayName: "Media",
        default: {},
        description:
          "Images, videos or documents uploaded to Peal, in the order they show",
        name: "media",
        options: [
          {
            displayName: "Media",
            name: "item",
            values: [
              {
                displayName: "Media ID",
                default: "",
                description:
                  "The ID Peal gave the media when it was uploaded or imported",
                name: "mediaId",
                type: "string",
              },
              {
                displayName: "Alt Text",
                default: "",
                description:
                  "A description of the image for people who can't see it",
                name: "altText",
                type: "string",
              },
            ],
          },
        ],
        placeholder: "Add Media",
        type: "fixedCollection",
        typeOptions: { multipleValues: true },
      },
      {
        displayName: "Shorten Links",
        default: true,
        description:
          "Whether to shorten the links in the text, when the workspace shortens links",
        name: "shortenLinks",
        type: "boolean",
      },
      {
        displayName: "Signature ID",
        default: "",
        description: "A signature to put under the text on every channel",
        name: "signatureId",
        type: "string",
      },
      {
        displayName: "Tag IDs",
        default: "",
        description: "Tags to give the post, by ID, separated by commas",
        name: "tagIds",
        type: "string",
      },
      {
        displayName: "Text per Channel",
        default: {},
        description: "Another text for some channels, in place of the post's",
        name: "textPerChannel",
        options: [
          {
            displayName: "Text",
            name: "override",
            values: [
              {
                displayName: "Channel Name or ID",
                default: "",
                description:
                  'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
                name: "channelId",
                type: "options",
                typeOptions: { loadOptionsMethod: "getChannels" },
              },
              {
                displayName: "Text",
                default: "",
                description: "What the post says on that channel",
                name: "text",
                type: "string",
                typeOptions: { rows: 2 },
              },
            ],
          },
        ],
        placeholder: "Add Text",
        type: "fixedCollection",
        typeOptions: { multipleValues: true },
      },
      {
        displayName: "Wait for Result (Seconds)",
        default: 0,
        description:
          "For a post published now, how long to wait for every channel's result before answering, up to 60",
        name: "waitSeconds",
        type: "number",
        typeOptions: { maxValue: 60, minValue: 0 },
      },
    ],
    placeholder: "Add Field",
    type: "collection",
  },
];

const postIdField: INodeProperties = {
  displayName: "Post ID",
  default: "",
  description: "The ID of the post",
  displayOptions: showFor([
    "cancel",
    "get",
    "getAnalytics",
    "getOutcome",
    "reschedule",
    "unschedule",
  ]),
  name: "postId",
  required: true,
  type: "string",
};

const outcomeFields: INodeProperties[] = [
  {
    displayName: "Wait (Seconds)",
    default: 30,
    description:
      "How long to wait for every channel's result, up to 60 seconds",
    displayOptions: showFor(["getOutcome"]),
    name: "wait",
    routing: {
      send: { property: "wait", type: "query", value: "={{ String($value) }}" },
    },
    type: "number",
    typeOptions: { maxValue: 60, minValue: 0 },
  },
];

const rescheduleFields: INodeProperties[] = [
  {
    displayName: "Date and Time",
    default: "",
    description: "When the post goes out, read in the time zone below",
    displayOptions: showFor(["reschedule"]),
    name: "scheduledAt",
    required: true,
    type: "dateTime",
  },
  {
    displayName: "Time Zone",
    default: "",
    description:
      "The IANA time zone the post is scheduled in, such as Europe/Paris. Empty uses the workflow's time zone.",
    displayOptions: showFor(["reschedule"]),
    name: "timeZone",
    placeholder: "Europe/Paris",
    type: "string",
  },
];

const listFields: INodeProperties[] = [
  {
    displayName: "Return All",
    default: false,
    description: "Whether to return all results or only up to a given limit",
    displayOptions: showFor(["getAll"]),
    name: "returnAll",
    routing: { send: { paginate: "={{ $value }}" } },
    type: "boolean",
  },
  {
    displayName: "Limit",
    default: 50,
    description: "Max number of results to return",
    displayOptions: {
      show: { operation: ["getAll"], resource: ["post"], returnAll: [false] },
    },
    name: "limit",
    routing: {
      output: {
        postReceive: [
          { properties: { property: "items" }, type: "rootProperty" },
        ],
      },
      send: {
        property: "limit",
        type: "query",
        value: "={{ String($value) }}",
      },
    },
    type: "number",
    typeOptions: { maxValue: 100, minValue: 1 },
  },
  {
    displayName: "Filters",
    default: {},
    displayOptions: showFor(["getAll"]),
    name: "filters",
    options: [
      {
        displayName: "Channel Name or ID",
        default: "",
        description:
          'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
        name: "channelId",
        routing: { send: { property: "channelId", type: "query" } },
        type: "options",
        typeOptions: { loadOptionsMethod: "getChannels" },
      },
      {
        displayName: "From",
        default: "",
        description:
          "Posts scheduled at this time or later. Leaves out drafts and other posts without a time.",
        name: "from",
        type: "dateTime",
      },
      {
        displayName: "Outcome",
        default: "published",
        description: "How a finished post ended",
        name: "outcome",
        options: [
          { name: "Cancelled", value: "cancelled" },
          { name: "Failed", value: "failed" },
          { name: "Partially Published", value: "partiallyPublished" },
          { name: "Published", value: "published" },
          { name: "Unconfirmed", value: "unconfirmed" },
        ],
        routing: { send: { property: "outcome", type: "query" } },
        type: "options",
      },
      {
        displayName: "Sort",
        default: "createdDesc",
        name: "sort",
        options: [
          { name: "Created, Newest First", value: "createdDesc" },
          { name: "Created, Oldest First", value: "createdAsc" },
          { name: "Scheduled, Latest First", value: "scheduledDesc" },
          { name: "Scheduled, Soonest First", value: "scheduledAsc" },
        ],
        routing: { send: { property: "sort", type: "query" } },
        type: "options",
      },
      {
        displayName: "Status",
        default: "scheduled",
        name: "status",
        options: [
          { name: "Awaiting Approval", value: "awaitingApproval" },
          { name: "Cancelled", value: "cancelled" },
          { name: "Draft", value: "draft" },
          { name: "Finished", value: "finished" },
          { name: "Publishing", value: "publishing" },
          { name: "Scheduled", value: "scheduled" },
        ],
        routing: { send: { property: "status", type: "query" } },
        type: "options",
      },
      {
        displayName: "To",
        default: "",
        description:
          "Posts scheduled before this time. Leaves out drafts and other posts without a time.",
        name: "to",
        type: "dateTime",
      },
    ],
    placeholder: "Add Filter",
    type: "collection",
  },
];

export const postFields: INodeProperties[] = [
  ...createFields,
  postIdField,
  ...outcomeFields,
  ...rescheduleFields,
  ...listFields,
];
