/**
 * UniShield - LinkedIn Profile Content Script
 * Detects fake/incomplete profiles (<50 connections and missing photo)
 * and injects a private notes & tags panel with AI photo scan link.
 */
(function() {
    'use strict';

    window.UniShield = window.UniShield || {};
    const browserAPI = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : {});

    const getStorage = () => window.UniShield && window.UniShield.Storage;

    let config = null;

    async function init() {
        const storage = getStorage();
        if (storage) {
            config = await storage.getConfig();
        }

        if (isExtensionActive()) {
            processProfile();
            startObserver();
        }

        setupMessageListener();
    }

    function isExtensionActive() {
        return config && config.global && config.global.enabled !== false && config.linkedin && config.linkedin.enabled !== false;
    }

    function injectWarningBanner(container, message) {
        if (!container) return;
        const existing = container.querySelector('.unishield-profile-warning');
        if (existing) return;

        const banner = document.createElement('div');
        banner.className = 'unishield-profile-warning';
        banner.style.padding = '12px 16px';
        banner.style.margin = '16px';
        banner.style.width = 'calc(100% - 32px)';
        banner.style.borderRadius = '8px';
        banner.style.backgroundColor = '#1e1e1e';
        banner.style.color = '#ff9800';
        banner.style.border = '1px solid #f57c00';
        banner.style.fontWeight = '500';
        banner.style.fontSize = '14px';
        banner.style.display = 'flex';
        banner.style.alignItems = 'center';
        banner.style.gap = '8px';

        const strong = document.createElement('strong');
        strong.textContent = typeof t === 'function' ? t('alertPrefix') : '⚠️ UniShield Alert:';
        const span = document.createElement('span');
        span.textContent = message;

        banner.appendChild(strong);
        banner.appendChild(span);
        container.prepend(banner);
    }

    function processProfile() {
        if (!isExtensionActive()) return;

        const buttons = Array.from(document.querySelectorAll('button'));
        const actionBtn = buttons.find(b => {
            const label = b.getAttribute('aria-label');
            return label && (
                label.toLowerCase().includes('message') ||
                label.toLowerCase().includes('connect') ||
                label.toLowerCase().includes('more') ||
                label.toLowerCase().includes('mensaje') ||
                label.toLowerCase().includes('conectar')
            );
        });

        if (!actionBtn) return;
        const topCard = actionBtn.closest('section') || actionBtn.parentElement.parentElement;

        // 1. Fake Profile Detector
        if (config.linkedin.detectFakeProfiles !== false) {
            const text = (document.body.textContent || '').toLowerCase();
            const connMatch = text.match(/(\d+)\+?\s*(connections|contactos)/);
            let isLowConnections = false;
            if (connMatch) {
                isLowConnections = parseInt(connMatch[1], 10) < 50;
            } else if (!text.includes('followers') && !text.includes('seguidores')) {
                isLowConnections = true;
            }

            const userName = document.title.split(' | ')[0].split(' ')[0];
            const hasPhoto = Boolean(
                document.querySelector(`img[alt*="${userName}"]`) ||
                document.querySelector('img[src*="profile-displayphoto"], img[srcset*="profile-displayphoto"]')
            );

            if (!hasPhoto || isLowConnections) {
                const warnMsg = typeof t === 'function' ? t('suspiciousProfile') : 'This profile may be suspicious or incomplete (missing custom photo or under 50 connections).';
                injectWarningBanner(topCard, warnMsg);
            }
        }

        // 2. Private Notes & Tags
        if (config.linkedin.enableProfileNotes !== false) {
            injectNotesPanel(topCard);
        }
    }

    async function injectNotesPanel(container) {
        if (!container || container.querySelector('.unishield-notes-panel')) return;

        const pathParts = window.location.pathname.split('/in/');
        const profileId = pathParts[1] ? pathParts[1].split('/')[0] : null;
        if (!profileId) return;

        const panel = document.createElement('div');
        panel.className = 'unishield-notes-panel';
        panel.style.margin = '16px';
        panel.style.width = 'calc(100% - 32px)';
        panel.style.padding = '14px 18px';
        panel.style.backgroundColor = '#181818';
        panel.style.color = '#ffffff';
        panel.style.border = '1px solid #2e2e2e';
        panel.style.borderRadius = '8px';

        // Header row
        const headerRow = document.createElement('div');
        headerRow.style.display = 'flex';
        headerRow.style.justifyContent = 'space-between';
        headerRow.style.alignItems = 'center';

        const titleWrap = document.createElement('div');
        titleWrap.style.display = 'flex';
        titleWrap.style.alignItems = 'center';
        titleWrap.style.cursor = 'pointer';
        titleWrap.style.gap = '8px';

        const titleText = document.createElement('h3');
        titleText.style.fontSize = '14px';
        titleText.style.margin = '0';
        titleText.style.fontWeight = '600';
        titleText.textContent = '🔒 ' + (typeof t === 'function' ? t('privateNotesTitle') : 'Private Notes & Tags');

        const toggleArrow = document.createElement('span');
        toggleArrow.textContent = '▼';
        toggleArrow.style.fontSize = '12px';
        toggleArrow.style.color = '#999999';

        titleWrap.appendChild(titleText);
        titleWrap.appendChild(toggleArrow);

        const aiScanLink = document.createElement('a');
        aiScanLink.href = 'https://truthscan.com/ai-image-detector';
        aiScanLink.target = '_blank';
        aiScanLink.textContent = '🔍 ' + (typeof t === 'function' ? t('scanPhoto') : 'Scan Photo for AI');
        aiScanLink.style.backgroundColor = '#2a2a2a';
        aiScanLink.style.color = '#70baff';
        aiScanLink.style.padding = '4px 12px';
        aiScanLink.style.borderRadius = '16px';
        aiScanLink.style.fontSize = '12px';
        aiScanLink.style.fontWeight = '600';
        aiScanLink.style.textDecoration = 'none';
        aiScanLink.style.border = '1px solid #3a3a3a';

        headerRow.appendChild(titleWrap);
        headerRow.appendChild(aiScanLink);

        // Content area
        const contentWrap = document.createElement('div');
        contentWrap.style.display = 'none';
        contentWrap.style.marginTop = '12px';

        const tagInput = document.createElement('input');
        tagInput.type = 'text';
        tagInput.placeholder = typeof t === 'function' ? t('tagPlaceholder') : 'Add a tag (e.g., Recruiter, Candidate, Lead)...';
        tagInput.style.width = '100%';
        tagInput.style.padding = '8px 12px';
        tagInput.style.marginBottom = '8px';
        tagInput.style.borderRadius = '6px';
        tagInput.style.border = '1px solid #333333';
        tagInput.style.background = '#121212';
        tagInput.style.color = '#ffffff';
        tagInput.style.fontSize = '13px';

        const noteTextarea = document.createElement('textarea');
        noteTextarea.placeholder = typeof t === 'function' ? t('notePlaceholder') : 'Write private notes for this contact (stored locally on your device)...';
        noteTextarea.style.width = '100%';
        noteTextarea.style.padding = '8px 12px';
        noteTextarea.style.borderRadius = '6px';
        noteTextarea.style.border = '1px solid #333333';
        noteTextarea.style.background = '#121212';
        noteTextarea.style.color = '#ffffff';
        noteTextarea.style.minHeight = '80px';
        noteTextarea.style.resize = 'vertical';
        noteTextarea.style.fontSize = '13px';

        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.alignItems = 'center';
        btnRow.style.gap = '10px';
        btnRow.style.marginTop = '8px';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = typeof t === 'function' ? t('saveNote') : 'Save Note';
        saveBtn.style.padding = '6px 16px';
        saveBtn.style.backgroundColor = '#0077b5';
        saveBtn.style.color = '#ffffff';
        saveBtn.style.border = 'none';
        saveBtn.style.borderRadius = '6px';
        saveBtn.style.cursor = 'pointer';
        saveBtn.style.fontWeight = '600';
        saveBtn.style.fontSize = '13px';

        const statusSpan = document.createElement('span');
        statusSpan.style.fontSize = '12px';
        statusSpan.style.color = '#48c774';

        btnRow.appendChild(saveBtn);
        btnRow.appendChild(statusSpan);

        contentWrap.appendChild(tagInput);
        contentWrap.appendChild(noteTextarea);
        contentWrap.appendChild(btnRow);

        panel.appendChild(headerRow);
        panel.appendChild(contentWrap);
        container.appendChild(panel);

        // Load existing notes
        try {
            browserAPI.storage.local.get(['profileNotes'], (res) => {
                const notes = (res && res.profileNotes) || {};
                const current = notes[profileId] || {};
                if (current.tag) tagInput.value = current.tag;
                if (current.note) noteTextarea.value = current.note;
            });
        } catch (e) {}

        // Toggle accordion
        titleWrap.onclick = () => {
            const isHidden = contentWrap.style.display === 'none';
            contentWrap.style.display = isHidden ? 'block' : 'none';
            toggleArrow.textContent = isHidden ? '▲' : '▼';
        };

        // Save action
        saveBtn.onclick = () => {
            try {
                browserAPI.storage.local.get(['profileNotes'], (res) => {
                    const notes = (res && res.profileNotes) || {};
                    notes[profileId] = {
                        tag: tagInput.value.trim(),
                        note: noteTextarea.value.trim(),
                        updatedAt: new Date().toISOString()
                    };
                    browserAPI.storage.local.set({ profileNotes: notes }, () => {
                        const savedMsg = typeof t === 'function' ? t('saved') : 'Saved!';
                        statusSpan.textContent = '✓ ' + savedMsg;
                        setTimeout(() => { statusSpan.textContent = ''; }, 2000);
                    });
                });
            } catch (e) {}
        };
    }

    function startObserver() {
        let timeout = null;
        const observer = new MutationObserver(() => {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(processProfile, 500);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function setupMessageListener() {
        try {
            const storage = getStorage();
            if (storage && !storage.isExtensionValid()) return;
            browserAPI.runtime.onMessage.addListener((message) => {
                if (message.type === 'UNISHIELD_CONFIG_UPDATED') {
                    if (storage) {
                        storage.getConfig().then(newConfig => {
                            config = newConfig;
                            if (isExtensionActive()) {
                                processProfile();
                            }
                        }).catch(() => {});
                    }
                }
            });
        } catch (e) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
