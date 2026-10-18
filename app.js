/* ============================================================
   FORMULA 1 – Renderer
   Liest window.F1DATA (lokal eingebundener Snapshot) und rendert
   Kalender, nächsten GP mit Live-Countdown, WM-Stände & Rennsieger.
   ============================================================ */
/* Alle dynamischen Strings werden mit esc() escaped; Datenquelle ist der
   lokale, vertrauenswürdige Snapshot data.js (aus der offiziellen F1-API
   gebaut) -> innerHTML hier sicher (kein untrusted user input). */
(function () {
  "use strict";
  const DATA = window.F1DATA;
  if (!DATA) {
    document.body.innerHTML = '<div style="padding:40px;font-family:sans-serif;color:#fff">Fehler: data.js nicht geladen.</div>';
    return;
  }
  const SEASONS = Object.keys(DATA.seasons).sort();
  const CURRENT = SEASONS[SEASONS.length - 1]; // neueste Saison (2026)

  /* ---------- Lookup-Tabellen ---------- */
  const TEAM_COLORS = {
    "mercedes": "#27f4d2", "ferrari": "#e8002d", "red bull": "#3671c6",
    "mclaren": "#ff8000", "aston martin": "#229971", "alpine": "#0093cc",
    "williams": "#64c4ff", "rb": "#6692ff", "toro rosso": "#6692ff",
    "sauber": "#52e252", "audi": "#52e252", "haas": "#b6babd",
    "alphatauri": "#2500a6", "renault": "#ff1801", "alfa romeo": "#8e1862",
    "racing point": "#52e252", "force india": "#c8102e", "lotus": "#0077c8",
    "brawn": "#c8a97e", "honda": "#cc0000", "mclaren": "#ff8000",
    "mclaren": "#ff8000", "mclaren": "#ff8000"
  };
  function teamColor(name) {
    if (!name) return "#5a5a66";
    const n = name.toLowerCase();
    for (const k in TEAM_COLORS) if (n.includes(k)) return TEAM_COLORS[k];
    return "#5a5a66";
  }

  const FLAGS = {
    "British": "🇬🇧", "English": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Scottish": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    "Welsh": "🏴󠁧󠁢󠁷󠁬󠁳󠁿", "Northern Irish": "🏴󠁧󠁢󠁮󠁩󠁣󠁿", "Irish": "🇮🇪",
    "German": "🇩🇪", "Dutch": "🇳🇱", "Spanish": "🇪🇸", "Monégasque": "🇲🇨", "Monegasque": "🇲🇨",
    "Canadian": "🇨🇦", "Mexican": "🇲🇽", "Australian": "🇦🇺", "Finnish": "🇫🇮",
    "Japanese": "🇯🇵", "New Zealander": "🇳🇿", "Brazilian": "🇧🇷", "American": "🇺🇸",
    "Italian": "🇮🇹", "French": "🇫🇷", "Portuguese": "🇵🇹", "South African": "🇿🇦",
    "Argentine": "🇦🇷", "Austrian": "🇦🇹", "Hungarian": "🇭🇺", "Swiss": "🇨🇭",
    "Belgian": "🇧🇪", "Danish": "🇩🇰", "Norwegian": "🇳🇴", "Polish": "🇵🇱",
    "Czech": "🇨🇿", "Swedish": "🇸🇪", "Malaysian": "🇲🇾", "Indonesian": "🇮🇩",
    "Chinese": "🇨🇳", "Korean": "🇰🇷", "South Korean": "🇰🇷", "Russian": "🇷🇺",
    "Ukrainian": "🇺🇦", "Estonian": "🇪🇪", "Latvian": "🇱🇻", "Lithuanian": "🇱🇹",
    "Croatian": "🇭🇷", "Slovak": "🇸🇰", "Slovenian": "🇸🇮", "Romanian": "🇷🇴",
    "Turkish": "🇹🇷", "Greek": "🇬🇷", "Israeli": "🇮🇱", "Emirati": "🇦🇪",
    "Indian": "🇮🇳", "Thai": "🇹🇭", "Colombian": "🇨🇴", "Venezuelan": "🇻🇪",
    "Chilean": "🇨🇱", "Peruvian": "🇵🇪", "Ecuadorian": "🇪🇨", "Paraguayan": "🇵🇾",
    "Uruguayan": "🇺🇾", "Costa Rican": "🇨🇷", "Panamanian": "🇵🇦", "Jamaican": "🇯🇲",
    "Trinidadian": "🇹🇹", "Manx": "🇮🇲", "Cypriot": "🇨🇾"
  };
  function flag(nat) { return (nat && FLAGS[nat]) || "🏳️"; }

  const COUNTRY_FLAGS = {
    "Australia": "🇦🇺", "Austria": "🇦🇹", "Azerbaijan": "🇦🇿", "Bahrain": "🇧🇭",
    "Belgium": "🇧🇪", "Brazil": "🇧🇷", "Canada": "🇨🇦", "China": "🇨🇳",
    "France": "🇫🇷", "Hungary": "🇭🇺", "Italy": "🇮🇹", "Japan": "🇯🇵",
    "Malaysia": "🇲🇾", "Mexico": "🇲🇽", "Monaco": "🇲🇨", "Netherlands": "🇳🇱",
    "Qatar": "🇶🇦", "Saudi Arabia": "🇸🇦", "Singapore": "🇸🇬", "Spain": "🇪🇸",
    "UAE": "🇦🇪", "UK": "🇬🇧", "USA": "🇺🇸"
  };
  function cflag(country) { return (country && COUNTRY_FLAGS[country]) || "📍"; }

  /* ---------- Helfer ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function raceDT(r) {
    const d = new Date(r.date + "T" + (r.time || "00:00:00Z"));
    return isNaN(d.getTime()) ? new Date(r.date + "T00:00:00Z") : d;
  }
  // Robustes Parsen des "generated"-Felds (Format z. B. "2026-10-18 02:35 UTC")
  function parseGen(s) {
    const m = String(s || "").match(/(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
    return m ? new Date(m[1] + "T" + m[2] + ":00Z") : new Date();
  }
  const dLong = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  const dShort = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const dTime = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });
  function fmtLong(d) { return dLong.format(d); }
  function fmtShort(d) { return dShort.format(d); }
  function fmtTime(d) { return dTime.format(d); }

  /* ---------- Kopf / Badge ---------- */
  const genDate = parseGen(DATA.generated);
  document.getElementById("standbadge").innerHTML =
    "Stand: <b>" + dShort.format(genDate) + "</b>";
  document.getElementById("footNote").innerHTML =
    "Lokal erstellt am <b>" + dShort.format(genDate) + "</b> · Daten-Snapshot (Saisons " +
    SEASONS[0] + "–" + CURRENT + ") · Bilder laden live von Wikimedia.";

  const cur = DATA.seasons[CURRENT];
  const doneCount = cur.races.filter(r => r.completed).length;
  document.getElementById("heroSeason").innerHTML =
    '<span class="dot"></span> Saison ' + CURRENT + ' · <b>' + doneCount + ' von ' +
    cur.races.length + '</b> Rennen gefahren';

  /* ---------- Nächster Grand Prix + Countdown ---------- */
  const allRaces = [];
  SEASONS.forEach(s => DATA.seasons[s].races.forEach(r =>
    allRaces.push(Object.assign({ season: s }, r))));
  const now0 = Date.now();
  const nextRace = allRaces
    .filter(r => raceDT(r).getTime() > now0)
    .sort((a, b) => raceDT(a) - raceDT(b))[0];

  const nextCard = document.getElementById("nextCard");
  let cdTarget = null;
  if (nextRace) {
    cdTarget = raceDT(nextRace);
    const img = nextRace.image
      ? '<div class="bg" style="background-image:url(\'' + esc(nextRace.image) + '\')"></div>'
      : '<div class="bg"></div>';
    nextCard.innerHTML =
      img +
      '<div class="next-body">' +
        '<div class="next-label"><span class="live"></span> NÄCHSTER GRAND PRIX · ' + nextRace.season + '</div>' +
        '<div class="next-name">' + esc(nextRace.name) + '</div>' +
        '<div class="next-meta">' +
          '<span>' + esc(nextRace.circuit) + '</span>' +
          '<span class="flag">' + cflag(nextRace.country) + '</span>' +
          '<span>' + esc(nextRace.location) + ', ' + esc(nextRace.country) + '</span>' +
        '</div>' +
        '<div class="countdown" id="countdown">' +
          '<div class="cd-unit"><div class="cd-num" id="cd-d">–</div><div class="cd-lab">Tage</div></div>' +
          '<div class="cd-unit"><div class="cd-num" id="cd-h">–</div><div class="cd-lab">Std</div></div>' +
          '<div class="cd-unit"><div class="cd-num" id="cd-m">–</div><div class="cd-lab">Min</div></div>' +
          '<div class="cd-unit"><div class="cd-num" id="cd-s">–</div><div class="cd-lab">Sek</div></div>' +
        '</div>' +
        '<div class="next-round">Rennen am <b>' + fmtLong(cdTarget) + '</b> · ' + fmtTime(cdTarget) +
          ' Uhr (MEZ) · Runde ' + esc(nextRace.round) + ' von ' + DATA.seasons[nextRace.season].races.length + '</div>' +
      '</div>';
    tick();
    setInterval(tick, 1000);
  } else {
    nextCard.innerHTML =
      '<div class="next-body"><div class="next-label"><span class="live"></span> SAISON ' + CURRENT + '</div>' +
      '<div class="next-name">Saison beendet</div>' +
      '<div class="next-meta"><span>Alle Rennen der Saison ' + CURRENT + ' sind gefahren. Die nächste Saison kommt bald.</span></div></div>';
  }
  function tick() {
    if (!cdTarget) return;
    let diff = cdTarget.getTime() - Date.now();
    if (diff < 0) diff = 0;
    const d = Math.floor(diff / 86400000);
    const h = Math.floor(diff % 86400000 / 3600000);
    const m = Math.floor(diff % 3600000 / 60000);
    const s = Math.floor(diff % 60000 / 1000);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("cd-d", d); set("cd-h", String(h).padStart(2, "0"));
    set("cd-m", String(m).padStart(2, "0")); set("cd-s", String(s).padStart(2, "0"));
  }

  /* ---------- Rennkalender (aktuelle Saison) ---------- */
  const calGrid = document.getElementById("calGrid");
  document.getElementById("calCount").textContent = cur.races.length + " Rennen";
  calGrid.innerHTML = cur.races.map(r => {
    const dt = raceDT(r);
    const isNext = nextRace && nextRace.season === CURRENT && nextRace.round === r.round;
    const img = r.image
      ? '<img loading="lazy" src="' + esc(r.image) + '" alt="' + esc(r.circuit) + '" onerror="this.style.display=\'none\'">'
      : '';
    let foot;
    if (r.completed) {
      foot = '<span class="race-date">' + fmtShort(dt) + '</span>' +
        '<span class="race-winner" title="Sieger">' + flag(r.winnerNationality || "") + '🏁 ' + esc(r.winner) + '</span>';
    } else {
      foot = '<span class="race-date">' + fmtShort(dt) + ' · ' + fmtTime(dt) + ' Uhr</span>' +
        '<span class="race-status upcoming">Geplant</span>';
    }
    return (
      '<article class="race-card' + (isNext ? ' is-next' : '') + '">' +
        '<div class="race-img">' + img +
          '<span class="round">R' + esc(r.round) + '</span>' +
          (isNext ? '<span class="nextflag">Nächstes</span>' : '') +
        '</div>' +
        '<div class="race-body">' +
          '<div class="race-name">' + esc(r.name) + '</div>' +
          '<div class="race-circuit">' + esc(r.circuit) + '</div>' +
          '<div class="race-loc">📍 ' + esc(r.location) + ', ' + esc(r.country) + '</div>' +
          '<div class="race-foot">' + foot + '</div>' +
        '</div>' +
      '</article>'
    );
  }).join("");

  /* ---------- Saison-Tabs + WM ---------- */
  const tabs = document.getElementById("seasonTabs");
  tabs.innerHTML = SEASONS.map(s =>
    '<button class="season-tab' + (s === CURRENT ? ' active' : '') + '" data-season="' + s + '">' + s + '</button>'
  ).join("");

  function renderStandings(s) {
    const se = DATA.seasons[s];
    document.getElementById("drvSeason").textContent = s;
    document.getElementById("conSeason").textContent = s;
    document.getElementById("winSeason").textContent = s;

    // Fahrer
    document.getElementById("driverList").innerHTML = se.driverStandings.map((d, i) =>
      '<div class="std-row' + (i === 0 ? ' leader' : '') + '">' +
        '<div class="std-pos">' + d.position + '</div>' +
        '<div class="std-main">' +
          '<span class="std-flag">' + flag(d.nationality) + '</span>' +
          '<div style="min-width:0">' +
            '<div class="std-name">' + esc(d.name) + (d.code ? ' <span style="color:var(--muted2);font-size:12px">' + esc(d.code) + '</span>' : '') + '</div>' +
            '<div class="std-team"><span class="team-dot" style="background:' + teamColor(d.team) + '"></span>' + esc(d.team) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="std-wins">' + (d.wins || 0) + ' Siege</div>' +
        '<div class="std-pts">' + d.points + '<small>PUNKTE</small></div>' +
      '</div>'
    ).join("");

    // Konstrukteure
    document.getElementById("conList").innerHTML = se.constructorStandings.map((c, i) =>
      '<div class="std-row' + (i === 0 ? ' leader' : '') + '">' +
        '<div class="std-pos">' + c.position + '</div>' +
        '<div class="std-main">' +
          '<span class="std-flag"><span class="team-dot" style="background:' + teamColor(c.name) + ';width:14px;height:14px"></span></span>' +
          '<div style="min-width:0"><div class="std-name">' + esc(c.name) + '</div>' +
          '<div class="std-team">' + (c.wins || 0) + ' Rennsiege</div></div>' +
        '</div>' +
        '<div class="std-pts">' + c.points + '<small>PUNKTE</small></div>' +
      '</div>'
    ).join("");

    // Rennsieger
    document.getElementById("winnersGrid").innerHTML = se.races.map(r => {
      if (r.completed) {
        return '<div class="win-item done">' +
          '<span class="w-round">R' + esc(r.round) + '</span>' +
          '<div class="w-body"><div class="w-race">' + esc(r.name) + '</div>' +
          '<div class="w-winner">' + flag(r.winnerNationality || "") + ' <b>' + esc(r.winner) + '</b></div></div>' +
        '</div>';
      }
      return '<div class="win-item">' +
        '<span class="w-round">R' + esc(r.round) + '</span>' +
        '<div class="w-body"><div class="w-race">' + esc(r.name) + '</div>' +
        '<div class="w-winner" style="color:var(--muted2)">' + fmtShort(raceDT(r)) + '</div></div>' +
        '<span class="w-pending">Geplant</span>' +
      '</div>';
    }).join("");
  }

  tabs.addEventListener("click", e => {
    const btn = e.target.closest(".season-tab");
    if (!btn) return;
    tabs.querySelectorAll(".season-tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderStandings(btn.dataset.season);
  });

  renderStandings(CURRENT);
})();
