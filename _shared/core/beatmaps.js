import { constants } from "../js/constants.js"

let allBeatmaps = { roundName: "", beatmaps: [] }

// Load beatmaps from beatmaps.json: { roundName, beatmaps: [...] }.
// Each map carries its pool slot (label / mod / isTiebreaker) next to the osu! API v1 fields
// (diff_size, diff_approach, diff_overall, difficultyrating, bpm, total_length, beatmapset_id...).
export async function loadBeatmaps() {
    const response = await axios.get(constants.BEATMAPS_PATH)
    const data = response.data ?? {}
    if (!Array.isArray(data.beatmaps)) throw new Error("beatmaps.json has no \"beatmaps\" list")

    const seen = new Set()
    const beatmaps = []
    data.beatmaps.forEach((map, index) => {
        const id = String(map?.beatmap_id ?? "").trim()
        if (!id) {
            console.warn(`beatmaps.json entry ${index + 1} has no beatmap_id and was skipped.`)
            return
        }
        if (seen.has(id)) {
            console.warn(`beatmaps.json lists beatmap ${id} twice: only the first one is used.`)
            return
        }
        seen.add(id)

        const mod = String(map.mod ?? "NM").trim().toUpperCase() || "NM"
        if (!map.label) console.warn(`beatmaps.json beatmap ${id} has no label.`)
        beatmaps.push({
            ...map,
            beatmap_id: id,
            beatmapset_id: map.beatmapset_id === undefined || map.beatmapset_id === null ? "" : String(map.beatmapset_id),
            label: String(map.label ?? `${mod}${index + 1}`),
            mod,
            isTiebreaker: Boolean(map.isTiebreaker),
            artist: map.artist ?? "",
            title: map.title ?? "",
            version: map.version ?? "",
        })
    })

    allBeatmaps = {
        roundName: typeof data.roundName === "string" ? data.roundName : "",
        beatmaps,
    }
    return allBeatmaps
}

// Find beatmap from Id
export function findBeatmap(id) {
    return allBeatmaps.beatmaps.find(b => Number(b.beatmap_id) === Number(id))
}

let showcaseBeatmaps = []

// Load showcase beatmaps
export async function loadShowcaseBeatmaps() {
    const response = await axios.get(constants.SHOWCASE_BEATMAPS_PATH)
    showcaseBeatmaps = response.data
    return showcaseBeatmaps
}

function normalise(value) {
    return String(value ?? "").normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase()
}

export function findShowcaseBeatmap(artist, title, difficultyName) {
    const maps = showcaseBeatmaps.beatmaps ?? []
    const wanted = { artist: normalise(artist), title: normalise(title), difficulty: normalise(difficultyName) }

    return maps.find(beatmap =>
        normalise(beatmap.title) === wanted.title &&
        normalise(beatmap.version) === wanted.difficulty &&
        (!normalise(beatmap.artist) || normalise(beatmap.artist) === wanted.artist)
    )
}