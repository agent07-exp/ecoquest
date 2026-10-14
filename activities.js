/* =========================================================
   ECOQUEST - ACTIVITIES
   Timeline built from two sources, merged by id:
     1. Firestore  users/{uid}/missions  (completed + in-progress missions)
     2. Local      state.activities      (rewards, level-ups, anything
                                          recorded through addActivity)
   ========================================================= */

import {
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";


/* =========================================================
   STATE
   ========================================================= */

let remoteActivities = [];   // from Firestore
let currentUid = null;
let activeFilter = "all";
let searchTerm = "";
let loaded = false;


/* =========================================================
   HELPERS
   ========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* Firestore Timestamp | Date | ISO string | millis  ->  millis (or 0) */
function toMillis(value) {

    if (!value) return 0;

    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value.toDate === "function") return value.toDate().getTime();

    const ms = new Date(value).getTime();

    return Number.isNaN(ms) ? 0 : ms;
}


function startOfDay(ms) {

    const d = new Date(ms);

    d.setHours(0, 0, 0, 0);

    return d.getTime();
}


function dayLabel(ms) {

    const today = startOfDay(Date.now());
    const day = startOfDay(ms);
    const diff = Math.round((today - day) / 86400000);

    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";

    return new Date(ms).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: diff > 300 ? "numeric" : undefined
    });
}


function timeLabel(ms) {

    return new Date(ms).toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit"
    });
}


/* =========================================================
   TYPES
   ========================================================= */

const TYPE_ICON = {
    mission: "fa-bullseye",
    reward: "fa-gift",
    level: "fa-arrow-up",
    other: "fa-leaf"
};


function normalizeType(type) {

    return TYPE_ICON[type] ? type : "other";
}


/* =========================================================
   LOAD: LOCAL
   ========================================================= */

function getLocalActivities() {

    const list = window.state?.activities;

    if (!Array.isArray(list)) return [];

    return list
        /* Never show another account's local events */
        .filter(item => !item.uid || !currentUid || item.uid === currentUid)
        .map(item => ({
            id: item.id || `local-${item.timestamp}-${item.title}`,
            type: normalizeType(item.type),
            title: item.title || "Eco activity",
            description: item.description || "",
            xp: Number(item.xp || 0),
            ts: toMillis(item.timestamp)
        }));
}


/* =========================================================
   LOAD: FIRESTORE
   ========================================================= */

async function loadRemoteActivities(user) {

    const { db } = window.ecoQuestFirebase || {};

    if (!db || !user) return [];

    const snapshot = await getDocs(
        collection(db, "users", user.uid, "missions")
    );

    const items = [];

    snapshot.forEach(docSnap => {

        const data = docSnap.data();
        const missionId = docSnap.id;
        const title = data.title || "Mission";

        if (data.status === "completed") {

            items.push({
                id: `mission-${missionId}-completed`,
                type: "mission",
                title,
                description: "Mission completed",
                xp: Number(data.xp || 0),
                ts: toMillis(data.completedAt) || toMillis(data.startedAt)
            });

        } else if (data.status === "active") {

            items.push({
                id: `mission-${missionId}-started`,
                type: "mission",
                title,
                description: "Mission in progress",
                xp: 0,
                pending: true,
                ts: toMillis(data.startedAt)
            });
        }
    });

    return items;
}


/* =========================================================
   MERGE
   ========================================================= */

function getAllActivities() {

    const byId = new Map();

    /* Local first, Firestore second: the server copy wins on a clash */
    [...getLocalActivities(), ...remoteActivities].forEach(item => {

        byId.set(item.id, item);
    });

    return [...byId.values()]
        .filter(item => item.ts > 0)
        .sort((a, b) => b.ts - a.ts);
}


/* =========================================================
   STATS
   ========================================================= */

function renderStats(all) {

    const set = (id, value) => {

        const el = document.getElementById(id);

        if (el) el.textContent = value;
    };

    const completed = all.filter(
        item => item.type === "mission" && !item.pending
    );

    const weekAgo = Date.now() - 7 * 86400000;

    set("statTotal", all.length.toLocaleString("en-IN"));
    set("statMissions", completed.length.toLocaleString("en-IN"));
    set("statXP", completed.reduce((sum, i) => sum + i.xp, 0).toLocaleString("en-IN"));
    set("statWeek", all.filter(i => i.ts >= weekAgo).length.toLocaleString("en-IN"));
}


