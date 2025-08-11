(function () {
  const { createApp, ref, onMounted } = Vue;

  createApp({
    setup() {
      const jobId = new URLSearchParams(window.location.search).get('job_id');
      const status = ref(null);
      const view = ref('anonymized');
      const docType = ref('');
      const zoom = ref(1);
      const entities = ref([]);
      const activeTab = ref('entities');
      const searchTerm = ref('');

      const loadStatus = async () => {
        if (!jobId) return;
        const res = await fetch(`/status/${jobId}`);
        const data = await res.json();
        status.value = data.result;
        entities.value = data.result.entities || [];
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

      const search = () => {
        document.querySelectorAll('.search-highlight').forEach((el) => el.classList.remove('search-highlight'));
        if (!searchTerm.value) return;
        const regex = new RegExp(searchTerm.value, 'gi');
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

      onMounted(loadStatus);

      return {
        view,
        changeView,
        zoomIn,
        zoomOut,
        activeTab,
        entities,
        highlightEntity,
        searchTerm,
        search,
        status,
      };
    },
  }).mount('#app');
})();
