import { delay } from "../_shared/core/utils.js"

// Load osu! api
let osuApi
async function getApi() {
    const apiResponse = await fetch("../_data/osu-api.json")
    const apiResponseJson = await apiResponse.json()
    osuApi = apiResponseJson.api
}

async function getBeatmaps() {
    const allBeatmapsJson = []
    const beatmapsBaseResponse = await fetch("../_data/beatmaps-base.json")
    const beatmapsBaseResponseJson = await beatmapsBaseResponse.json()
    const allBeatmaps = beatmapsBaseResponseJson.beatmaps
    const roundName = beatmapsBaseResponseJson.roundName

    for (let i = 0; i < allBeatmaps.length; i++) {
        // Set mod number
        let modNumber = 0
        if (allBeatmaps[i].mod.includes("HR")) modNumber += 16
        if (allBeatmaps[i].mod.includes("EZ")) modNumber += 2
        if (allBeatmaps[i].mod.includes("DT")) modNumber += 64
        
        // Get API response
        const osuMapResponse = await fetch(`https://osu.ppy.sh/api/get_beatmaps?k=${osuApi}&b=${allBeatmaps[i].beatmap_id}&mods=${modNumber}`)
        await delay(1000)
        const osuMapResponseJson = await osuMapResponse.json()
        if (!osuMapResponseJson[0]) {
            console.warn(`No beatmap found for ${allBeatmaps[i].label} (${allBeatmaps[i].beatmap_id}), skipping`)
            continue
        }
        osuMapResponseJson[0].order = allBeatmaps[i].order
        osuMapResponseJson[0].mod = allBeatmaps[i].mod
        if (allBeatmaps[i].EZMultiplier) osuMapResponseJson[0].EZMultiplier = allBeatmaps[i].EZMultiplier
        
        allBeatmapsJson.push(osuMapResponseJson[0])
    }

    const fullJson = {
        "roundName": roundName,
        "beatmaps": allBeatmapsJson
    }

    const jsonString = JSON.stringify(fullJson, null, 4)
    const blob = new Blob([jsonString], { type: "application/json" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "beatmaps.json"
    link.click()
}

async function initialise() {
    await getApi()
    await getBeatmaps()
}

const buttonEl = document.getElementById("button")
document.addEventListener("DOMContentLoaded", () => {
    buttonEl.addEventListener("click", initialise)
})