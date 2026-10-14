/* =========================================================
   EcoQuest - script.js
   Firebase + shared EcoQuest state
========================================================= */

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";


/* =========================================================
   FIREBASE CONFIG
========================================================= */

const firebaseConfig = {
    apiKey: "AIzaSyCpX8Fs3BRfk6_dPsBoixNRDR0lVd7UFVw",
    authDomain: "ecoquest-3a4f4.firebaseapp.com",
    projectId: "ecoquest-3a4f4",
    storageBucket: "ecoquest-3a4f4.firebasestorage.app",
    messagingSenderId: "751787364955",
    appId: "1:751787364955:web:21e2333a026557fe12e57e",
    measurementId: "G-GHP1YHPDYE"
};


/* =========================================================
   FIREBASE INITIALIZATION
========================================================= */

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);


/* =========================================================
   SHARED DOM HELPERS
========================================================= */

window.$ = (selector, parent = document) => {
    return parent.querySelector(selector);
};

window.$$ = (selector, parent = document) => {
    return [...parent.querySelectorAll(selector)];
};
/* =========================================================
   EXPOSE FIREBASE SERVICES TO OTHER MODULES
========================================================= */

window.ecoQuestFirebase = {
    db,
    auth
};
window.renderStats = renderStats;
/* =========================================================
   LOCAL ECOQUEST STATE
========================================================= */

const STORAGE_KEY = "ecoquest-state-v1";

const defaultState = {
    points: 2450,
    weekly: 180,
    level: 12,
    levelMax: 3000,
    missions: {},
    activities: [],
    seenNotifications: false
};

let state = loadState();

window.state = state;


function loadState() {

    try {

        const saved =
            JSON.parse(
                localStorage.getItem(STORAGE_KEY)
            );

        return saved
            ? {
                ...defaultState,
                ...saved
            }
            : {
                ...defaultState
            };

    } catch (error) {

        console.warn(
            "Could not load EcoQuest state:",
            error
        );

        return {
            ...defaultState
        };
    }
}


function saveState() {

    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(state)
        );

    } catch (error) {

        console.warn(
            "Could not save EcoQuest state:",
            error
        );
    }
}

window.saveState = saveState;


/* =========================================================
   FORMATTER
========================================================= */

function fmt(value) {

    return Number(value || 0)
        .toLocaleString("en-US");

}


/* =========================================================
   TOAST
========================================================= */

const toastStyle =
    document.createElement("style");

toastStyle.textContent = `
.eq-toast {
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 9999;
    background: #1f2a24;
    color: #fff;
    padding: 14px 20px;
    border-radius: 14px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 10px 30px rgba(0,0,0,.2);
    opacity: 0;
    transform: translateY(12px);
    transition: opacity .3s, transform .3s;
    pointer-events: none;
}

.eq-toast.show {
    opacity: 1;
    transform: translateY(0);
}

.mission-card.done {
    opacity: .75;
}

.continue-btn:disabled {
    cursor: default;
    opacity: .7;
}
`;

document.head.appendChild(toastStyle);


let toastTimer;


function showToast(message) {

    let toast =
        document.querySelector(".eq-toast");

    if (!toast) {

        toast =
            document.createElement("div");

        toast.className = "eq-toast";

        document.body.appendChild(toast);
    }

    toast.textContent = message;

    void toast.offsetWidth;

    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer =
        setTimeout(() => {

            toast.classList.remove("show");

        }, 2600);
}

window.showToast = showToast;


/* =========================================================
   LEVEL SYSTEM
========================================================= */

function getLevelTitle(level) {

    const titles = {

        1: "Seedling",
        2: "Sprout",
        3: "Eco Explorer",
        4: "Green Guardian",
        5: "Eco Warrior",
        6: "Planet Protector",
        7: "Earth Champion",
        8: "Eco Legend",
        9: "Nature Master",
        10: "Earth Hero"

    };

    return titles[level] || "Eco Beginner";
}

window.getLevelTitle = getLevelTitle;


/* =========================================================
   RENDER DASHBOARD STATS
   Safe for missions.html
========================================================= */

