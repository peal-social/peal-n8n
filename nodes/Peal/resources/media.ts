import type { INodeProperties } from "n8n-workflow";

import { paginateByCursor, uploadMedia } from "../hooks";

const showFor = (operation: string[]) => ({
  show: { operation, resource: ["media"] },
});

const mediaIdPath = "{{ encodeURIComponent($parameter.mediaId) }}";

export const mediaOperations: INodeProperties = {
  displayName: "Operation",
  default: "upload",
  displayOptions: { show: { resource: ["media"] } },
  name: "operation",
  noDataExpression: true,
  options: [
    {
      action: "Delete a media file",
      description: "Delete a file and remove it from the drafts that show it",
      name: "Delete",
      routing: {
        output: {
          postReceive: [
            {
              properties: { value: '={{ { "deleted": true } }}' },
              type: "set",
            },
          ],
        },
        request: { method: "DELETE", url: `=/media/${mediaIdPath}` },
      },
      value: "delete",
    },
    {
      action: "Get a media file",
      description: "Get a file of the workspace's library",
      name: "Get",
      routing: { request: { method: "GET", url: `=/media/${mediaIdPath}` } },
      value: "get",
    },
    {
      action: "Get many media files",
      description: "List the workspace's library, newest first",
      name: "Get Many",
      routing: {
        operations: { pagination: paginateByCursor },
        request: { method: "GET", url: "/media" },
      },
      value: "getAll",
    },
    {
      action: "Import a media file from a URL",
      description:
        "Have Peal fetch a public image or video and add it to the library",
      name: "Import From URL",
      routing: { request: { method: "POST", url: "/media/import" } },
      value: "import",
    },
    {
      action: "Upload a media file",
      description:
        "Upload an image, video or document from the item's binary data",
      name: "Upload",
      routing: {
        request: { method: "POST", url: "/media" },
        send: { preSend: [uploadMedia] },
      },
      value: "upload",
    },
  ],
  type: "options",
};

export const mediaFields: INodeProperties[] = [
  {
    displayName: "Media ID",
    default: "",
    description: "The ID of the media file",
    displayOptions: showFor(["delete", "get"]),
    name: "mediaId",
    required: true,
    type: "string",
  },
  {
    displayName: "Input Binary Field",
    default: "data",
    description: "The name of the input field that holds the file",
    displayOptions: showFor(["upload"]),
    hint: "JPEG, PNG, GIF and WebP images, MP4 and QuickTime videos, PDF documents",
    name: "binaryPropertyName",
    required: true,
    type: "string",
  },
  {
    displayName: "URL",
    default: "",
    description:
      "A public HTTPS address of a JPEG, PNG, GIF or WebP image, or an MP4 or QuickTime video",
    displayOptions: showFor(["import"]),
    name: "url",
    placeholder: "https://example.com/photo.jpg",
    required: true,
    routing: { send: { property: "url", type: "body" } },
    type: "string",
  },
  {
    displayName: "Additional Fields",
    default: {},
    displayOptions: showFor(["import", "upload"]),
    name: "additionalFields",
    options: [
      {
        displayName: "Alt Text",
        default: "",
        description: "A description of the image for people who can't see it",
        name: "altText",
        routing: { send: { property: "altText", type: "body" } },
        type: "string",
      },
    ],
    placeholder: "Add Field",
    type: "collection",
  },
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
      show: { operation: ["getAll"], resource: ["media"], returnAll: [false] },
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
        displayName: "Kind",
        default: "image",
        name: "kind",
        options: [
          { name: "Audio", value: "audio" },
          { name: "Document", value: "document" },
          { name: "Image", value: "image" },
          { name: "Video", value: "video" },
        ],
        routing: { send: { property: "kind", type: "query" } },
        type: "options",
      },
      {
        displayName: "Search",
        default: "",
        description: "Text the file's name or its description holds",
        name: "q",
        routing: { send: { property: "q", type: "query" } },
        type: "string",
      },
    ],
    placeholder: "Add Filter",
    type: "collection",
  },
];
