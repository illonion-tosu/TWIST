import { constants } from "../js/constants.js"
import { truncateSVGText } from "./utils.js"

// CountUp number that animates to whatever value it's given
export const createCounter = element =>
    new CountUp(element, 0, 0, 0, constants.COUNT_UP_DURATION, constants.COUNT_UP_OPTIONS)

// Set an SVG team name and shorten it to fit the gameplay layout
export function setTeamName(element, name) {
    element.textContent = name
    truncateSVGText(element, constants.GAMEPLAY_TEAM_NAME_MAX_WIDTH)
}

// Show / hide everything with the .toggle-hp class
export function setToggleHpVisible(visible) {
    for (const element of document.getElementsByClassName("toggle-hp")) {
        element.style.opacity = visible ? 1 : 0
    }
}

// Now playing elements, looked up once
export function getNowPlayingElements() {
    const byId = id => document.getElementById(`now-playing-${id}`)
    return {
        background: byId("background"),
        mod: byId("mod"),
        artistTitle: byId("artist-title"),
        version: byId("version"),
        cs: byId("stats-cs"),
        ar: byId("stats-ar"),
        od: byId("stats-od"),
        sr: byId("stats-sr"),
    }
}

// Background image, artist - title and [difficulty] straight from tosu's beatmap + directPath
export function setNowPlayingMetadata(els, beatmap, directPath) {
    const background = directPath?.beatmapBackground
    if (background) {
        const url = `${window.location.origin}/Songs/${background}`
        els.background.style.backgroundImage = `url("${encodeURI(url.replaceAll("\\", "/"))}")`
    } else {
        els.background.style.backgroundImage = "none"
    }

    els.artistTitle.textContent = `${beatmap.artist} - ${beatmap.title}`
    els.version.textContent = `[${beatmap.version}]`
}

// CS / AR / OD / SR labels
export function setNowPlayingStats(els, { cs, ar, od, sr }) {
    els.cs.textContent = `CS: ${Number(cs).toFixed(1)}`
    els.ar.textContent = `AR: ${Number(ar).toFixed(1)}`
    els.od.textContent = `OD: ${Number(od).toFixed(1)}`
    els.sr.textContent = `SR: ${Number(sr).toFixed(2)}`
}

// Same, from tosu's own (converted) stats
export const setNowPlayingStatsFromTosu = (els, stats) => setNowPlayingStats(els, {
    cs: stats.cs.converted,
    ar: stats.ar.converted,
    od: stats.od.converted,
    sr: stats.stars.total,
})
