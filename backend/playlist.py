import uuid

class Node:
    def __init__(self, song):
        self.song = song
        self.prev = None
        self.next = None

class DoublyLinkedList:
    def __init__(self):
        self.head = None
        self.tail = None
        self.size = 0
        self.current = None

    def to_list(self):
        items, i, cur_index = [], 0, -1
        n = self.head
        while n:
            if n is self.current:
                cur_index = i
            items.append(n.song)
            n = n.next
            i += 1
        return {"size": self.size, "currentIndex": cur_index, "items": items}

    def _get_node(self, index):
        if index < 0 or index >= self.size:
            raise IndexError("index out of range")
        n = self.head
        for _ in range(index):
            n = n.next
        return n

    def _append_node(self, node):
        if not self.tail:
            self.head = self.tail = node
            self.current = self.head
        else:
            node.prev = self.tail
            self.tail.next = node
            self.tail = node
        self.size += 1

    def add_first(self, song):
        node = Node(song)
        if not self.head:
            self.head = self.tail = node
            self.current = self.head
        else:
            node.next = self.head
            self.head.prev = node
            self.head = node
        self.size += 1

    def add_last(self, song):
        self._append_node(Node(song))

    def add_at(self, index, song):
        if index == 0:
            return self.add_first(song)
        if index == self.size:
            return self.add_last(song)
        if index < 0 or index > self.size:
            raise IndexError("index out of range")
        next_node = self._get_node(index)
        prev_node = next_node.prev
        node = Node(song)
        node.prev = prev_node
        node.next = next_node
        prev_node.next = node
        next_node.prev = node
        self.size += 1
        if self.current is None:
            self.current = node

    def remove_by_id(self, sid: str):
        n = self.head
        while n:
            if n.song["id"] == sid:
                if n.prev: n.prev.next = n.next
                else: self.head = n.next
                if n.next: n.next.prev = n.prev
                else: self.tail = n.prev
                was_current = (n is self.current)
                self.size -= 1
                if self.size == 0:
                    self.current = None
                elif was_current:
                    self.current = n.next or n.prev
                return True
            n = n.next
        return False

    def find_by_id(self, sid: str):
        n = self.head
        idx = 0
        while n:
            if n.song["id"] == sid:
                return idx, n.song
            n = n.next
            idx += 1
        return -1, None

    def set_current(self, index):
        if self.size == 0:
            self.current = None
            return
        self.current = self._get_node(index)

    def move_next(self):
        if self.current and self.current.next:
            self.current = self.current.next

    def move_prev(self):
        if self.current and self.current.prev:
            self.current = self.current.prev

def new_song(title, artist, url):
    return {
        "id": str(uuid.uuid4()),
        "title": title,
        "artist": artist,
        "url": url,
        "favorite": False
    }

class PlaylistManager:
    """
    Administra múltiples playlists y una Fila de reproducción (queue).
    - playlists: dict[name] -> DoublyLinkedList
    - active: nombre de la playlist activa
    - queue: lista de canciones (dict song) que se reproducirán antes que 'next' del listado
    """
    def __init__(self):
        self.playlists = {}
        self.active = None
        self.queue = []

    def create(self, name: str):
        if name in self.playlists:
            raise ValueError("playlist already exists")
        self.playlists[name] = DoublyLinkedList()
        if self.active is None:
            self.active = name

    def remove(self, name: str):
        if name not in self.playlists:
            return False
        del self.playlists[name]
        if self.active == name:
            self.active = next(iter(self.playlists), None)  # otra existente o None
        return True

    def set_active(self, name: str):
        if name not in self.playlists:
            raise ValueError("playlist not found")
        self.active = name

    def active_list(self) -> DoublyLinkedList:
        if self.active is None:
            raise ValueError("no active playlist")
        return self.playlists[self.active]

    def enqueue(self, song):
        self.queue.append(song)

    def dequeue(self):
        if self.queue:
            return self.queue.pop(0)
        return None

    def queue_state(self):
        return {"size": len(self.queue), "items": self.queue.copy()}