import { Application, Router } from "oak";

import config from "./config.ts";

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
    const error = (await response.json()) as unknown;
    console.warn({
      msg: "Error setting webhook url",
      callbackUrl,
      ...(error as Record<string, unknown>),
    });
  }
};

export interface IRequestBody {
  recipient: { id: string };
  message: { text: string };
}
const callSendApi = async (
  pageAccessToken: string,
  requestBody: IRequestBody
) => {
  const url = new URL(`${config.apiUrl}/me/messages`);
  url.search = new URLSearchParams({
    access_token: pageAccessToken,
  }).toString();

  const response = await fetch(url.href, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    console.warn({ msg: "Could not sent message", ...error });
  }
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
          entry.messaging.forEach((event: any) => {
            // Log webhook body
            // console.info({ msg: "Webhook body", ...body });

            // Discard uninteresting events (message sent by self)
            if (
              "message" in event &&
              "is_echo" in event.message &&
              event.message.is_echo === true
            ) {
              console.info("Got an echo");
              return;
            }

            const { message, sender } = event;
            const senderIgsid = sender.id;

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
  console.time();
  await setWebhookURL(config.webhookUrl);
  console.timeEnd();
});
app.listen({ port: parseInt(config.port, 10) });
