import type {
  IAuthenticateGeneric,
  Icon,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from "n8n-workflow";

export class PealApi implements ICredentialType {
  authenticate: IAuthenticateGeneric = {
    properties: {
      headers: { Authorization: "=Bearer {{$credentials.apiKey}}" },
    },
    type: "generic",
  };

  displayName = "Peal API";

  documentationUrl = "https://github.com/peal-social/peal-n8n#credentials";

  icon: Icon = {
    dark: "file:../icons/peal.dark.svg",
    light: "file:../icons/peal.svg",
  };

  name = "pealApi";

  properties: INodeProperties[] = [
    {
      displayName: "API Key",
      default: "",
      description:
        "An API key of your workspace, starting with peal_. Create one in Peal: open the workspace's Settings, then API keys.",
      name: "apiKey",
      required: true,
      type: "string",
      typeOptions: { password: true },
    },
    {
      displayName: "Server",
      default: "https://app.peal.social",
      description:
        "The address of your Peal server. Change it only if you run Peal yourself.",
      name: "server",
      type: "string",
    },
  ];

  test: ICredentialTestRequest = {
    request: {
      baseURL:
        '={{ ($credentials.server || "https://app.peal.social").replace(/\\/+$/, "") + "/api/v1" }}',
      url: "/credential",
    },
  };
}