function renderStats() {

    /* -------------------------
       Points card
    ------------------------- */

    const pointsElement =
        document.getElementById("points");

    if (pointsElement) {

        pointsElement.textContent =
            fmt(state.points);

        const parent =
            pointsElement.parentElement;

        const weekly =
            parent?.querySelector("small");

        if (weekly) {

            weekly.textContent =
                `+${fmt(state.weekly)} this week`;
        }
    }


    /* -------------------------
       Level header
    ------------------------- */

    const levelHeader =
        document.querySelector(".level-header h2");

    if (levelHeader) {

        levelHeader.textContent =
            `Level ${state.level}`;
    }


    /* -------------------------
       Level XP
    ------------------------- */

    const levelXP =
        document.querySelector(
            ".level-progress-top strong"
        );

    if (levelXP) {

        levelXP.textContent =
            `${fmt(state.points)} / ${fmt(state.levelMax)} XP`;
    }


    /* -------------------------
       Level progress bar
    ------------------------- */

    const levelBar =
        document.querySelector(
            ".level-progress .progress div"
        );

    if (levelBar) {

        const pct =
            Math.min(
                100,
                (state.points / state.levelMax) * 100
            );

        levelBar.style.width =
            `${pct}%`;
    }


    /* -------------------------
       Next level
    ------------------------- */

    const nextLevel =
        document.querySelector(".next-level");

    if (nextLevel) {

        const remaining =
            Math.max(
                0,
                state.levelMax - state.points
            );

        nextLevel.innerHTML =
            `${fmt(remaining)} XP until <strong>Green Champion</strong> 🚀`;
    }


    /* -------------------------
       Leaderboard
    ------------------------- */

    const currentLeader =
        document.querySelector(
            ".leader.current .leader-points"
        );

    if (currentLeader) {

        currentLeader.textContent =
            fmt(state.points);
    }


    /* -------------------------
       Rewards
    ------------------------- */

    if (
        typeof window.renderRewards ===
        "function"
    ) {

        window.renderRewards();
    }
}


/* =========================================================
   ADD POINTS
========================================================= */

function addPoints(xp) {

    xp = Number(xp) || 0;

    if (xp <= 0) return;

    state.points += xp;
    state.weekly += xp;


    /* Level up */

    while (
        state.points >= state.levelMax
    ) {

        state.level += 1;

        state.levelMax += 500;

        showToast(
            `🎉 Level up! You're now Level ${state.level}`
        );
    }


    renderStats();

    saveState();
}

window.addPoints = addPoints;


/* =========================================================
   ACTIVITY
========================================================= */

