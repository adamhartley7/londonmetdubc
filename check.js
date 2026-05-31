// ===== THE ONE PIECE WE STILL NEED =====
// Paste the data-feed address here once you find it in the Network tab.
const FEED_URL = "PASTE_THE_FEED_URL_HERE";
// =======================================

const fs = require("fs");

async function main() {
  // 1) Ask the back end for the latest data
  const response = await fetch(FEED_URL);
  const latest = await response.text();

  // 2) (We'll refine this together once we see the feed, so it reacts
  //     only to YOUR races instead of any change anywhere.)
  const snapshot = latest;

  // 3) Compare with what we saw last time
  let previous = "";
  try { previous = fs.readFileSync("last_seen.txt", "utf8"); } catch (e) {}
  if (snapshot === previous) { console.log("Nothing new."); return; }

  // 4) Something changed — save it and send the alert
  fs.writeFileSync("last_seen.txt", snapshot);
  await notify("Met Regatta results just updated — open rowresults.co.uk/metsat26");
  console.log("Change found, notification sent.");
}

async function notify(message) {
  await fetch(process.env.NTFY_URL, { method: "POST", body: message });
}

main().catch(err => { console.error(err); process.exit(1); });
