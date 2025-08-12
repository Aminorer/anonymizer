(function () {
  const { createApp, ref, onMounted, computed } = Vue;
  const { createPinia, defineStore } = Pinia;
  const jobId = new URLSearchParams(window.location.search).get('job_id');

  // ----------------------- Stores -----------------------------------
  const useEntityStore = defineStore('entities', {
    state: () => ({ items: [] }),
    actions: {
      async fetch() {
        const res = await fetch(`/entities/${jobId}`);
        this.items = await res.json();
      },
      async add(entity) {
        const res = await fetch(`/entities/${jobId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entity),
        });
        this.items.push(await res.json());
      },
      async update(entity) {
        await fetch(`/entities/${jobId}/${entity.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entity),
        });
      },
      async remove(id) {
        await fetch(`/entities/${jobId}/${id}`, { method: 'DELETE' });
        this.items = this.items.filter((e) => e.id !== id);
      },
      reorder(from, to) {
        this.items.splice(to, 0, this.items.splice(from, 1)[0]);
      },
    },
  });

  const useGroupStore = defineStore('groups', {
    state: () => ({ items: [] }),
    actions: {
      async fetch() {
        const res = await fetch(`/groups/${jobId}`);
        this.items = await res.json();
      },
      async add(group) {
        const res = await fetch(`/groups/${jobId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(group),
        });
        this.items.push(await res.json());
      },
      async remove(id) {
        await fetch(`/groups/${jobId}/${id}`, { method: 'DELETE' });
        this.items = this.items.filter((g) => g.id !== id);
      },
      async assign(entityId, groupId) {
        const res = await fetch(`/groups/${jobId}/${groupId}/entities/${entityId}`, { method: 'POST' });
        const updated = await res.json();
        const idx = this.items.findIndex((g) => g.id === updated.id);
        if (idx !== -1) this.items[idx] = updated;
      },
    },
  });

  const pinia = createPinia();

  createApp({
    setup() {
      const status = ref(null);
      const processingMode = ref('');
      const entitiesDetected = ref(0);
      const eta = ref(null);
      const view = ref('anonymized');
      const docType = ref('');
      const zoom = ref(1);
      const currentPage = ref(1);
      const totalPages = ref(1);
      const activeTab = ref('entities');
      const searchTerm = ref('');
      const searchType = ref('text');
      const selected = ref([]);
      const dragIndex = ref(null);
      const showDetectionModal = ref(false);
      const showGroupModal = ref(false);
      const showExportModal = ref(false);
      const watermark = ref('');
      const wantAudit = ref(false);
      const newDetection = ref({ type: '', value: '' });
      const rules = ref({ regex_rules: [], ner: { confidence: 0.5 }, styles: {} });
      const newRegex = ref({ pattern: '', replacement: '' });
      const newStyle = ref({ type: '', style: '' });

      const applyZoom = () => {
        const container = document.getElementById('viewer');
        container.style.transform = `scale(${zoom.value})`;
        container.style.transformOrigin = 'top left';
      };

      const entityStore = useEntityStore();
      const groupStore = useGroupStore();
      const entities = computed(() => entityStore.items);

      const loadStatus = async () => {
        if (!jobId) return;
        const res = await fetch(`/status/${jobId}`);
        const data = await res.json();
        status.value = data.result;
        processingMode.value = data.mode;
        entitiesDetected.value = data.entities_detected;
        eta.value = data.eta;
        entityStore.items = (data.result.entities || []).map((e) => ({
          id: crypto.randomUUID(),
          ...e,
        }));
        docType.value = data.result.filename.split('.').pop().toLowerCase();
        await renderDoc();
      };

      const fetchRules = async () => {
        const res = await fetch('/rules');
        rules.value = await res.json();
      };

      const addRegex = () => {
        if (!newRegex.value.pattern) return;
        rules.value.regex_rules.push({ ...newRegex.value });
        newRegex.value = { pattern: '', replacement: '' };
      };

      const removeRegex = (idx) => {
        rules.value.regex_rules.splice(idx, 1);
      };

      const addStyle = () => {
        if (!newStyle.value.type) return;
        rules.value.styles[newStyle.value.type] = newStyle.value.style;
        newStyle.value = { type: '', style: '' };
      };

      const removeStyle = (type) => {
        delete rules.value.styles[type];
      };

      const saveRules = async () => {
        await fetch('/rules', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rules.value),
        });
        alert('Règles sauvegardées');
      };

      const clearViewer = () => {
        const container = document.getElementById('viewer');
        container.innerHTML = '';
      };

      const showPage = (num) => {
        document.querySelectorAll('.pdf-page').forEach((el, idx) => {
          el.style.display = idx + 1 === num ? 'block' : 'none';
        });
      };

      const renderPdfPages = async (url) => {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        totalPages.value = pdf.numPages;
        const container = document.getElementById('viewer');
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1 });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          const pageDiv = document.createElement('div');
          pageDiv.className = 'pdf-page';
          pageDiv.dataset.page = i;
          if (i !== currentPage.value) pageDiv.style.display = 'none';
          pageDiv.appendChild(canvas);
          container.appendChild(pageDiv);
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
        showPage(currentPage.value);
      };

      const highlightPdfEntities = () => {
        if (!status.value || !status.value.entities) return false;
        let hasCoords = false;
        status.value.entities.forEach((ent) => {
          if (
            ent.page === undefined ||
            ent.x === undefined ||
            ent.y === undefined ||
            ent.width === undefined ||
            ent.height === undefined
          )
            return;
          hasCoords = true;
          const pageDiv = document.querySelector(`.pdf-page[data-page='${ent.page}']`);
          if (!pageDiv) return;
          const box = document.createElement('div');
          box.className = 'pdf-highlight';
          box.style.left = `${ent.x}px`;
          box.style.top = `${ent.y}px`;
          box.style.width = `${ent.width}px`;
          box.style.height = `${ent.height}px`;
          pageDiv.appendChild(box);
        });
        return hasCoords;
      };

      const renderDoc = async () => {
        const prev = currentPage.value;
        clearViewer();
        if (docType.value === 'pdf') {
          currentPage.value = prev;
          const url =
            view.value === 'original'
              ? status.value.original_url
              : status.value.anonymized_url || status.value.original_url;
          await renderPdfPages(url);
          if (view.value === 'anonymized') {
            const ok = highlightPdfEntities();
            if (!ok && status.value.reconstructed_url) {
              clearViewer();
              await renderPdfPages(status.value.reconstructed_url);
            }
          }
        } else if (docType.value === 'docx') {
          const url =
            view.value === 'original'
              ? status.value.original_url
              : status.value.anonymized_url;
          const buffer = await fetch(url).then((r) => r.arrayBuffer());
          const container = document.getElementById('viewer');
          await docx.renderAsync(buffer, container);
          applyEntitySpans();
        }
        applyZoom();
      };

      const applyEntitySpans = () => {
        const container = document.getElementById('viewer');
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        const re = /\[[A-Z]+\]/g;
        const nodes = [];
        let n;
        while ((n = walker.nextNode())) nodes.push(n);
        nodes.forEach((node) => {
          const text = node.textContent;
          if (!re.test(text)) return;
          const frag = document.createDocumentFragment();
          let last = 0;
          re.lastIndex = 0;
          let m;
          while ((m = re.exec(text))) {
            const before = text.slice(last, m.index);
            if (before) frag.appendChild(document.createTextNode(before));
            const span = document.createElement('span');
            span.textContent = m[0];
            span.className = 'entity-span';
            span.dataset.entityType = m[0].slice(1, -1);
            frag.appendChild(span);
            last = m.index + m[0].length;
          }
          const after = text.slice(last);
          if (after) frag.appendChild(document.createTextNode(after));
          node.parentNode.replaceChild(frag, node);
        });
      };

      const highlightEntity = (type) => {
        document.querySelectorAll('.entity-span').forEach((el) => {
          el.classList.toggle('highlight', el.dataset.entityType === type);
        });
      };

      const changeView = async (v) => {
        view.value = v;
        await renderDoc();
      };

      const zoomIn = () => {
        zoom.value += 0.1;
        applyZoom();
      };
      const zoomOut = () => {
        zoom.value = Math.max(0.1, zoom.value - 0.1);
        applyZoom();
      };

      const nextPage = () => {
        if (currentPage.value < totalPages.value) {
          currentPage.value += 1;
          showPage(currentPage.value);
        }
      };
      const prevPage = () => {
        if (currentPage.value > 1) {
          currentPage.value -= 1;
          showPage(currentPage.value);
        }
      };

      const search = async () => {
        document
          .querySelectorAll('.search-highlight')
          .forEach((el) => el.classList.remove('search-highlight'));
        if (!searchTerm.value) return;
        let terms = [searchTerm.value];
        if (searchType.value === 'semantic') {
          const res = await fetch(`/semantic-search/${jobId}?q=${encodeURIComponent(searchTerm.value)}`);
          const data = await res.json();
          if (data.matches && data.matches.length) terms = data.matches;
        }
        const regex =
          searchType.value === 'regex'
            ? new RegExp(searchTerm.value, 'gi')
            : new RegExp(terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');
        const walker = document.createTreeWalker(document.getElementById('viewer'), NodeFilter.SHOW_TEXT);
        const nodes = [];
        let node;
        while ((node = walker.nextNode())) nodes.push(node);
        nodes.forEach((n) => {
          const text = n.textContent;
          const frag = document.createDocumentFragment();
          let last = 0;
          let m;
          regex.lastIndex = 0;
          while ((m = regex.exec(text))) {
            const before = text.slice(last, m.index);
            if (before) frag.appendChild(document.createTextNode(before));
            const span = document.createElement('span');
            span.textContent = m[0];
            span.className = 'search-highlight';
            frag.appendChild(span);
            last = m.index + m[0].length;
          }
          const after = text.slice(last);
          if (after) frag.appendChild(document.createTextNode(after));
          if (frag.childNodes.length) n.parentNode.replaceChild(frag, n);
        });
      };
      onMounted(async () => {
        await loadStatus();
        await groupStore.fetch();
        await fetchRules();
      });

      const dragStart = (idx, evt) => {
        dragIndex.value = idx;
        evt.dataTransfer.setData('text/plain', entityStore.items[idx].id);
      };
      const drop = (idx) => {
        if (dragIndex.value === null) return;
        entityStore.reorder(dragIndex.value, idx);
        dragIndex.value = null;
      };

      const updateEntity = async (ent) => {
        await entityStore.update(ent);
      };
      const deleteSelected = async () => {
        for (const id of selected.value) await entityStore.remove(id);
        selected.value = [];
      };

      const newGroupName = ref('');
      const confirmGroup = async () => {
        if (!newGroupName.value) return;
        await groupStore.add({ name: newGroupName.value, entities: [] });
        newGroupName.value = '';
        showGroupModal.value = false;
      };
      const confirmDetection = async () => {
        if (!newDetection.value.type || !newDetection.value.value) return;
        await entityStore.add({
          id: crypto.randomUUID(),
          type: newDetection.value.type,
          value: newDetection.value.value,
          start: 0,
          end: 0,
        });
        newDetection.value = { type: '', value: '' };
        showDetectionModal.value = false;
      };
      const deleteGroup = async (id) => {
        await groupStore.remove(id);
      };
      const assignToGroup = async (groupId, evt) => {
        const entId = evt.dataTransfer.getData('text/plain');
        if (entId) await groupStore.assign(entId, groupId);
      };

      const exportDoc = async () => {
        const res = await fetch(`/export/${jobId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ watermark: watermark.value, audit: wantAudit.value })
        });
        const data = await res.json();
        if (data.download_url) window.location.href = data.download_url;
        if (data.audit_url) window.open(data.audit_url, '_blank');
        showExportModal.value = false;
      };

      return {
        view,
        changeView,
        zoomIn,
        zoomOut,
        currentPage,
        totalPages,
        nextPage,
        prevPage,
        activeTab,
        entities,
        highlightEntity,
        searchTerm,
        searchType,
        search,
        status,
        processingMode,
        entitiesDetected,
        eta,
        entityStore,
        groupStore,
        selected,
        dragStart,
        drop,
        updateEntity,
        deleteSelected,
        newGroupName,
        confirmGroup,
        confirmDetection,
        deleteGroup,
        assignToGroup,
        showDetectionModal,
        showGroupModal,
        showExportModal,
        watermark,
        wantAudit,
        exportDoc,
        newDetection,
        rules,
        newRegex,
        newStyle,
        addRegex,
        removeRegex,
        addStyle,
        removeStyle,
        saveRules,
      };
    }
  }).use(pinia).mount('#app');
})();