/*
   Records an activity in state.activities (shown on activities.html)
   and, if a .activity-list feed exists on the page, prepends it there.

   meta (optional): { type: "mission" | "reward" | "level",
                      xp: number (negative = points spent),
                      id: string (use a stable id to avoid duplicates) }
*/
function addActivity(
    title,
    subtitle,
    icon = "🌱",
    meta = {}
) {

    if (typeof icon !== "string") {
        icon = "🌱";
    }

    const entry = {
        id: meta.id ||
            `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: meta.type || "other",
        title: String(title ?? ""),
        description: String(subtitle ?? ""),
        xp: Number(meta.xp || 0),
        uid: window.ecoQuestFirebase?.auth?.currentUser?.uid || null,
        timestamp: new Date().toISOString()
    };

    if (!Array.isArray(state.activities)) {
        state.activities = [];
    }

    if (!state.activities.some(item => item.id === entry.id)) {

        state.activities.unshift(entry);

        state.activities.length =
            Math.min(state.activities.length, 100);

        saveState();
    }

    if (typeof window.refreshActivities === "function") {
        window.refreshActivities();
    }


    const list =
        document.querySelector(".activity-list");

    if (!list) return;


    const item =
        document.createElement("div");

    item.className = "activity";


    item.innerHTML = `
        <div class="activity-icon">
            ${icon}
        </div>

        <div>
            <strong></strong>
            <p></p>
        </div>

        <span>Just now</span>
    `;


    const strong =
        item.querySelector("strong");

    const paragraph =
        item.querySelector("p");


    if (strong) {
        strong.textContent = title;
    }

    if (paragraph) {
        paragraph.textContent = subtitle;
    }


    list.prepend(item);


    while (list.children.length > 6) {

        list.lastElementChild.remove();
    }
}

window.addActivity = addActivity;


/* =========================================================
   SIDEBAR
========================================================= */

function toggleSidebar() {

    const sidebar =
        document.querySelector(".sidebar");

    if (!sidebar) return;

    sidebar.classList.toggle("open");
}

window.toggleSidebar = toggleSidebar;


/* Close mobile sidebar */

document.addEventListener(
    "click",
    (event) => {

        const sidebar =
            document.querySelector(".sidebar");

        if (!sidebar) return;

        if (!sidebar.classList.contains("open")) {
            return;
        }

        const clickedLink =
            event.target.closest(
                ".sidebar nav a"
            );

        const clickedInside =
            event.target.closest(
                ".sidebar"
            );

        const clickedMenu =
            event.target.closest(
                ".menu-btn"
            );

        if (
            clickedLink ||
            (
                !clickedInside &&
                !clickedMenu
            )
        ) {

            sidebar.classList.remove("open");
        }
    }
);


/* =========================================================
   NAVIGATION HIGHLIGHT
========================================================= */

document
    .querySelectorAll(".sidebar nav a")
    .forEach(link => {

        link.addEventListener(
            "click",
            () => {

                document
                    .querySelectorAll(
                        ".sidebar nav a"
                    )
                    .forEach(a =>
                        a.classList.remove("active")
                    );

                link.classList.add("active");
            }
        );
    });


/* =========================================================
   SCROLL TO MISSIONS
========================================================= */

function scrollToMissions() {

    const missions =
        document.getElementById("missions");

    if (!missions) return;

    missions.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

window.scrollToMissions =
    scrollToMissions;


/* =========================================================
   NOTIFICATIONS
========================================================= */

function setupNotifications() {

    const bell =
        document.querySelector(
            ".notification"
        );

    if (!bell) return;

    const badge =
        bell.querySelector("span");

    if (
        state.seenNotifications &&
        badge
    ) {

        badge.style.display = "none";
    }


    bell.addEventListener(
        "click",
        () => {

            if (badge) {
                badge.style.display = "none";
            }

            state.seenNotifications = true;

            saveState();

            showToast(
                "🔔 You're all caught up!"
            );
        }
    );
}


/* =========================================================
   ECO TIPS
========================================================= */

function setupEcoTips() {

    const tipText =
        document.querySelector(
            ".eco-tip p"
        );

    if (!tipText) return;


    const tips = [

        "Switch off lights when leaving a classroom.",

        "Carry a reusable water bottle to campus.",

        "Print double-sided to save paper.",

        "Segregate dry and wet waste before disposal.",

        "Take the stairs or cycle for short distances."

    ];


    let index = 0;


    setInterval(
        () => {

            index =
                (index + 1) %
                tips.length;

            tipText.textContent =
                tips[index];

        },
        8000
    );
}


/* =========================================================
   AUTH HELPERS
========================================================= */

function setTextSafe(
    id,
    value
) {

    const element =
        document.getElementById(id);

    if (element) {

        element.textContent =
            value;
    }
}


function getInitials(name) {

    return String(name || "User")
        .trim()
        .split(/\s+/)
        .map(word => word[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();
}


/* =========================================================
   LOAD FIREBASE USER DATA
========================================================= */

async function loadUserData(user) {

    if (!user) return;


    const userRef =
        doc(
            db,
            "users",
            user.uid
        );


    const userSnap =
        await getDoc(userRef);


    if (!userSnap.exists()) {

        console.log(
            "User document doesn't exist."
        );

        return;
    }


    const data =
        userSnap.data();


    const name =
        data.name ||
        user.displayName ||
        "Eco Explorer";


    const points =
        Number(data.points ?? 0);


    const level =
        Number(data.level ?? 1);


    /* Profile */

    setTextSafe(
        "userName",
        name
    );

    setTextSafe(
        "userAvatar",
        getInitials(name)
    );

    setTextSafe(
        "userLevel",
        getLevelTitle(level)
    );


    /* Dashboard points */

    const pointsElement =
        document.getElementById("points");

    if (pointsElement) {

        pointsElement.textContent =
            fmt(points);
    }


    /* Profile name */

    const profileName =
        document.querySelector(
            ".profile strong"
        );

    if (profileName) {

        profileName.textContent =
            name;
    }


    /* Avatar */

    const avatar =
        document.querySelector(
            ".avatar"
        );

    if (avatar) {

        avatar.textContent =
            getInitials(name);
    }


    /*
       Sync Firebase values into local state
       without destroying mission progress.
    */

    state.points = points;

    state.level = level;

    state.weekly =
        Number(data.weekly ?? state.weekly);

    state.levelMax =
        Number(data.levelMax ?? state.levelMax);


    if (data.missions) {

        state.missions = {
            ...state.missions,
            ...data.missions
        };
    }


    window.state = state;

    saveState();

    renderStats();
}


/* =========================================================
   FIREBASE REGISTRATION
========================================================= */

async function registerUser(
    name,
    email,
    password
) {

    try {

        const userCredential =
            await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );


        const user =
            userCredential.user;


        await updateProfile(
            user,
            {
                displayName: name
            }
        );


        await setDoc(
            doc(
                db,
                "users",
                user.uid
            ),
            {

                name: name,

                email: email,

                points: 0,

                weekly: 0,

                level: 1,

                levelMax: 500,

                streak: 0,

                badges: [],

                missions: {},

                createdAt: new Date()

            }
        );


        alert(
            "Account created successfully!"
        );


        hideLoginScreen();


        await loadUserData(user);

    }

    catch (error) {

        console.error(
            "Registration error:",
            error
        );

        alert(
            getFirebaseError(
                error.code
            )
        );
    }
}


/* =========================================================
   FIREBASE LOGIN
========================================================= */

async function loginUser(
    email,
    password
) {

    try {

        await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        hideLoginScreen();

    }

    catch (error) {

        console.error(
            "Login error:",
            error
        );

        alert(
            getFirebaseError(
                error.code
            )
        );
    }
}


/* =========================================================
   FIREBASE LOGOUT
========================================================= */

async function logoutUser() {

    try {

        await signOut(auth);

        console.log(
            "Logged out successfully"
        );

    }

    catch (error) {

        console.error(
            "Logout failed:",
            error
        );
    }
}


/* =========================================================
   FIREBASE ERROR MESSAGES
========================================================= */

function getFirebaseError(code) {

    switch (code) {

        case "auth/email-already-in-use":
            return "This email is already registered.";

        case "auth/invalid-email":
            return "Invalid email address.";

        case "auth/weak-password":
            return "Password must be at least 6 characters.";

        case "auth/invalid-credential":
            return "Incorrect email or password.";

        case "auth/network-request-failed":
            return "Network error. Check your internet connection.";

        default:
            return "Something went wrong. Try again.";
    }
}


/* =========================================================
   LOGIN / REGISTER SCREEN
========================================================= */

function showLoginScreen() {

    if (
        document.getElementById(
            "authOverlay"
        )
    ) {
        return;
    }


    const overlay =
        document.createElement("div");

    overlay.id = "authOverlay";


    overlay.innerHTML = `

        <div class="auth-box">

            <div class="auth-logo">
                🌱
            </div>

            <h2>
                Welcome to EcoQuest
            </h2>

            <p class="auth-subtitle">
                Learn • Play • Protect
            </p>


            <!-- LOGIN -->

            <div id="loginForm">

                <input
                    id="loginEmail"
                    type="email"
                    placeholder="Email"
                >

                <input
                    id="loginPassword"
                    type="password"
                    placeholder="Password"
                >

                <button
                    id="loginBtn"
                    type="button"
                >
                    Login
                </button>

                <p>
                    Don't have an account?

                    <button
                        class="switchAuth"
                        id="showRegister"
                        type="button"
                    >
                        Create one
                    </button>
                </p>

            </div>


            <!-- REGISTER -->

            <div
                id="registerForm"
                style="display:none"
            >

                <input
                    id="registerName"
                    type="text"
                    placeholder="Full name"
                >

                <input
                    id="registerEmail"
                    type="email"
                    placeholder="Email"
                >

                <input
                    id="registerPassword"
                    type="password"
                    placeholder="Password"
                >

                <button
                    id="registerBtn"
                    type="button"
                >
                    Create Account
                </button>

                <p>
                    Already have an account?

                    <button
                        class="switchAuth"
                        id="showLogin"
                        type="button"
                    >
                        Login
                    </button>
                </p>

            </div>

        </div>
    `;


    document.body.appendChild(
        overlay
    );


    /* LOGIN */

    document
        .getElementById("loginBtn")
        ?.addEventListener(
            "click",
            () => {

                const email =
                    document
                        .getElementById(
                            "loginEmail"
                        )
                        ?.value
                        .trim();

                const password =
                    document
                        .getElementById(
                            "loginPassword"
                        )
                        ?.value;


                if (
                    !email ||
                    !password
                ) {

                    alert(
                        "Enter email and password."
                    );

                    return;
                }


                loginUser(
                    email,
                    password
                );
            }
        );


    /* REGISTER */

    document
        .getElementById("registerBtn")
        ?.addEventListener(
            "click",
            () => {

                const name =
                    document
                        .getElementById(
                            "registerName"
                        )
                        ?.value
                        .trim();

                const email =
                    document
                        .getElementById(
                            "registerEmail"
                        )
                        ?.value
                        .trim();

                const password =
                    document
                        .getElementById(
                            "registerPassword"
                        )
                        ?.value;


                if (
                    !name ||
                    !email ||
                    !password
                ) {

                    alert(
                        "Fill all fields."
                    );

                    return;
                }


                registerUser(
                    name,
                    email,
                    password
                );
            }
        );


    /* SWITCH TO REGISTER */

    document
        .getElementById("showRegister")
        ?.addEventListener(
            "click",
            () => {

                document
                    .getElementById(
                        "loginForm"
                    )
                    .style.display =
                    "none";

                document
                    .getElementById(
                        "registerForm"
                    )
                    .style.display =
                    "block";
            }
        );


    /* SWITCH TO LOGIN */

    document
        .getElementById("showLogin")
        ?.addEventListener(
            "click",
            () => {

                document
                    .getElementById(
                        "registerForm"
                    )
                    .style.display =
                    "none";

                document
                    .getElementById(
                        "loginForm"
                    )
                    .style.display =
                    "block";
            }
        );
}

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
        </div>`;
}

let loading = false;


async function load() {

    const { db, auth } = window.ecoQuestFirebase || {};

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
        renderError(error);

    } finally {

        loading = false;
    }
}
/* =========================================================
   HIDE LOGIN
========================================================= */

function hideLoginScreen() {

    document
        .getElementById(
            "authOverlay"
        )
        ?.remove();
}


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(
    auth,
    async (user) => {

        if (!user) {

            showLoginScreen();

            return;
        }


        hideLoginScreen();


        try {

            await loadUserData(
                user
            );

        }

        catch (error) {

            console.error(
                "Could not load EcoQuest profile:",
                error
            );
        }
    }
);


/* =========================================================
   LOGOUT BUTTON
========================================================= */

function setupLogoutButtons() {

    const buttons =
        document.querySelectorAll(
            ".logout, #logoutBtn"
        );


    buttons.forEach(
        button => {

            button.addEventListener(
                "click",
                async (event) => {

                    event.preventDefault();

                    const confirmed =
                        confirm(
                            "Log out of EcoQuest?"
                        );

                    if (!confirmed) return;

                    await logoutUser();
                }
            );
        }
    );
}


/* =========================================================
   INITIALIZATION
========================================================= */

function init() {

    renderStats();

    setupNotifications();

    setupEcoTips();

    setupLogoutButtons();
}


init();