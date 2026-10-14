/* =========================================================
   ECOQUEST - LEADERBOARD
   Reads the public  leaderboard/{uid}  collection:
       { name, xp, level, missionsCompleted, updatedAt }

   Ranking = lifetime XP from completed missions, so spending
   points on rewards never lowers anyone's rank.

   Why a separate collection instead of reading "users"?
   users/{uid} holds private data (email). Anyone who can read
   it can read every player's email. leaderboard/{uid} holds
   only what the board displays.
   ========================================================= */

import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    query,
    orderBy,
    limit,
    where,
    getCountFromServer,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";


const TOP_N = 50;


/* =========================================================
   HELPERS
   ========================================================= */

const $ = id => document.getElementById(id);

const fmt = n => Number(n || 0).toLocaleString("en-IN");



function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function initials(name) {

    return String(name || "?")
        .trim()
        .split(/\s+/)
        .map(w => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "?";
}


function levelLine(level) {

    const title = typeof window.getLevelTitle === "function"
        ? window.getLevelTitle(level)
        : "";

    return title ? `Level ${level} · ${title}` : `Level ${level}`;
}


/* =========================================================
   MY STATS  (computed from the user's own missions)
   ========================================================= */

async function computeMyStats(db, user) {

    const missionSnap = await getDocs(
        collection(db, "users", user.uid, "missions")
    );

    let xp = 0;
    let missionsCompleted = 0;

    missionSnap.forEach(d => {

        const m = d.data();

        if (m.status === "completed") {
            missionsCompleted++;
            xp += Number(m.xp || 0);
        }
    });

    const userSnap = await getDoc(doc(db, "users", user.uid));
    const profile = userSnap.exists() ? userSnap.data() : {};

    return {
        uid: user.uid,
        name: profile.name || user.displayName || "Eco Explorer",
        level: Number(profile.level || 1),
        xp,
        missionsCompleted
    };
}


/* Keep leaderboard/{uid} in step with the real numbers. This also
   backfills players who finished missions before the leaderboard
   existed. Players with 0 XP are not listed. */
async function syncMyEntry(db, mine) {

    if (mine.xp <= 0) return;

    const ref = doc(db, "leaderboard", mine.uid);
    const existing = await getDoc(ref);
    const data = existing.exists() ? existing.data() : null;

    const upToDate =
        data &&
        data.name === mine.name &&
        Number(data.xp) === mine.xp &&
        Number(data.level) === mine.level &&
        Number(data.missionsCompleted) === mine.missionsCompleted;

    if (upToDate) return;

    try {

        await setDoc(ref, {
            name: mine.name,
            xp: mine.xp,
            level: mine.level,
            missionsCompleted: mine.missionsCompleted,
            updatedAt: serverTimestamp()
        }, { merge: true });

    } catch (error) {

        console.warn("Could not update your leaderboard entry:", error);
    }
}


/* =========================================================
   LOAD
   ========================================================= */

async function fetchBoard(db) {

    const board = collection(db, "leaderboard");

    const [topSnap, totalSnap] = await Promise.all([
        getDocs(query(board, orderBy("xp", "desc"), limit(TOP_N))),
        getCountFromServer(board)
    ]);

    const players = [];

    topSnap.forEach(d => {

        const p = d.data();

        players.push({
            uid: d.id,
            name: p.name || "Eco Explorer",
            xp: Number(p.xp || 0),
            level: Number(p.level || 1),
            missionsCompleted: Number(p.missionsCompleted || 0)
        });
    });

    /* Standard competition ranking: equal XP shares a rank (1,2,2,4) */
    players.forEach((p, i) => {

        p.rank = i > 0 && p.xp === players[i - 1].xp
            ? players[i - 1].rank
            : i + 1;
    });

    return {
        players,
        total: totalSnap.data().count
    };
}


async function rankOutsideTop(db, xp) {

    const snap = await getCountFromServer(
        query(collection(db, "leaderboard"), where("xp", ">", xp))
    );

    return snap.data().count + 1;
}


/* =========================================================
   RENDER: YOUR RANK CARD
   ========================================================= */

function renderMyRank(mine, board, myRank) {

    const el = $("myRank");

    if (!el) return;

    if (!mine) {

        el.innerHTML = `
            <div class="my-rank-body" style="grid-column:1/-1">
                <strong>Log in to see your rank</strong>
                <p>Your position on the leaderboard appears here.</p>
            </div>`;
        return;
    }

    if (mine.xp <= 0) {

        el.innerHTML = `
            <div class="my-rank-body" style="grid-column:1/-1">
                <strong>You're not on the leaderboard yet</strong>
                <p>Complete your first mission to earn XP and join the ranking.</p>
                <a class="my-rank-cta" href="missions.html">Find a mission</a>
            </div>`;
        return;
    }

    const { players, total } = board;
    const idx = players.findIndex(p => p.uid === mine.uid);

    let message;
    let progress = 100;

    if (myRank === 1) {

        const runnerUp = players.find(p => p.uid !== mine.uid);

        if (!runnerUp) {
            message = "You're the first player on the board.";
        } else if (runnerUp.xp === mine.xp) {
            message = `You're tied for first with ${escapeHTML(runnerUp.name)}.`;
        } else {
            message = `You're in the lead, ${fmt(mine.xp - runnerUp.xp)} XP ahead of ${escapeHTML(runnerUp.name)}.`;
        }

    } else {

        /* nearest player with more XP than me */
        const above = [...players]
            .filter(p => p.xp > mine.xp)
            .sort((a, b) => a.xp - b.xp)[0];

        if (above && idx !== -1) {

            message = `${fmt(above.xp - mine.xp)} XP to pass ${escapeHTML(above.name)} (#${above.rank}).`;
            progress = Math.min(100, (mine.xp / above.xp) * 100);

        } else {

            /* ranked below the top list */
            const last = players[players.length - 1];

            message = last
                ? `${fmt(Math.max(0, last.xp - mine.xp + 1))} XP to reach the top ${TOP_N}.`
                : "Keep completing missions to climb.";

            progress = last ? Math.min(100, (mine.xp / last.xp) * 100) : 0;
        }
    }

    el.innerHTML = `
        <div class="my-rank-number">
            <small>Your rank</small>
            <strong>#${myRank}</strong>
            <span>of ${fmt(Math.max(total, myRank))} players</span>
        </div>
        <div class="my-rank-body">
            <strong>${escapeHTML(mine.name)}</strong>
            <p>${message}</p>
            <div class="my-rank-bar" role="progressbar"
                 aria-valuemin="0" aria-valuemax="100"
                 aria-valuenow="${Math.round(progress)}">
                <div style="width:${progress}%"></div>
            </div>
        </div>
        <div class="my-rank-xp">
            <small>Total XP</small>
            <strong>${fmt(mine.xp)} XP</strong>
        </div>`;
}


/* =========================================================
   RENDER: PODIUM
   ========================================================= */

function podiumCard(player, place, uid) {

    const cls = ["first", "second", "third"][place - 1];
    const label = `#${player ? player.rank : place}`;

    if (!player) {

        return `
            <div class="podium-card ${cls} empty">
                <div class="rank-number">#${place}</div>
                <div class="avatar">?</div>
                <h3>Open spot</h3>
                <p class="level-line">Could be you</p>
            </div>`;
    }

    const isMe = player.uid === uid;

    return `
        <div class="podium-card ${cls}${isMe ? " is-me" : ""}">
            ${place === 1 ? '<div class="crown"><i class="fa-solid fa-crown"></i></div>' : ""}
            <div class="rank-number">${label}</div>
            <div class="avatar">${escapeHTML(initials(player.name))}</div>
            <h3>${escapeHTML(player.name)}${isMe ? '<span class="you-tag">YOU</span>' : ""}</h3>
            <p class="level-line">${escapeHTML(levelLine(player.level))}</p>
            <div class="score">${fmt(player.xp)} <span>XP</span></div>
        </div>`;
}


function renderPodium(players, uid) {

    const el = $("podium");

    if (!el) return;

    if (!players.length) {
        el.innerHTML = "";
        return;
    }

    /* visual order: 2nd, 1st, 3rd */
    el.innerHTML =
        podiumCard(players[1], 2, uid) +
        podiumCard(players[0], 1, uid) +
        podiumCard(players[2], 3, uid);
}


/* =========================================================
   RENDER: TABLE
   ========================================================= */

function renderTable(board, uid) {

    const rows = $("leaderboardRows");
    const summary = $("rankingSummary");

    if (!rows) return;

    const { players, total } = board;
    const rest = players.slice(3);

    if (summary) {

        summary.textContent = total
            ? `Showing ${Math.min(players.length, TOP_N)} of ${fmt(total)} players`
            : "No players yet";
    }

    if (!players.length) {

        rows.innerHTML = `
            <div class="leaderboard-state">
                No one is on the leaderboard yet. Complete a mission to be the first!
            </div>`;
        return;
    }

    if (!rest.length) {

        rows.innerHTML = `
            <div class="leaderboard-state">
                More players will show up here as they join.
            </div>`;
        return;
    }

    rows.innerHTML = rest.map(p => {

        const isMe = p.uid === uid;

        return `
            <div class="leaderboard-row${isMe ? " me" : ""}">
                <div class="rank">${p.rank}</div>
                <div class="player">
                    <div class="small-avatar">${escapeHTML(initials(p.name))}</div>
                    <div>
                        <strong>${escapeHTML(p.name)}${isMe ? '<span class="you-tag">YOU</span>' : ""}</strong>
                        <small>${escapeHTML(levelLine(p.level))}</small>
                    </div>
                </div>
                <div class="missions-count">${fmt(p.missionsCompleted)}</div>
                <div class="xp">${fmt(p.xp)} XP</div>
            </div>`;
    }).join("");
}


function renderError(error) {

    const rows = $("leaderboardRows");
    const card = $("myRank");

    const denied = error?.code === "permission-denied";

    if (card) card.innerHTML = "";
    if ($("podium")) $("podium").innerHTML = "";

    if (rows) {

        rows.innerHTML = `
            <div class="leaderboard-state">
                Couldn't load the leaderboard.
                <div><button type="button" id="retryLeaderboard">Try again</button></div>
                ${denied
                ? "<small>Firestore rules don't allow reading the leaderboard collection yet.</small>"
                : ""}
            </div>`;

        $("retryLeaderboard")?.addEventListener("click", load);
    }
}


/* =========================================================
   MAIN
   ========================================================= */
/* =========================================================
   DASHBOARD RANK CARD  (index.html: #rank + #rankSubtitle)
   Lightweight path: no top-50 list, just two count queries.
   ========================================================= */

let loading = false;


async function load() {

    const { db, auth } = window.e9coQuestFirebase || {};

    if (!db || !auth) {
        console.error("Firebase bridge not found.");
        return;
    }

    const user = auth.currentUser;

    if (!user) {
        renderMyRank(null);
        return;
    }

    if (loading) return;

    loading = true;

    try {

        const mine = await computeMyStats(db, user);

        await syncMyEntry(db, mine);
        /* Dashboard: only the rank card needs updating */


        const board = await fetchBoard(db);

        let myRank = 0;

        if (mine.xp > 0) {

            const entry = board.players.find(p => p.uid === mine.uid);

            myRank = entry
                ? entry.rank
                : await rankOutsideTop(db, mine.xp);
        }

        renderMyRank(mine, board, myRank);
        renderPodium(board.players, mine.uid);
        renderTable(board, mine.uid);

    } catch (error) {

        console.error("Leaderboard failed to load:", error);
        if ($("leaderboardRows")) {
            renderError(error);
        } else {
            setDashboardRank("#--", "Rank unavailable");
        }

    } finally {

        loading = false;
    }
}


function init() {

    const { auth } = window.ecoQuestFirebase || {};

    if (!auth) {
        console.error("Firebase bridge not found.");
        return;
    }

    /* Runs on page load and again after login / logout */
    auth.onAuthStateChanged(load);
}


init();
