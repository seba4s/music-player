import { store } from "./state/Store.js";
import { 
  initializeApp, 
  getPlaylist, 
  getUpNext,
  uploadFile,
  addSong as apiAddSong
} from "./Utils/Api.js";
import { Player } from "./components/Player.js";
import { Playlist } from "./components/Playlist.js";
import { UpNext } from "./components/UpNext.js";
import { Favorites } from "./components/Favorites.js";

class MusicPlayerApp {
  constructor() {
    this.components = {};
    this.init();
  }

  async init() {
    // Esperar a que el DOM esté listo
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      await this.setup();
    }
  }

  async setup() {
    try {
      // Inicializar la aplicación (cargar datos iniciales)
      await initializeApp();

      // Inicializar componentes
      this.initializeComponents();
      
      // Configurar formularios
      this.setupForms();
      
      // Configurar botones globales
      this.setupGlobalButtons();

      // Configurar tema
      this.setupTheme();

      console.log('✅ Aplicación inicializada correctamente');
    } catch (error) {
      console.error('❌ Error inicializando la aplicación:', error);
      this.showError('Error cargando la aplicación. Por favor, recarga la página.');
    }
  }

  initializeComponents() {
    this.components.player = new Player();
    this.components.playlist = new Playlist();
    this.components.upNext = new UpNext();
    this.components.favorites = new Favorites();

    // Suscribirse a cambios de estado para actualizar la UI
    this.setupStateListeners();
  }

  setupStateListeners() {
    // Cuando cambie la playlist, actualizar el player
    store.subscribe((playlist) => {
      this.updatePlayerUI(playlist);
    }, 'playlistChanged');

    // Cuando cambie upnext, podríamos actualizar algo en la UI global
    store.subscribe((upnext) => {
      // Aquí podrías agregar lógica adicional si necesitas
    }, 'upnextChanged');
  }

  updatePlayerUI(playlist) {
    const barTitle = document.getElementById('barTitle');
    const barArtist = document.getElementById('barArtist');
    const player = document.getElementById('player');
    const nowPlaying = document.getElementById('nowPlaying');

    const currentSong = playlist.items[playlist.currentIndex];

    if (currentSong) {
      barTitle.textContent = currentSong.title;
      barArtist.textContent = currentSong.artist;
      
      if (player.src !== currentSong.url) {
        player.src = currentSong.url;
      }

      if (nowPlaying) {
        nowPlaying.textContent = `Now playing [${playlist.name}]: ${currentSong.title} — ${currentSong.artist}`;
      }
    } else {
      barTitle.textContent = '—';
      barArtist.textContent = '—';
      
      if (nowPlaying) {
        nowPlaying.textContent = `Playlist "${playlist.name}" sin canción seleccionada`;
      }

      if (playlist.size === 0) {
        player.removeAttribute('src');
      }
    }
  }

  setupForms() {
    this.setupUploadForm();
    this.setupAddSongForm();
  }

  setupUploadForm() {
    const uploadForm = document.getElementById('uploadForm');
    const audioFile = document.getElementById('audioFile');
    const uploadMsg = document.getElementById('uploadMsg');

    if (!uploadForm) return;

    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const file = audioFile.files?.[0];
      if (!file) {
        uploadMsg.textContent = 'Selecciona un archivo de audio.';
        uploadMsg.style.color = 'var(--red)';
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      uploadMsg.textContent = 'Subiendo...';
      uploadMsg.style.color = 'var(--muted)';

      try {
        const result = await uploadFile(formData);
        
        if (result.error) {
          uploadMsg.textContent = result.error;
          uploadMsg.style.color = 'var(--red)';
          return;
        }

        // Colocar la URL en el campo del formulario de agregar canción
        const urlInput = document.querySelector('input[name="url"]');
        if (urlInput) {
          urlInput.value = result.url;
        }

        uploadMsg.textContent = 'Subido ✓. URL lista en el formulario.';
        uploadMsg.style.color = 'var(--accent)';

        // Limpiar después de 3 segundos
        setTimeout(() => {
          uploadMsg.textContent = '';
          audioFile.value = '';
        }, 3000);

      } catch (error) {
        uploadMsg.textContent = 'Error al subir el archivo.';
        uploadMsg.style.color = 'var(--red)';
      }
    });
  }

  setupAddSongForm() {
    const addForm = document.getElementById('addForm');
    const audioFile = document.getElementById('audioFile');
    const uploadMsg = document.getElementById('uploadMsg');

    if (!addForm) return;

    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(addForm);
      
      let title = (formData.get('title') || '').trim() || 'Untitled';
      let artist = (formData.get('artist') || '').trim() || 'Unknown';
      let url = (formData.get('url') || '').trim();
      const position = formData.get('position') || 'end';
      const index = Number(formData.get('index') || 0);

      // Auto-subir si hay archivo seleccionado pero no URL
      if (!url && audioFile?.files?.[0]) {
        uploadMsg.textContent = 'Subiendo audio para esta canción...';
        uploadMsg.style.color = 'var(--muted)';

        try {
          const upFormData = new FormData();
          upFormData.append('file', audioFile.files[0]);
          const result = await uploadFile(upFormData);

          if (result.error) {
            alert(result.error);
            uploadMsg.textContent = '';
            return;
          }

          url = result.url;
          document.querySelector('input[name="url"]').value = url;
          uploadMsg.textContent = 'Subido ✓ (auto).';
          uploadMsg.style.color = 'var(--accent)';
        } catch (error) {
          alert('No se pudo subir el archivo.');
          uploadMsg.textContent = '';
          return;
        }
      }

      if (!url) {
        alert('Falta la URL o un archivo de audio para subir.');
        return;
      }

      // Obtener playlist activa
      const playlistsSelect = document.getElementById('playlists');
      const targetPlaylist = playlistsSelect?.value;

      const songData = {
        title,
        artist,
        url,
        position,
        index,
        playlist: targetPlaylist
      };

      try {
        await apiAddSong(songData);
        
        // Limpiar formulario
        addForm.reset();
        
        // Limpiar mensaje de upload
        if (uploadMsg) {
          uploadMsg.textContent = '';
        }
        
        // Limpiar archivo seleccionado
        if (audioFile) {
          audioFile.value = '';
        }

        console.log('✅ Canción agregada exitosamente');
      } catch (error) {
        console.error('Error agregando canción:', error);
        alert('Error al agregar la canción. Intenta de nuevo.');
      }
    });
  }

  setupGlobalButtons() {
    // Botón de limpiar cola
    const clearQueueBtn = document.getElementById('clearQueue');
    if (clearQueueBtn) {
      clearQueueBtn.addEventListener('click', async () => {
        if (confirm('¿Vaciar la fila de reproducción?')) {
          try {
            const { clearQueue } = await import('./Utils/Api.js');
            await clearQueue();
          } catch (error) {
            console.error('Error limpiando la cola:', error);
          }
        }
      });
    }
  }

  setupTheme() {
    const themeToggle = document.getElementById('themeToggle');
    
    if (!themeToggle) return;

    // Cargar tema guardado
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.dataset.theme = savedTheme;

    themeToggle.addEventListener('click', () => {
      const currentTheme = document.body.dataset.theme;
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      document.body.dataset.theme = newTheme;
      localStorage.setItem('theme', newTheme);

      // Animación suave
      document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    });
  }

  showError(message) {
    // Crear un toast de error
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--red);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      z-index: 9999;
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }
}

// Inicializar la aplicación
const app = new MusicPlayerApp();

// Exportar para acceso global si es necesario
window.musicPlayerApp = app;
window.store = store; // Para debugging

// Agregar estilos para el toast
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);