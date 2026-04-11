(function () {
    const tableContainer = document.getElementById('table-container');
    const searchBox = document.getElementById('searchBox');
    const stats = document.getElementById('stats');

    function logError(msg) {
        if (tableContainer) {
            tableContainer.innerHTML = '<div style="color: red; padding: 20px;">' + msg + '</div>';
        }
        if (stats) stats.textContent = 'Error';
    }

    try {
        const vscode = acquireVsCodeApi();
        
        let parsedData = [];
        let headers = [];
        let rawUnfilteredData = []; // To keep complete track if search is modifying the view
        let lastSentText = '';
        let currentSortColumn = -1;
        let currentSortAscending = true;
        let selectedRows = new Set();

        stats.textContent = "Script Loaded, Waiting for data...";

        const toolbar = document.querySelector('.toolbar');
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Delete Selected';
        deleteBtn.style.display = 'none';
        toolbar.insertBefore(deleteBtn, stats);

        // Modal Construction
        let modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        modalOverlay.style.display = 'none';
        let modalBox = document.createElement('div');
        modalBox.className = 'modal-box';
        let modalTitle = document.createElement('h3');
        modalTitle.textContent = 'Confirm Deletion';
        let modalText = document.createElement('p');
        modalText.id = 'modal-text';
        let modalButtons = document.createElement('div');
        modalButtons.className = 'modal-buttons';
        let cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-cancel';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => modalOverlay.style.display = 'none');
        let confirmBtn = document.createElement('button');
        confirmBtn.className = 'btn-confirm';
        confirmBtn.textContent = 'Delete Data';
        
        confirmBtn.addEventListener('click', () => {
            modalOverlay.style.display = 'none';
            rawUnfilteredData = rawUnfilteredData.filter((row, index) => !selectedRows.has(index));
            selectedRows.clear();
            parsedData = rawUnfilteredData.map((row, index) => ({ row, originalIndex: index }));
            sendEditUpdate();
            renderTable(searchBox.value.toLowerCase());
            updateDeleteBtn();
        });

        modalButtons.appendChild(cancelBtn);
        modalButtons.appendChild(confirmBtn);
        modalBox.appendChild(modalTitle);
        modalBox.appendChild(modalText);
        modalBox.appendChild(modalButtons);
        modalOverlay.appendChild(modalBox);
        document.body.appendChild(modalOverlay);

        deleteBtn.addEventListener('click', () => {
            if (selectedRows.size === 0) return;
            document.getElementById('modal-text').textContent = `Are you sure you want to permanently delete ${selectedRows.size} selected row${selectedRows.size > 1 ? 's' : ''}?`;
            modalOverlay.style.display = 'flex';
        });

        function updateDeleteBtn() {
            if (selectedRows.size > 0) {
                deleteBtn.style.display = 'inline-block';
                deleteBtn.textContent = `Delete Selected (${selectedRows.size})`;
            } else {
                deleteBtn.style.display = 'none';
            }
        }

        vscode.postMessage({ type: 'ready' });

        window.addEventListener('message', event => {
            try {
                const message = event.data;
                if (message.type === 'update') {
                    // Ignore echo updates caused by our own edits
                    if (message.text === lastSentText) {
                        return;
                    }
                    stats.textContent = "Data received, parsing...";
                    setTimeout(() => {
                        try {
                            processCsvData(message.text);
                        } catch(e) {
                            logError("Parse Error: " + e.message);
                        }
                    }, 10);
                }
            } catch(e) {
                logError("Msg Error: " + e.message);
            }
        });

        searchBox.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            renderTable(term);
        });

        // Event listener for blur to capture edits
        tableContainer.addEventListener('blur', (e) => {
            const isEditableCell = e.target && e.target.hasAttribute('contenteditable');
            if (isEditableCell) {
                const rowIndex = parseInt(e.target.dataset.row, 10);
                const colIndex = parseInt(e.target.dataset.col, 10);
                const newValue = e.target.textContent;

                // Determine if header or data
                let changed = false;
                if (rowIndex === -1) {
                    if (headers[colIndex] !== newValue) {
                        headers[colIndex] = newValue;
                        changed = true;
                    }
                } else {
                    if (rawUnfilteredData[rowIndex][colIndex] !== newValue) {
                        rawUnfilteredData[rowIndex][colIndex] = newValue;
                        changed = true;
                    }
                }

                if (changed) {
                    sendEditUpdate();
                }
            }
        }, true); // Use capture phase because blur doesn't bubble

        function sendEditUpdate() {
            const newCsvText = serializeCSV(headers, rawUnfilteredData);
            lastSentText = newCsvText;
            vscode.postMessage({
                type: 'edit',
                text: newCsvText
            });
            stats.textContent = "Saved";
        }

        function serializeCSV(headers, data) {
            function escapeCell(val) {
                if (val === null || val === undefined) return '';
                let str = String(val);
                if (str.includes(',') || str.includes('\"') || str.includes('\n') || str.includes('\r')) {
                    str = '"' + str.replace(/"/g, '""') + '"';
                }
                return str;
            }
            let lines = [];
            if (headers && headers.length > 0) {
                lines.push(headers.map(escapeCell).join(','));
            }
            for (const row of data) {
                lines.push(row.map(escapeCell).join(','));
            }
            return lines.join('\r\n');
        }

        function parseCSV(text) {
            if (!text) return [];
            let p = '', row = [''], ret = [row], i = 0, r = 0, s = !0, l;
            for (l of text) {
                if ('"' === l) {
                    if (s && l === p) row[i] += l;
                    s = !s;
                } else if (',' === l && s) l = row[++i] = '';
                else if ('\n' === l && s) {
                    if ('\r' === p) row[i] = row[i].slice(0, -1);
                    row = ret[++r] = [l = '']; i = 0;
                } else row[i] += l;
                p = l;
            }
            if (ret.length > 0 && ret[ret.length - 1].length === 1 && ret[ret.length - 1][0] === '') ret.pop();
            return ret;
        }

        function processCsvData(text) {
            const rawData = parseCSV(text);
            if (!rawData || rawData.length === 0) {
                tableContainer.innerHTML = '<div class="empty-state">No data found in CSV file.</div>';
                stats.textContent = "0 rows";
                return;
            }
            
            headers = rawData[0];
            rawUnfilteredData = rawData.slice(1);
            
            // Map original indices so we can edit the right row even when filtered
            parsedData = rawUnfilteredData.map((row, index) => ({ row, originalIndex: index }));
            
            stats.textContent = "Rendering table...";
            setTimeout(() => renderTable(''), 10);
        }

        function renderTable(filterTerm) {
            let filteredData = [...parsedData]; // Shallow copy to prevent permanent reordering
            if (filterTerm) {
                filteredData = filteredData.filter(item => {
                    return item.row.some(cell => cell && typeof cell === 'string' && cell.toLowerCase().includes(filterTerm));
                });
            }

            if (currentSortColumn !== -1) {
                filteredData.sort((a, b) => {
                    let valA = a.row[currentSortColumn] || '';
                    let valB = b.row[currentSortColumn] || '';
                    
                    const numA = Number(valA);
                    const numB = Number(valB);
                    if (!isNaN(numA) && !isNaN(numB) && valA.trim() !== '' && valB.trim() !== '') {
                        return currentSortAscending ? numA - numB : numB - numA;
                    }
                    
                    valA = valA.toString().toLowerCase();
                    valB = valB.toString().toLowerCase();
                    if (valA < valB) return currentSortAscending ? -1 : 1;
                    if (valA > valB) return currentSortAscending ? 1 : -1;
                    return 0;
                });
            }

            if (headers.length === 0 && filteredData.length === 0) {
                tableContainer.innerHTML = '<div class="empty-state">No data available</div>';
                stats.textContent = "0 rows";
                return;
            }

            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const tbody = document.createElement('tbody');

            const headerRow = document.createElement('tr');
            const checkboxHeader = document.createElement('th');
            checkboxHeader.className = 'checkbox-col';
            
            const masterCheckbox = document.createElement('input');
            masterCheckbox.type = 'checkbox';
            masterCheckbox.className = 'row-checkbox master-checkbox';
            
            const allVisibleSelected = filteredData.length > 0 && filteredData.every(item => selectedRows.has(item.originalIndex));
            masterCheckbox.checked = allVisibleSelected;
            
            masterCheckbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    filteredData.forEach(item => selectedRows.add(item.originalIndex));
                } else {
                    filteredData.forEach(item => selectedRows.delete(item.originalIndex));
                }
                updateDeleteBtn();
                renderTable(searchBox.value.toLowerCase());
            });
            checkboxHeader.appendChild(masterCheckbox);
            headerRow.appendChild(checkboxHeader);

            const rowNumHeader = document.createElement('th');
            rowNumHeader.className = 'row-num-col';
            rowNumHeader.textContent = '#';
            headerRow.appendChild(rowNumHeader);

            headers.forEach((header, colIndex) => {
                const th = document.createElement('th');
                
                const container = document.createElement('div');
                container.style.display = 'flex';
                container.style.justifyContent = 'space-between';
                container.style.alignItems = 'center';

                const span = document.createElement('span');
                span.textContent = header || '';
                span.setAttribute('contenteditable', 'true');
                span.className = 'header-editable';
                span.dataset.row = -1;
                span.dataset.col = colIndex;
                
                const sortBtn = document.createElement('span');
                sortBtn.className = 'sort-btn';
                if (currentSortColumn === colIndex) {
                    sortBtn.textContent = currentSortAscending ? ' ▲' : ' ▼';
                    sortBtn.style.opacity = '1';
                } else {
                    sortBtn.textContent = ' ↕';
                    sortBtn.style.opacity = '0.3';
                }
                sortBtn.dataset.col = colIndex;
                
                sortBtn.addEventListener('click', () => {
                    if (currentSortColumn === colIndex) {
                        currentSortAscending = !currentSortAscending;
                    } else {
                        currentSortColumn = colIndex;
                        currentSortAscending = true;
                    }
                    renderTable(document.getElementById('searchBox').value.toLowerCase());
                });

                container.appendChild(span);
                container.appendChild(sortBtn);
                th.appendChild(container);
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);

            const MAX_ROWS = 1000;
            const rowsToRender = filteredData.slice(0, MAX_ROWS);

            rowsToRender.forEach((item, displayIndex) => {
                const tr = document.createElement('tr');
                if (selectedRows.has(item.originalIndex)) {
                    tr.classList.add('selected');
                }
                
                const checkboxCell = document.createElement('td');
                checkboxCell.className = 'checkbox-col';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'row-checkbox';
                checkbox.checked = selectedRows.has(item.originalIndex);
                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        selectedRows.add(item.originalIndex);
                        tr.classList.add('selected');
                    } else {
                        selectedRows.delete(item.originalIndex);
                        tr.classList.remove('selected');
                    }
                    updateDeleteBtn();
                    
                    const masterCb = thead.querySelector('.master-checkbox');
                    if (masterCb) {
                        masterCb.checked = filteredData.length > 0 && filteredData.every(item => selectedRows.has(item.originalIndex));
                    }
                });
                checkboxCell.appendChild(checkbox);
                tr.appendChild(checkboxCell);

                const rowNumCell = document.createElement('td');
                rowNumCell.className = 'row-num-col';
                rowNumCell.textContent = (item.originalIndex + 1).toString();
                tr.appendChild(rowNumCell);

                item.row.forEach((cell, colIndex) => {
                    const td = document.createElement('td');
                    td.textContent = cell || '';
                    td.setAttribute('contenteditable', 'true');
                    td.dataset.row = item.originalIndex;
                    td.dataset.col = colIndex;
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });

            table.appendChild(tbody);
            
            tableContainer.innerHTML = '';
            tableContainer.appendChild(table);

            if (filteredData.length > MAX_ROWS) {
                const warning = document.createElement('div');
                warning.className = 'limit-warning';
                warning.textContent = `Showing first ${MAX_ROWS} matching rows out of ${filteredData.length}. Please use search to filter.`;
                tableContainer.appendChild(warning);
            }

            stats.textContent = `${filteredData.length} row${filteredData.length === 1 ? '' : 's'}`;
        }
    } catch(e) {
        logError("Init Error: " + e.message);
    }
}());
