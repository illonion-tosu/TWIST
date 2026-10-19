import { constants } from "../js/constants.js"

let allBeatmaps = []

// Load beatmaps
export async function loadBeatmaps() {
    const response = await axios.get(constants.BEATMAPS_PATH)
    allBeatmaps = response.data
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

// Match a showcase map. Prefer the beatmap id when the entry has one, otherwise song + difficulty + mapper.
export function findShowcaseBeatmap(songName, difficultyName, mapper, beatmapId) {
    const maps = showcaseBeatmaps.beatmaps ?? []
    const byId = beatmapId ? maps.find(beatmap => Number(beatmap.beatmap_id) === Number(beatmapId)) : undefined
    return byId ?? maps.find(beatmap => beatmap.songName === songName && beatmap.difficultyName === difficultyName && beatmap.mapper === mapper)
}