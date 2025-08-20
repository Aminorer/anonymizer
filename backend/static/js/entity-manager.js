/**
 * Entity Management System
 */
class EntityManager {
  constructor(options = {}) {
    this.options = {
      typeColors: {
        EMAIL: "#ffeb3b",
        PERSON: "#4caf50",
        ORG: "#2196f3",
        LOC: "#9c27b0",
        DATE: "#ff9800",
        PHONE: "#f44336",
      },
      confidenceThreshold: 0.8,
      ...options,
    };

    this.entities = new Map();
    this.groups = new Map();
    this.selectedEntity = null;
    this.eventListeners = new Map();

    // Initialize virtual list for performance
    this.virtualList = new VirtualList();
  }

  // Event System
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(callback);
  }

  off(event, callback) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  emit(event, data) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        callback(data);
      }
    }
  }

  // Entity Management
  addEntity(entity) {
    if (!entity.id) entity.id = this.generateId();
    if (!entity.confidence) entity.confidence = 1.0;
    if (!entity.status) entity.status = "pending";

    this.entities.set(entity.id, {
      selected: false,
      highlights: [],
      annotations: [],
      ...entity,
    });

    this.virtualList.addItem(entity.id);
    this.emit("entityAdded", { entity });
    return entity.id;
  }

  updateEntity(id, updates) {
    const entity = this.entities.get(id);
    if (!entity) return false;

    Object.assign(entity, updates);
    this.emit("entityUpdated", { entity });
    return true;
  }

  removeEntity(id) {
    const entity = this.entities.get(id);
    if (!entity) return false;

    this.entities.delete(id);
    this.virtualList.removeItem(id);

    if (this.selectedEntity === id) {
      this.selectedEntity = null;
    }

    this.emit("entityRemoved", { id, entity });
    return true;
  }

  getEntity(id) {
    return this.entities.get(id);
  }

  getAllEntities() {
    return Array.from(this.entities.values());
  }

  filterEntities(predicate) {
    return this.getAllEntities().filter(predicate);
  }

  // Entity Selection
  selectEntity(id) {
    if (this.selectedEntity === id) return;

    if (this.selectedEntity) {
      const previousEntity = this.entities.get(this.selectedEntity);
      if (previousEntity) previousEntity.selected = false;
    }

    const entity = this.entities.get(id);
    if (entity) {
      entity.selected = true;
      this.selectedEntity = id;
      this.emit("entitySelected", { entity });
    }
  }

  deselectEntity() {
    if (!this.selectedEntity) return;

    const entity = this.entities.get(this.selectedEntity);
    if (entity) {
      entity.selected = false;
      this.emit("entityDeselected", { entity });
    }
    this.selectedEntity = null;
  }

  // Entity Highlights
  addHighlight(entityId, highlight) {
    const entity = this.entities.get(entityId);
    if (!entity) return false;

    entity.highlights.push(highlight);
    this.emit("highlightAdded", { entityId, highlight });
    return true;
  }

  removeHighlight(entityId, highlightId) {
    const entity = this.entities.get(entityId);
    if (!entity) return false;

    const index = entity.highlights.findIndex((h) => h.id === highlightId);
    if (index === -1) return false;

    entity.highlights.splice(index, 1);
    this.emit("highlightRemoved", { entityId, highlightId });
    return true;
  }

  // Entity Annotations
  addAnnotation(entityId, annotation) {
    const entity = this.entities.get(entityId);
    if (!entity) return false;

    annotation.id = this.generateId();
    annotation.timestamp = Date.now();

    entity.annotations.push(annotation);
    this.emit("annotationAdded", { entityId, annotation });
    return annotation.id;
  }

  removeAnnotation(entityId, annotationId) {
    const entity = this.entities.get(entityId);
    if (!entity) return false;

    const index = entity.annotations.findIndex((a) => a.id === annotationId);
    if (index === -1) return false;

    entity.annotations.splice(index, 1);
    this.emit("annotationRemoved", { entityId, annotationId });
    return true;
  }

  // Group Management
  createGroup(name) {
    const id = this.generateId();
    const group = {
      id,
      name,
      entities: new Set(),
      created: Date.now(),
    };

    this.groups.set(id, group);
    this.emit("groupCreated", { group });
    return id;
  }

  removeGroup(id) {
    const group = this.groups.get(id);
    if (!group) return false;

    this.groups.delete(id);
    this.emit("groupRemoved", { id, group });
    return true;
  }

  addEntityToGroup(entityId, groupId) {
    const entity = this.entities.get(entityId);
    const group = this.groups.get(groupId);

    if (!entity || !group) return false;

    group.entities.add(entityId);
    this.emit("entityAddedToGroup", { entityId, groupId });
    return true;
  }

  removeEntityFromGroup(entityId, groupId) {
    const group = this.groups.get(groupId);
    if (!group) return false;

    const result = group.entities.delete(entityId);
    if (result) {
      this.emit("entityRemovedFromGroup", { entityId, groupId });
    }
    return result;
  }

  // Search and Filter
  searchEntities(query) {
    query = query.toLowerCase();
    return this.filterEntities(
      (entity) =>
        entity.value.toLowerCase().includes(query) ||
        entity.type.toLowerCase().includes(query)
    );
  }

  filterByType(type) {
    return this.filterEntities((entity) => entity.type === type);
  }

  filterByConfidence(threshold) {
    return this.filterEntities((entity) => entity.confidence >= threshold);
  }

  // Utility Functions
  generateId() {
    return "entity_" + Math.random().toString(36).substr(2, 9);
  }

  getTypeColor(type) {
    return this.options.typeColors[type] || "#999999";
  }

  serialize() {
    return {
      entities: Array.from(this.entities.values()),
      groups: Array.from(this.groups.values()),
    };
  }

  deserialize(data) {
    this.entities.clear();
    this.groups.clear();
    this.selectedEntity = null;

    if (data.entities) {
      for (const entity of data.entities) {
        this.addEntity(entity);
      }
    }

    if (data.groups) {
      for (const group of data.groups) {
        const id = this.createGroup(group.name);
        const newGroup = this.groups.get(id);
        for (const entityId of group.entities) {
          newGroup.entities.add(entityId);
        }
      }
    }
  }
}

