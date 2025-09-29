import { store } from "../state/Store.js";
import { toggleFavorite, setCurrent } from "../Utils/Api.js";

export class Favorites {
  constructor() {
    this.favEl = document.getElementById("favorites");
    this.favCount = document.getElementById("favCount");

    this.init();
  }

  init() {
    this.setupStateSubscriptions();
  }

  setupStateSubscriptions() {
    // Subscribirse a cambios de playlist para actualizar favoritos
    store.subscribe((playlist) => {
      this.loadFavorites(playlist);
    }, 'playlistChanged');

    // Renderizar favoritos iniciales
    const initialPlaylist = store.getState().playlist;
    if (initialPlaylist) {
      this.loadFavorites(initialPlaylist);
    }
  }

  loadFavorites(playlist) {
    const favorites = playlist.items.filter(song => song.favorite);
    
    // Actualizar contador
    if (this.favCount) {
      this.favCount.textContent = favorites.length;
    }
    
    this.render(favorites, playlist.items);
  }

  render(favorites, allSongs) {
    if (!this.favEl) return;
    
    this.favEl.innerHTML = "";

    if (favorites.length === 0) {
      const li = document.createElement("li");
      li.className = "muted";
      li.style.padding = "20px";
      li.style.textAlign = "center";
      li.textContent = "No tienes canciones favoritas aún. Marca algunas con ★";
      this.favEl.appendChild(li);
      return;
    }

    favorites.forEach((song) => {
      const li = this.createFavoriteItem(song, allSongs);
      this.favEl.appendChild(li);
    });
  }

  createFavoriteItem(song, allSongs) {
    const li = document.createElement("li");
    li.className = "fav-item";

    // Metadatos de la canción
    const meta = document.createElement("div");
    meta.className = "fav-meta";
    meta.textContent = `${song.title} — ${song.artist}`;
    meta.title = `${song.title} por ${song.artist}`;

    // Contenedor de acciones
    const actions = document.createElement("div");
    actions.className = "fav-actions";

    // Botón de seleccionar/reproducir
    const selectBtn = document.createElement("button");
    selectBtn.type = "button";
    selectBtn.className = "btn ghost";
    selectBtn.textContent = "Reproducir";
    selectBtn.title = "Reproducir esta canción";
    selectBtn.onclick = () => this.selectSong(song.id, allSongs);

    // Botón de quitar de favoritos
    const unfavBtn = document.createElement("button");
    unfavBtn.type = "button";
    unfavBtn.className = "btn";
    unfavBtn.textContent = "Quitar ★";
    unfavBtn.title = "Quitar de favoritos";
    unfavBtn.onclick = () => this.removeFavorite(song.id, song.title);

    actions.appendChild(selectBtn);
    actions.appendChild(unfavBtn);
    
    li.appendChild(meta);
    li.appendChild(actions);

    return li;
  }

  async selectSong(songId, allSongs) {
    try {
      // Encontrar el índice de la canción en la playlist completa
      const index = allSongs.findIndex(song => song.id === songId);
      
      if (index === -1) {
        console.error('Canción no encontrada en la playlist');
        return;
      }

      await setCurrent(index);
      // El estado y reproducción se manejan automáticamente en api.js
    } catch (error) {
      console.error("Error seleccionando canción favorita:", error);
      store.setError("Error al reproducir la canción");
    }
  }

  async removeFavorite(songId, songTitle) {
    try {
      await toggleFavorite(songId);
      // El estado se actualiza automáticamente
      
      this.showToast(`"${songTitle}" quitada de favoritos`, 'info');
    } catch (error) {
      console.error("Error quitando de favoritos:", error);
      store.setError("Error al quitar de favoritos");
    }
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 20px;
      background: ${type === 'info' ? 'var(--primary)' : 'var(--accent)'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 9999;
      animation: slideInUp 0.3s ease;
      font-size: 14px;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOutDown 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }
}

// Agregar estilos para favoritos
const style = document.createElement('style');
style.textContent = `
  .fav-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 10px;
    border-top: 1px solid var(--stroke);
    transition: var(--transition);
  }

  .fav-item:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .fav-meta {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    padding-right: 10px;
  }

  .fav-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .fav-actions button {
    padding: 6px 12px;
    font-size: 13px;
  }
`