/* getLyricsFromInput() and getTabFromInput() were created using CoPilot */ 
async function getLyricsFromInput() {
    const songTitle = document.getElementById("songInput").value.trim();
    if (!songTitle) {
        throw new Error("Please enter a song title.");
    }

    const url = new URL("https://lrclib.net/api/search");
    url.searchParams.set("q", songTitle);

    const response = await fetch(url, {
        headers: {
            "X-User-Agent": "Song Search/1.0 (https://github.com/avacrozier/songSearch)"
        }
    });

    if (!response.ok) {
        const retryAfter = response.headers.get("Retry-After");
        const retryMessage = response.status === 429 && retryAfter
            ? ` Please try again in ${retryAfter} seconds.`
            : "";
        throw new Error(`LRCLIB request failed (${response.status}).${retryMessage}`);
    }

    if (!response.headers.get("Content-Type")?.includes("application/json")) {
        throw new Error("LRCLIB returned an unexpected response.");
    }

    const records = await response.json();
    if (!Array.isArray(records)) {
        throw new Error("LRCLIB returned an unexpected response.");
    }

    const record = records.find(item => item && (
        (typeof item.plainLyrics === "string" && item.plainLyrics.trim()) ||
        (typeof item.syncedLyrics === "string" && item.syncedLyrics.trim())
    ));

    if (!record) {
        throw new Error("No lyrics found for that song.");
    }

    return record.plainLyrics?.trim() || record.syncedLyrics.trim();
}

async function getTabFromInput() {
    const songTitle = document.getElementById("songInput").value.trim();
    if (!songTitle) {
        throw new Error("Please enter a song title.");
    }

    const url = new URL("https://www.songsterr.com/api/songs");
    url.searchParams.set("pattern", songTitle);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Songsterr request failed (${response.status}).`);
    }

    if (!response.headers.get("Content-Type")?.includes("application/json")) {
        throw new Error("Songsterr returned an unexpected response.");
    }

    const songs = await response.json();
    if (!Array.isArray(songs)) {
        throw new Error("Songsterr returned an unexpected response.");
    }

    const song = songs.find(item =>
        item &&
        item.hasPlayer &&
        Number.isInteger(item.songId) &&
        typeof item.artist === "string" &&
        typeof item.title === "string" &&
        Number.isInteger(item.popularTrackGuitar) &&
        Array.isArray(item.tracks) &&
        item.tracks[item.popularTrackGuitar]
    );

    if (!song) {
        throw new Error("No guitar tab found for that song.");
    }

    const slug = `${song.artist} ${song.title}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    return {
        title: `${song.artist} - ${song.title}`,
        url: `https://www.songsterr.com/a/wsa/${slug}-tab-s${song.songId}`
    };
}

const lyricsButton = document.getElementById("findLyrics");
const lyricsOutput = document.getElementById("lyricsResult");
const tabButton = document.getElementById("findTab");

lyricsButton.addEventListener("click", async () => {
    lyricsButton.disabled = true;
    lyricsOutput.textContent = "Searching…";

    try {
        lyricsOutput.textContent = await getLyricsFromInput();
    } catch (error) {
        lyricsOutput.textContent = error instanceof Error
            ? error.message
            : "Unable to retrieve lyrics.";
    } finally {
        lyricsButton.disabled = false;
    }
});

tabButton.addEventListener("click", async () => {
    if (!document.getElementById("songInput").value.trim()) {
        lyricsOutput.textContent = "Please enter a song title.";
        return;
    }

    tabButton.disabled = true;
    lyricsOutput.textContent = "Searching Songsterr…";
    const tabWindow = window.open("about:blank", "_blank");
    if (tabWindow) {
        tabWindow.opener = null;
    }

    try {
        const tab = await getTabFromInput();
        if (tabWindow) {
            tabWindow.location.href = tab.url;
            lyricsOutput.textContent = `Opening ${tab.title} guitar tab on Songsterr…`;
        } else {
            const link = document.createElement("a");
            link.href = tab.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = `Open ${tab.title} guitar tab on Songsterr`;
            lyricsOutput.replaceChildren(link);
        }
    } catch (error) {
        tabWindow?.close();
        lyricsOutput.textContent = error instanceof Error
            ? error.message
            : "Unable to retrieve a guitar tab.";
    } finally {
        tabButton.disabled = false;
    }
});