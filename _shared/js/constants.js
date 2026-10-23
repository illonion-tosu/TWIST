/**
 * Shared constants for the tournament overlays.
 */
export const constants = Object.freeze({
    // Players and teams
    SIDES: ["red", "blue"],
    PLAYER_NUMBERS: [1, 2, 3, 4, 5, 6],
    TEAM_PLAYER_NUMBERS: { red: [1, 2, 3], blue: [4, 5, 6] },
    DEFAULT_PLAYER_ID: 123456,
    DEFAULT_TARGETS: [6, 5, 4, 3, 2, 1],

    // Mappool pickers
    DEFAULT_NEXT_PICKER: "red",
    DEFAULT_CURRENT_PICKER: "blue",

    // HP and damage
    DEFAULT_MAX_HP: 800000,
    MAX_STANDARD_DAMAGE: 400000,
    ROUND_MAX_HP: [
        { names: ["quarterfinals", "quarter finals", "qf"], maxHp: 800000 },
        { names: ["semifinals", "semi finals", "sf"], maxHp: 1200000 },
        { names: ["finals", "grand finals", "f", "gf"], maxHp: 1600000 },
    ],
    DEAD_ROUNDS: 3,
    REVIVE_HP_RATIO: 0.5,
    SECONDARY_ATTACKER_RATIO: 0.5,

    DAMAGE_MULTIPLIER_STEP: 1,
    MAPS_PER_MULTIPLIER_STEP: 2,

    // Class abilities
    CLASSES_WITH_CONTROLS: ["human", "demigod", "soulweaver", "witch"],
    DEMIGOD_MULTIPLIERS: { 3: 2.5, 2: 2, 1: 1.5 },
    SOULWEAVER_CHALLENGER_MULTIPLIER: 1.1,
    SOULWEAVER_CHALLENGED_MULTIPLIER: 0.9,
    SOULWEAVER_LOSER_HP_LOSS_RATIO: 0.75,
    HUMAN_HEAL_AMOUNT: 150000,
    CLASS_IMAGE_FOLDER: "static/classes",

    // tosu
    TOSU_WS_PATH: "/websocket/v2",
    IPC_STATE: { IDLE: 1, WAITING_FOR_CLIENTS: 2, PLAYING: 3, RANKING: 4 },
    STATS_DELAY_MS: 250,

    // Saved state and polling
    STORAGE_KEY: "data",
    POLL_INTERVAL_MS: 100,
    SAVE_INTERVAL_MS: 100,
    SAVE_THROTTLE_MS: 25,

    // Data files
    BEATMAPS_PATH: "../_data/beatmaps.json",
    MAPPOOLS_PATH: "../_data/mappools.json",
    // Which pool in mappools.json to use (its "id"). null = the first pool
    ACTIVE_MAPPOOL_ID: null,
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
    TEAM_HP_BAR_MAX_WIDTH: 238,
    PLAYER_HP_BAR_MAX_WIDTH: 636,
    COUNT_UP_DURATION: 0.2,
    TEAM_NAME_MIN_FONT_RATIO: 0.55,
    HP_BAR_TEAM_NAME_MAX_WIDTH: 570,
    COUNT_UP_OPTIONS: { useEasing: true, useGrouping: true, separator: ",", decimal: ".", suffix: "" },

    // Showcase
    SHOWCASE_ROUND_NAME_MAX_WIDTH: 350,
    SHOWCASE_ROUND_NAME_X: 210,
    SHOWCASE_ROUND_NAME_LINE_YS: { 1: [80], 2: [45, 80]},

    // Twitch Chat
    TWITCH_CHANNEL: "purlstournaments",
    TWITCH_IGNORED_USERS: ["nightbot"],
    MAX_CHAT_MESSAGES: 100,
    SHOWCASE_CHAT_COLOUR_MAX_BRIGHTNESS: 384,
    STARTING_SOON_CHAT_COLOUR_MIN_BRIGHTNESS: 384,
    CHAT_COLOUR_MAX_GREEN_RATIO: 0.8,

    // Winner
    CHIBI_FOLDER: "static/chibis",
    PLACEHOLDER_CHIBI: "static/placeholder chibi.png",
    WINNER_NAME_MAX_WIDTH: 330,
    WINNER_TEAM_NAME_MAX_WIDTH: 570,
    WINNER_NAME_MAX_LINES: 2,
    WINNER_NAME_X: 183,
    WINNER_NAME_LINE_YS: { 1: [260], 2: [235, 285] },

    // Mappool
    MOD_ORDER: ["NM", "HD", "SD", "HR", "DT", "DTHR", "FM", "TB"],
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
    NP_PIXELS_PER_SECOND: 45
})
