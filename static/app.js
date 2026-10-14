/**
 * Clinic RAG & Patient Management Platform Frontend Application Logic v2
 */

document.addEventListener('DOMContentLoaded', () => {
    // App State
    const state = {
        currentTab: 'dashboard',
        searchQuery: '',
        selectedTag: 'All',
        selectedGender: 'All',
        currentPage: 1,
        pageSize: 24,
        viewMode: 'grid',
        stats: null,
        tags: [],
        currentPatient: null,
        isRagLoading: false
    };

    // DOM Elements
    const elements = {
        themeToggle: document.getElementById('theme-toggle'),
        navTabs: document.querySelectorAll('.nav-tab'),
        tabViews: document.querySelectorAll('.tab-view'),
        // Dashboard
        kpiTotal: document.getElementById('kpi-total-patients'),
        kpiBppv: document.getElementById('kpi-bppv-count'),
        kpiVm: document.getElementById('kpi-vm-count'),
        kpiMd: document.getElementById('kpi-md-count'),
        diagTagsList: document.getElementById('diagnostic-tags-list'),
        maleCount: document.getElementById('gender-male-count'),
        femaleCount: document.getElementById('gender-female-count'),
        unknownCount: document.getElementById('gender-unknown-count'),
        ageBarsContainer: document.getElementById('age-bars-container'),
        indexedCountText: document.getElementById('indexed-count-text'),
        // Directory
        searchInput: document.getElementById('patient-search-input'),
        clearSearchBtn: document.getElementById('clear-search-btn'),
        genderFilterSelect: document.getElementById('gender-filter-select'),
        viewGridBtn: document.getElementById('view-mode-grid'),
        viewListBtn: document.getElementById('view-mode-list'),
        tagChipsBar: document.getElementById('tag-chips-bar'),
        resultsCountText: document.getElementById('results-count-text'),
        patientsContainer: document.getElementById('patients-container'),
        paginationBar: document.getElementById('pagination-bar'),
        // Modal
        patientModal: document.getElementById('patient-modal'),
        modalCloseBtn: document.getElementById('modal-close-btn'),
        modalName: document.getElementById('modal-patient-name'),
        modalTagsRow: document.getElementById('modal-tags-row'),
        modalMetaAgeGender: document.getElementById('modal-patient-age-gender'),
        modalDate: document.getElementById('modal-patient-date'),
        modalTabs: document.querySelectorAll('.mod-tab'),
        modalTabContents: document.querySelectorAll('.mod-tab-content'),
        modalHistory: document.getElementById('modal-history-text'),
        modalPastHistory: document.getElementById('modal-pasthistory-text'),
        modalEnt: document.getElementById('modal-ent-text'),
        modalInvestigations: document.getElementById('modal-investigations-text'),
        modalVng: document.getElementById('modal-vng-text'),
        modalImpression: document.getElementById('modal-impression-text'),
        modalTreatment: document.getElementById('modal-treatment-text'),
        modalRaw: document.getElementById('modal-raw-text'),
        // RAG
        ragPromptInput: document.getElementById('rag-prompt-input'),
        ragTagScope: document.getElementById('rag-tag-scope'),
        btnRunRag: document.getElementById('btn-run-rag'),
        presetChips: document.querySelectorAll('.preset-chip'),
        ragContainer: document.getElementById('rag-response-container'),
        ragResponseBody: document.getElementById('rag-response-body'),
        sourcesToggleBtn: document.getElementById('sources-toggle-btn'),
        sourcesList: document.getElementById('sources-list'),
        sourcesCount: document.getElementById('sources-count')
    };

    // --- INIT APP ---
    initTheme();
    initEventListeners();
    fetchStats();
    fetchTags();
    fetchPatients();

    // --- THEME ---
    function initTheme() {
        const savedTheme = localStorage.getItem('clinic_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }

    elements.themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', nextTheme);
        localStorage.setItem('clinic_theme', nextTheme);
    });

    // --- NAVIGATION TABS ---
    function initEventListeners() {
        elements.navTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.getAttribute('data-tab');
                switchTab(targetTab);
            });
        });

        // Search Input Debounce
        let debounceTimer;
        elements.searchInput.addEventListener('input', (e) => {
            const val = e.target.value;
            elements.clearSearchBtn.style.display = val ? 'block' : 'none';
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                state.searchQuery = val;
                state.currentPage = 1;
                fetchPatients();
            }, 300);
        });

        elements.clearSearchBtn.addEventListener('click', () => {
            elements.searchInput.value = '';
            elements.clearSearchBtn.style.display = 'none';
            state.searchQuery = '';
            state.currentPage = 1;
            fetchPatients();
        });

        elements.genderFilterSelect.addEventListener('change', (e) => {
            state.selectedGender = e.target.value;
            state.currentPage = 1;
            fetchPatients();
        });

        elements.viewGridBtn.addEventListener('click', () => {
            state.viewMode = 'grid';
            elements.viewGridBtn.classList.add('active');
            elements.viewListBtn.classList.remove('active');
            elements.patientsContainer.className = 'patients-grid';
        });

        elements.viewListBtn.addEventListener('click', () => {
            state.viewMode = 'list';
            elements.viewListBtn.classList.add('active');
            elements.viewGridBtn.classList.remove('active');
            elements.patientsContainer.className = 'patients-grid list-mode';
        });

        // Modal Controls
        elements.modalCloseBtn.addEventListener('click', closeModal);
        elements.patientModal.addEventListener('click', (e) => {
            if (e.target === elements.patientModal) closeModal();
        });

        elements.modalTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.getAttribute('data-modtab');
                elements.modalTabs.forEach(t => t.classList.remove('active'));
                elements.modalTabContents.forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`modcontent-${target}`).classList.add('active');
            });
        });

        // RAG Preset Chips
        elements.presetChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const promptText = chip.getAttribute('data-prompt');
                elements.ragPromptInput.value = promptText;
                runRagQuery();
            });
        });

        elements.btnRunRag.addEventListener('click', runRagQuery);

        // Sources Accordion Toggle
        elements.sourcesToggleBtn.addEventListener('click', () => {
            const isHidden = elements.sourcesList.style.display === 'none';
            elements.sourcesList.style.display = isHidden ? 'flex' : 'none';
        });
    }

    function switchTab(tabName) {
        state.currentTab = tabName;
        elements.navTabs.forEach(btn => {
            if (btn.getAttribute('data-tab') === tabName) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        elements.tabViews.forEach(view => {
            if (view.id === `view-${tabName}`) view.classList.add('active');
            else view.classList.remove('active');
        });
    }

    // --- FETCH DATA ---
    async function fetchStats() {
        try {
            const res = await fetch('/api/stats');
            const data = await res.json();
            state.stats = data;
            renderStats(data);
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    }

    function renderStats(data) {
        if (!data) return;
        elements.kpiTotal.textContent = data.total_patients;
        elements.indexedCountText.textContent = `${data.total_patients} Patient Docs`;

        const bppvItem = data.tag_distribution.find(t => t.tag === 'BPPV');
        const vmItem = data.tag_distribution.find(t => t.tag === 'Vestibular Migraine');
        const mdItem = data.tag_distribution.find(t => t.tag === "Ménière's Disease");

        elements.kpiBppv.textContent = bppvItem ? bppvItem.count : 0;
        elements.kpiVm.textContent = vmItem ? vmItem.count : 0;
        elements.kpiMd.textContent = mdItem ? mdItem.count : 0;

        elements.maleCount.textContent = data.gender_distribution.Male || 0;
        elements.femaleCount.textContent = data.gender_distribution.Female || 0;
        elements.unknownCount.textContent = data.gender_distribution.Unknown || 0;

        // Render Diagnostic Tag Bars
        elements.diagTagsList.replaceChildren();
        const topTags = data.tag_distribution.slice(0, 7);
        const maxCount = topTags.length > 0 ? topTags[0].count : 1;

        topTags.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'tag-bar-item';

            const headerEl = document.createElement('div');
            headerEl.className = 'tag-bar-header';

            const titleSpan = document.createElement('span');
            titleSpan.textContent = item.tag;

            const countSpan = document.createElement('span');
            countSpan.textContent = `${item.count} patients`;

            headerEl.appendChild(titleSpan);
            headerEl.appendChild(countSpan);

            const trackEl = document.createElement('div');
            trackEl.className = 'tag-bar-track';

            const fillEl = document.createElement('div');
            fillEl.className = 'tag-bar-fill';
            const pct = Math.round((item.count / maxCount) * 100);
            fillEl.style.width = `${pct}%`;

            trackEl.appendChild(fillEl);
            itemEl.appendChild(headerEl);
            itemEl.appendChild(trackEl);

            elements.diagTagsList.appendChild(itemEl);
        });

        // Render Age Bars
        elements.ageBarsContainer.replaceChildren();
        const ageGroupKeys = Object.keys(data.age_distribution);
        const maxAgeCount = Math.max(...Object.values(data.age_distribution));

        ageGroupKeys.forEach(grp => {
            const count = data.age_distribution[grp];
            const itemEl = document.createElement('div');
            itemEl.className = 'tag-bar-item';

            const headerEl = document.createElement('div');
            headerEl.className = 'tag-bar-header';

            const titleSpan = document.createElement('span');
            titleSpan.textContent = grp === 'Unknown' ? 'Age Unspecified' : `${grp} yrs`;

            const countSpan = document.createElement('span');
            countSpan.textContent = `${count}`;

            headerEl.appendChild(titleSpan);
            headerEl.appendChild(countSpan);

            const trackEl = document.createElement('div');
            trackEl.className = 'tag-bar-track';

            const fillEl = document.createElement('div');
            fillEl.className = 'tag-bar-fill';
            fillEl.style.background = 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)';
            const pct = maxAgeCount > 0 ? Math.round((count / maxAgeCount) * 100) : 0;
            fillEl.style.width = `${pct}%`;

            trackEl.appendChild(fillEl);
            itemEl.appendChild(headerEl);
            itemEl.appendChild(trackEl);

            elements.ageBarsContainer.appendChild(itemEl);
        });
    }

    async function fetchTags() {
        try {
            const res = await fetch('/api/tags');
            const data = await res.json();
            state.tags = data;
            renderTagChips(data);
        } catch (err) {
            console.error('Failed to fetch tags:', err);
        }
    }

    function renderTagChips(tagsData) {
        elements.tagChipsBar.replaceChildren();

        const allChip = document.createElement('button');
        allChip.className = `tag-chip ${state.selectedTag === 'All' ? 'active' : ''}`;
        allChip.textContent = 'All Conditions';
        allChip.addEventListener('click', () => selectTagFilter('All'));
        elements.tagChipsBar.appendChild(allChip);

        tagsData.forEach(item => {
            const chip = document.createElement('button');
            chip.className = `tag-chip ${state.selectedTag === item.tag ? 'active' : ''}`;
            chip.textContent = `${item.tag} (${item.count})`;
            chip.addEventListener('click', () => selectTagFilter(item.tag));
            elements.tagChipsBar.appendChild(chip);
        });
    }

    function selectTagFilter(tagName) {
        state.selectedTag = tagName;
        state.currentPage = 1;
        renderTagChips(state.tags);
        fetchPatients();
    }

    async function fetchPatients() {
        elements.patientsContainer.replaceChildren();

        const loadingEl = document.createElement('div');
        loadingEl.className = 'loading-state';
        loadingEl.textContent = 'Searching clinical dataset...';
        elements.patientsContainer.appendChild(loadingEl);

        const params = new URLSearchParams({
            q: state.searchQuery,
            tag: state.selectedTag,
            gender: state.selectedGender,
            page: state.currentPage,
            page_size: state.pageSize
        });

        try {
            const res = await fetch(`/api/patients?${params.toString()}`);
            const data = await res.json();
            renderPatients(data);
        } catch (err) {
            console.error('Failed to fetch patients:', err);
            elements.patientsContainer.textContent = 'Error loading patient data.';
        }
    }

    function renderPatients(data) {
        elements.patientsContainer.replaceChildren();

        const total = data.total;
        const page = data.page;
        const totalPages = data.total_pages;

        const startItem = total > 0 ? (page - 1) * state.pageSize + 1 : 0;
        const endItem = Math.min(page * state.pageSize, total);

        elements.resultsCountText.textContent = `Showing ${startItem}-${endItem} of ${total} patient records`;

        if (!data.patients || data.patients.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'empty-state';
            emptyEl.textContent = 'No matching patient records found in dataset.';
            elements.patientsContainer.appendChild(emptyEl);
            elements.paginationBar.replaceChildren();
            return;
        }

        data.patients.forEach(p => {
            const card = document.createElement('div');
            card.className = 'patient-card glass-card';
            card.addEventListener('click', () => openPatientModal(p.patient_id));

            const topDiv = document.createElement('div');
            topDiv.className = 'card-top';

            const nameEl = document.createElement('h3');
            nameEl.className = 'patient-name';
            nameEl.textContent = p.name;

            topDiv.appendChild(nameEl);

            const metaRow = document.createElement('div');
            metaRow.className = 'patient-meta-row';
            const ageStr = p.age ? `${p.age} yrs` : 'Age N/A';
            const genStr = p.gender || 'Sex N/A';
            metaRow.textContent = `${ageStr} • ${genStr} • ${p.date_of_exam}`;

            const tagsRow = document.createElement('div');
            tagsRow.className = 'card-tags';
            (p.tags || []).slice(0, 3).forEach(t => {
                const badge = document.createElement('span');
                badge.className = 'badge-tag';
                badge.textContent = t;
                tagsRow.appendChild(badge);
            });

            const snippetEl = document.createElement('p');
            snippetEl.className = 'card-snippet';
            snippetEl.textContent = p.snippet || p.clinical_impression || p.history || 'View clinical report...';

            const footerDiv = document.createElement('div');
            footerDiv.className = 'card-footer';

            const folderSpan = document.createElement('span');
            folderSpan.textContent = p.filename || p.folder_name;

            const viewBtn = document.createElement('button');
            viewBtn.className = 'view-btn';
            viewBtn.textContent = 'View Report →';

            footerDiv.appendChild(folderSpan);
            footerDiv.appendChild(viewBtn);

            card.appendChild(topDiv);
            card.appendChild(metaRow);
            card.appendChild(tagsRow);
            card.appendChild(snippetEl);
            card.appendChild(footerDiv);

            elements.patientsContainer.appendChild(card);
        });

        renderPagination(page, totalPages);
    }

    function renderPagination(currentPage, totalPages) {
        elements.paginationBar.replaceChildren();
        if (totalPages <= 1) return;

        const prevBtn = document.createElement('button');
        prevBtn.className = 'page-btn';
        prevBtn.textContent = '« Prev';
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                state.currentPage--;
                fetchPatients();
            }
        });
        elements.paginationBar.appendChild(prevBtn);

        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, startPage + 4);

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.addEventListener('click', () => {
                state.currentPage = i;
                fetchPatients();
            });
            elements.paginationBar.appendChild(pageBtn);
        }

        const nextBtn = document.createElement('button');
        nextBtn.className = 'page-btn';
        nextBtn.textContent = 'Next »';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                state.currentPage++;
                fetchPatients();
            }
        });
        elements.paginationBar.appendChild(nextBtn);
    }

    // --- PATIENT DETAIL MODAL ---
    async function openPatientModal(patientId) {
        try {
            const res = await fetch(`/api/patients/${patientId}`);
            if (!res.ok) return;
            const p = await res.json();
            state.currentPatient = p;

            elements.modalName.textContent = p.name;
            elements.modalMetaAgeGender.textContent = `${p.age ? p.age + ' yrs' : 'Age Unspecified'} / ${p.gender || 'Sex Unspecified'}`;
            elements.modalDate.textContent = p.date_of_exam || 'N/A';

            elements.modalTagsRow.replaceChildren();
            (p.tags || []).forEach(t => {
                const badge = document.createElement('span');
                badge.className = 'badge-tag';
                badge.textContent = t;
                elements.modalTagsRow.appendChild(badge);
            });

            elements.modalHistory.textContent = p.history || 'No history recorded.';
            elements.modalPastHistory.textContent = p.past_history || 'No past history recorded.';
            elements.modalEnt.textContent = (p.ent_exam + '\n\n' + p.neuro_exam + '\n\n' + p.neurotological_exam).trim() || 'Normal examination.';

            elements.modalInvestigations.textContent = p.investigations || 'No MRI/PTA recorded.';
            elements.modalVng.textContent = p.vng_results || 'VNG tests normal.';

            elements.modalImpression.textContent = p.clinical_impression || 'N/A';
            elements.modalTreatment.textContent = p.treatment || 'No treatment recorded.';
            elements.modalRaw.textContent = p.full_text;

            elements.modalTabs.forEach(t => t.classList.remove('active'));
            elements.modalTabContents.forEach(c => c.classList.remove('active'));
            elements.modalTabs[0].classList.add('active');
            elements.modalTabContents[0].classList.add('active');

            elements.patientModal.style.display = 'flex';
        } catch (err) {
            console.error('Error opening patient modal:', err);
        }
    }

    function closeModal() {
        elements.patientModal.style.display = 'none';
    }

    // --- RAG ASSISTANT ---
    async function runRagQuery() {
        const prompt = elements.ragPromptInput.value.trim();
        if (!prompt || state.isRagLoading) return;

        state.isRagLoading = true;
        elements.btnRunRag.disabled = true;
        elements.btnRunRag.textContent = 'Synthesizing Answers...';

        elements.ragContainer.style.display = 'block';
        elements.ragResponseBody.textContent = 'Analyzing records via Hybrid BM25 + Gemini Vector RRF Engine...';
        elements.sourcesList.replaceChildren();
        elements.sourcesList.style.display = 'none';

        const scopeTag = elements.ragTagScope.value;

        try {
            const res = await fetch('/api/query-rag', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: prompt,
                    tag_filter: scopeTag,
                    top_k: 10
                })
            });

            const data = await res.json();
            renderRagResponse(data);
        } catch (err) {
            console.error('RAG Error:', err);
            elements.ragResponseBody.textContent = 'Error executing RAG query. Please check connection and try again.';
        } finally {
            state.isRagLoading = false;
            elements.btnRunRag.disabled = false;
            elements.btnRunRag.textContent = 'Ask Clinic AI';
        }
    }

    function renderRagResponse(data) {
        const text = data.answer || 'No response generated.';

        // Use marked + DOMPurify for clean, safe Markdown rendering
        if (window.marked && window.DOMPurify) {
            const rawHtml = window.marked.parse(text);
            const cleanHtml = window.DOMPurify.sanitize(rawHtml);
            elements.ragResponseBody.innerHTML = cleanHtml;
        } else {
            elements.ragResponseBody.replaceChildren();
            const paragraphs = text.split('\n\n');
            paragraphs.forEach(pText => {
                const p = document.createElement('p');
                p.textContent = pText;
                elements.ragResponseBody.appendChild(p);
            });
        }

        // Render Sources Accordion
        elements.sourcesCount.textContent = data.total_sources || 0;
        elements.sourcesList.replaceChildren();

        (data.sources || []).forEach(src => {
            const item = document.createElement('div');
            item.className = 'source-item';
            item.style.cursor = 'pointer';
            item.addEventListener('click', () => openPatientModal(src.patient_id));

            const title = document.createElement('span');
            title.className = 'source-title';
            title.textContent = `📄 ${src.name} (${src.filename})`;

            const snippet = document.createElement('span');
            snippet.className = 'source-snippet';
            snippet.textContent = src.snippet || src.clinical_impression || 'View patient record';

            item.appendChild(title);
            item.appendChild(snippet);
            elements.sourcesList.appendChild(item);
        });
    }
});
