from flask import Flask, jsonify, request, send_from_directory
from playlist import PlaylistManager, new_song
from pathlib import Path
import uuid
from werkzeug.utils import secure_filename
import random
from youtube import is_youtube_url, download_youtube_audio

app = Flask(__name__, static_folder="../frontend", static_url_path="/")

# === Media ===
MEDIA_DIR = Path(app.static_folder) / "media"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXT = {"mp3", "wav", "ogg", "m4a", "aac", "flac"}
MAX_BYTES = 25 * 1024 * 1024
app.config["MAX_CONTENT_LENGTH"] = MAX_BYTES

# === Playlists + modos ===
pm = PlaylistManager()
pm.create("General")
pm.create("Focus")
pm.set_active("General")

# repeat: "off" | "one" | "all"
player_state = {"shuffle": False, "repeat": "off"}

# Seed
for s in [
    new_song("Intro Beat", "Dev One", "https://www2.cs.uic.edu/~i101/SoundFiles/StarWars60.wav"),
    new_song("Lo-Fi Loop", "CoderX", "https://www2.cs.uic.edu/~i101/SoundFiles/CantinaBand60.wav"),
    new_song("Focus Track", "DeepWork", "https://www2.cs.uic.edu/~i101/SoundFiles/PinkPanther30.wav")
]:
    pm.playlists["General"].add_last(s)

# ===== helpers =====
def _serialize_playlist(pl_name=None):
    pl = pm.active_list() if pl_name is None else pm.playlists[pl_name]
    data = pl.to_list()
    data["name"] = pm.active if pl_name is None else pl_name
    data["queue"] = pm.queue_state()
    data["modes"] = player_state
    return data

def _playlist_as_list(pl):
    """Devuelve las canciones en orden (lista de dict song)."""
    out, n = [], pl.head
    while n:
        out.append(n.song); n = n.next
    return out

# ===== RUTAS =====

@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")

@app.get("/media/<path:filename>")
def media_file(filename):
    return send_from_directory(MEDIA_DIR, filename, conditional=True)

# ===== Playlists =====
@app.get("/api/playlists")
def list_playlists():
    return jsonify({"active": pm.active, "items": list(pm.playlists.keys())})

@app.post("/api/playlists")
def create_playlist():
    data = request.get_json(force=True)
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    if name in pm.playlists:
        return jsonify({"error": "playlist already exists"}), 400
    pm.create(name)
    return jsonify({"active": pm.active, "items": list(pm.playlists.keys())})

@app.post("/api/playlists/activate")
def activate_playlist():
    data = request.get_json(force=True)
    name = data.get("name")
    if name not in pm.playlists:
        return jsonify({"error": "playlist not found"}), 404
    pm.set_active(name)
    return jsonify({"active": pm.active, "items": list(pm.playlists.keys())})

@app.delete("/api/playlists/<name>")
def delete_playlist(name):
    ok = pm.remove(name)
    if not ok:
        return jsonify({"error": "not found"}), 404
    return jsonify({"active": pm.active, "items": list(pm.playlists.keys())})

# ===== Playlist activa =====
@app.get("/api/playlist")
def get_playlist():
    return jsonify(_serialize_playlist())

@app.post("/api/songs")
def add_song():
    data = request.get_json(force=True)
    title = data.get("title", "Untitled")
    artist = data.get("artist", "Unknown")
    url = data.get("url", "")
    position = data.get("position", "end")
    idx = int(data.get("index", 0))
    target = (data.get("playlist") or pm.active)
    
    # Manejar URLs de YouTube
    if is_youtube_url(url):
        result = download_youtube_audio(url, MEDIA_DIR)
        if 'error' in result:
            return jsonify({"error": f"Error processing YouTube URL: {result['error']}"}), 400
        url = result['url']
        if not title or title == "Untitled":
            title = result['title']
        if not artist or artist == "Unknown":
            artist = result['artist']
    if target not in pm.playlists:
        return jsonify({"error": "playlist not found"}), 404
    s = new_song(title, artist, url)
    pl = pm.playlists[target]
    try:
        if position == "start": pl.add_first(s)
        elif position == "end": pl.add_last(s)
        elif position == "index": pl.add_at(idx, s)
        else: return jsonify({"error": "invalid position"}), 400
    except IndexError:
        return jsonify({"error": "index out of range"}), 400
    return jsonify(_serialize_playlist(target))

@app.delete("/api/songs/<sid>")
def delete_song(sid):
    pl = pm.active_list()
    ok = pl.remove_by_id(sid)
    if not ok:
        return jsonify({"error": "not found"}), 404
    return jsonify(_serialize_playlist())

# ===== Favoritos =====
@app.patch("/api/songs/<sid>/favorite")
def toggle_favorite(sid):
    pl = pm.active_list()
    idx, song = pl.find_by_id(sid)
    if song is None:
        return jsonify({"error": "not found"}), 404
    body = request.get_json(silent=True) or {}
    song["favorite"] = bool(body.get("favorite", not song.get("favorite", False)))
    return jsonify(_serialize_playlist())

