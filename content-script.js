// Uses browser-compatible storage and fetch (credentials included).

(() => {
  'use strict';

  // Cross-browser storage API (promisified)
  const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

  const storage = {
    async get(key, defaultValue = null) {
      return new Promise((resolve) => {
        browserAPI.storage.local.get([key], (result) => {
          if (browserAPI.runtime.lastError) {
            console.warn('storage.get error', browserAPI.runtime.lastError);
            resolve(defaultValue);
            return;
          }
          resolve(result[key] !== undefined ? result[key] : defaultValue);
        });
      });
    },
    async set(key, value) {
      return new Promise((resolve, reject) => {
        const payload = {};
        payload[key] = value;
        browserAPI.storage.local.set(payload, () => {
          if (browserAPI.runtime.lastError) {
            console.warn('storage.set error', browserAPI.runtime.lastError);
            reject(browserAPI.runtime.lastError);
            return;
          }
          resolve();
        });
      });
    }
  };

  // ====== Constants & Config ======
  const STEAM_ID_REGEX = /^\d{17}$/;
  const REQUEST_DELAY = 1500; // ms

  const UI_TEXT = {
      TITLE: 'Bulk Steam Nickname',
      SUBTITLE: "Nicknames are set even if you aren't friends with the user",
      PREFIX_LABEL: 'Nickname prefix:',
      ADD_ROW: 'Add Row',
      SUBMIT_CSV: 'Submit CSV',
      APPLY: 'Apply',
      EXPORT_CSV: 'Copy as CSV',
      CLOSE: 'Close',
      CSV_PLACEHOLDER: 'Paste CSV data here (steamId,nickname)',
      LOADING: '⌛',
      SUCCESS: '✅',
      ERROR: '❌'
  };

  // Colors are in CSS file (steam-nickname.css)

  // ====== State ======
  let nicknameData = [];
  let popupElement = null;

  // ====== Helpers ======
  function isValidSteamId(steamId) {
    return STEAM_ID_REGEX.test(steamId);
  }

  function renumberRows(tbody) {
    const rows = tbody.querySelectorAll('tr');
    rows.forEach((row, index) => {
      const rowNumCell = row.cells[0];
      if (rowNumCell) rowNumCell.textContent = index + 1;
    });
  }

  function getSessionID() {
    try {
      // Attempt to read the session ID from the global window context
      if (typeof window.g_sessionID !== 'undefined') {
        return window.g_sessionID;
      }
      // Fallback: extract sessionid cookie
      const match = document.cookie.match(/sessionid=([^;]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
    } catch (e) {
      console.warn('getSessionID error:', e);
    }
    return null;
  }


  async function setSteamNickname(sessionid, steamId, nickname) {
    const ajaxSetNicknameURL = `https://steamcommunity.com/profiles/${steamId}/ajaxsetnickname/`;
    const body = `nickname=${encodeURIComponent(nickname)}&sessionid=${encodeURIComponent(sessionid)}`;

    async function attempt() {
      return fetch(ajaxSetNicknameURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body,
        credentials: 'include'
      });
    }

    let resp = await attempt().catch(()=>null);
    if (!resp || !resp.ok) {
      // retry once after short wait
      await new Promise(res => setTimeout(res, 800));
      resp = await attempt().catch(()=>null);
    }

    if (!resp || !resp.ok) {
      throw new Error(`Request failed`);
    }
    return resp.text();
  }


  function exportToCsv(data) {
    return data.map(item => `${item.steamId},${item.nickname}`).join('\n');
  }

  function parseCsv(csvText) {
    const lines = csvText.split('\n');
    const parsedData = [];
    const parseErrors = [];
    lines.forEach((line, index) => {
      line = line.trim();
      if (!line) return;
      const parts = line.split(',');
      if (parts.length >= 2) {
        const steamId = parts[0].trim();
        const nickname = parts.slice(1).join(',').trim();
        parsedData.push({ steamId, nickname });
      } else {
        parseErrors.push(`Line ${index+1}: ${line}`);
      }
    });
    return { data: parsedData, errors: parseErrors };
  }

  function createButton(id, text, className='bsn_blue_button') {
    const button = document.createElement('button');
    button.id = id;
    button.textContent = text;
    button.classList.add('bsn_button', className);
    return button;
  }

  function createTableRow(tbody, rowNum, steamId='', nickname='') {
    const row = document.createElement('tr');

    const rowNumCell = document.createElement('td');
    rowNumCell.id = 'bsn_rowNumCell';
    rowNumCell.textContent = rowNum;

    const steamIdCell = document.createElement('td');
    const steamIdInput = document.createElement('input');
    steamIdInput.className = 'bsn_rowInput';
    steamIdInput.type = 'text';
    steamIdInput.value = steamId;
    steamIdCell.appendChild(steamIdInput);
    steamIdInput.addEventListener('input', () => {
      if (steamIdInput.value && !isValidSteamId(steamIdInput.value)) {
        steamIdInput.classList.add('invalid');
      } else {
        steamIdInput.classList.remove('invalid');
      }
    });

    const nicknameCell = document.createElement('td');
    const nicknameInput = document.createElement('input');
    nicknameInput.className = 'bsn_rowInput';
    nicknameInput.type = 'text';
    nicknameInput.value = nickname;
    nicknameCell.appendChild(nicknameInput);

    const removeUserCell = document.createElement('td');
    const removeUserButton = document.createElement('button');
    removeUserButton.id = 'bsn_removeUserButton';
    removeUserButton.textContent = 'X';
    removeUserButton.addEventListener('click', () => {
      tbody.removeChild(row);
      renumberRows(tbody);
      updateNicknameDataFromTable(tbody);
    });
    removeUserCell.appendChild(removeUserButton);

    row.appendChild(rowNumCell);
    row.appendChild(steamIdCell);
    row.appendChild(nicknameCell);
    row.appendChild(removeUserCell);

    tbody.appendChild(row);
  }

  function updateNicknameDataFromTable(tbody) {
    nicknameData = [];
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
      const steamIdInput = row.cells[1].querySelector('input');
      const nicknameInput = row.cells[2].querySelector('input');
      if (steamIdInput && nicknameInput) {
        nicknameData.push({
          steamId: steamIdInput.value,
          nickname: nicknameInput.value
        });
      }
    });
    // persist
    storage.set('nicknameData', nicknameData).catch(console.warn);
    return nicknameData;
  }

  function showError(message) {
    const errorContainer = document.getElementById('bsn_errorMessageContainer');
    if (errorContainer) errorContainer.textContent = message;
    console.warn(message);
  }

  function createCleanupLogContainer() {
    const div = document.createElement('div');
    div.id = 'bsn_cleanupResultsContainer';
    div.style.display = 'none';
    div.style.backgroundColor = '#1b2838';
    div.style.color = '#c6d4df';
    div.style.border = '1px solid #3b4751';
    div.style.padding = '8px';
    div.style.margin = '8px 0';
    div.style.maxHeight = '120px';
    div.style.overflowY = 'auto';
    div.style.borderRadius = '4px';
    div.style.fontSize = '12px';
    return div;
  }

  function createSteamTablePopup(initialData) {
    const popupContainer = document.createElement('div');
    popupContainer.id = 'bsn_popupContainer';

    const title = document.createElement('h3');
    title.id = 'bsn_titleText';
    title.textContent = UI_TEXT.TITLE;

    const subtitle = document.createElement('p');
    subtitle.id = 'bsn_subtitleText';
    subtitle.textContent = UI_TEXT.SUBTITLE;

    popupContainer.append(title, subtitle);

    const prefixContainer = document.createElement('div');
    prefixContainer.id = 'bsn_prefixContainer';

    const prefixLabel = document.createElement('label');
    prefixLabel.id = 'bsn_prefixLabel';
    prefixLabel.textContent = UI_TEXT.PREFIX_LABEL;

    const prefixInput = document.createElement('input');
    prefixInput.id = 'bsn_prefixInput';
    prefixInput.type = 'text';
    // load prefix from storage
    storage.get('nicknamePrefix', '').then(v => { prefixInput.value = v || ''; });

    prefixInput.addEventListener('input', () => {
      storage.set('nicknamePrefix', prefixInput.value).catch(console.warn);
    });

    prefixContainer.append(prefixLabel, prefixInput);
    popupContainer.appendChild(prefixContainer);

    // table
    const table = document.createElement('table');
    table.id = 'bsn_table';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['#','SteamID','Nickname',''].forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    // populate
    if (initialData && Array.isArray(initialData) && initialData.length>0) {
      initialData.forEach((item, idx) => createTableRow(tbody, idx+1, item.steamId, item.nickname));
    } else {
      createTableRow(tbody, 1, '', '');
    }
    popupContainer.appendChild(table);

    const addRowButton = createButton('bsn_addRowButton', UI_TEXT.ADD_ROW);
    addRowButton.addEventListener('click', () => {
      const rowCount = tbody.rows.length + 1;
      createTableRow(tbody, rowCount);
      updateNicknameDataFromTable(tbody);
    });
    popupContainer.appendChild(addRowButton);

    const errorMessageContainer = document.createElement('div');
    errorMessageContainer.id = 'bsn_errorMessageContainer';
    popupContainer.appendChild(errorMessageContainer);

    // INSERT CLEANUP RESULTS BOX HERE ✅
    const cleanupResultsContainer = createCleanupLogContainer();
    popupContainer.appendChild(cleanupResultsContainer);

    const csvInputContainer = document.createElement('div');
    csvInputContainer.id = 'bsn_csvInputContainer';
    const csvInputArea = document.createElement('textarea');
    csvInputArea.id = 'bsn_csvInputArea';
    csvInputArea.rows = 1;
    csvInputArea.placeholder = UI_TEXT.CSV_PLACEHOLDER;

    csvInputArea.addEventListener('input', function(){
      const maxHeight = 100;
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, maxHeight) + 'px';
    });

    const csvSubmitButton = createButton('bsn_csvSubmitButton', UI_TEXT.SUBMIT_CSV, 'bsn_green_button');
    csvInputContainer.append(csvInputArea, csvSubmitButton);
    popupContainer.appendChild(csvInputContainer);

    const bottomButtonContainer = document.createElement('div');
    bottomButtonContainer.id = 'bsn_bottomButtonContainer';
    const applyButton = createButton('bsn_applyButton', UI_TEXT.APPLY, 'bsn_green_button');
    const csvExportButton = createButton('bsn_csvExportButton', UI_TEXT.EXPORT_CSV);
    const closeButton = createButton('bsn_closeButton', UI_TEXT.CLOSE);
    bottomButtonContainer.append(applyButton, csvExportButton, closeButton);
    popupContainer.appendChild(bottomButtonContainer);

    // apply handler
    applyButton.addEventListener('click', async () => {
      if (tbody.rows.length < 1) { showError('No data to apply'); return; }

      updateNicknameDataFromTable(tbody);

      const invalidRows = [];
      const steamIds = [];
      nicknameData.forEach((item, index) => {
        if (!isValidSteamId(item.steamId)) invalidRows.push(index+1);
        steamIds.push(item.steamId);
      });
      if (invalidRows.length>0) { showError(`Invalid SteamIDs in row(s): ${invalidRows.join(', ')}`); return; }

      const duplicates = steamIds.filter((id, idx) => steamIds.indexOf(id)!==idx && id!=='');
      if (duplicates.length>0) {
        const duplicateRows = [];
        steamIds.forEach((id, idx) => { if (duplicates.includes(id)) duplicateRows.push(idx+1); });
        showError(`Duplicate SteamIDs in row(s): ${duplicateRows.join(', ')}`); return;
      }

      const sessionID = getSessionID();
      if (!sessionID) { showError('Session ID not found. Please reload the page.'); return; }

      const prefix = prefixInput.value || '';
      const friendBlocks = Array.from(document.querySelectorAll('.selectable.friend_block_v2')).filter(b=>b.querySelector('a.selectable_overlay'));

      if (!prefix) {
        cleanupResultsContainer.style.display = 'none';
      } else {
        // Start cleanup log
        cleanupResultsContainer.style.display = 'block';
        cleanupResultsContainer.innerHTML = '<strong>🔁 Running nickname cleanup...</strong>';

        let cleanupHappened = false;

        for (const block of friendBlocks) {
          const link = block.querySelector('a.selectable_overlay');
          if (!link) continue;
          const steamId = await extractSteamID64(link.href);
          if (!steamId) continue;
          const nicknameEl = block.querySelector('.friend_block_content');
          let nickname = '';
          if (nicknameEl) {
            const raw = nicknameEl.childNodes;
            for (const node of raw) {
              if (node.nodeType === Node.TEXT_NODE) {
                nickname = node.textContent.trim(); break;
              }
            }
          }
          if (nickname.startsWith(prefix) && !nicknameData.find(i=>i.steamId===steamId)) {
            const oldName = nickname.replace(prefix, '') || '(blank)';
            cleanupHappened = true;
            try {
              await setSteamNickname(sessionID, steamId, '');
              const logLine = document.createElement('div');
              logLine.textContent = `✅ Cleared: ${steamId} (was: ${oldName})`;
              cleanupResultsContainer.appendChild(logLine);
              cleanupResultsContainer.scrollTop = cleanupResultsContainer.scrollHeight;
              await new Promise(res=>setTimeout(res, REQUEST_DELAY));
            } catch (e) {
              const logLine = document.createElement('div');
              logLine.textContent = `⚠️ Failed: ${steamId} (was: ${oldName}) — ${e.message}`;
              cleanupResultsContainer.appendChild(logLine);
              cleanupResultsContainer.scrollTop = cleanupResultsContainer.scrollHeight;
            }
            await new Promise(res=>setTimeout(res, 500));
          }
        }

        // --- Final UI update ---
        if (!cleanupHappened) {
          cleanupResultsContainer.innerHTML = '<strong>✅ No nicknames required cleanup.</strong>';
        } else {
          const header = cleanupResultsContainer.firstChild;
          header.textContent = '✅ Cleanup complete:';
        }
      }


      // process table rows
      for (let i=0;i<tbody.rows.length;i++) {
        const row = tbody.rows[i];
        const statusCell = row.cells[3];
        const steamId = nicknameData[i].steamId;
        const nickname = nicknameData[i].nickname;
        if (!steamId) continue;
        statusCell.innerHTML = '';
        const statusContainer = document.createElement('div');
        statusContainer.id = 'bsn_statusContainer';
        const spinner = document.createElement('div');
        spinner.className = 'bsn_spinner';
        statusContainer.appendChild(spinner);
        statusCell.appendChild(statusContainer);
        try {
          const nicknamePrefix = prefixInput.value || '';
          const fullNickname = `${nicknamePrefix}${nickname}`;
          await setSteamNickname(sessionID, steamId, fullNickname);
          statusContainer.textContent = UI_TEXT.SUCCESS;
        } catch (error) {
          statusContainer.textContent = UI_TEXT.ERROR;
          statusContainer.title = error?.message || 'Request failed';

          if (typeof debugMode !== 'undefined' && debugMode) {
            console.warn('Nickname set failed:', error);
          }
        }

        if (i < tbody.rows.length - 1) {
          await new Promise(res=>setTimeout(res, REQUEST_DELAY));
        }
      }
    });

    csvExportButton.addEventListener('click', () => {
      updateNicknameDataFromTable(tbody);
      const csvString = exportToCsv(nicknameData);
      navigator.clipboard.writeText(csvString).then(() => {
        csvExportButton.textContent = 'Copied!';
        setTimeout(()=>csvExportButton.textContent = UI_TEXT.EXPORT_CSV, 2000);
      }).catch(err => showError('Failed to copy: ' + (err && err.message ? err.message : String(err))));
    });

    csvSubmitButton.addEventListener('click', () => {
      const csvText = csvInputArea.value.trim();
      if (!csvText) return;
      const result = parseCsv(csvText);
      if (result.errors.length > 0) {
        showError(`Some lines were invalid and skipped: ${result.errors.length} error(s)`);
        console.error('CSV parse errors:', result.errors);
      }
      if (result.data.length > 0) {
        nicknameData = result.data;
        storage.set('nicknameData', nicknameData).catch(console.warn);
        tbody.innerHTML = '';
        nicknameData.forEach((item, idx) => createTableRow(tbody, idx+1, item.steamId, item.nickname));
        csvInputArea.value = '';
        csvInputArea.style.height = 'auto';
      } else if (result.errors.length === 0) {
        showError('No valid data found in CSV input');
      }
    });

    closeButton.addEventListener('click', () => {
      updateNicknameDataFromTable(tbody);
      if (popupContainer.parentNode) popupContainer.parentNode.removeChild(popupContainer);
      popupElement = null;
    });

    popupContainer.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') { applyButton.click(); e.preventDefault(); }
      if (e.key === 'Escape') { closeButton.click(); e.preventDefault(); }
    });

    return popupContainer;
  }

  async function extractSteamID64(url) {
    try {
      url = url.replace(/\/+$/, '');
      const profileMatch = url.match(/^https?:\/\/steamcommunity\.com\/profiles\/(\d{17})$/);
      if (profileMatch) return profileMatch[1];
      const customMatch = url.match(/^https?:\/\/steamcommunity\.com\/id\/([\w-]+)$/);
      if (customMatch) {
        const customId = customMatch[1];
        const resp = await fetch(`https://steamcommunity.com/id/${customId}?xml=1`, { credentials: 'include' });
        if (!resp.ok) return null;
        const text = await resp.text();
        const idMatch = text.match(/<steamID64>(\d{17})<\/steamID64>/);
        return idMatch ? idMatch[1] : null;
      }
    } catch (e) {
      console.warn('extractSteamID64 error', e);
    }
    return null;
  }

  // Initialize UI
  async function init() {
    const stored = await storage.get('nicknameData', [{steamId:'', nickname:''}]).catch(()=>[{steamId:'', nickname:''}]);
    nicknameData = Array.isArray(stored) ? stored : [{steamId:'', nickname:''}];

    const popupButton = createButton('bsn_popupButton', 'Bulk Nickname', 'bsn_green_button');
    popupButton.addEventListener('click', () => {
      if (popupElement && popupElement.parentNode) {
        popupElement.parentNode.removeChild(popupElement);
        popupElement = null;
      } else {
        popupElement = createSteamTablePopup(nicknameData);
        document.body.appendChild(popupElement);
      }
    });

    document.body.appendChild(popupButton);
  }

  // Run
  init();

})();
