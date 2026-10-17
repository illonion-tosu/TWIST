/**
 * Every tweakable value used by the overlays and the dashboard.
 *
 * Usage:
 *   import { constants } from "../_shared/js/constants.js"
 *   constants.DEFAULT_MAX_HP
 *
 * Constants following the format of
 * SCENE_ELEMENT_TYPE_INFO
 */
export const constants = Object.freeze({
    // Players & teams
    SIDES: ["red", "blue"],
    PLAYER_NUMBERS: [1, 2, 3, 4, 5, 6],
    TEAM_PLAYER_NUMBERS: { red: [1, 2, 3], blue: [4, 5, 6] },
    DEFAULT_PLAYER_ID: 123456,
    // Who each player (1-6) targets before the dashboard says otherwise
    DEFAULT_TARGETS: [6, 5, 4, 3, 2, 1],

    // HP & damage
    DEFAULT_MAX_HP: 300000,
    // Starting HP per round. Every alias is matched against the lowercase round name.
    ROUND_MAX_HP: [
        { names: ["quarterfinals", "quarter finals", "qf"], maxHp: 400000 },
        { names: ["semifinals", "semi finals", "sf"], maxHp: 600000 },
        { names: ["finals", "grand finals", "f", "gf"], maxHp: 800000 },
    ],
    // Rounds a player stays dead for after reaching 0 HP
    DEAD_ROUNDS: 2,
    // Revive HP as a share of the round's max HP
    REVIVE_HP_RATIO: 0.3,
    DUEL_LOSER_REVIVE_HP_RATIO: 0.5,
    // Damage multiplier: +DAMAGE_MULTIPLIER_STEP after every MAPS_PER_MULTIPLIER_STEP maps
    DAMAGE_MULTIPLIER_STEP: 0.5,
    MAPS_PER_MULTIPLIER_STEP: 2,

    // Class abilities
    CLASSES_WITH_CONTROLS: ["human", "demigod", "soulweaver"],
    // Demigod multiplier, keyed by number of opponents alive
    DEMIGOD_MULTIPLIERS: { 3: 4, 2: 3, 1: 2 },
    SOULWEAVER_CHALLENGED_MULTIPLIER: 1.4,
    // Human's Lucky!: first number is worth LUCKY_BASE_BONUS_PERCENT,
    // every extra number takes off LUCKY_PENALTY_PERCENT, never below LUCKY_MIN_BONUS_PERCENT
    LUCKY_BASE_BONUS_PERCENT: 77.7,
    LUCKY_PENALTY_PERCENT: 7,
    LUCKY_MIN_BONUS_PERCENT: 7.7,

    // tosu
    TOSU_WS_PATH: "/websocket/v2",
    // tourney.ipcState values
    IPC_STATE: { IDLE: 1, WAITING_FOR_CLIENTS: 2, PLAYING: 3, RANKING: 4 },
    // tosu needs a moment after a map change before the converted stats are correct
    STATS_DELAY_MS: 250,

    // Saved state & polling
    STORAGE_KEY: "data",
    POLL_INTERVAL_MS: 100,
    SAVE_INTERVAL_MS: 100,

    // Data files (relative to a page folder)
    BEATMAPS_PATH: "../_data/beatmaps.json",
    SHOWCASE_BEATMAPS_PATH: "../_data/showcase-beatmaps.json",
    TEAMS_PATH: "../_data/teams.json",

    // OBS
    OBS_ADDRESS: "ws://127.0.0.1:4455",
    OBS_RECONNECT_MS: 3000,
    OBS_SCENES: { GAMEPLAY: "Gameplay", WINNER: "Winner", MAPPOOL: "Mappool" },

    // Mod maths
    MOD_HR_CS_MULTIPLIER: 1.3,
    MOD_HR_AR_OD_MULTIPLIER: 1.4,
    MOD_DT_SPEED_MULTIPLIER: 1.5,
    MOD_STAT_CAP: 10,

    // Overlay layout
    GAMEPLAY_TEAM_NAME_MAX_WIDTH: 550,
    // Width in px of a full HP bar
    TEAM_HP_BAR_MAX_WIDTH: 238, // main + mappool (a team's 3 players)
    PLAYER_HP_BAR_MAX_WIDTH: 636, // hp-bar (a single player)
    // CountUp animation used for every score / HP number
    COUNT_UP_DURATION: 0.2,
    COUNT_UP_OPTIONS: { useEasing: true, useGrouping: true, separator: ",", decimal: ".", suffix: "" },

    // Showcase
    SHOWCASE_ROUND_NAME_MAX_WIDTH: 350,
    SHOWCASE_ROUND_NAME_X: 210,
    SHOWCASE_ROUND_NAME_LINE_YS: { 1: [62.5], 2: [45, 80] },
    TWITCH_CHANNEL: "purlstournaments",
    TWITCH_IGNORED_USERS: ["nightbot"],
    // Don't let the overlay grow forever during a long stream
    MAX_CHAT_MESSAGES: 100,
    // A random chat colour is accepted when r+g+b <= CHAT_COLOUR_MAX_BRIGHTNESS
    // and g <= (r+b) * CHAT_COLOUR_MAX_GREEN_RATIO
    CHAT_COLOUR_MAX_BRIGHTNESS: 384,
    CHAT_COLOUR_MAX_GREEN_RATIO: 0.8,

    // Winner
    CHIBI_FOLDER: "static/chibis",
    PLACEHOLDER_CHIBI: "static/placeholder chibi.png",
    WINNER_NAME_MAX_WIDTH: 330,
    WINNER_NAME_MAX_LINES: 2,
    WINNER_NAME_X: 183,
    WINNER_NAME_LINE_YS: { 1: [260], 2: [235, 285] },

    // Mappool
    SVG_NS: "http://www.w3.org/2000/svg",
    BEATMAP_COVER_URL: "https://assets.ppy.sh/beatmaps/{id}/covers/cover.jpg",
    MAP_BORDER_VIEWBOX: "0 0 680 91",
    MAP_BORDER_TRANSFORM: "translate(96.92852783203125,-0.106964111328125)",
    MAP_BORDER_PATH: "M0 0 C9 -0.24 18 -0.39 27.01 -0.46 C28.1 -0.46 28.1 -0.46 29.21 -0.47 C52.13 -0.65 74.86 0.35 97.71 2.07 C98.97 2.16 100.23 2.26 101.53 2.35 C106.75 2.74 111.96 3.13 117.17 3.52 C176.29 7.95 234.01 7.79 293.24 3.87 C307.72 2.91 322.21 2.21 336.7 1.57 C341.24 1.37 345.77 1.15 350.3 0.92 C351.46 0.87 352.63 0.81 353.82 0.75 C355.88 0.65 357.94 0.54 359.99 0.44 C375.94 -0.32 391.87 0.15 407.81 0.83 C409.7 0.9 411.58 0.98 413.47 1.06 C418.54 1.26 423.6 1.48 428.67 1.69 C432.91 1.87 437.15 2.04 441.39 2.22 C451.38 2.63 461.38 3.05 471.37 3.47 C481.68 3.9 491.98 4.33 502.29 4.75 C511.16 5.12 520.04 5.49 528.91 5.86 C534.2 6.08 539.49 6.3 544.78 6.52 C549.74 6.72 554.69 6.93 559.65 7.14 C561.47 7.22 563.29 7.29 565.11 7.37 C567.59 7.47 570.07 7.58 572.55 7.68 C573.27 7.71 574 7.74 574.75 7.77 C577.75 7.9 580.2 8.15 583.07 9.11 C583.07 36.17 583.07 63.23 583.07 91.11 C360.32 91.11 137.57 91.11 -91.93 91.11 C-92.67 87.41 -93.15 84.12 -93.41 80.4 C-93.53 78.71 -93.53 78.71 -93.65 76.98 C-93.73 75.77 -93.82 74.55 -93.9 73.3 C-94.03 71.4 -94.03 71.4 -94.17 69.45 C-94.35 66.76 -94.53 64.06 -94.71 61.36 C-94.9 58.64 -95.08 55.92 -95.27 53.2 C-96.45 36.47 -97.22 19.88 -96.93 3.11 C-89.47 2.84 -82.01 2.57 -74.55 2.31 C-72.03 2.22 -69.52 2.13 -67 2.04 C-46.68 1.31 -26.37 0.68 -6.05 0.16 C-4.03 0.11 -2.02 0.05 0 0 Z",
    PICK_BAN_LABELS: {
        redBan: "BANNED BY TEAM RED",
        blueBan: "BANNED BY TEAM BLUE",
        redPick: "PICKED BY TEAM RED",
        bluePick: "PICKED BY TEAM BLUE",
    },

    // Countdown
    COUNTDOWN_TICK_MS: 1000,
    MS_PER_DAY: 24 * 60 * 60 * 1000,
})
