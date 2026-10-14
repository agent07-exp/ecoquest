/* =========================================================
   ECOQUEST - MISSIONS
   Firebase Mission System
   ========================================================= */

import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
    runTransaction
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";


/* =========================================================
   CONFIG
   ========================================================= */

const RECOMMENDED_COUNT = 3;

let db = null;
let auth = null;

let currentMission = null;
let allMissions = [];
let userMissions = {};

let recommendedMissions = [];
let showAllMissions = false;


/* =========================================================
   FIREBASE
   ========================================================= */

function getFirebase() {

    if (!window.ecoQuestFirebase) {
        console.error("Firebase bridge not found.");
        return false;
    }

    db = window.ecoQuestFirebase.db;
    auth = window.ecoQuestFirebase.auth;

    return !!(db && auth);
}


/* =========================================================
   HELPERS
   ========================================================= */

function shuffle(array) {

    const copy = [...array];

    for (let i = copy.length - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1));

        [copy[i], copy[j]] =
            [copy[j], copy[i]];
    }

    return copy;
}


function getCurrentUser() {

    return auth?.currentUser || null;
}


function showToast(message) {

    if (typeof window.showToast === "function") {
        window.showToast(message);
    } else {
        alert(message);
    }
}


function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   LOAD MISSIONS FROM FIRESTORE
   ========================================================= */

async function loadMissionPool() {

    if (!db) return;

    try {

        const snapshot =
            await getDocs(collection(db, "missions"));

        allMissions = [];

        snapshot.forEach(docSnap => {

            const data = docSnap.data();

            if (data.active === false) {
                return;
            }

            allMissions.push({
                id: docSnap.id,
                ...data
            });
        });

        console.log(
            `Loaded ${allMissions.length} missions from Firebase.`
        );

    } catch (error) {

        console.error(
            "Failed to load missions:",
            error
        );

        showToast(
            "Unable to load missions."
        );
    }
}


/* =========================================================
   LOAD USER MISSIONS
   ========================================================= */

async function loadUserMissions() {

    const user = getCurrentUser();

    if (!user || !db) {
        userMissions = {};
        return;
    }

    try {

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "users",
                    user.uid,
                    "missions"
                )
            );

        userMissions = {};

        snapshot.forEach(docSnap => {

            userMissions[docSnap.id] =
                docSnap.data();
        });

    } catch (error) {

        console.error(
            "Failed to load user missions:",
            error
        );

        userMissions = {};
    }
}


/* =========================================================
   AVAILABLE MISSIONS
   ========================================================= */

function getAvailableMissions() {

    return allMissions.filter(mission => {

        const userMission =
            userMissions[mission.id];

        if (!userMission) {
            return true;
        }

        if (userMission.status === "completed") {
            return false;
        }

        if (userMission.status === "active") {
            return false;
        }

        return true;
    });
}


/* =========================================================
   ACTIVE MISSION
   ========================================================= */

function getActiveMission() {

    for (const mission of allMissions) {

        const userMission =
            userMissions[mission.id];

        if (
            userMission &&
            userMission.status === "active"
        ) {
            return mission;
        }
    }

    return null;
}


/* =========================================================
   MISSION CONTAINER
   ========================================================= */

function getMissionContainer() {

    const missionsSection =
        document.getElementById("missions");

    if (!missionsSection) {
        return null;
    }

    let container =
        document.getElementById(
            "firebaseMissionList"
        );

    if (!container) {

        container =
            document.createElement("div");

        container.id =
            "firebaseMissionList";

        container.className =
            "firebase-mission-list";

        missionsSection.appendChild(container);
    }

    return container;
}


/* =========================================================
   HIDE OLD STATIC CARDS
   ========================================================= */

function hideOldMissionCards() {

    const cards =
        document.querySelectorAll(
            "#missions .mission-card:not(.firebase-card)"
        );

    cards.forEach(card => {

        card.style.display = "none";
    });
}


/* =========================================================
   BUILD MISSION CARD
   ========================================================= */

