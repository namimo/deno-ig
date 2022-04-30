import { Application, Router } from "oak";

import config from "./config.ts";
import { ICallSendApiOptions, IIgConversation, IIgPost } from "./types.ts";

console.log("For Europe");

const setWebhookURL = async (callbackUrl: string) => {
  const url = new URL(
    `https://graph.facebook.com/${config.appId}/subscriptions`
  );
  url.search = new URLSearchParams({
    access_token: `${config.appId}|${config.appSecret}`,
    verify_token: config.verifyToken,
    object: "instagram",
    callback_url: callbackUrl,
    fields: "comments,messages,messaging_postbacks",
  }).toString();

  const response = await fetch(url.href, {
    method: "POST",
  });

  if (response.ok) {
    console.log("Webhook url has been set.");
  } else {
    const error = (await response.json()) as Record<string, unknown>;

    console.warn({
      msg: "Error setting webhook url",
      callbackUrl,
      ...error,
    });
  }
};

const callSendApi = async (
  pageAccessToken: string,
  options: ICallSendApiOptions
) => {
  const url = new URL(`${config.apiUrl}/me/messages`);
  url.search = new URLSearchParams({
    access_token: pageAccessToken,
  }).toString();

  const response = await fetch(url.href, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const error = await response.json();
    console.warn({ msg: "Could not sent message", ...error });
  }
};

const getConversations = async (
  pageAccessToken: string,
  options: { pageId: string; userId: string }
) => {
  const { pageId, userId } = options;

  const url = new URL(`${config.apiUrl}/${pageId}/conversations`);
  url.search = new URLSearchParams({
    access_token: pageAccessToken,
    platform: "instagram",
    user_id: userId,
    fields: "messages.limit(15){from,to,message}",
  }).toString();

  const response = await fetch(url.href);
  const data = (await response.json()) as
    | IIgConversation
    | Record<string, unknown>;

  if (!response.ok) {
    console.warn({ msg: "Could not load conversations", ...data });
  }
  return data;
};

const getPost = async (pageAccessToken: string, options: { id: string }) => {
  const { id } = options;

  const url = new URL(`${config.apiUrl}/${id}`);
  url.search = new URLSearchParams({
    access_token: pageAccessToken,
    fields: "caption",
  }).toString();

  const response = await fetch(url.href);
  const data = (await response.json()) as IIgPost | Record<string, unknown>;

  if (!response.ok) {
    console.warn({ msg: "Could not load post", id, ...response });
  }
  return data;
};

const router = new Router();

router.get("/", (ctx) => {
  ctx.response.body = "hello";
});

router.get("/webhook", (ctx) => {
  const { url } = ctx.request;

  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === config.verifyToken) {
    console.log("WEBHOOK_VERIFIED");
    ctx.response.body = challenge;
  } else {
    ctx.response.body =
      "Webhook verification failed. Make sure the verify tokens match.";
    ctx.response.status = 403;
  }
});

router.post("/webhook", async (ctx) => {
  const body = await ctx.request.body({
    type: "json",
  }).value;

  if (body.object === "instagram") {
    // Return a '200 OK' response to all requests
    ctx.response.body = "EVENT_RECEIVED";

    new Promise((resolve) => {
      body.entry.forEach((entry: any) => {
        if (!("messaging" in entry)) {
          console.warn("No messaging field in entry. Possibly a webhook test.");
        } else {
          entry.messaging.forEach(async (event: any) => {
            // Log webhook body
            // console.info({ msg: "Webhook body", ...body });

            // Discard uninteresting events (message sent by self)
            if (
              "message" in event &&
              "is_echo" in event.message &&
              event.message.is_echo === true
            ) {
              return;
            }

            const { message, sender } = event;
            const senderIgsid = sender.id;

            console.time("conversations");
            await getConversations(config.pageAccessToken, {
              pageId: config.pageId,
              userId: senderIgsid,
            });
            console.timeEnd("conversations");

            console.time("post");
            await getPost(config.pageAccessToken, {
              id: "17936743154054340",
            });
            console.timeEnd("post");

            callSendApi(config.pageAccessToken, {
              recipient: { id: senderIgsid },
              message: { text: message.text },
            });

            resolve(undefined);
          });
        }
      });
    });
  } else if (body.object === "page") {
    console.warn(
      'Received Messenger "page" object instead of "instagram" message webhook.'
    );

    ctx.response.body = "Coming soon on Messenger";
    ctx.response.status = 404;
  } else {
    console.warn("Unrecognized POST to webhook.");

    ctx.response.body = "Unrecognized event";
    ctx.response.status = 404;
  }
});

const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

app.addEventListener("listen", async ({ hostname, port, secure }) => {
  console.log(
    `Listening on: ${secure ? "https://" : "http://"}${
      hostname ?? "localhost"
    }:${port}`
  );

  console.time("webhook");
  await setWebhookURL(config.webhookUrl);
  console.timeEnd("webhook");
});
app.listen({ port: parseInt(config.port, 10) });
