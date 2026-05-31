// check.js — runs on GitHub Actions. No tokens, no cost beyond free minutes.
const DAYS = ["metsat26", "metsun26"];   // Saturday + Sunday feeds
const OUR  = "ZADU";                      // Dublin University (men)

const fs = require("fs");

async function getJSON(url){
  const r = await fetch(url, { headers: { "User-Agent": "results-watcher" } });
  if (!r.ok) throw new Error(url + " -> " + r.status);
  return r.json();
}
function ordinal(n){ n = parseInt(n); return (n%10===1&&n!==11)?"st":(n%10===2&&n!==12)?"nd":(n%10===3&&n!==13)?"rd":"th"; }
function loadSeen(){ try { return JSON.parse(fs.readFileSync("seen.json","utf8")); } catch(e){ return {}; } }
async function notify(msg){ await fetch(process.env.NTFY_URL, { method:"POST", body: msg }); }

(async () => {
  const seen = loadSeen();
  const alerts = [];

  for (const code of DAYS){
    let info;
    try { info = await getJSON(`https://rowresults.co.uk/raceinfo.php?c=${code}`); }
    catch(e){ console.log("skip", code, e.message); continue; }

    const ourRaces = (info.data || []).filter(r => (r.SearchInfo || "").includes(OUR));
    for (const r of ourRaces){
      let det;
      try { det = await getJSON(`https://rowresults.co.uk/results/${code}/Race${r.Race}.json`); }
      catch(e){ continue; }

      const lanes = det.lanes || [];
      const us = lanes.find(L => (L.CrewCode || "") === OUR);
      if (!us) continue;

      const hasResult = String(us.Finish || "").trim() && String(us.Posn || "").trim();
      if (!hasResult) continue;                          // not posted yet

      const key = `${code}-${r.Race}-${us.Finish}`;       // re-alerts if a time is corrected
      if (seen[key]) continue;                            // already alerted

      const finishers = lanes.filter(L => String(L.Finish || "").trim()).length;
      const ev    = (det.race && det.race.RaceName ? det.race.RaceName : r.Event  || "").trim();
      const round = (det.race && det.race.Round    ? det.race.Round    : r.Round || "").trim();
      alerts.push(`${ev} ${round}: DUBC ${us.Posn}${ordinal(us.Posn)} of ${finishers} — ${us.Finish}`);
      seen[key] = true;
    }
  }

  if (alerts.length){
    await notify("Met Regatta result\n" + alerts.join("\n"));
    fs.writeFileSync("seen.json", JSON.stringify(seen, null, 2));
    console.log("Alerted:\n" + alerts.join("\n"));
  } else {
    console.log("No new results.");
  }
})().catch(e => { console.error(e); process.exit(1); });
