import type { INodeProperties } from "n8n-workflow";

export const channelOperations: INodeProperties = {
  displayName: "Operation",
  default: "getAll",
  displayOptions: { show: { resource: ["channel"] } },
  name: "operation",
  noDataExpression: true,
  options: [
    {
      action: "Get many channels",
      description: "List the channels connected to the workspace",
      name: "Get Many",
      routing: {
        output: {
          postReceive: [
            { properties: { property: "items" }, type: "rootProperty" },
          ],
        },
        request: { method: "GET", url: "/channels" },
      },
      value: "getAll",
    },
  ],
  type: "options",
};

export const channelFields: INodeProperties[] = [];
