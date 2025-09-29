import { store } from '../state/Store.js';

const API_BASE = "";

// Función base API con manejo de errores mejorado
export const API = async (path, options = {}) => {
  try {
    store.setLoading(true);
    store.clearError();
    
    const response = await fetch(`${API_BASE}${path}`, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    
    store.setLoading(false);
    return data;
  } catch (error) {
    store.setLoading(false);
    store.setError(error.message);
    console.error(`API Error [${path}]:`, error);
    throw error;
  }
};

// ===== FUNCIONES CON PRESERVACIÓN DE ESTADO =====

// Función helper para preservar reproducción durante cambios
const preservePlaybackDuring = async (apiCall) => {
  const playbackState = store.preservePlaybackState();
  
  try {
    const result = await apiCall();
    
    // Solo restaurar si estaba reproduciéndose antes
    if (playbackState.isPlaying && !playbackState.userPaused) {
      setTimeout(() => {
        const audioElement = document.getElementById('player');
        if (audioElement && !store.getState().userPaused) {
          audioElement.currentTime = playbackState.currentTime;
          audioElement.play().catch(() => {});
        }
      }, 100);
    }
    
    return result;
  } catch (error) {
    throw error;
  }
};

// ===== PLAYLISTS =====
export const getPlaylist = async () => {
  const data = await API("/api/playlist");
  store.setState({ playlist: data });
  return data;
};

export const getPlaylists = () => API("/api/playlists");

export const createPlaylist = async (name) => {
  const data = await API("/api/playlists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  return data;
};

export const activatePlaylist = async (name) => {
  return await preservePlaybackDuring(async () => {
    const data = await API("/api/playlists/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    
    // Recargar playlist después del cambio
    await getPlaylist();
    await getUpNext();
    
    return data;
  });
};

export const deletePlaylist = async (name) => {
  return await preservePlaybackDuring(async () => {
    const data = await API(`/api/playlists/${name}`, { method: "DELETE" });
    await getPlaylist();
    return data;
  });
};

// ===== CANCIONES =====
export const addSong = async (songData) => {
  return await preservePlaybackDuring(async () => {
    const data = await API("/api/songs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(songData)
    });
    
    store.setState({ playlist: data });
    await getUpNext();
    return data;
  });
};

export const removeSong = async (id) => {
  return await preservePlaybackDuring(async () => {
    const data = await API(`/api/songs/${id}`, { method: "DELETE" });
    store.setState({ playlist: data });
    await getUpNext();
    return data;
  });
};

export const toggleFavorite = async (id) => {
  return await preservePlaybackDuring(async () => {
    const data = await API(`/api/songs/${id}/favorite`, { method: "PATCH" });
    store.setState({ playlist: data });
    return data;
  });
};

export const getFavorites = () => API("/api/favorites");

// ===== CONTROLES DE REPRODUCCIÓN =====
export const setCurrent = async (index) => {
  const data = await API("/api/control/current", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ index })
  });
  
  store.setState({ 
    playlist: data,
    userPaused: false // Al seleccionar canción, resetear pausa manual
  });
  
  await getUpNext();
  
  // Auto-reproducir la nueva canción
  setTimeout(() => {
    const audioElement = document.getElementById('player');
    if (audioElement) {
      audioElement.play().catch(() => {});
    }
  }, 100);
  
  return data;
};

export const next = async () => {
  const data = await API("/api/control/next", { method: "POST" });
  store.setState({ 
    playlist: data,
    userPaused: false 
  });
  
  await getUpNext();
  
  // Auto-reproducir siguiente canción
  setTimeout(() => {
    const audioElement = document.getElementById('player');
    if (audioElement) {
      audioElement.play().catch(() => {});
    }
  }, 100);
  
  return data;
};

export const prev = async () => {
  const data = await API("/api/control/prev", { method: "POST" });
  store.setState({ 
    playlist: data,
    userPaused: false 
  });
  
  await getUpNext();
  
  // Auto-reproducir canción anterior
  setTimeout(() => {
    const audioElement = document.getElementById('player');
    if (audioElement) {
      audioElement.play().catch(() => {});
    }
  }, 100);
  
  return data;
};

export const jumpTo = async (songId) => {
  const data = await API("/api/control/jump", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ songId })
  });
  
  store.setState({ 
    playlist: data,
    userPaused: false 
  });
  
  await getUpNext();
  
  // Auto-reproducir canción
  setTimeout(() => {
    const audioElement = document.getElementById('player');
    if (audioElement) {
      audioElement.play().catch(() => {});
    }
  }, 100);
  
  return data;
};

// ===== QUEUE =====
export const getUpNext = async () => {
  const data = await API("/api/upnext");
  store.setState({ upnext: data });
  return data;
};

export const getQueue = () => API("/api/queue");

export const enqueueSong = async (songId) => {
  return await preservePlaybackDuring(async () => {
    const data = await API("/api/queue/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songId })
    });
    
    await getUpNext();
    return data;
  });
};

export const removeFromQueue = async (index) => {
  return await preservePlaybackDuring(async () => {
    const data = await API(`/api/queue/${index}`, { method: "DELETE" });
    await getUpNext();
    await getPlaylist();
    return data;
  });
};

export const clearQueue = async () => {
  return await preservePlaybackDuring(async () => {
    const data = await API("/api/queue/clear", { method: "POST" });
    await getUpNext();
    return data;
  });
};

// ===== MODOS =====
export const setMode = async (modeData) => {
  return await preservePlaybackDuring(async () => {
    const data = await API("/api/mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(modeData)
    });
    
    // Actualizar modos en playlist
    const currentPlaylist = store.getState().playlist;
    store.setState({ 
      playlist: { ...currentPlaylist, modes: data }
    });
    
    await getUpNext();
    return data;
  });
};

export const getMode = () => API("/api/mode");

// ===== UPLOAD =====
export const uploadFile = async (formData) => {
  store.setLoading(true);
  try {
    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    
    store.setLoading(false);
    return data;
  } catch (error) {
    store.setLoading(false);
    store.setError(error.message);
    throw error;
  }
};

// ===== ACCIONES COMBINADAS =====
export const initializeApp = async () => {
  try {
    store.setLoading(true);
    
    // Cargar datos iniciales
    await Promise.all([
      getPlaylist(),
      getUpNext(),
      getMode()
    ]);
    
    store.setLoading(false);
    store.emit('appInitialized');
  } catch (error) {
    console.error('Error initializing app:', error);
    store.setError('Error cargando la aplicación');
  }
};

// ===== PLAYER CONTROLS =====
export const play = () => {
  store.setState({ userPaused: false });
  const audioElement = document.getElementById('player');
  if (audioElement) {
    return audioElement.play();
  }
};

export const pause = () => {
  store.setState({ userPaused: true });
  const audioElement = document.getElementById('player');
  if (audioElement) {
    audioElement.pause();
  }
};

export const togglePlayPause = () => {
  const audioElement = document.getElementById('player');
  if (audioElement) {
    if (audioElement.paused) {
      return play();
    } else {
      return pause();
    }
  }
};