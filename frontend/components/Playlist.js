import { store } from "../state/Store.js";
import {
  getPlaylists,
  createPlaylist,
  activatePlaylist,
  deletePlaylist,
  toggleFavorite,
  setCurrent,
  removeSong,
  enqueueSong,
  getPlaylist
} from "../Utils/api.js";

export class Playlist {
  constructor() {
    this.listEl = document.getElementById("list");
    this.nowEl = document.getElementById("nowPlaying");
    this.playlistsSelect = document.getElementById("playlists");
    this.deleteBtn = document.getElementById("deletePlaylist");
    this.newPlaylistForm = document.getElementById("newPlaylistForm");

    this.init();
  }

  async init() {
    console.log('🎵 Inicializando componente Playlist...');
    
    this.setupEventListeners();
    this.setupStateSubscriptions();
    
    // Cargar playlists inmediatamente
    await this.loadPlaylists();
    
    // Cargar playlist actual
    await this.loadCurrentPlaylist();
  }

  setupEventListeners() {
    // Cambio de playlist
    if (this.playlistsSelect) {
      this.playlistsSelect.onchange = async () => {
        if (!this.playlistsSelect.value) return;
        console.log('📝 Cambiando a playlist:', this.playlistsSelect.value);
        await this.activatePlaylist(this.playlistsSelect.value);
      };
    }

    // Crear nueva playlist
    if (this.newPlaylistForm) {
      this.newPlaylistForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(this.newPlaylistForm);
        const name = formData.get("name")?.trim();
        
        if (!name) {
          alert('Ingresa un nombre para la playlist');
          return;
        }
        
        await this.createPlaylist(name);
        this.newPlaylistForm.reset();
      });
    }

    // Eliminar playlist
    if (this.deleteBtn) {
      this.deleteBtn.onclick = async () => {
        const name = this.playlistsSelect?.value;
        if (!name) return;
        await this.deletePlaylist(name);
      };
    }
  }

  setupStateSubscriptions() {
    // Cuando cambie la playlist, re-renderizar
    store.subscribe((playlist) => {
      console.log('📊 Playlist cambió en el store:', playlist.name);
      this.renderPlaylist(playlist);
    }, 'playlistChanged');
  }

  async loadPlaylists() {
    try {
      console.log('📥 Cargando lista de playlists...');
      const data = await getPlaylists();
      
      console.log('✅ Playlists recibidas:', data);
      
      if (!data || !data.items || !Array.isArray(data.items)) {
        console.error("❌ Respuesta inválida de /api/playlists:", data);
        throw new Error('Formato de respuesta inválido');
      }
      
      if (data.items.length === 0) {
        console.warn('⚠️ No hay playlists disponibles');
      }
      
      this.renderPlaylistsSelect(data);
      return data;
    } catch (error) {
      console.error("❌ Error cargando playlists:", error);
      store.setError("No se pudieron cargar las playlists");
      
      // Mostrar error visual en el select
      if (this.playlistsSelect) {
        this.playlistsSelect.innerHTML = '<option value="">Error cargando playlists</option>';
      }
    }
  }

  async loadCurrentPlaylist() {
    try {
      console.log('📥 Cargando playlist actual...');
      const playlist = await getPlaylist();
      console.log('✅ Playlist actual cargada:', playlist.name);
      store.setState({ playlist });
      this.renderPlaylist(playlist);
    } catch (error) {
      console.error("❌ Error cargando playlist actual:", error);
    }
  }

  renderPlaylistsSelect(data) {
    if (!this.playlistsSelect) {
      console.warn('⚠️ Elemento select de playlists no encontrado');
      return;
    }

    console.log('🎨 Renderizando selector de playlists:', data.items);
    
    this.playlistsSelect.innerHTML = "";
    
    if (data.items.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No hay playlists";
      this.playlistsSelect.appendChild(option);
      return;
    }
    
    data.items.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      if (name === data.active) {
        option.selected = true;
      }
      this.playlistsSelect.appendChild(option);
    });

    console.log('✅ Selector actualizado. Activa:', data.active);

    // Actualizar estado del botón de eliminar
    if (this.deleteBtn) {
      this.deleteBtn.disabled = data.items.length <= 1;
    }
  }

  renderPlaylist(playlist) {
    if (!this.listEl) {
      console.warn('⚠️ Elemento de lista no encontrado');
      return;
    }

    console.log('🎨 Renderizando playlist:', playlist.name, 'Canciones:', playlist.items.length);

    this.listEl.innerHTML = "";

    if (playlist.items.length === 0) {
      const li = document.createElement("li");
      li.className = "muted";
      li.style.padding = "20px";
      li.style.textAlign = "center";
      li.textContent = "Esta playlist está vacía. Agrega canciones usando el formulario de arriba.";
      this.listEl.appendChild(li);
      return;
    }

    playlist.items.forEach((song, index) => {
      const li = this.createSongItem(song, index, playlist.currentIndex);
      this.listEl.appendChild(li);
    });

    // Actualizar "Now Playing"
    this.updateNowPlaying(playlist);
  }

  createSongItem(song, index, currentIndex) {
    const li = document.createElement("li");
    li.className = "item" + (index === currentIndex ? " current" : "");

    // Metadatos de la canción
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${song.title} — ${song.artist}`;
    meta.title = `${song.title} por ${song.artist}`;

    // Botón de favorito
    const favBtn = document.createElement("button");
    favBtn.type = "button";
    favBtn.className = "star btn";
    favBtn.textContent = song.favorite ? "★" : "☆";
    favBtn.title = song.favorite ? "Quitar de favoritos" : "Agregar a favoritos";
    favBtn.onclick = () => this.toggleFavorite(song.id);

    // Botón de seleccionar
    const selectBtn = document.createElement("button");
    selectBtn.type = "button";
    selectBtn.className = "select btn";
    selectBtn.textContent = "Reproducir";
    selectBtn.title = "Reproducir esta canción";
    selectBtn.onclick = () => this.setCurrent(index);

    // Botón de agregar a fila
    const queueBtn = document.createElement("button");
    queueBtn.type = "button";
    queueBtn.className = "btn ghost";
    queueBtn.textContent = "A Fila";
    queueBtn.title = "Agregar a la fila de reproducción";
    queueBtn.onclick = () => this.addToQueue(song.id);

    // Botón de eliminar
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn";
    deleteBtn.textContent = "Eliminar";
    deleteBtn.title = "Eliminar de la playlist";
    deleteBtn.onclick = () => this.removeSong(song.id, song.title);

    li.appendChild(meta);
    li.appendChild(favBtn);
    li.appendChild(selectBtn);
    li.appendChild(queueBtn);
    li.appendChild(deleteBtn);

    return li;
  }

  updateNowPlaying(playlist) {
    if (!this.nowEl) return;

    const currentSong = playlist.items[playlist.currentIndex];
    
    if (currentSong) {
      this.nowEl.textContent = `Now playing [${playlist.name}]: ${currentSong.title} — ${currentSong.artist}`;
      this.nowEl.style.color = "var(--primary)";
    } else {
      this.nowEl.textContent = `Playlist "${playlist.name}" sin canción seleccionada`;
      this.nowEl.style.color = "var(--muted)";
    }
  }

  async activatePlaylist(name) {
    try {
      console.log('🔄 Activando playlist:', name);
      await activatePlaylist(name);
      await this.loadPlaylists();
      await this.loadCurrentPlaylist();
      console.log('✅ Playlist activada correctamente');
    } catch (error) {
      console.error("❌ Error activando playlist:", error);
      store.setError("Error al cambiar de playlist");
    }
  }

  async createPlaylist(name) {
    try {
      console.log('➕ Creando playlist:', name);
      await createPlaylist(name);
      await this.loadPlaylists();
      
      // Seleccionar la nueva playlist automáticamente
      if (this.playlistsSelect) {
        this.playlistsSelect.value = name;
        await this.activatePlaylist(name);
      }
      
      console.log('✅ Playlist creada correctamente');
    } catch (error) {
      console.error("❌ Error creando playlist:", error);
      
      if (error.message.includes('already exists')) {
        alert(`La playlist "${name}" ya existe. Usa otro nombre.`);
      } else {
        store.setError("Error al crear la playlist");
      }
    }
  }

  async deletePlaylist(name) {
    if (!confirm(`¿Eliminar la playlist "${name}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      console.log('🗑️ Eliminando playlist:', name);
      await deletePlaylist(name);
      await this.loadPlaylists();
      await this.loadCurrentPlaylist();
      console.log('✅ Playlist eliminada correctamente');
    } catch (error) {
      console.error("❌ Error eliminando playlist:", error);
      store.setError("Error al eliminar la playlist");
    }
  }

  async toggleFavorite(songId) {
    try {
      await toggleFavorite(songId);
    } catch (error) {
      console.error("❌ Error toggling favorite:", error);
      store.setError("Error al marcar como favorito");
    }
  }

  async setCurrent(index) {
    try {
      await setCurrent(index);
    } catch (error) {
      console.error("❌ Error seleccionando canción:", error);
      store.setError("Error al seleccionar la canción");
    }
  }

  async addToQueue(songId) {
    try {
      await enqueueSong(songId);
      this.showToast("Canción agregada a la fila", "success");
    } catch (error) {
      console.error("❌ Error agregando a la fila:", error);
      store.setError("Error al agregar a la fila");
    }
  }

  async removeSong(songId, title) {
    if (!confirm(`¿Eliminar "${title}" de esta playlist?`)) {
      return;
    }

    try {
      await removeSong(songId);
    } catch (error) {
      console.error("❌ Error eliminando canción:", error);
      store.setError("Error al eliminar la canción");
    }
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 100px;
      right: 20px;
      background: ${type === 'success' ? 'var(--accent)' : 'var(--primary)'};
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