/**
 * Virtual List for performance optimization
 */
class VirtualList {
  constructor(options = {}) {
    this.options = {
      itemHeight: 48,
      overscan: 5,
      ...options,
    };

    this.items = [];
    this.visibleItems = new Set();
    this.container = null;
    this.content = null;
    this.scrollTop = 0;

    this.updateVisibleItems = this.updateVisibleItems.bind(this);
  }

  mount(container) {
    this.container = container;
    this.content = document.createElement("div");
    this.content.style.position = "relative";
    this.container.appendChild(this.content);

    this.container.addEventListener("scroll", this.updateVisibleItems);
    window.addEventListener("resize", this.updateVisibleItems);

    this.updateVisibleItems();
  }

  unmount() {
    if (this.container) {
      this.container.removeEventListener("scroll", this.updateVisibleItems);
      window.removeEventListener("resize", this.updateVisibleItems);
      this.container = null;
      this.content = null;
    }
  }

  addItem(id) {
    this.items.push(id);
    this.updateContentHeight();
    this.updateVisibleItems();
  }

  removeItem(id) {
    const index = this.items.indexOf(id);
    if (index !== -1) {
      this.items.splice(index, 1);
      this.updateContentHeight();
      this.updateVisibleItems();
    }
  }

  updateContentHeight() {
    if (this.content) {
      this.content.style.height = `${
        this.items.length * this.options.itemHeight
      }px`;
    }
  }

  updateVisibleItems() {
    if (!this.container || !this.content) return;

    const { scrollTop, clientHeight } = this.container;
    const startIndex = Math.floor(scrollTop / this.options.itemHeight);
    const endIndex = Math.ceil(
      (scrollTop + clientHeight) / this.options.itemHeight
    );

    const visibleRange = {
      start: Math.max(0, startIndex - this.options.overscan),
      end: Math.min(this.items.length, endIndex + this.options.overscan),
    };

    const newVisibleItems = new Set(
      this.items.slice(visibleRange.start, visibleRange.end)
    );

    // Remove items that are no longer visible
    for (const id of this.visibleItems) {
      if (!newVisibleItems.has(id)) {
        this.emit("itemHidden", id);
      }
    }

    // Add newly visible items
    for (const id of newVisibleItems) {
      if (!this.visibleItems.has(id)) {
        this.emit("itemVisible", id);
      }
    }

    this.visibleItems = newVisibleItems;
  }
}

window.EntityManager = EntityManager;
