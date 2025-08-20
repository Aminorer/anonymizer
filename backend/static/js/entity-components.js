/**
 * UI Components for Entity Management
 */

// Entity List Component
class EntityListComponent {
  constructor(container, entityManager, options = {}) {
    this.container = container;
    this.entityManager = entityManager;
    this.options = {
      itemHeight: 48,
      batchSize: 20,
      ...options,
    };

    // Initialize virtual list
    this.virtualList = new VirtualList({
      itemHeight: this.options.itemHeight,
    });

    // Setup UI
    this.setupUI();
    this.setupEventListeners();
  }

  setupUI() {
    this.container.innerHTML = `
            <div class="entity-list-container">
                <div class="entity-list-header flex items-center justify-between p-4 border-b">
                    <div class="flex items-center space-x-2">
                        <h3 class="font-semibold">Entités</h3>
                        <span class="entity-count px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">0</span>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button class="select-all-btn text-sm text-blue-600 hover:text-blue-800">
                            <i class="fas fa-check-square mr-1"></i>Tout sélectionner
                        </button>
                        <button class="add-entity-btn p-1 text-blue-600 hover:text-blue-800">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
                <div class="entity-list-filters p-4 border-b">
                    <div class="flex items-center space-x-2">
                        <input type="text" class="search-input flex-1 px-3 py-2 border rounded" placeholder="Rechercher...">
                        <select class="type-filter px-3 py-2 border rounded">
                            <option value="">Tous les types</option>
                            <!-- Types will be populated dynamically -->
                        </select>
                    </div>
                </div>
                <div class="entity-list-content flex-1 overflow-auto"></div>
            </div>
        `;

    this.listContent = this.container.querySelector(".entity-list-content");
    this.searchInput = this.container.querySelector(".search-input");
    this.typeFilter = this.container.querySelector(".type-filter");
    this.entityCount = this.container.querySelector(".entity-count");

    // Mount virtual list
    this.virtualList.mount(this.listContent);
  }

  setupEventListeners() {
    // Entity Manager Events
    this.entityManager.on("entityAdded", () => this.refreshList());
    this.entityManager.on("entityRemoved", () => this.refreshList());
    this.entityManager.on("entityUpdated", () => this.refreshList());

    // UI Events
    this.searchInput.addEventListener("input", () => this.onSearch());
    this.typeFilter.addEventListener("change", () => this.onFilterChange());

    this.container
      .querySelector(".select-all-btn")
      .addEventListener("click", () => this.onSelectAll());
    this.container
      .querySelector(".add-entity-btn")
      .addEventListener("click", () => this.onAddEntity());

    // Virtual List Events
    this.virtualList.on("itemVisible", (id) => this.renderEntity(id));
    this.virtualList.on("itemHidden", (id) => this.removeEntityElement(id));
  }

  refreshList() {
    const entities = this.getFilteredEntities();
    this.entityCount.textContent = entities.length;

    // Update virtual list
    this.virtualList.clear();
    entities.forEach((entity) => this.virtualList.addItem(entity.id));

    // Update type filter options
    this.updateTypeFilterOptions();
  }

  getFilteredEntities() {
    let entities = this.entityManager.getAllEntities();

    // Apply search filter
    const searchTerm = this.searchInput.value.toLowerCase();
    if (searchTerm) {
      entities = entities.filter(
        (entity) =>
          entity.value.toLowerCase().includes(searchTerm) ||
          entity.type.toLowerCase().includes(searchTerm)
      );
    }

    // Apply type filter
    const selectedType = this.typeFilter.value;
    if (selectedType) {
      entities = entities.filter((entity) => entity.type === selectedType);
    }

    return entities;
  }

