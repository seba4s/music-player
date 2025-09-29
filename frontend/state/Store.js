class EventEmitter {
  constructor() {
    this.events = {};
  }
  
  on(event, callback) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
    
    // Retornar función para desuscribirse
    return () => {
      const index = this.events[event].indexOf(callback);
      if (index > -1) this.events[event].splice(index, 1);
    };
  }
  
  emit(event, data) {
    if (this.events[event]) {
      this.events[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }
}

export class Store extends EventEmitter {
  constructor() {
    super();
    this.state = {
      playlist: {
        name: "",
        size: 0,
        currentIndex: -1,
        items: [],
        queue: { size: 0, items: [] },
        modes: { shuffle: false, repeat: "off" }
      },
      upnext: {
        current: null,
        items: [],
        queueCount: 0,
        modes: { shuffle: false, repeat: "off" }
      },
      userPaused: false,
      player: {
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        volume: 1,
        muted: false
      },
      ui: {
        loading: false,
        error: null
      }
    };
  }

  // Deep merge para objetos anidados
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  setState(newState, silent = false) {
    const prevState = { ...this.state };
    this.state = this.deepMerge(this.state, newState);
    
    if (!silent) {
      this.emit('stateChanged', {
        newState: this.state,
        prevState,
        changes: newState
      });
      
      // Emitir eventos específicos para cambios importantes
      if (newState.playlist) {
        this.emit('playlistChanged', this.state.playlist);
      }
      if (newState.upnext) {
        this.emit('upnextChanged', this.state.upnext);
      }
      if (newState.player) {
        this.emit('playerChanged', this.state.player);
      }
    }
  }

  getState() {
    return { ...this.state }; // Clonar para evitar mutaciones accidentales
  }

  // Getters específicos para facilitar el acceso
  get playlist() {
    return this.state.playlist;
  }

  get upnext() {
    return this.state.upnext;
  }

  get player() {
    return this.state.player;
  }

  get currentSong() {
    const { items, currentIndex } = this.state.playlist;
    return items[currentIndex] || null;
  }

  // Acciones comunes
  setLoading(loading) {
    this.setState({ ui: { loading } });
  }

  setError(error) {
    this.setState({ ui: { error } });
  }

  clearError() {
    this.setState({ ui: { error: null } });
  }

  // Preservar estado de reproducción
  preservePlaybackState() {
    return {
      isPlaying: this.state.player.isPlaying,
      currentTime: this.state.player.currentTime,
      userPaused: this.state.userPaused
    };
  }

  restorePlaybackState(savedState) {
    this.setState({
      player: {
        isPlaying: savedState.isPlaying,
        currentTime: savedState.currentTime
      },
      userPaused: savedState.userPaused
    });
  }

  // Subscribe a cambios específicos
  subscribe(callback, filter) {
    if (typeof filter === 'string') {
      // Subscribirse a un evento específico
      return this.on(filter, callback);
    } else if (typeof filter === 'function') {
      // Subscribirse con filtro personalizado
      return this.on('stateChanged', ({ newState, prevState }) => {
        if (filter(newState, prevState)) {
          callback(newState, prevState);
        }
      });
    } else {
      // Subscribirse a todos los cambios
      return this.on('stateChanged', callback);
    }
  }

  // Debugger para desarrollo
  enableDebugMode() {
    this.on('stateChanged', ({ changes }) => {
      console.log('🔄 State changed:', changes);
    });
    
    this.on('playlistChanged', (playlist) => {
      console.log('🎵 Playlist changed:', playlist.name);
    });
    
    this.on('playerChanged', (player) => {
      console.log('▶️ Player changed:', { 
        isPlaying: player.isPlaying, 
        currentTime: player.currentTime 
      });
    });
  }
}

// Instancia global del store
export const store = new Store();

// Solo para desarrollo - habilitar debug en consola
if (import.meta.env?.DEV || window.location.hostname === 'localhost') {
  store.enableDebugMode();
  window.store = store; // Acceso global para debugging
}