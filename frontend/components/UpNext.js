import { store } from "../state/Store.js";
import { removeFromQueue, jumpTo } from "../Utils/Api.js";
export class UpNext {
  constructor() {
    this.queueEl = document.getElementById("queue");
    this.queueSize = document.getElementById("queueSize");

    this.init();
  }

  init() {
    this.setupStateSubscriptions();
  }

  setupStateSubscriptions() {
    // Subscribirse a cambios en upnext
    store.subscribe((upnext) => {
      this.render(upnext);
    }, 'upnextChanged');

    // Renderizar el estado inicial
    const initialUpNext = store.getState().upnext;
    if (initialUpNext) {
      this.render(initialUpNext);
    }
  }

  render(upnext) {
    if (!this.queueEl) return;

    // Actualizar el contador
    if (this.queueSize) {
      this.queueSize.textContent = upnext.items.length;
    }

    // Limpiar la lista
    this.queueEl.innerHTML = "";

    // Si no hay elementos en la fila
    if (upnext.items.length === 0) {
      const li = document.createElement("li");
      li.className = "muted";
      li.style.padding = "20px";
      li.style.textAlign = "center";
      li.textContent = "La fila de reproducción está vacía";
      this.queueEl.appendChild(li);
      return;
    }

    // Renderizar cada elemento
    upnext.items.forEach((song, index) => {
      const isFromQueue = index < upnext.queueCount;
      const row = this.createQueueRow(song, index, isFromQueue);
      this.queueEl.appendChild(row);
    });
  }

  createQueueRow(song, index, isFromQueue) {
    const li = document.createElement("li");
    li.className = "queue-item";
    
    // Agregar clase especial si es de la queue manual
    if (isFromQueue) {
      li.classList.add("manual-queue");
    }

    // Contenedor de información de la canción
    const songInfo = document.createElement("div");
    songInfo.className = "queue-song-info";
    
    // Número de posición
    const position = document.createElement("span");
    position.className = "queue-position";
    position.textContent = `${index + 1}.`;
    
    // Título y artista
    const meta = document.createElement("div");
    meta.className = "queue-meta";
    meta.textContent = `${song.title} — ${song.artist}`;
    meta.title = `${song.title} por ${song.artist}`;
    
    songInfo.appendChild(position);
    songInfo.appendChild(meta);

    // Contenedor de acciones
    const actions = document.createElement("div");
    actions.className = "queue-actions";

    if (isFromQueue) {
      // Si es de la queue manual, mostrar tag y botón quitar
      const tag = document.createElement("span");
      tag.className = "pill";
      tag.textContent = "En fila";
      tag.title = "Esta canción fue agregada manualmente a la fila";
      actions.appendChild(tag);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn ghost";
      removeBtn.textContent = "Quitar";
      removeBtn.title = "Quitar de la fila manual";
      removeBtn.onclick = () => this.removeFromQueue(index, song.title);
      actions.appendChild(removeBtn);
    } else {
      // Si es de la playlist, mostrar botón saltar
      const jumpBtn = document.createElement("button");
      jumpBtn.type = "button";
      jumpBtn.className = "btn ghost";
      jumpBtn.textContent = "Saltar";
      jumpBtn.title = "Reproducir esta canción ahora";
      jumpBtn.onclick = () => this.jumpToSong(song.id);
      actions.appendChild(jumpBtn);
    }

    li.appendChild(songInfo);
    li.appendChild(actions);

    return li;
  }

  async removeFromQueue(index, songTitle) {
    try {
      await removeFromQueue(index);
      // El estado se actualiza automáticamente
      
      this.showToast(`"${songTitle}" quitada de la fila`, 'info');
    } catch (error) {
      console.error("Error quitando de la fila:", error);
      store.setError("Error al quitar de la fila");
    }
  }

  async jumpToSong(songId) {
    try {
      await jumpTo(songId);
      // El estado y reproducción se manejan automáticamente en api.js
    } catch (error) {
      console.error("Error saltando a la canción:", error);
      store.setError("Error al saltar a la canción");
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

// Agregar estilos adicionales para la queue
const style = document.createElement('style');
style.textContent = `
  .queue-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 10px;
    border-top: 1px solid var(--stroke);
    transition: var(--transition);
  }

  .queue-item:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .queue-item.manual-queue {
    background: rgba(87, 210, 255, 0.05);
  }

  .queue-song-info {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
  }

  .queue-position {
    color: var(--muted);
    font-size: 12px;
    min-width: 20px;
    font-variant-numeric: tabular-nums;
  }

  .queue-meta {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
  }

  .queue-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  @keyframes slideInUp {
    from {
      transform: translateY(100px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutDown {
    from {
      transform: translateY(0);
      opacity: 1;
    }
    to {
      transform: translateY(100px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);