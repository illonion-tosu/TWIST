import { delay } from "../_shared/core/utils.js"

// Builds beatmaps.json for one pool in _data/mappools.json:
//   [{ id, name, maps: [{ id, label, title, artist, difficulty, beatmapId, mods, isTiebreaker }] }]
// Output: { roundName, beatmaps: [...] } where roundName is the pool's id (SF, QF, F...)
// and each beatmap is the osu! API v1 response plus label / mod / isTiebreaker.

let osuApi
let pools = []

async function getApi() {
    const apiResponse = await fetch("../_data/osu-api.json")
    const apiResponseJson = await apiResponse.json()
    osuApi = apiResponseJson.api
}

async function getPools() {
    const response = await fetch("../_data/mappools.json")
    pools = await response.json()
    if (!Array.isArray(pools) || !pools.length) throw new Error("mappools.json has no pools")

    const poolEl = document.getElementById("pool")
    pools.forEach(pool => poolEl.add(new Option(`${pool.name} (${pool.maps?.length ?? 0} maps)`, pool.id)))
}

function getModNumber(mods) {
    let modNumber = 0
    if (mods.includes("HR")) modNumber += 16
    if (mods.includes("EZ")) modNumber += 2
    if (mods.includes("DT")) modNumber += 64
    return modNumber
}

async function getBeatmaps(pool) {
    const allBeatmapsJson = []

    for (const map of pool.maps ?? []) {
        const mods = String(map.mods ?? "NM").trim().toUpperCase() || "NM"

        // Get API response
        const osuMapResponse = await fetch(`https://osu.ppy.sh/api/get_beatmaps?k=${osuApi}&b=${map.beatmapId}&mods=${getModNumber(mods)}`)
        await delay(1000)
        const osuMapResponseJson = await osuMapResponse.json()
        if (!Array.isArray(osuMapResponseJson) || !osuMapResponseJson[0]) {
            console.warn(`No beatmap found for ${map.label} (${map.beatmapId}), skipping`)
            continue
        }
        allBeatmapsJson.push({
            ...osuMapResponseJson[0],
            label: map.label,
            mod: mods,
            isTiebreaker: Boolean(map.isTiebreaker),
        })
    }

    const jsonString = JSON.stringify({ roundName: pool.id, beatmaps: allBeatmapsJson }, null, 4)
    const blob = new Blob([jsonString], { type: "application/json" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "beatmaps.json"
    link.click()
}

async function initialise() {
    const pool = pools.find(p => p.id === document.getElementById("pool").value)
    if (!pool) return
    const buttonEl = document.getElementById("button")
    buttonEl.disabled = true
    try {
        await getApi()
        await getBeatmaps(pool)
    } finally {
        buttonEl.disabled = false
    }
}

document.addEventListener("DOMContentLoaded", () => {
    getPools().catch(error => console.error("Could not load mappools.json:", error))
    document.getElementById("button").addEventListener("click", initialise)
})
