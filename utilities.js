/* getLyricsFromInput() and getSongInfoFromInput() were created using Copilot */
function normalizeArtistName(artistName) {
    return artistName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

async function getLyricsFromInput(artistName) {
    const songTitle = document.getElementById("songInput").value.trim();
    if (!songTitle) {
        throw new Error("Please enter a song title.");
    }

    const url = new URL("https://lrclib.net/api/search");
    url.searchParams.set("q", `${songTitle} ${artistName}`);

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

    const recordsWithLyrics = records.filter(item => item &&
        typeof item.artistName === "string" &&
        ((typeof item.plainLyrics === "string" && item.plainLyrics.trim()) ||
            (typeof item.syncedLyrics === "string" && item.syncedLyrics.trim()))
    );

    if (!recordsWithLyrics.length) {
        throw new Error("No lyrics found for that song.");
    }

    const record = recordsWithLyrics.find(item =>
        normalizeArtistName(item.artistName) === normalizeArtistName(artistName)
    );

    if (!record) {
        throw new Error(
            `Could not confirm lyrics for ${artistName}; LRCLIB returned lyrics by a different artist.`
        );
    }

    return record;
}

async function getSongInfoFromInput() {
    const songTitle = document.getElementById("songInput").value.trim();
    if (!songTitle) {
        throw new Error("Please enter a song title.");
    }

    const url = new URL("https://itunes.apple.com/search");
    url.searchParams.set("term", songTitle);
    url.searchParams.set("media", "music");
    url.searchParams.set("entity", "song");
    url.searchParams.set("limit", "10");

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`iTunes request failed (${response.status}).`);
    }

    const contentType = response.headers.get("Content-Type")
        ?.split(";")[0]
        .trim()
        .toLowerCase();
    if (contentType !== "application/json" && contentType !== "text/javascript") {
        throw new Error("iTunes returned an unexpected response.");
    }

    const data = await response.json();
    if (!data || !Array.isArray(data.results)) {
        throw new Error("iTunes returned an unexpected response.");
    }

    const song = data.results.find(item =>
        item &&
        typeof item.trackName === "string" &&
        typeof item.artistName === "string" &&
        typeof item.trackViewUrl === "string"
    );

    if (!song) {
        throw new Error("No song information found for that title.");
    }

    return song;
}

async function getConfirmedSongDataFromInput() {
    const song = await getSongInfoFromInput();
    const lyrics = await getLyricsFromInput(song.artistName);

    return { song, lyrics };
}

const lyricsButton = document.getElementById("findLyrics");
const lyricsOutput = document.getElementById("lyricsResult");
const infoButton = document.getElementById("findInfo");

lyricsButton.addEventListener("click", async () => {
    lyricsButton.disabled = true;
    lyricsOutput.textContent = "Searching iTunes and LRCLIB…";

    try {
        const { lyrics } = await getConfirmedSongDataFromInput();
        lyricsOutput.textContent = lyrics.plainLyrics?.trim() || lyrics.syncedLyrics.trim();
    } catch (error) {
        lyricsOutput.textContent = error instanceof Error
            ? error.message
            : "Unable to retrieve lyrics.";
    } finally {
        lyricsButton.disabled = false;
    }
});

infoButton.addEventListener("click", async () => {
    if (!document.getElementById("songInput").value.trim()) {
        lyricsOutput.textContent = "Please enter a song title.";
        return;
    }

    infoButton.disabled = true;
    lyricsOutput.textContent = "Searching iTunes and LRCLIB…";

    try {
        const { song } = await getConfirmedSongDataFromInput();
        const details = document.createElement("article");
        details.className = "songDetails";

        if (song.artworkUrl100) {
            const coverLink = document.createElement("a");
            coverLink.href = song.trackViewUrl;
            coverLink.target = "_blank";
            coverLink.rel = "noopener noreferrer";
            coverLink.setAttribute("aria-label", `View ${song.trackName} on Apple Music`);

            const cover = document.createElement("img");
            cover.className = "albumCover";
            cover.src = song.artworkUrl100.replace(/\/\d+x\d+bb(?=\.)/, "/500x500bb");
            cover.alt = `${song.collectionName || song.trackName} album cover`;
            cover.width = 500;
            cover.height = 500;
            coverLink.append(cover);
            details.append(coverLink);
        }

        const heading = document.createElement("h2");
        heading.textContent = song.trackName;
        details.append(heading);

        const artist = document.createElement("p");
        artist.textContent = `Artist: ${song.artistName}`;
        details.append(artist);

        if (song.previewUrl) {
            const preview = document.createElement("audio");
            preview.controls = true;
            preview.src = song.previewUrl;
            preview.setAttribute("aria-label", `${song.trackName} song preview`);
            details.append(preview);
        } else {
            const noPreview = document.createElement("p");
            noPreview.textContent = "A preview is not available for this song.";
            details.append(noPreview);
        }

        const metadata = [
            song.collectionName && `Album: ${song.collectionName}`,
            song.primaryGenreName && `Genre: ${song.primaryGenreName}`,
            song.releaseDate && `Released: ${new Date(song.releaseDate).getFullYear()}`,
            Number.isFinite(song.trackTimeMillis) &&
                `Duration: ${Math.floor(song.trackTimeMillis / 60000)}:${String(
                    Math.floor((song.trackTimeMillis % 60000) / 1000)
                ).padStart(2, "0")}`
        ].filter(Boolean);

        if (metadata.length) {
            const information = document.createElement("p");
            information.textContent = metadata.join(" · ");
            details.append(information);
        }

        const storeLink = document.createElement("a");
        storeLink.className = "storeLink";
        storeLink.href = song.trackViewUrl;
        storeLink.target = "_blank";
        storeLink.rel = "noopener noreferrer";
        storeLink.textContent = "View on Apple Music";
        details.append(storeLink);

        lyricsOutput.replaceChildren(details);
    } catch (error) {
        lyricsOutput.textContent = error instanceof Error
            ? error.message
            : "Unable to retrieve song information.";
    } finally {
        infoButton.disabled = false;
    }
});