/**
 * Posting the winner to a Google Chat space via an incoming webhook.
 *
 * Setup (a space manager, once): in Google Chat open the space → space name →
 * Apps & integrations → Webhooks → Add webhook, then put the URL in the
 * GOOGLE_CHAT_WEBHOOK_URL environment variable. Needs a Google Workspace
 * (Business/Enterprise) org that allows incoming webhooks.
 */

export const chatWebhookUrl = () => process.env.GOOGLE_CHAT_WEBHOOK_URL || null;

export function winnerMessage({ raffleId, name, firstName, dateLabel, poolSize, imageUrl, origin }) {
  const fairness = `${origin}/fairness`;
  const pool = poolSize ? ` — picked at random from ${poolSize} teammates` : "";
  return {
    text: `🎉 *${name}* won the Blackdog raffle!`,
    cardsV2: [
      {
        cardId: `raffle-${raffleId}`,
        card: {
          header: {
            title: "And the winner is…",
            subtitle: `${dateLabel}${pool}`,
            imageUrl: `${origin}/assets/black_dog_logo.png`,
            imageType: "SQUARE",
            imageAltText: "Blackdog",
          },
          sections: [
            {
              widgets: [
                {
                  image: {
                    imageUrl,
                    altText: `The Blackdog pup holding a bone with ${firstName}'s name on it`,
                  },
                },
                {
                  buttonList: {
                    buttons: [
                      { text: "How the draw works", onClick: { openLink: { url: fairness } } },
                      { text: "Open the raffle", onClick: { openLink: { url: origin } } },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };
}

/** Plain-text version, used if the space rejects the card. */
export const winnerTextMessage = ({ name, imageUrl, origin }) => ({
  text: `🎉 *${name}* won the Blackdog raffle!\n${imageUrl}\nHow the draw works: ${origin}/fairness`,
});

async function post(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const detail = res.ok ? "" : (await res.text().catch(() => "")).slice(0, 300);
  return { ok: res.ok, status: res.status, detail };
}

/** Post the card; if the space refuses cards (400), fall back to a text post with the image link. */
export async function postWinnerToChat(message, fallback) {
  const url = chatWebhookUrl();
  if (!url) {
    const err = new Error("Google Chat isn't connected yet (GOOGLE_CHAT_WEBHOOK_URL is not set).");
    err.status = 503;
    throw err;
  }
  let result = await post(url, message);
  if (!result.ok && result.status === 400) result = await post(url, fallback);
  if (!result.ok) {
    console.error("[google-chat] webhook failed", result.status, result.detail);
    const err = new Error(`Google Chat didn't accept the post (${result.status}).`);
    err.status = 502;
    throw err;
  }
}