/* =========================================================
   FEED
   ========================================================= */

function amountHTML(item) {

    if (item.pending) {
        return `<span class="activity-amount pending">In progress</span>`;
    }

    if (item.type === "reward" && item.xp !== 0) {
        return `<span class="activity-amount spent">−${Math.abs(item.xp).toLocaleString("en-IN")} pts</span>`;
    }

    if (item.xp > 0) {
        return `<span class="activity-amount">+${item.xp.toLocaleString("en-IN")} XP</span>`;
    }

    return "";
}


function rowHTML(item) {

    return `
        <div class="activity-row" data-type="${item.type}">
            <div class="activity-badge">
                <i class="fa-solid ${TYPE_ICON[item.type]}"></i>
            </div>
            <div class="activity-info">
                <h3>${escapeHTML(item.title)}</h3>
                <p>${escapeHTML(item.description)}</p>
            </div>
            <div class="activity-side">
                ${amountHTML(item)}
                <span class="activity-time">${timeLabel(item.ts)}</span>
            </div>
        </div>
    `;
}


function emptyHTML(hasAny) {

    if (hasAny) {

        return `
            <div class="activity-empty">
                <i class="fa-solid fa-magnifying-glass"></i>
                <h3>Nothing matches</h3>
                <p>Try a different search or filter.</p>
            </div>
        `;
    }

    return `
        <div class="activity-empty">
            <i class="fa-solid fa-seedling"></i>
            <h3>No activity yet</h3>
            <p>Start a mission and your progress will show up here.</p>
            <a href="missions.html">Browse missions</a>
        </div>
    `;
}


function render() {

    const feed = document.getElementById("activityFeed");

    if (!feed) return;

    const all = getAllActivities();

    renderStats(all);

    if (!loaded) return;

    const term = searchTerm.trim().toLowerCase();

    const visible = all.filter(item => {

        if (activeFilter !== "all" && item.type !== activeFilter) {
            return false;
        }

        if (!term) return true;

        return (
            item.title.toLowerCase().includes(term) ||
            item.description.toLowerCase().includes(term)
        );
    });

    if (!visible.length) {
        feed.innerHTML = emptyHTML(all.length > 0);
        return;
    }

    /* Group by calendar day (list is already newest-first) */

    const groups = [];

    visible.forEach(item => {

        const day = startOfDay(item.ts);
        const last = groups[groups.length - 1];

        if (last && last.day === day) {
            last.items.push(item);
        } else {
            groups.push({ day, items: [item] });
        }
    });

    feed.innerHTML = groups.map(group => `
        <h3 class="activity-day">${dayLabel(group.day)}</h3>
        <div class="activity-group">
            ${group.items.map(rowHTML).join("")}
        </div>
    `).join("");
}


/* =========================================================
   CONTROLS
   ========================================================= */

function setupControls() {

    const search = document.getElementById("activitySearch");

    search?.addEventListener("input", () => {

        searchTerm = search.value;
        render();
    });

    const bar = document.getElementById("activityFilters");

    bar?.addEventListener("click", event => {

        const chip = event.target.closest(".chip");

        if (!chip) return;

        activeFilter = chip.dataset.filter || "all";

        bar.querySelectorAll(".chip").forEach(c => {

            const on = c === chip;

            c.classList.toggle("active", on);
            c.setAttribute("aria-selected", String(on));
        });

        render();
    });
}


/* =========================================================
   AUTH + INIT
   ========================================================= */

async function refreshForUser(user) {

    currentUid = user?.uid || null;
    remoteActivities = [];

    if (user) {

        try {
            remoteActivities = await loadRemoteActivities(user);
        } catch (error) {
            console.error("Could not load mission activity:", error);
        }
    }

    loaded = true;

    render();
}


function initActivities() {

    setupControls();

    /* Lets script.js refresh this page when addActivity() runs */
    window.refreshActivities = render;

    const { auth } = window.ecoQuestFirebase || {};

    if (!auth) {
        console.error("Firebase bridge not found.");
        refreshForUser(null);
        return;
    }

    /* Fires on page load and again if the user logs in or out */
    auth.onAuthStateChanged(refreshForUser);
}


initActivities();
