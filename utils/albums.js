/**
 * Album lookup for the /album command.
 *
 * Deezer's public API is used because it needs no credentials and returns an
 * ordered tracklist. It only supplies metadata: the audio still comes from
 * YouTube, because these tracks are not streamable here.
 *
 * Ranking is deliberately left to the provider. Its relevance order already puts
 * the original record first, and re-scoring it by hand was measurably worse: it
 * promoted SEO fakes like "Disc-Overy" and one track remixes over the real
 * albums. The only filtering done here is dropping tribute and cover records.
 */

const SEARCH_URL = "https://api.deezer.com/search";
const ARTIST_URL = "https://api.deezer.com/artist";
const ALBUM_URL = "https://api.deezer.com/album";
const TIMEOUT = 15000;

async function getJson(url) {
    const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT)
    });

    if (!response.ok) throw new Error(`album lookup failed (${response.status})`);

    return response.json();
}

const FILLER = /\b(album|ep|playlist|record|cd)\b/gi;

/** "(Remastered)", "[Deluxe Edition]" and friends describe a release, not a title. */
function baseTitle(title) {
    return String(title || "")
        .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/** Tributes, covers and re-recordings that imitate a well known record. */
const IMPOSTOR = /rendition|tribute|made famous|piano cover|karaoke|lullaby|in the style|performs/i;

/** Letters and digits only, so "OK Computer" also answers to "okcomputer". */
function compact(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, "");
}

function clean(term) {
    return String(term || "").replace(FILLER, " ").replace(/\s+/g, " ").trim();
}

function toAlbum(result, index) {
    return {
        id: String(result.id),
        name: result.title,
        artist: result.artist?.name,
        trackCount: result.nb_tracks ?? undefined,
        url: result.link ?? `https://www.deezer.com/album/${result.id}`,
        thumbnail: result.cover_xl ?? result.cover_big ?? undefined,
        order: index
    };
}

const isRealAlbum = (album) => !IMPOSTOR.test(album.name);

/** True when the query and the album plainly refer to the same thing. */
function related(album, query) {
    const title = compact(baseTitle(album.name));
    const artist = compact(album.artist);
    if (!title) return false;

    return (
        title.includes(query) ||
        query.includes(title) ||
        Boolean(artist) && (artist.includes(query) || query.includes(artist))
    );
}

/** Finds the artist whose name best matches, falling back to the most followed. */
async function resolveArtist(name) {
    const data = await getJson(`${SEARCH_URL}/artist?q=${encodeURIComponent(name)}&limit=10`);
    const artists = (data.data || []).filter((artist) => artist?.id);
    if (!artists.length) return null;

    const want = compact(name);

    return artists
        .map((artist) => {
            const actual = compact(artist.name);
            let accuracy = 0;
            if (actual === want) accuracy = 2;
            else if (actual.includes(want) || want.includes(actual)) accuracy = 1;

            return { artist, accuracy };
        })
        .sort((a, b) => b.accuracy - a.accuracy || (b.artist.nb_fan ?? 0) - (a.artist.nb_fan ?? 0))[0].artist;
}

/**
 * Resolves an album from an explicit "artist - album" query.
 *
 * Going through the artist's own catalogue excludes tribute and cover records by
 * construction, because they are filed under a different artist. That catalogue
 * is not complete though — Deezer omits some records — so a miss falls back to
 * the ordinary album search and the artist is verified there instead.
 */
async function fromArtistAndAlbum(artistName, albumName, resolveTop) {
    const artist = await resolveArtist(artistName);
    if (!artist) return null;

    const want = compact(albumName);
    const expected = compact(artist.name);

    const data = await getJson(`${ARTIST_URL}/${artist.id}/albums?limit=100`);
    const albums = (data.data || []).filter((result) => result?.id).map(toAlbum).filter(isRealAlbum);

    const match = albums.find((album) => {
        const title = compact(baseTitle(album.name));
        return title.includes(want) || want.includes(title);
    });

    if (match) return { ...match, artist: match.artist || artist.name };

    // Not in the catalogue: accept the search result only if it really is a
    // record by that artist, rather than some similarly titled album.
    const top = await resolveTop();
    if (top && compact(top.artist) === expected) return top;

    return null;
}

/** Finds the album that best matches the query. Returns null when nothing is close. */
async function searchAlbum(query) {
    const term = clean(query);
    if (!term) return null;

    const wanted = compact(term);

    const topMatch = async () => {
        const data = await getJson(`${SEARCH_URL}/album?q=${encodeURIComponent(term)}&limit=25`);
        const albums = (data.data || []).filter((result) => result?.id).map(toAlbum).filter(isRealAlbum);

        for (const album of albums) {
            if (related(album, wanted)) return album;
        }

        return null;
    };

    const parts = term.split(/\s+-\s+/);
    if (parts.length >= 2) {
        const album = await fromArtistAndAlbum(parts[0], parts.slice(1).join(" - "), topMatch);
        if (album) return album;
    }

    return topMatch();
}

/** Ordered tracklist for an album id. */
async function albumTracks(albumId) {
    const data = await getJson(`${ALBUM_URL}/${encodeURIComponent(albumId)}`);

    return (data.tracks?.data || [])
        .filter((track) => track?.title)
        .map((track, index) => ({
            position: track.track_position ?? index + 1,
            name: track.title,
            artist: track.artist?.name,
            duration: track.duration || 0
        }))
        .sort((a, b) => a.position - b.position)
        .map((track, index) => ({ ...track, position: index + 1 }));
}

module.exports = { searchAlbum, albumTracks };
