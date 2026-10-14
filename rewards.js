/* =========================
   EcoQuest - rewards.js
   Rewards shop: spend EcoPoints to redeem rewards.
   Needs script.js loaded first (uses state, $, fmt, saveState,
   renderStats, addActivity, showToast).
========================= */

const rewards = [
    { id: "bottle", icon: "🥤", title: "Reusable Bottle", desc: "Steel water bottle for your daily campus use.", cost: 500 },
    { id: "coupon", icon: "🎟️", title: "Canteen Coupon", desc: "Discount voucher for the college canteen.", cost: 700 },
    { id: "sapling", icon: "🌱", title: "Free Sapling", desc: "Take home a sapling to plant and grow.", cost: 900 },
    { id: "cert", icon: "📜", title: "Eco Certificate", desc: "Digital certificate for your green efforts.", cost: 1500 },
    { id: "tshirt", icon: "👕", title: "Eco T-Shirt", desc: "Organic cotton EcoQuest t-shirt.", cost: 2000 },
    { id: "pass", icon: "🎫", title: "Event Priority Pass", desc: "Skip the queue at the next eco event.", cost: 2800 },
];

/* ---------- Draw the reward cards ---------- */
function renderRewards() {
    const grid = $("#rewards-grid");
    if (!grid) return;

    state.redeemed = state.redeemed || [];
    $("#rewards-points").textContent = fmt(state.points);

    grid.innerHTML = "";

    rewards.forEach((r) => {
        const done = state.redeemed.includes(r.id);
        const canAfford = state.points >= r.cost;

        const card = document.createElement("div");
        card.className = "reward-card" + (done ? " redeemed" : "");
        card.innerHTML = `
            <div class="reward-icon">${r.icon}</div>
            <h3></h3>
            <p></p>
            <div class="reward-cost">⭐ ${fmt(r.cost)} points</div>
            <button class="reward-btn"></button>
        `;
        $("h3", card).textContent = r.title;
        $("p", card).textContent = r.desc;

        const btn = $(".reward-btn", card);
        if (done) {
            btn.textContent = "Redeemed ✓";
            btn.disabled = true;
        } else if (!canAfford) {
            btn.textContent = `Need ${fmt(r.cost - state.points)} more`;
            btn.disabled = true;
        } else {
            btn.textContent = "Redeem";
            btn.addEventListener("click", () => redeemReward(r.id));
        }

        grid.appendChild(card);
    });
}

/* ---------- Spend points ---------- */
function redeemReward(id) {
    const r = rewards.find((x) => x.id === id);
    state.redeemed = state.redeemed || [];

    if (!r || state.redeemed.includes(id) || state.points < r.cost) return;

    state.points -= r.cost;
    state.redeemed.push(id);

    addActivity(`Redeemed ${r.title}`, `Spent ${fmt(r.cost)} EcoPoints`, r.icon, {
        type: "reward",
        xp: -r.cost,
        id: `reward-${r.id}`
    });
    showToast(`🎁 ${r.title} redeemed!`);

    saveState();
    renderStats(); // updates points everywhere and re-draws rewards
}

renderRewards();