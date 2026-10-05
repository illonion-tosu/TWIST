let allBeatmaps = []

// Load beatmaps
export async function loadBeatmaps() {
    const response = await axios.get("../_data/beatmaps.json")
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
    const response = await axios.get("../_data/showcase-beatmaps.json")
    showcaseBeatmaps = response.data
    return showcaseBeatmaps
}

export function findShowcaseBeatmap(songName, difficultyName, mapper) {
    return showcaseBeatmaps.beatmaps.find(beatmap => beatmap.songName === songName && beatmap.difficultyName === difficultyName && beatmap.mapper === mapper)
}