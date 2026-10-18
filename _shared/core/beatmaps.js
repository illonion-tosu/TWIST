import { constants } from "../js/constants.js"

let allBeatmaps = []

// Load beatmaps: the tiles come from mappools.json (label + mods), and the osu! stats
// (CS / AR / OD / SR / cover) are filled in from beatmaps.json when the map is in there
export async function loadBeatmaps() {
    const [mappoolsResponse, statsResult] = await Promise.all([
        axios.get(constants.MAPPOOLS_PATH),
        axios.get(constants.BEATMAPS_PATH).catch(error => {
            console.warn("Could not load beatmaps.json, cards will have no osu! stats:", error)
            return null
        }),
    ])

    const pools = mappoolsResponse.data
    const pool = pools.find(p => p.id === constants.ACTIVE_MAPPOOL_ID) ?? pools[0]
    if (!pool) throw new Error("mappools.json has no pools")

    const statsById = new Map((statsResult?.data?.beatmaps ?? []).map(b => [Number(b.beatmap_id), b]))

    const beatmaps = pool.maps.map(map => {
        const stats = statsById.get(Number(map.beatmapId)) ?? {}
        const mods = String(map.mods ?? "NM").toUpperCase()
        return {
            ...stats,
            beatmap_id: String(map.beatmapId),
            label: map.label,
            mod: mods,
            isTiebreaker: Boolean(map.isTiebreaker),
            artist: map.artist ?? stats.artist ?? "",
            title: map.title ?? stats.title ?? "",
            version: map.difficulty ?? stats.version ?? "",
        }
    })

    allBeatmaps = {
        roundName: statsResult?.data?.roundName ?? pool.name,
        poolName: pool.name,
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

export function findShowcaseBeatmap(songName, difficultyName, mapper) {
    return showcaseBeatmaps.beatmaps.find(beatmap => beatmap.songName === songName && beatmap.difficultyName === difficultyName && beatmap.mapper === mapper)
}