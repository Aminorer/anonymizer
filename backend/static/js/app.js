(function () {
  const { createApp, ref, onMounted, computed } = Vue;
  const { createPinia, defineStore } = Pinia;

  // ----------------------- Stores -----------------------------------
  const useEntityStore = defineStore('entities', {
    state: () => ({ items: [] }),
    actions: {
      async fetch() {
        const res = await fetch('/entities');
        this.items = await res.json();
      },
      async add(entity) {
        const res = await fetch('/entities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entity),
        });
        this.items.push(await res.json());
      },
      async update(entity) {
        await fetch(`/entities/${entity.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entity),
        });
      },
      async remove(id) {
        await fetch(`/entities/${id}`, { method: 'DELETE' });
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
        const res = await fetch('/groups');
        this.items = await res.json();
      },
      async add(group) {
        const res = await fetch('/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(group),
        });
        this.items.push(await res.json());
      },
      async remove(id) {
        await fetch(`/groups/${id}`, { method: 'DELETE' });
        this.items = this.items.filter((g) => g.id !== id);
      },
      async assign(entityId, groupId) {
        const res = await fetch(`/groups/${groupId}/entities/${entityId}`, { method: 'POST' });
        const updated = await res.json();
        const idx = this.items.findIndex((g) => g.id === updated.id);
        if (idx !== -1) this.items[idx] = updated;
      },
    },
  });

  const pinia = createPinia();

  createApp({
    setup() {
      const jobId = new URLSearchParams(window.location.search).get('job_id');
      const status = ref(null);
      const view = ref('anonymized');
      const docType = ref('');
      const zoom = ref(1);
      const activeTab = ref('entities');
      const searchTerm = ref('');
      const searchType = ref('text');
      const selected = ref([]);
      const dragIndex = ref(null);
      const showDetectionModal = ref(false);
      const showGroupModal = ref(false);
      const newDetection = ref({ type: '', value: '' });

      const entityStore = useEntityStore();
      const groupStore = useGroupStore();
      const entities = computed(() => entityStore.items);

      const loadStatus = async () => {
        if (!jobId) return;
        const res = await fetch(`/status/${jobId}`);
        const data = await res.json();
        status.value = data.result;
        entityStore.items = (data.result.entities || []).map((e) => ({
          id: crypto.randomUUID(),
          ...e,
        }));
        docType.value = data.result.filename.split('.').pop().toLowerCase();
        await renderDoc();
      };

      const clearViewer = () => {
        const container = document.getElementById('viewer');
        container.innerHTML = '';
        container.style.transform = `scale(${zoom.value})`;
        container.style.transformOrigin = 'top left';
      };

      const renderDoc = async () => {
        clearViewer();
        const container = document.getElementById('viewer');
        if (docType.value === 'pdf') {
          if (view.value === 'original') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            const loadingTask = pdfjsLib.getDocument(status.value.original_url);
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: zoom.value });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            container.appendChild(canvas);
            await page.render({ canvasContext: ctx, viewport }).promise;
          } else {
            const pre = document.createElement('pre');
            pre.textContent = status.value.text;
            pre.style.transform = `scale(${zoom.value})`;
            pre.style.transformOrigin = 'top left';
            container.appendChild(pre);
            applyEntitySpans();
          }
        } else if (docType.value === 'docx') {
          const url = view.value === 'original' ? status.value.original_url : status.value.download_url;
          const buffer = await fetch(url).then((r) => r.arrayBuffer());
          await docx.renderAsync(buffer, container);
          container.style.transform = `scale(${zoom.value})`;
          applyEntitySpans();
        }
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

      const zoomIn = async () => {
        zoom.value += 0.1;
        await renderDoc();
      };
      const zoomOut = async () => {
        zoom.value = Math.max(0.1, zoom.value - 0.1);
        await renderDoc();
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

      return {
        view,
        changeView,
        zoomIn,
        zoomOut,
        activeTab,
        entities,
        highlightEntity,
        searchTerm,
        searchType,
        search,
        status,
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
        newDetection,
      };
    }
  }).use(pinia).mount('#app');
})();
