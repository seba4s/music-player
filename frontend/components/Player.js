import { store } from "../state/Store.js";
import { next, prev, setMode, togglePlayPause } from "../Utils/api.js";

export class Player {
  constructor() {
    this.player = document.getElementById("player");
    this.seek = document.getElementById("seek");
    this.volume = document.getElementById("volume");
    this.elapsed = document.getElementById("elapsed");
    this.remaining = document.getElementById("remaining");
    this.muteBtn = document.getElementById("muteBtn");
    this.repeatBtn = document.getElementById("repeatBtn");
    this.shuffleBtn = document.getElementById("shuffleBtn");
    this.playBtn = document.getElementById("playBtn");
    this.nextBtn = document.getElementById("nextBtn");
    this.prevBtn = document.getElementById("prevBtn");

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupStateSubscriptions();
    this.loadVolumePreference();
  }

  setupEventListeners() {
    // Eventos del elemento audio
    this.player.addEventListener("timeupdate", () => this.updateProgress());
    this.player.addEventListener("loadedmetadata", () => this.onLoadedMetadata());
    this.player.addEventListener("ended", () => this.handleEnd());
    this.player.addEventListener("pause", () => this.handlePause());
    this.player.addEventListener("play", () => this.handlePlay());
    this.player.addEventListener("error", (e) => this.handleError(e));

    // Controles
    this.seek.addEventListener("input", () => this.seekTo());
    this.volume.addEventListener("input", (e) => this.setVolume(e.target.value));
    
    // Botones
    this.muteBtn.onclick = () => this.toggleMute();
    this.repeatBtn.onclick = () => this.toggleRepeat();
    this.shuffleBtn.onclick = () => this.toggleShuffle();
    this.playBtn.onclick = () => this.togglePlayPause();
    this.nextBtn.onclick = () => this.next();
    this.prevBtn.onclick = () => this.prev();

    // Prevenir pausas accidentales por visibilidad
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && this.player.src && !this.player.paused) {
        this.player.play().catch(() => {});
      }
    });
  }

  setupStateSubscriptions() {
    // Subscribirse a cambios de playlist para actualizar modos
    store.subscribe((playlist) => {
      this.updateModeButtons(playlist.modes);
    }, 'playlistChanged');

    // Actualizar estado del player en el store
    this.player.addEventListener('timeupdate', () => {
      store.setState({
        player: {
          currentTime: this.player.currentTime,
          duration: this.player.duration,
          isPlaying: !this.player.paused
        }
      }, true); // silent = true para no emitir eventos por cada timeupdate
    });
  }

  updateProgress() {
    if (!isFinite(this.player.duration)) return;
    
    const percent = (this.player.currentTime / this.player.duration) * 100;
    this.seek.value = percent || 0;
    this.elapsed.textContent = this.formatTime(this.player.currentTime);
    this.remaining.textContent = this.formatTime(
      Math.max(this.player.duration - this.player.currentTime, 0)
    );
  }

  onLoadedMetadata() {
    this.elapsed.textContent = "0:00";
    this.remaining.textContent = this.formatTime(this.player.duration || 0);
  }

  formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) seconds = 0;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  seekTo() {
    if (!isFinite(this.player.duration)) return;
    this.player.currentTime = (this.seek.value / 100) * this.player.duration;
  }

  setVolume(value) {
    const vol = Number(value);
    this.player.volume = vol;
    this.player.muted = vol === 0;
    this.muteBtn.textContent = this.player.muted ? "🔈" : "🔊";
    
    // Guardar preferencia
    localStorage.setItem('playerVolume', vol);
    
    // Actualizar store
    store.setState({
      player: {
        volume: vol,
        muted: this.player.muted
      }
    }, true);
  }

  loadVolumePreference() {
    const savedVolume = localStorage.getItem('playerVolume');
    if (savedVolume !== null) {
      const vol = Number(savedVolume);
      this.volume.value = vol;
      this.player.volume = vol;
      this.muteBtn.textContent = vol === 0 ? "🔈" : "🔊";
    }
  }

  toggleMute() {
    this.player.muted = !this.player.muted;
    this.muteBtn.textContent = this.player.muted ? "🔈" : "🔊";
    
    if (!this.player.muted && this.player.volume === 0) {
      this.volume.value = 0.5;
      this.player.volume = 0.5;
      localStorage.setItem('playerVolume', 0.5);
    }

    store.setState({
      player: { muted: this.player.muted }
    }, true);
  }

  async toggleRepeat() {
    const modes = store.playlist.modes;
    const nextMode = modes.repeat === "off" ? "all" : 
                     modes.repeat === "all" ? "one" : "off";
    
    try {
      await setMode({ repeat: nextMode });
    } catch (error) {
      console.error('Error toggling repeat:', error);
    }
  }

  async toggleShuffle() {
    const modes = store.playlist.modes;
    
    try {
      await setMode({ shuffle: !modes.shuffle });
    } catch (error) {
      console.error('Error toggling shuffle:', error);
    }
  }

  updateModeButtons(modes) {
    this.shuffleBtn.style.outline = modes.shuffle ? "2px solid #57d2ff" : "none";
    this.shuffleBtn.style.background = modes.shuffle ? 
      "rgba(87, 210, 255, 0.15)" : "rgba(255, 255, 255, 0.06)";
    
    this.repeatBtn.textContent = modes.repeat === "one" ? "🔂" : "🔁";
    this.repeatBtn.style.outline = modes.repeat !== "off" ? "2px solid #57d2ff" : "none";
    this.repeatBtn.style.background = modes.repeat !== "off" ? 
      "rgba(87, 210, 255, 0.15)" : "rgba(255, 255, 255, 0.06)";
  }

  async handleEnd() {
    try {
      await next();
    } catch (error) {
      console.error('Error en auto-next:', error);
    }
  }

  handlePause() {
    const userPaused = store.getState().userPaused;
    
    // Solo intentar reanudar si NO fue pausa intencional del usuario
    if (!userPaused && !this.player.ended) {
      setTimeout(() => {
        if (!store.getState().userPaused && !this.player.ended) {
          this.player.play().catch(() => {});
        }
      }, 100);
    }

    // Actualizar UI del botón play
    this.updatePlayButton();
  }

  handlePlay() {
    store.setState({ 
      player: { isPlaying: true }
    }, true);
    
    this.updatePlayButton();
  }

  updatePlayButton() {
    if (this.playBtn) {
      this.playBtn.textContent = this.player.paused ? "▶️" : "⏸";
      this.playBtn.title = this.player.paused ? "Reproducir" : "Pausar";
    }
  }

  async togglePlayPause() {
    try {
      await togglePlayPause();
      this.updatePlayButton();
    } catch (error) {
      console.error('Error toggling play/pause:', error);
    }
  }

  async next() {
    try {
      await next();
    } catch (error) {
      console.error('Error en next:', error);
    }
  }

  async prev() {
    try {
      await prev();
    } catch (error) {
      console.error('Error en prev:', error);
    }
  }

  handleError(e) {
    console.error('Error en el reproductor de audio:', e);
    
    const error = this.player.error;
    let message = 'Error reproduciendo el audio';
    
    if (error) {
      switch (error.code) {
        case error.MEDIA_ERR_ABORTED:
          message = 'Reproducción abortada';
          break;
        case error.MEDIA_ERR_NETWORK:
          message = 'Error de red al cargar el audio';
          break;
        case error.MEDIA_ERR_DECODE:
          message = 'Error decodificando el audio';
          break;
        case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          message = 'Formato de audio no soportado';
          break;
      }
    }
    
    store.setError(message);
  }
}