@app.get("/api/favorites")
def get_favorites():
    pl = pm.active_list()
    favs = []
    n = pl.head
    while n:
        if n.song.get("favorite"):
            favs.append(n.song)
        n = n.next
    return jsonify({"playlist": pm.active, "items": favs})

# ===== Queue =====
@app.get("/api/queue")
def queue_state():
    return jsonify(pm.queue_state())

@app.post("/api/queue/enqueue")
def queue_enqueue():
    data = request.get_json(force=True)
    song_id = data.get("songId")
    if not song_id:
        return jsonify({"error": "songId required"}), 400
    pl = pm.active_list()
    idx, song = pl.find_by_id(song_id)
    if song is None:
        return jsonify({"error": "song not found in active playlist"}), 404
    pm.enqueue(song.copy())
    return jsonify(pm.queue_state())

@app.delete("/api/queue/<int:qindex>")
def queue_remove(qindex):
    if qindex < 0 or qindex >= len(pm.queue):
        return jsonify({"error": "index out of range"}), 400
    pm.queue.pop(qindex)
    return jsonify(pm.queue_state())

@app.post("/api/queue/clear")
def queue_clear():
    pm.queue.clear()
    return jsonify(pm.queue_state())

# ===== Modos (shuffle / repeat) =====
@app.get("/api/mode")
def get_mode():
    return jsonify(player_state)

@app.post("/api/mode")
def set_mode():
    data = request.get_json(force=True)
    if "shuffle" in data:
        player_state["shuffle"] = bool(data["shuffle"])
    if "repeat" in data:
        val = data["repeat"]
        if val not in ("off", "one", "all"):
            return jsonify({"error": "repeat must be off|one|all"}), 400
        player_state["repeat"] = val
    return jsonify(player_state)

# ===== Control =====
@app.post("/api/control/current")
def ctrl_current():
    data = request.get_json(force=True)
    i = int(data.get("index", 0))
    pl = pm.active_list()
    try:
        pl.set_current(i)
    except IndexError:
        return jsonify({"error": "index out of range"}), 400
    return jsonify(_serialize_playlist())

@app.post("/api/control/jump")
def ctrl_jump():
    data = request.get_json(force=True)
    sid = data.get("songId")
    pl = pm.active_list()
    idx, _ = pl.find_by_id(sid)
    if idx < 0:
        return jsonify({"error": "song not found"}), 404
    pl.set_current(idx)
    return jsonify(_serialize_playlist())

@app.post("/api/control/next")
def ctrl_next():
    pl = pm.active_list()
    queued = pm.dequeue()
    if queued:
        pl.add_last(queued)
        pl.set_current(pl.size - 1)
        return jsonify(_serialize_playlist())

    if player_state["repeat"] == "one":
        return jsonify(_serialize_playlist())

    if player_state["shuffle"] and pl.size > 0:
        cur_idx = pl.to_list()["currentIndex"]
        choices = [i for i in range(pl.size) if i != cur_idx] or [cur_idx]
        pl.set_current(random.choice(choices))
        return jsonify(_serialize_playlist())

    if pl.current and pl.current.next:
        pl.move_next()
    else:
        if player_state["repeat"] == "all" and pl.size > 0:
            pl.set_current(0)
    return jsonify(_serialize_playlist())

@app.post("/api/control/prev")
def ctrl_prev():
    pl = pm.active_list()
    if pl.current and pl.current.prev:
        pl.move_prev()
    else:
        if player_state["repeat"] == "all" and pl.size > 0:
            pl.set_current(pl.size - 1)
    return jsonify(_serialize_playlist())

# ===== Up Next =====
@app.get("/api/upnext")
def up_next():
    pl = pm.active_list()
    songs = _playlist_as_list(pl)
    cur_node = pl.current
    current = cur_node.song if cur_node else None

    queue_items = pm.queue.copy()
    queue_count = len(queue_items)

    rest = []
    if current is None:
        rest = songs.copy()
    else:
        if player_state["repeat"] == "one":
            rest = []
        elif player_state["shuffle"]:
            remaining = [s for s in songs if s["id"] != current["id"]]
            random.shuffle(remaining)
            rest = remaining
        else:
            n = cur_node.next
            while n:
                rest.append(n.song); n = n.next
            if player_state["repeat"] == "all":
                n = pl.head
                while n and n is not cur_node:
                    rest.append(n.song); n = n.next

    upnext = queue_items + rest
    return jsonify({"current": current, "items": upnext, "queueCount": queue_count, "modes": player_state})

# ===== Upload audio =====
@app.post("/api/upload")
def upload_audio():
    if "file" not in request.files:
        return jsonify({"error": "file field required"}), 400
    f = request.files["file"]
    if f.filename == "":
        return jsonify({"error": "empty filename"}), 400
    ext = secure_filename(f.filename).rsplit(".", 1)[-1].lower() if "." in f.filename else ""
    if ext not in ALLOWED_EXT:
        return jsonify({"error": f"extension .{ext} not allowed"}), 400
    filename = f"{uuid.uuid4().hex}.{ext}"
    (MEDIA_DIR / filename).write_bytes(f.read())
    return jsonify({"url": f"/media/{filename}", "filename": filename})

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)