function buildFirebaseMissionCard(
    mission,
    status = "available"
) {

    const card =
        document.createElement("div");

    card.className =
        "mission-card firebase-card";

    const icon =
        mission.icon ||
        "fa-leaf";

    const xp =
        Number(mission.xp || 0);

    const difficulty =
        mission.difficulty ||
        "Easy";

    const deadline =
        mission.deadline ||
        "No deadline";

    const isActive =
        status === "active";

    card.innerHTML = `

        <div class="mission-card-top">

            <div class="mission-icon">

                <i class="fa-solid ${escapeHTML(icon)}"></i>

            </div>

            <span class="mission-status">
                ${isActive
            ? "Active mission"
            : "Recommended"
        }
            </span>

        </div>


        <h3>
            ${escapeHTML(mission.title)}
        </h3>


        <p>
            ${escapeHTML(mission.description)}
        </p>


        <div class="mission-meta">

            <span>
                <i class="fa-solid fa-star"></i>
                ${xp} XP
            </span>

            <span>
                <i class="fa-solid fa-signal"></i>
                ${escapeHTML(difficulty)}
            </span>

        </div>


        <div class="mission-deadline">

            <i class="fa-regular fa-clock"></i>

            ${escapeHTML(deadline)}

        </div>


        <button
            type="button"
            class="mission-start-btn firebase-mission-btn"
            data-mission-id="${escapeHTML(mission.id)}"
        >

            ${isActive
            ? "Continue Mission"
            : "Start Mission"
        }

            <i class="fa-solid fa-arrow-right"></i>

        </button>

    `;

    const button =
        card.querySelector(
            ".firebase-mission-btn"
        );

    button.addEventListener("click", () => {
        console.log("Clicked mission:", mission.id);
        console.log("Loaded missions:", allMissions.length);
        openMission(mission.id);
    });

    return card;
}


/* =========================================================
   RENDER MISSION CARDS
   ========================================================= */

function renderMissionCards() {

    const container =
        getMissionContainer();

    if (!container) {
        return;
    }

    hideOldMissionCards();

    container.innerHTML = "";

    const active =
        getActiveMission();


    /* -----------------------------------------------------
       ACTIVE MISSION
       ----------------------------------------------------- */

    if (active) {

        const heading =
            document.createElement("h3");

        heading.className =
            "mission-group-title";

        heading.textContent =
            "Your Active Mission";

        container.appendChild(heading);

        container.appendChild(
            buildFirebaseMissionCard(
                active,
                "active"
            )
        );
    }


    /* -----------------------------------------------------
       AVAILABLE MISSIONS
       ----------------------------------------------------- */

    const available = getAvailableMissions();

    let missionsToShow = [];

    if (showAllMissions) {

        // VIEW ALL = literally all missions from Firebase
        missionsToShow = allMissions.filter(
            mission => mission.active !== false
        );

    } else {

        // RECOMMENDED = only missions the user hasn't completed
        recommendedMissions =
            shuffle(available)
                .slice(0, RECOMMENDED_COUNT);

        missionsToShow = recommendedMissions;
    }

    /* -----------------------------------------------------
       DISPLAY AVAILABLE
       ----------------------------------------------------- */

    if (missionsToShow.length) {

        const heading =
            document.createElement("h3");

        heading.className =
            "mission-group-title";

        heading.textContent =
            active
                ? "Choose Your Next Mission"
                : showAllMissions
                    ? "All Available Missions"
                    : "Recommended Missions";

        container.appendChild(heading);


        const grid =
            document.createElement("div");

        grid.className =
            "mission-recommendations";


        missionsToShow.forEach(
            mission => {

                grid.appendChild(
                    buildFirebaseMissionCard(
                        mission,
                        "available"
                    )
                );

            }
        );


        container.appendChild(grid);
    }


    /* -----------------------------------------------------
       NOTHING LEFT
       ----------------------------------------------------- */

    if (
        !active &&
        !missionsToShow.length
    ) {

        const empty =
            document.createElement("div");

        empty.className =
            "mission-empty";

        empty.textContent =
            "You've completed every available mission. New missions coming soon.";

        container.appendChild(empty);
    }
}


/* =========================================================
   VIEW ALL BUTTON
   ========================================================= */

