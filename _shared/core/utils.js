// Get Cookie
export function getCookie(cname) {
    let name = cname + "="
    let ca = document.cookie.split(';')
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i]
        while (c.charAt(0) == ' ') c = c.substring(1)
        if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
    }
    return "";
}

// Set Length Display
export function setLengthDisplay(seconds) {
    const minuteCount = Math.floor(seconds / 60)
    const secondCount = seconds % 60

    return `${minuteCount.toString().padStart(2, "0")}:${secondCount.toString().padStart(2, "0")}`
}

// Sleep
export const delay = async time => new Promise(resolve => setTimeout(resolve, time))

// Get Mods
export function getModDetails(cs, ar, od, bpm, len, mod) {
    if (mod.includes("HR")) {
        cs = Math.min(Math.round(Number(cs) * 1.3 * 10) / 10, 10)
        ar = Math.min(Math.round(Number(ar) * 1.4 * 10) / 10, 10)
        od = Math.min(Math.round(Number(od) * 1.4 * 10) / 10, 10)
    }
    if (mod.includes("DT")) {
        if (ar > 5) ar = Math.round((((1200 - (( 1200 - (ar - 5) * 150) * 2 / 3)) / 150) + 5) * 10) / 10
        else ar = Math.round((1800 - ((1800 - ar * 120) * 2 / 3)) / 120 * 10) / 10
        od = Math.round((79.5 - (( 79.5 - 6 * od) * 2 / 3)) / 6 * 10) / 10
        bpm = Math.round(bpm * 1.5)
        len = Math.round(len / 1.5)
    }

    return { cs, ar, od, bpm, len, mod }
}

// Read what the dashboard saved to localStorage (null until the dashboard has written something)
export function readSavedData() {
    try {
        const raw = localStorage.getItem("data")
        return raw ? JSON.parse(raw) : null
    } catch (error) {
        console.error("Could not read dashboard data:", error)
        return null
    }
}

// Run callback every `interval` ms, aligned to the clock.
// An error in one tick is logged instead of killing the loop.
export function startPolling(callback, interval = 100) {
    const tick = () => {
        try {
            callback()
        } catch (error) {
            console.error(error)
        }
        setTimeout(tick, interval - (Date.now() % interval))
    }
    tick()
}

// Deep equal for plain objects / arrays
export function deepEqual(a, b) {
    if (a === b) return true
    if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
        return false
    }

    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    if (keysA.length !== keysB.length) return false

    return keysA.every(key => keysB.includes(key) && deepEqual(a[key], b[key]))
}

// Shorten an SVG <text> with "..." until it fits maxWidth
export function truncateSVGText(element, maxWidth) {
    if (!element) return

    const originalText = element.textContent.trim()
    element.textContent = originalText

    if (element.getComputedTextLength() <= maxWidth) return
    let text = originalText
    while (text.length > 0) {
        text = text.slice(0, -1)
        element.textContent = text.trimEnd() + "..."

        if (element.getComputedTextLength() <= maxWidth) break
    }
}
