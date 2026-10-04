import { loadShowcaseBeatmaps } from "../_shared/core/beatmaps.js"

function setRoundName(name) {
    const text = document.getElementById("round-name")

    const maxWidth = 350
    const words = name.split(" ")
    const lines = []
    let currentLine = ""

    // Temporarily put text on the SVG so getComputedTextLength() works.
    text.textContent = ""

    for (const word of words) {
        const testLine = currentLine
            ? `${currentLine} ${word}`
            : word

        text.textContent = testLine

        if (text.getComputedTextLength() <= maxWidth) {
            currentLine = testLine
        } else {
            if (currentLine) {
                lines.push(currentLine)
            }

            currentLine = word
        }
    }

    if (currentLine) {
        lines.push(currentLine)
    }

    // Rebuild the text using tspans.
    text.textContent = ""

    const lineYs = {
        1: [62.5],
        2: [45, 80],
    }

    lines.forEach((line, index) => {
        const tspan = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "tspan"
        )

        tspan.setAttribute("x", "210")
        tspan.setAttribute("y", lineYs[lines.length][index])
        tspan.textContent = line

        text.appendChild(tspan)
    })
}

// Load beatmaps
let allBeatmaps = []
loadShowcaseBeatmaps().then(beatmaps => {
    setRoundName(beatmaps.roundName)
})