  renderEntity(id) {
    const entity = this.entityManager.getEntity(id);
    if (!entity) return;

    const existingElement = this.listContent.querySelector(
      `[data-entity-id="${id}"]`
    );
    if (existingElement) return;

    const element = document.createElement("div");
    element.className =
      "entity-item p-3 border-b hover:bg-gray-50 cursor-pointer transition-colors";
    element.dataset.entityId = id;

    if (entity.selected) {
      element.classList.add("selected", "bg-blue-50");
    }

    element.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3 flex-1 min-w-0">
                    <div class="entity-color w-3 h-3 rounded-full" style="background-color: ${this.entityManager.getTypeColor(
                      entity.type
                    )}"></div>
                    <div class="flex-1 min-w-0">
                        <div class="entity-value font-medium truncate">${this.escapeHtml(
                          entity.value
                        )}</div>
                        <div class="entity-type text-sm text-gray-500">${
                          entity.type
                        }</div>
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    <button class="edit-btn p-1 text-blue-600 hover:text-blue-800">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-btn p-1 text-red-600 hover:text-red-800">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            ${
              entity.confidence
                ? `
                <div class="mt-1 flex items-center space-x-2">
                    <div class="confidence-bar h-1 flex-1 bg-gray-200 rounded">
                        <div class="h-full bg-blue-600 rounded" style="width: ${
                          entity.confidence * 100
                        }%"></div>
                    </div>
                    <span class="confidence-value text-xs text-gray-500">${Math.round(
                      entity.confidence * 100
                    )}%</span>
                </div>
            `
                : ""
            }
        `;

    // Event Listeners
    element.addEventListener("click", () => this.onEntityClick(id));
    element.querySelector(".edit-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      this.onEditEntity(id);
    });
    element.querySelector(".delete-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      this.onDeleteEntity(id);
    });

    this.listContent.appendChild(element);
  }

  removeEntityElement(id) {
    const element = this.listContent.querySelector(`[data-entity-id="${id}"]`);
    if (element) element.remove();
  }

  updateTypeFilterOptions() {
    const types = new Set(
      this.entityManager.getAllEntities().map((e) => e.type)
    );
    const currentValue = this.typeFilter.value;

    this.typeFilter.innerHTML =
      '<option value="">Tous les types</option>' +
      Array.from(types)
        .sort()
        .map(
          (type) =>
            `<option value="${type}" ${
              type === currentValue ? "selected" : ""
            }>${type}</option>`
        )
        .join("");
  }

  onSearch() {
    this.refreshList();
  }

  onFilterChange() {
    this.refreshList();
  }

  onSelectAll() {
    const entities = this.getFilteredEntities();
    const allSelected = entities.every((e) => e.selected);

    entities.forEach((entity) => {
      this.entityManager.updateEntity(entity.id, { selected: !allSelected });
    });

    this.refreshList();
  }

  onAddEntity() {
    // Show add entity modal
    const modal = new EntityFormModal(this.entityManager);
    modal.show();
  }

  onEditEntity(id) {
    const entity = this.entityManager.getEntity(id);
    if (!entity) return;

    // Show edit entity modal
    const modal = new EntityFormModal(this.entityManager, entity);
    modal.show();
  }

  async onDeleteEntity(id) {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette entité ?")) {
      await this.entityManager.removeEntity(id);
    }
  }

  onEntityClick(id) {
    const entity = this.entityManager.getEntity(id);
    if (!entity) return;

    if (entity.selected) {
      this.entityManager.deselectEntity();
    } else {
      this.entityManager.selectEntity(id);
    }

    this.refreshList();
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// Entity Form Modal Component
class EntityFormModal {
  constructor(entityManager, entity = null) {
    this.entityManager = entityManager;
    this.entity = entity;
    this.modal = null;
  }

  show() {
    this.modal = document.createElement("div");
    this.modal.className =
      "modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";

    this.modal.innerHTML = `
            <div class="modal-content bg-white rounded-lg p-6 w-full max-w-md">
                <div class="modal-header flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold">${
                      this.entity ? "Modifier" : "Ajouter"
                    } une entité</h3>
                    <button class="close-btn text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <form class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Valeur</label>
                        <input type="text" class="entity-value w-full px-3 py-2 border rounded" value="${
                          this.entity?.value || ""
                        }" required>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
                        <select class="entity-type w-full px-3 py-2 border rounded" required>
                            <option value="">Sélectionner un type</option>
                            ${this.getTypeOptions()}
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Confiance</label>
                        <input type="range" class="entity-confidence w-full" min="0" max="100" value="${
                          this.entity?.confidence
                            ? Math.round(this.entity.confidence * 100)
                            : 100
                        }">
                        <div class="flex justify-between text-sm text-gray-500">
                            <span>0%</span>
                            <span class="confidence-value">${
                              this.entity?.confidence
                                ? Math.round(this.entity.confidence * 100)
                                : 100
                            }%</span>
                            <span>100%</span>
                        </div>
                    </div>
                </form>
                
                <div class="modal-actions flex justify-end space-x-3 mt-6">
                    <button class="cancel-btn px-4 py-2 text-gray-700 hover:bg-gray-100 rounded">
                        Annuler
                    </button>
                    <button class="save-btn px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        ${this.entity ? "Mettre à jour" : "Ajouter"}
                    </button>
                </div>
            </div>
        `;

    // Event Listeners
    this.modal
      .querySelector(".close-btn")
      .addEventListener("click", () => this.close());
    this.modal
      .querySelector(".cancel-btn")
      .addEventListener("click", () => this.close());
    this.modal
      .querySelector(".save-btn")
      .addEventListener("click", () => this.save());

    const confidenceInput = this.modal.querySelector(".entity-confidence");
    const confidenceValue = this.modal.querySelector(".confidence-value");
    confidenceInput.addEventListener("input", () => {
      confidenceValue.textContent = `${confidenceInput.value}%`;
    });

    document.body.appendChild(this.modal);

    // Set initial type if editing
    if (this.entity) {
      this.modal.querySelector(".entity-type").value = this.entity.type;
    }

    // Focus first input
    this.modal.querySelector(".entity-value").focus();
  }

  getTypeOptions() {
    const types = [
      "EMAIL",
      "PHONE",
      "DATE",
      "ADDRESS",
      "PERSON",
      "ORG",
      "LOC",
      "IBAN",
      "SIREN",
      "SIRET",
    ];

    return types
      .map(
        (type) =>
          `<option value="${type}" ${
            this.entity?.type === type ? "selected" : ""
          }>${type}</option>`
      )
      .join("");
  }

  async save() {
    const value = this.modal.querySelector(".entity-value").value.trim();
    const type = this.modal.querySelector(".entity-type").value;
    const confidence =
      parseInt(this.modal.querySelector(".entity-confidence").value) / 100;

    if (!value || !type) {
      alert("Veuillez remplir tous les champs requis");
      return;
    }

    try {
      if (this.entity) {
        await this.entityManager.updateEntity(this.entity.id, {
          value,
          type,
          confidence,
        });
      } else {
        await this.entityManager.addEntity({ value, type, confidence });
      }
      this.close();
    } catch (error) {
      alert("Une erreur est survenue");
      console.error("Error saving entity:", error);
    }
  }

  close() {
    this.modal.remove();
  }
}

window.EntityListComponent = EntityListComponent;
window.EntityFormModal = EntityFormModal;