function setupViewAllMissions() {

    const button =
        document.getElementById(
            "viewAllMissionsBtn"
        );

    if (!button) {
        console.warn(
            "viewAllMissionsBtn not found."
        );
        return;
    }

    button.onclick = () => {

        showAllMissions =
            !showAllMissions;

        renderMissionCards();


        if (showAllMissions) {

            button.innerHTML = `
                Show recommended
                <i class="fa-solid fa-arrow-left"></i>
            `;

        } else {

            button.innerHTML = `
                View all
                <i class="fa-solid fa-arrow-right"></i>
            `;
        }
    };
}


/* =========================================================
   OPEN MISSION DETAILS
   ========================================================= */

function openMission(missionId) {

    const mission =
        allMissions.find(
            item => item.id === missionId
        );

    if (!mission) {

        console.error(
            "Mission not found:",
            missionId
        );

        showToast(
            "Mission not found."
        );

        return;
    }


    currentMission =
        missionId;


    const setText = (
        id,
        value
    ) => {

        const element =
            document.getElementById(id);

        if (element) {
            element.textContent =
                value ?? "";
        }
    };


    setText(
        "missionDetailsCategory",
        mission.category ||
        mission.difficulty ||
        "Mission"
    );

    setText(
        "missionDetailsTitle",
        mission.title
    );

    setText(
        "missionDetailsDescription",
        mission.description
    );

    setText(
        "missionDetailsXP",
        `${Number(mission.xp || 0)} XP`
    );

    setText(
        "missionDetailsDifficulty",
        mission.difficulty ||
        "Easy"
    );

    setText(
        "missionDetailsDeadline",
        mission.deadline ||
        "No deadline"
    );

    setText(
        "missionDetailsPeople",
        mission.people ||
        "0"
    );


    const missionsSection =
        document.getElementById(
            "missions"
        );

    const detailsSection =
        document.getElementById(
            "missionDetails"
        );

    const proofSection =
        document.getElementById(
            "proof"
        );


    if (detailsSection) {
        detailsSection.hidden =
            false;
        detailsSection.style.display =
            "block";
    }

    if (proofSection) {
        proofSection.hidden =
            true;
        proofSection.style.display =
            "none";
    }


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/* =========================================================
   CLOSE MISSION
   ========================================================= */

function closeMission() {

    currentMission = null;


    const missionsSection =
        document.getElementById(
            "missions"
        );

    const detailsSection =
        document.getElementById(
            "missionDetails"
        );

    const proofSection =
        document.getElementById(
            "proof"
        );


    if (missionsSection) {

        missionsSection.style.display =
            "";
    }

    if (detailsSection) {

        detailsSection.hidden =
            true;

        detailsSection.style.display =
            "none";
    }

    if (proofSection) {

        proofSection.hidden =
            true;

        proofSection.style.display =
            "none";
    }
}


/* =========================================================
   START MISSION
   ========================================================= */

async function startMission(missionId) {

    const user =
        getCurrentUser();

    if (!user) {

        showToast(
            "Please login first."
        );

        return false;
    }


    const mission =
        allMissions.find(
            item => item.id === missionId
        );

    if (!mission) {

        showToast(
            "Mission not found."
        );

        return false;
    }


    const existingActive =
        getActiveMission();

    if (
        existingActive &&
        existingActive.id !== missionId
    ) {

        showToast(
            "Finish your current mission first."
        );

        return false;
    }


    const missionRef =
        doc(
            db,
            "users",
            user.uid,
            "missions",
            missionId
        );


    try {

        await setDoc(
            missionRef,
            {
                missionId: mission.id,

                title:
                    mission.title || "",

                xp:
                    Number(mission.xp || 0),

                status:
                    "active",

                startedAt:
                    serverTimestamp(),

                completedAt:
                    null,

                proofSubmitted:
                    false
            },
            {
                merge: true
            }
        );


        userMissions[missionId] = {

            missionId: mission.id,

            title:
                mission.title || "",

            xp:
                Number(mission.xp || 0),

            status:
                "active",

            startedAt:
                new Date(),

            completedAt:
                null,

            proofSubmitted:
                false
        };


        currentMission =
            missionId;


        renderMissionCards();

        return true;

    } catch (error) {

        console.error(
            "Failed to start mission:",
            error
        );

        showToast(
            "Could not start mission."
        );

        return false;
    }
}


/* =========================================================
   BEGIN MISSION
   ========================================================= */

async function beginMission() {

    if (!currentMission) {

        showToast(
            "No mission selected."
        );

        return;
    }


    const mission =
        allMissions.find(
            item => item.id === currentMission
        );

    if (!mission) {

        showToast(
            "Mission not found."
        );

        return;
    }


    const active =
        getActiveMission();


    if (
        active &&
        active.id !== mission.id
    ) {

        showToast(
            "Finish your active mission first."
        );

        return;
    }


    const alreadyActive =
        userMissions[mission.id]?.status ===
        "active";


    if (!alreadyActive) {

        const started =
            await startMission(
                mission.id
            );

        if (!started) {
            return;
        }
    }


    const detailsSection =
        document.getElementById(
            "missionDetails"
        );

    const missionsSection =
        document.getElementById(
            "missions"
        );

    const proofSection =
        document.getElementById(
            "proof"
        );


    if (detailsSection) {

        detailsSection.hidden =
            true;

        detailsSection.style.display =
            "none";
    }

    if (proofSection) {

        proofSection.hidden =
            false;

        proofSection.style.display =
            "block";
    }


    ensureCompleteButton();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/* =========================================================
   COMPLETE BUTTON
   ========================================================= */

function ensureCompleteButton() {

    const proofSection =
        document.getElementById(
            "proof"
        );

    if (!proofSection) {
        return;
    }


    let button =
        document.getElementById(
            "firebaseCompleteMission"
        );


    if (!button) {

        button =
            document.createElement("button");

        button.id =
            "firebaseCompleteMission";

        button.type =
            "button";

        button.className =
            "mission-start-btn";

        button.innerHTML = `
            <i class="fa-solid fa-check"></i>
            Complete Mission
        `;


        const actions =
            proofSection.querySelector(
                ".proof-actions"
            );

        if (actions) {

            actions.appendChild(button);

        } else {

            proofSection.appendChild(button);
        }
    }


    button.onclick =
        completeCurrentMission;
}


/* =========================================================
   PHOTO PREVIEW
   ========================================================= */

function setupPhotoPreview() {

    const input =
        document.getElementById(
            "missionPhoto"
        );

    const preview =
        document.getElementById(
            "photoPreview"
        );

    const image =
        document.getElementById(
            "previewImage"
        );

    const name =
        document.getElementById(
            "previewName"
        );

    const removeButton =
        document.getElementById(
            "removePhoto"
        );


    if (!input) {
        return;
    }


    input.onchange =
        () => {

            const file =
                input.files?.[0];

            if (!file) {
                return;
            }


            if (!file.type.startsWith("image/")) {

                showToast(
                    "Please select an image."
                );

                input.value = "";

                return;
            }


            if (
                file.size >
                5 * 1024 * 1024
            ) {

                showToast(
                    "Image must be smaller than 5MB."
                );

                input.value = "";

                return;
            }


            const reader =
                new FileReader();


            reader.onload =
                event => {

                    if (image) {

                        image.src =
                            event.target.result;
                    }

                    if (name) {

                        name.textContent =
                            file.name;
                    }

                    if (preview) {

                        preview.hidden =
                            false;

                        preview.style.display =
                            "flex";
                    }
                };


            reader.readAsDataURL(file);
        };


    if (removeButton) {

        removeButton.onclick =
            () => {

                input.value = "";

                if (image) {
                    image.src = "";
                }

                if (name) {
                    name.textContent =
                        "Selected photo";
                }

                if (preview) {

                    preview.hidden =
                        true;

                    preview.style.display =
                        "none";
                }
            };
    }
}


/* =========================================================
   GET REFLECTION VALUES
   ========================================================= */

function getReflectionValues() {

    const experience =
        document.getElementById(
            "missionExperience"
        );

    const impact =
        document.getElementById(
            "missionImpact"
        );

    const pride =
        document.getElementById(
            "missionPride"
        );


    return {

        experience:
            experience?.value || "",

        impact:
            impact?.value || "",

        pride:
            pride?.value || ""
    };
}


/* =========================================================
   COMPLETE MISSION
   ========================================================= */

async function completeCurrentMission() {

    const user =
        getCurrentUser();

    if (!user) {

        showToast(
            "Please login first."
        );

        return;
    }


    if (!currentMission) {

        showToast(
            "No active mission."
        );

        return;
    }


    const mission =
        allMissions.find(
            item => item.id === currentMission
        );


    if (!mission) {

        showToast(
            "Mission not found."
        );

        return;
    }


    const photoInput =
        document.getElementById(
            "missionPhoto"
        );


    if (
        !photoInput ||
        !photoInput.files ||
        photoInput.files.length === 0
    ) {

        showToast(
            "Please upload proof of your mission."
        );

        return;
    }


    const reflection =
        getReflectionValues();


    if (!reflection.experience) {

        showToast(
            "Please answer the experience question."
        );

        return;
    }


    if (!reflection.impact) {

        showToast(
            "Please answer the impact question."
        );

        return;
    }


    if (!reflection.pride) {

        showToast(
            "Please rate how proud you feel."
        );

        return;
    }


    const missionId =
        mission.id;

    const xp =
        Number(mission.xp || 0);


    const missionRef =
        doc(
            db,
            "missions",
            missionId
        );

    const userMissionRef =
        doc(
            db,
            "users",
            user.uid,
            "missions",
            missionId
        );

    const userRef =
        doc(
            db,
            "users",
            user.uid
        );

    const leaderboardRef =
        doc(
            db,
            "leaderboard",
            user.uid
        );


    /* Lifetime totals for the public leaderboard (this mission included) */

    const completedBefore =
        Object.values(userMissions)
            .filter(item => item.status === "completed");

    const lifetimeXP =
        completedBefore.reduce(
            (sum, item) => sum + Number(item.xp || 0),
            0
        ) + xp;

    const lifetimeMissions =
        completedBefore.length + 1;


    const button =
        document.getElementById(
            "firebaseCompleteMission"
        );


    if (button) {

        button.disabled =
            true;

        button.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Completing...
        `;
    }


    try {

        let updatedUserData = null;

        let previousLevel = null;


        await runTransaction(
            db,
            async transaction => {

                const [
                    userSnap,
                    missionSnap,
                    userMissionSnap
                ] =
                    await Promise.all([

                        transaction.get(
                            userRef
                        ),

                        transaction.get(
                            missionRef
                        ),

                        transaction.get(
                            userMissionRef
                        )
                    ]);


                if (!missionSnap.exists()) {

                    throw new Error(
                        "Mission no longer exists."
                    );
                }


                if (
                    !userMissionSnap.exists()
                ) {

                    throw new Error(
                        "Mission was not started."
                    );
                }


                const userMissionData =
                    userMissionSnap.data();


                if (
                    userMissionData.status ===
                    "completed"
                ) {

                    throw new Error(
                        "Mission is already completed."
                    );
                }


                const userData =
                    userSnap.exists()
                        ? userSnap.data()
                        : {};


                const oldPoints =
                    Number(
                        userData.points || 0
                    );

                const oldWeekly =
                    Number(
                        userData.weekly || 0
                    );

                const oldLevel =
                    Number(
                        userData.level || 1
                    );

                const oldLevelMax =
                    Number(
                        userData.levelMax || 500
                    );


                const newPoints =
                    oldPoints + xp;

                const newWeekly =
                    oldWeekly + xp;


                let newLevel =
                    oldLevel;

                let newLevelMax =
                    oldLevelMax;


                while (
                    newPoints >= newLevelMax
                ) {

                    newLevel++;

                    newLevelMax += 500;
                }


                transaction.update(
                    userMissionRef,
                    {

                        status:
                            "completed",

                        completedAt:
                            serverTimestamp(),

                        proofSubmitted:
                            true,

                        reflection: {

                            experience:
                                reflection.experience,

                            impact:
                                reflection.impact,

                            pride:
                                Number(
                                    reflection.pride
                                )
                        }
                    }
                );


                transaction.set(
                    userRef,
                    {

                        points:
                            newPoints,

                        weekly:
                            newWeekly,

                        level:
                            newLevel,

                        levelMax:
                            newLevelMax

                    },
                    {
                        merge: true
                    }
                );


                transaction.set(
                    leaderboardRef,
                    {

                        name:
                            userData.name ||
                            user.displayName ||
                            "Eco Explorer",

                        xp:
                            lifetimeXP,

                        level:
                            newLevel,

                        missionsCompleted:
                            lifetimeMissions,

                        updatedAt:
                            serverTimestamp()

                    },
                    {
                        merge: true
                    }
                );


                updatedUserData = {

                    points:
                        newPoints,

                    weekly:
                        newWeekly,

                    level:
                        newLevel,

                    levelMax:
                        newLevelMax
                };
            }
        );


        /* -------------------------------------------------
           UPDATE LOCAL DATA
           ------------------------------------------------- */

        userMissions[missionId] = {

            ...userMissions[missionId],

            missionId:
                missionId,

            title:
                mission.title,

            xp:
                xp,

            status:
                "completed",

            completedAt:
                new Date(),

            proofSubmitted:
                true,

            reflection
        };


        if (
            window.state &&
            updatedUserData
        ) {

            window.state.points =
                updatedUserData.points;

            window.state.weekly =
                updatedUserData.weekly;

            previousLevel =
                window.state.level;

            window.state.level =
                updatedUserData.level;

            window.state.levelMax =
                updatedUserData.levelMax;


            if (
                typeof window.saveState ===
                "function"
            ) {
                window.saveState();
            }

            if (
                typeof window.renderStats ===
                "function"
            ) {
                window.renderStats();
            }
        }


        if (
            typeof window.addActivity ===
            "function"
        ) {

            window.addActivity(
                mission.title,
                "Mission completed",
                "🎯",
                {
                    type: "mission",
                    xp: xp,
                    id: `mission-${missionId}-completed`
                }
            );

            if (
                updatedUserData &&
                previousLevel !== null &&
                updatedUserData.level > previousLevel
            ) {

                window.addActivity(
                    `Reached Level ${updatedUserData.level}`,
                    "Level up",
                    "⬆️",
                    {
                        type: "level",
                        id: `level-${updatedUserData.level}`
                    }
                );
            }
        }


        showToast(
            `Mission completed! +${xp} XP`
        );


        /* -------------------------------------------------
           RESET FORM
           ------------------------------------------------- */

        resetProofForm();


        /* -------------------------------------------------
           RETURN TO MISSIONS
           ------------------------------------------------- */

        currentMission =
            null;


        const proofSection =
            document.getElementById(
                "proof"
            );

        const missionsSection =
            document.getElementById(
                "missions"
            );


        if (proofSection) {

            proofSection.hidden =
                true;

            proofSection.style.display =
                "none";
        }


        if (missionsSection) {

            missionsSection.style.display =
                "";
        }


        await loadUserMissions();

        renderMissionCards();

        renderMissionHistory();


        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });


    } catch (error) {

        console.error(
            "Mission completion failed:",
            error
        );


        showToast(
            error.message ||
            "Could not complete mission."
        );


        if (button) {

            button.disabled =
                false;

            button.innerHTML = `
                <i class="fa-solid fa-check"></i>
                Complete Mission
            `;
        }
    }
}


/* =========================================================
   RESET PROOF FORM
   ========================================================= */

function resetProofForm() {

    const input =
        document.getElementById(
            "missionPhoto"
        );

    const preview =
        document.getElementById(
            "photoPreview"
        );

    const image =
        document.getElementById(
            "previewImage"
        );

    const name =
        document.getElementById(
            "previewName"
        );

    const experience =
        document.getElementById(
            "missionExperience"
        );

    const impact =
        document.getElementById(
            "missionImpact"
        );

    const pride =
        document.getElementById(
            "missionPride"
        );


    if (input) {
        input.value = "";
    }


    if (image) {
        image.src = "";
    }


    if (name) {
        name.textContent =
            "Selected photo";
    }


    if (preview) {

        preview.hidden =
            true;

        preview.style.display =
            "none";
    }


    if (experience) {
        experience.value = "";
    }


    if (impact) {
        impact.value = "";
    }


    if (pride) {
        pride.value = "";
    }
}


/* =========================================================
   MISSION HISTORY
   ========================================================= */

function renderMissionHistory() {

    const historyContainer =
        document.getElementById(
            "missionHistory"
        );

    if (!historyContainer) {
        return;
    }


    const completed =
        allMissions.filter(
            mission =>
                userMissions[
                    mission.id
                ]?.status ===
                "completed"
        );


    if (!completed.length) {

        historyContainer.innerHTML = `

            <div class="mission-empty">

                <i class="fa-solid fa-clock-rotate-left"></i>

                <p>
                    No completed missions yet.
                </p>

            </div>

        `;

        return;
    }


    historyContainer.innerHTML = `

        <div class="mission-history-list">

            ${completed.map(mission => {

        const userMission =
            userMissions[
            mission.id
            ];

        return `

                    <div class="mission-history-item">

                        <div class="mission-history-icon">

                            <i class="fa-solid ${escapeHTML(
            mission.icon ||
            "fa-leaf"
        )
            }"></i>

                        </div>


                        <div class="mission-history-info">

                            <h4>
                                ${escapeHTML(
                mission.title
            )}
                            </h4>

                            <span>
                                Completed
                            </span>

                        </div>


                        <strong>
                            +${Number(
                userMission?.xp ||
                mission.xp ||
                0
            )} XP
                        </strong>

                    </div>

                `;

    }).join("")}

        </div>

    `;
}


/* =========================================================
   SEARCH
   ========================================================= */

function setupMissionSearch() {

    const input =
        document.getElementById(
            "missionSearch"
        );

    if (!input) {
        return;
    }


    input.oninput =
        () => {

            const query =
                input.value
                    .trim()
                    .toLowerCase();


            const cards =
                document.querySelectorAll(
                    "#firebaseMissionList .mission-card"
                );


            cards.forEach(card => {

                const text =
                    card.textContent
                        .toLowerCase();


                card.style.display =
                    text.includes(query)
                        ? ""
                        : "none";
            });
        };
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initMissions() {

    if (!getFirebase()) {
        return;
    }


    /* -----------------------------------------------------
       Wait for Firebase Auth
       ----------------------------------------------------- */

    let user =
        getCurrentUser();


    if (!user) {

        await new Promise(resolve => {

            let finished =
                false;


            const timeout =
                setTimeout(() => {

                    if (!finished) {

                        finished = true;

                        resolve();
                    }

                }, 3000);


            const unsubscribe =
                auth.onAuthStateChanged(
                    currentUser => {

                        if (finished) {
                            return;
                        }

                        finished = true;

                        clearTimeout(
                            timeout
                        );

                        unsubscribe();

                        user =
                            currentUser;

                        resolve();
                    }
                );

        });
    }


    if (!user) {

        console.warn(
            "No logged-in user."
        );

        renderMissionCards();

        setupViewAllMissions();

        setupMissionSearch();

        setupPhotoPreview();

        return;
    }


    /* -----------------------------------------------------
       Load Firebase data
       ----------------------------------------------------- */

    await loadMissionPool();

    await loadUserMissions();


    /* -----------------------------------------------------
       Render
       ----------------------------------------------------- */

    renderMissionCards();

    renderMissionHistory();


    /* -----------------------------------------------------
       Setup UI
       ----------------------------------------------------- */

    setupMissionSearch();

    setupViewAllMissions();

    setupPhotoPreview();

    ensureCompleteButton();


    console.log(
        "EcoQuest missions initialized."
    );
}


/* =========================================================
   GLOBAL FUNCTIONS
   ========================================================= */

window.openMission =
    openMission;

window.closeMission =
    closeMission;

window.beginMission =
    beginMission;

window.completeMission =
    completeCurrentMission;

window.startMission =
    startMission;

window.renderMissionHistory =
    renderMissionHistory;


/* =========================================================
   START
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initMissions
    );

} else {

    initMissions();
} 