/**
 * Advanced Document Viewer with PDF.js integration
 */
class DocumentViewer {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      zoomStep: 0.1,
      minZoom: 0.3,
      maxZoom: 3.0,
      pageGap: 20,
      highlightColors: {
        EMAIL: "#ffeb3b",
        PERSON: "#4caf50",
        ORG: "#2196f3",
        LOC: "#9c27b0",
        DATE: "#ff9800",
        PHONE: "#f44336",
      },
      ...options,
    };

    this.zoom = 1.0;
    this.currentPage = 1;
    this.totalPages = 1;
    this.pdf = null;
    this.renderedPages = new Map();
    this.highlights = new Map();
    this.annotations = new Map();
    this.selectedEntity = null;

    // Initialize toolbar
    this.initializeToolbar();

    // Bind event handlers
    this.handleScroll = this.handleScroll.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.container.addEventListener("scroll", this.handleScroll);
    window.addEventListener("resize", this.handleResize);

    // Initialize PDF.js
    if (typeof pdfjsLib === "undefined") {
      throw new Error(
        "PDF.js library not loaded. Make sure to include both pdf.js and pdf.worker.js"
      );
    }

    // Set worker
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    console.log(
      "PDF.js initialized with worker:",
      pdfjsLib.GlobalWorkerOptions.workerSrc
    );
  }

  initializeToolbar() {
    const toolbar = document.createElement("div");
    toolbar.className =
      "viewer-toolbar fixed bottom-4 left-1/2 transform -translate-x-1/2 flex items-center bg-white rounded-full shadow-lg px-4 py-2 space-x-4 z-50";

    toolbar.innerHTML = `
            <button class="zoom-out p-2 hover:bg-gray-100 rounded-full">
                <i class="fas fa-search-minus"></i>
            </button>
            <span class="zoom-level font-medium">100%</span>
            <button class="zoom-in p-2 hover:bg-gray-100 rounded-full">
                <i class="fas fa-search-plus"></i>
            </button>
            <div class="h-6 border-r border-gray-300"></div>
            <button class="prev-page p-2 hover:bg-gray-100 rounded-full">
                <i class="fas fa-chevron-up"></i>
            </button>
            <span class="page-info font-medium">Page 1 / 1</span>
            <button class="next-page p-2 hover:bg-gray-100 rounded-full">
                <i class="fas fa-chevron-down"></i>
            </button>
        `;

    // Event handlers
    toolbar.querySelector(".zoom-in").onclick = () => this.zoomIn();
    toolbar.querySelector(".zoom-out").onclick = () => this.zoomOut();
    toolbar.querySelector(".prev-page").onclick = () => this.prevPage();
    toolbar.querySelector(".next-page").onclick = () => this.nextPage();

    document.body.appendChild(toolbar);
    this.toolbar = toolbar;
  }

  async loadDocument(url) {
    try {
      // Clear previous content
      this.container.innerHTML = "";
      this.renderedPages.clear();
      this.highlights.clear();
      this.annotations.clear();

      // Show loading state
      this.showLoading();

      // Set container styles
      this.container.style.height = "calc(100vh - 200px)";
      this.container.style.width = "100%";
      this.container.style.margin = "0 auto";
      this.container.style.padding = "20px";

      // Add container styles for scrolling and appearance
      this.container.style.overflow = "auto";
      this.container.style.position = "relative";
      this.container.style.backgroundColor = "#f8fafc";
      this.container.style.borderRadius = "0.5rem";
      this.container.style.boxShadow =
        "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)";

      // Load PDF
      const loadingTask = pdfjsLib.getDocument({
        url: url,
        cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/",
        cMapPacked: true,
      });

      this.pdf = await loadingTask.promise;
      this.totalPages = this.pdf.numPages;

      // Update toolbar
      this.updateToolbar();

      // Initial render - Force render first page
      await this.renderPage(1);

      // Then render other visible pages
      await this.renderVisiblePages();

      // Hide loading
      this.hideLoading();

      // Log success
      console.log("Document loaded successfully:", {
        numPages: this.totalPages,
        currentPage: this.currentPage,
      });

      return true;
    } catch (error) {
      console.error("Error loading document:", error);
      this.showError("Failed to load document");
      return false;
    }
  }

  showLoading() {
    const loading = document.createElement("div");
    loading.className =
      "loading-indicator flex items-center justify-center absolute inset-0 bg-white bg-opacity-90 z-50";
    loading.innerHTML = `
            <div class="text-center">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <div class="mt-2 text-gray-600">Loading document...</div>
            </div>
        `;
    this.container.appendChild(loading);
  }

  hideLoading() {
    const loading = this.container.querySelector(".loading-indicator");
    if (loading) loading.remove();
  }

  showError(message) {
    const error = document.createElement("div");
    error.className =
      "error-message flex items-center justify-center absolute inset-0 bg-white";
    error.innerHTML = `
            <div class="text-center text-red-600">
                <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                <div>${message}</div>
            </div>
        `;
    this.container.appendChild(error);
  }

  async renderPage(pageNumber) {
    if (this.renderedPages.has(pageNumber)) return;

    const page = await this.pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: this.zoom });

    const pageContainer = document.createElement("div");
    pageContainer.className = "pdf-page relative mb-8";
    pageContainer.dataset.page = pageNumber;
    pageContainer.style.display = "flex";
    pageContainer.style.justifyContent = "center";
    pageContainer.style.alignItems = "center";
    pageContainer.style.width = "100%";
    pageContainer.style.minHeight = viewport.height + "px";

    const canvas = document.createElement("canvas");
    canvas.className = "pdf-canvas shadow-lg rounded-lg";
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.border = "1px solid #e2e8f0";
    canvas.style.boxShadow =
      "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)";
    canvas.style.display = "block";

    pageContainer.appendChild(canvas);
    this.container.appendChild(pageContainer);

    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;

    // Create highlight layer
    const highlightLayer = document.createElement("div");
    highlightLayer.className =
      "highlight-layer absolute inset-0 pointer-events-none";
    pageContainer.appendChild(highlightLayer);

    this.renderedPages.set(pageNumber, {
      page,
      viewport,
      canvas,
      highlightLayer,
    });
    this.renderHighlights(pageNumber);
  }

  async renderVisiblePages() {
    const { scrollTop, clientHeight } = this.container;
    const renderedPages = Array.from(
      this.container.querySelectorAll(".pdf-page")
    );

    for (const pageEl of renderedPages) {
      const pageNumber = parseInt(pageEl.dataset.page);
      const { top, bottom } = pageEl.getBoundingClientRect();

      if (top < clientHeight && bottom > 0) {
        await this.renderPage(pageNumber);
      }
    }
  }

  updateToolbar() {
    const zoomLevel = this.toolbar.querySelector(".zoom-level");
    const pageInfo = this.toolbar.querySelector(".page-info");

    zoomLevel.textContent = `${Math.round(this.zoom * 100)}%`;
    pageInfo.textContent = `Page ${this.currentPage} / ${this.totalPages}`;

    // Update button states
    this.toolbar.querySelector(".zoom-in").disabled =
      this.zoom >= this.options.maxZoom;
    this.toolbar.querySelector(".zoom-out").disabled =
      this.zoom <= this.options.minZoom;
    this.toolbar.querySelector(".prev-page").disabled = this.currentPage <= 1;
    this.toolbar.querySelector(".next-page").disabled =
      this.currentPage >= this.totalPages;
  }

  addHighlight(entityId, pageNumber, coords, type) {
    if (!this.highlights.has(pageNumber)) {
      this.highlights.set(pageNumber, new Map());
    }

    const pageHighlights = this.highlights.get(pageNumber);
    pageHighlights.set(entityId, { coords, type });

    this.renderHighlights(pageNumber);
  }

  removeHighlight(entityId, pageNumber) {
    const pageHighlights = this.highlights.get(pageNumber);
    if (pageHighlights) {
      pageHighlights.delete(entityId);
      this.renderHighlights(pageNumber);
    }
  }

  renderHighlights(pageNumber) {
    const pageData = this.renderedPages.get(pageNumber);
    if (!pageData || !this.highlights.has(pageNumber)) return;

    const { highlightLayer, viewport } = pageData;
    highlightLayer.innerHTML = "";

    const pageHighlights = this.highlights.get(pageNumber);
    for (const [entityId, { coords, type }] of pageHighlights) {
      const highlight = document.createElement("div");
      highlight.className = "entity-highlight absolute pointer-events-auto";
      highlight.dataset.entityId = entityId;
      highlight.dataset.entityType = type;

      // Apply scaled coordinates
      const scaled = viewport.convertToViewportPoint(coords.x, coords.y);
      highlight.style.left = `${scaled[0]}px`;
      highlight.style.top = `${scaled[1]}px`;
      highlight.style.width = `${coords.width * this.zoom}px`;
      highlight.style.height = `${coords.height * this.zoom}px`;
      highlight.style.backgroundColor =
        this.options.highlightColors[type] + "40"; // 40 = 25% opacity
      highlight.style.border = `2px solid ${this.options.highlightColors[type]}`;

      highlight.addEventListener("mouseover", () =>
        this.onHighlightHover(entityId)
      );
      highlight.addEventListener("click", () =>
        this.onHighlightClick(entityId)
      );

      highlightLayer.appendChild(highlight);
    }
  }

  onHighlightHover(entityId) {
    // Dispatch custom event
    const event = new CustomEvent("entityHover", { detail: { entityId } });
    this.container.dispatchEvent(event);
  }

  onHighlightClick(entityId) {
    this.selectedEntity = entityId;
    // Update visual state
    this.container.querySelectorAll(".entity-highlight").forEach((el) => {
      el.classList.toggle("selected", el.dataset.entityId === entityId);
    });
    // Dispatch custom event
    const event = new CustomEvent("entitySelect", { detail: { entityId } });
    this.container.dispatchEvent(event);
  }

  addAnnotation(entityId, pageNumber, coords, content) {
    if (!this.annotations.has(pageNumber)) {
      this.annotations.set(pageNumber, new Map());
    }

    const pageAnnotations = this.annotations.get(pageNumber);
    pageAnnotations.set(entityId, { coords, content });

    this.renderAnnotations(pageNumber);
  }

  removeAnnotation(entityId, pageNumber) {
    const pageAnnotations = this.annotations.get(pageNumber);
    if (pageAnnotations) {
      pageAnnotations.delete(entityId);
      this.renderAnnotations(pageNumber);
    }
  }

  renderAnnotations(pageNumber) {
    const pageData = this.renderedPages.get(pageNumber);
    if (!pageData || !this.annotations.has(pageNumber)) return;

    const { viewport } = pageData;
    const annotationLayer =
      pageData.annotationLayer || this.createAnnotationLayer(pageNumber);
    annotationLayer.innerHTML = "";

    const pageAnnotations = this.annotations.get(pageNumber);
    for (const [entityId, { coords, content }] of pageAnnotations) {
      const annotation = document.createElement("div");
      annotation.className =
        "entity-annotation absolute bg-white shadow-lg rounded p-2 text-sm max-w-xs";
      annotation.dataset.entityId = entityId;

      const scaled = viewport.convertToViewportPoint(coords.x, coords.y);
      annotation.style.left = `${scaled[0]}px`;
      annotation.style.top = `${scaled[1] + coords.height * this.zoom}px`;

      annotation.innerHTML = content;
      annotationLayer.appendChild(annotation);
    }
  }

  createAnnotationLayer(pageNumber) {
    const pageData = this.renderedPages.get(pageNumber);
    const annotationLayer = document.createElement("div");
    annotationLayer.className =
      "annotation-layer absolute inset-0 pointer-events-none z-10";
    pageData.annotationLayer = annotationLayer;
    return annotationLayer;
  }

  handleScroll() {
    this.renderVisiblePages();
    this.updateCurrentPage();
  }

  handleResize() {
    this.renderVisiblePages();
  }

  updateCurrentPage() {
    const { scrollTop, clientHeight } = this.container;
    const pages = Array.from(this.container.querySelectorAll(".pdf-page"));

    for (const page of pages) {
      const { top, bottom } = page.getBoundingClientRect();
      if (top < clientHeight / 2 && bottom > clientHeight / 2) {
        this.currentPage = parseInt(page.dataset.page);
        this.updateToolbar();
        break;
      }
    }
  }

  zoomIn() {
    if (this.zoom >= this.options.maxZoom) return;
    this.zoom = Math.min(
      this.zoom + this.options.zoomStep,
      this.options.maxZoom
    );
    this.rerender();
  }

  zoomOut() {
    if (this.zoom <= this.options.minZoom) return;
    this.zoom = Math.max(
      this.zoom - this.options.zoomStep,
      this.options.minZoom
    );
    this.rerender();
  }

  setZoom(zoom) {
    this.zoom = Math.max(
      this.options.minZoom,
      Math.min(zoom, this.options.maxZoom)
    );
    this.rerender();
  }

  async rerender() {
    this.renderedPages.clear();
    this.container.innerHTML = "";
    await this.renderVisiblePages();
    this.updateToolbar();
  }

  async prevPage() {
    if (this.currentPage <= 1) return;
    this.currentPage--;
    await this.renderPage(this.currentPage);
    this.scrollToPage(this.currentPage);
  }

  async nextPage() {
    if (this.currentPage >= this.totalPages) return;
    this.currentPage++;
    await this.renderPage(this.currentPage);
    this.scrollToPage(this.currentPage);
  }

  scrollToPage(pageNumber) {
    const pageEl = this.container.querySelector(`[data-page="${pageNumber}"]`);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: "smooth" });
    }
  }

  destroy() {
    window.removeEventListener("resize", this.handleResize);
    this.container.removeEventListener("scroll", this.handleScroll);
    if (this.toolbar) this.toolbar.remove();
  }
}

window.DocumentViewer = DocumentViewer;
