// check.js — GitHub Actions. Sends phone alerts AND writes results.json for the page.
const DAYS = ["metsat26", "metsun26"];   // Saturday + Sunday feeds
const OUR  = "ZADU";                      // Dublin University (men)
const fs = require("fs");

async function getJSON(url){
  const r = await fetch(url, { headers: { "User-Agent": "results-watcher" } });
  if (!r.ok) throw new Error(url + " -> " + r.status);
  return r.json();
}
function ordinal(n){ n=parseInt(n); return (n%10===1&&n!==11)?"st":(n%10===2&&n!==12)?"nd":(n%10===3&&n!==13)?"rd":"th"; }
function load(f){ try { return JSON.parse(fs.readFileSync(f,"utf8")); } catch(e){ return null; } }
async function notify(msg){ if (process.env.NTFY_URL) await fetch(process.env.NTFY_URL, { method:"POST", body: msg }); }

(async () => {
  const seen = load("seen.json") || {};
  const alerts = [];
  const out = { updated: new Date().toISOString(), sat: [], sun: [] };

  for (const code of DAYS){
    const dayKey = code.includes("sat") ? "sat" : "sun";
    let info;
    try { info = await getJSON(`https://rowresults.co.uk/raceinfo.php?c=${code}`); }
    catch(e){ console.log("skip", code, e.message); continue; }

    const ourRaces = (info.data || []).filter(r => (r.SearchInfo || "").includes(OUR));
    for (const r of ourRaces){
      let det;
      try { det = await getJSON(`https://rowresults.co.uk/results/${code}/Race${r.Race}.json`); }
      catch(e){ continue; }

      const lanes = det.lanes || [];
      const roundStr  = (det.race && det.race.Round) ? det.race.Round : (r.Round || "");
      const roundType = /final/i.test(roundStr) ? "final" : "tt";

      // four-vs-eight: finals are named differently from TTs, so check several forms
      const evStr = `${r.Event || ""} ${(det.race && det.race.RaceName) || ""}`;
      const boat  = /8\+|eight|viii/i.test(evStr) ? "eight" : (/4\+|four/i.test(evStr) ? "four" : null);

      out[dayKey].push({
        boat, roundType, dist: roundType === "tt" ? 1900 : 2000,
        event: (det.race && det.race.RaceName ? det.race.RaceName : r.Event || "").trim(),
        round: roundStr.trim(),
        time: r.Time || (det.race && det.race.Time) || "",
        raceNo: r.Race,
        resultStatus: det.race ? det.race.ResultStatus : "",
        lanes: lanes.map(L => ({
          CrewNum:L.CrewNum, CrewCode:L.CrewCode, ClubName:L.ClubName,
          Finish:L.Finish, Posn:L.Posn, Split1:L.Split1, Split2:L.Split2, Split3:L.Split3
        }))
      });

      const us = lanes.find(L => (L.CrewCode || "") === OUR);
      if (us && String(us.Finish||"").trim() && String(us.Posn||"").trim()){
        const key = `${code}-${r.Race}-${us.Finish}`;
        if (!seen[key]){
          const finishers = lanes.filter(L => String(L.Finish||"").trim()).length;
          alerts.push(`${(det.race&&det.race.RaceName?det.race.RaceName:r.Event||"").trim()} ${roundStr.trim()}: DUBC ${us.Posn}${ordinal(us.Posn)} of ${finishers} — ${us.Finish}`);
          seen[key] = true;
        }
      }
    }
  }

  const prev = load("results.json");
  const changed = !prev || JSON.stringify({s:prev.sat, u:prev.sun}) !== JSON.stringify({s:out.sat, u:out.sun});
  if (changed) { fs.writeFileSync("results.json", JSON.stringify(out, null, 2)); console.log("results.json updated"); }
  else console.log("no data change");

  if (alerts.length){
    await notify("Met Regatta result\n" + alerts.join("\n"));
    fs.writeFileSync("seen.json", JSON.stringify(seen, null, 2));
    console.log("Alerted:\n" + alerts.join("\n"));
  }
})().catch(e => { console.error(e); process.exit(1); });
