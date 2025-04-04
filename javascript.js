document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos del DOM ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const selectFilesBtn = document.getElementById('select-files-btn');
    const fileListElement = document.getElementById('file-list');
    const noFilesLi = document.getElementById('no-files');
    const mergeBtn = document.getElementById('merge-btn');
    const splitBtn = document.getElementById('split-btn');
    const splitRangeInput = document.getElementById('split-input');
    const splitAllBtn = document.getElementById('split-all-btn');
    const statusElement = document.getElementById('status');
    const downloadArea = document.getElementById('download-area');
    const clearBtn = document.getElementById('clear-btn');

    // --- Estado de la Aplicación ---
    let uploadedFiles = [];
    let pdfLibLoaded = false; // Flag para saber si pdf-lib está lista

    // --- Acceso a pdf-lib ---
    const { PDFDocument } = window.PDFLib || {};

    // --- Chequeo de PDF-LIB ---
    if (!PDFDocument) {
        console.error("pdf-lib no se cargó correctamente o no está disponible.");
        setStatus("Error crítico: La funcionalidad PDF no está disponible. Intenta recargar la página.", true);
        pdfLibLoaded = false;
        if(mergeBtn) mergeBtn.disabled = true;
        if(splitBtn) splitBtn.disabled = true;
        if(splitAllBtn) splitAllBtn.disabled = true;
        if(splitRangeInput) splitRangeInput.disabled = true;
    } else {
        pdfLibLoaded = true;
        console.log("pdf-lib cargada correctamente.");
    }

    // --- Inicializar Popovers ---
    try {
        if (typeof bootstrap !== 'undefined' && bootstrap.Popover) {
            const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
            popoverTriggerList.map(function (popoverTriggerEl) { return new bootstrap.Popover(popoverTriggerEl); });
        } else { console.warn("Bootstrap Popover no encontrado."); }
    } catch (e) { console.error("Error inicializando popovers:", e); }


    // --- Función setStatus (con keepDownloads) ---
    /**
     * Muestra mensajes al usuario.
     * @param {string} message - El mensaje a mostrar.
     * @param {boolean} [isError=false] - Indica si es un mensaje de error.
     * @param {boolean} [isSuccess=false] - Indica si es un mensaje de éxito.
     * @param {boolean} [keepDownloads=false] - Si es true, NO limpia el área de descargas.
     */
    function setStatus(message, isError = false, isSuccess = false, keepDownloads = false) {
        if (!statusElement) return; // Salir si el elemento no existe
        statusElement.textContent = message;
        statusElement.className = 'mb-3 text-center'; // Reset classes
        if (isError) statusElement.classList.add('error');
        else if (isSuccess) statusElement.classList.add('success');
        else statusElement.classList.add('processing');

        const isCriticalError = isError && !pdfLibLoaded;
        if (!isSuccess && !keepDownloads && !isCriticalError) {
            clearDownloadArea();
        }
    }

    // --- Funciones Auxiliares ---
    function clearDownloadArea() { if (downloadArea) downloadArea.innerHTML = ''; }
    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    }
    // *** createDownloadLink ajustado para d-grid ***
    function createDownloadLink(bytes, filename) {
        if (!downloadArea) return;
        try {
            const blob = new Blob([bytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.textContent = `Descargar ${filename}`;
            // Clases ajustadas: solo estilo de botón. d-grid se encarga del layout.
            a.classList.add('btn', 'btn-outline-primary');
            downloadArea.appendChild(a);
        } catch (e) {
            console.error("Error creando enlace de descarga:", e);
            setStatus("Error al crear enlace de descarga.", true);
        }
    }

    // --- Gestión de Archivos y UI ---
    function clearFileList() {
        uploadedFiles = [];
        if (fileListElement) fileListElement.innerHTML = '';
        if (noFilesLi && fileListElement) {
            fileListElement.appendChild(noFilesLi);
            noFilesLi.style.display = 'block';
        }
        updateButtonStates();
        if(pdfLibLoaded) setStatus("");
        clearDownloadArea();
        if(splitRangeInput) splitRangeInput.value = '';
    }
    function updateButtonStates() {
        const fileCount = uploadedFiles.length;
        const hasFiles = fileCount > 0;
        const canMerge = fileCount >= 2;
        if (mergeBtn) mergeBtn.disabled = !canMerge || !pdfLibLoaded;
        if (splitBtn) splitBtn.disabled = !hasFiles || !pdfLibLoaded;
        if (splitAllBtn) splitAllBtn.disabled = !hasFiles || !pdfLibLoaded;
        if (splitRangeInput) splitRangeInput.disabled = !hasFiles || !pdfLibLoaded;
        if (clearBtn) clearBtn.disabled = !hasFiles;
        if (noFilesLi) noFilesLi.style.display = hasFiles ? 'none' : 'block';
    }
    function renderFileList() {
        if (!fileListElement) return;
        fileListElement.innerHTML = '';
        if (uploadedFiles.length === 0) {
            if (noFilesLi) { fileListElement.appendChild(noFilesLi); noFilesLi.style.display = 'block'; }
        } else {
            if (noFilesLi) noFilesLi.style.display = 'none';
            uploadedFiles.forEach((file, index) => {
                const li = document.createElement('li'); li.textContent = file.name;
                const removeBtn = document.createElement('button'); removeBtn.textContent = 'Eliminar';
                removeBtn.classList.add('btn', 'btn-danger', 'btn-sm', 'btn-remove-file');
                removeBtn.onclick = (e) => { e.stopPropagation(); removeFile(index); };
                li.appendChild(removeBtn); fileListElement.appendChild(li);
            });
        }
        updateButtonStates();
    }
    function removeFile(index) {
        uploadedFiles.splice(index, 1);
        renderFileList();
        if (pdfLibLoaded) { setStatus(""); clearDownloadArea(); }
    }
    function handleFiles(files) {
        if (!pdfLibLoaded) return;
        setStatus('Procesando archivos...');
        clearDownloadArea();
        const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
        if (pdfFiles.length === 0 && files.length > 0) { setStatus('Por favor, selecciona solo archivos PDF.', true); return; }
        if (pdfFiles.length === 0) { setStatus(''); return; }
        let filesAddedCount = 0;
        pdfFiles.forEach(file => {
            if (!uploadedFiles.some(existingFile => existingFile.name === file.name)) {
                uploadedFiles.push(file); filesAddedCount++;
            } else { console.warn(`Archivo "${file.name}" ya existe, omitiendo.`); }
        });
        if (filesAddedCount > 0) { renderFileList(); setStatus(''); }
        else { setStatus(''); }
    }

    // --- Lógica Principal de PDF ---

    /** Une los PDFs cargados */
    async function mergePdfs() {
        if (!pdfLibLoaded) { setStatus("Funcionalidad PDF no disponible.", true); return; }
        if (uploadedFiles.length < 2) { setStatus('Necesitas al menos 2 archivos PDF para unir.', true); return; }
        setStatus('Uniendo PDFs...');
        mergeBtn.disabled = true; splitBtn.disabled = true; splitAllBtn.disabled = true;
        clearDownloadArea();
        try {
            const mergedPdf = await PDFDocument.create();
            for (const file of uploadedFiles) {
                const arrayBuffer = await readFileAsArrayBuffer(file);
                const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
                const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                pages.forEach(page => mergedPdf.addPage(page));
            }
            const mergedPdfBytes = await mergedPdf.save();
            createDownloadLink(mergedPdfBytes, 'pdf_unido.pdf');
            setStatus('¡PDFs unidos con éxito!', false, true);
        } catch (error) {
             console.error("Error al unir PDFs:", error);
             setStatus(`Error al unir PDFs: ${error.message || 'Error desconocido'}`, true);
        } finally { updateButtonStates(); }
    }

    /** Divide el primer PDF según rango/página */
    async function splitPdf() {
         if (!pdfLibLoaded) { setStatus("Funcionalidad PDF no disponible.", true); return; }
         if (uploadedFiles.length === 0) { setStatus('Necesitas seleccionar al menos un archivo PDF.', true); return; }
         const fileToSplit = uploadedFiles[0];
         const baseFileName = fileToSplit.name.replace(/\.pdf$/i, '');
         const splitValue = splitRangeInput.value.trim();
         if (!splitValue) { setStatus('Por favor, introduce un número de página o rango para dividir.', true); if (splitRangeInput) splitRangeInput.focus(); return; }

         setStatus('Dividiendo PDF...');
         mergeBtn.disabled = true; splitBtn.disabled = true; splitAllBtn.disabled = true;
         clearDownloadArea();

         try {
            const arrayBuffer = await readFileAsArrayBuffer(fileToSplit);
            const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
            const totalPages = pdfDoc.getPageCount();
            let partsToCreate = [];
            let startPage = 0, endPage = 0;

            // Lógica de parseo (sin cambios)
            if (splitValue.includes('-')) {
                const rangeParts = splitValue.split('-');
                if (rangeParts.length !== 2) throw new Error("Formato de rango inválido.");
                startPage = parseInt(rangeParts[0], 10); endPage = parseInt(rangeParts[1], 10);
                if (isNaN(startPage) || isNaN(endPage) || startPage <= 0 || endPage <= 0) throw new Error("Rango con números enteros positivos.");
                if (startPage > endPage) throw new Error("Inicio del rango mayor que fin.");
                if (startPage > totalPages) throw new Error(`Inicio (${startPage}) excede total (${totalPages}).`);
                if (endPage > totalPages) { console.warn(`Fin (${endPage}) ajustado a ${totalPages}.`); endPage = totalPages; }
                if (startPage > 1) partsToCreate.push({ indices: Array.from({ length: startPage - 1 }, (_, i) => i), name: `${baseFileName}_p1-${startPage - 1}.pdf` });
                partsToCreate.push({ indices: Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage - 1 + i), name: `${baseFileName}_p${startPage}-${endPage}.pdf` });
                if (endPage < totalPages) partsToCreate.push({ indices: Array.from({ length: totalPages - endPage }, (_, i) => endPage + i), name: `${baseFileName}_p${endPage + 1}-fin.pdf` });
            } else {
                const splitPage = parseInt(splitValue, 10);
                if (isNaN(splitPage) || splitPage <= 0) throw new Error("Número de página entero positivo.");
                if (splitPage >= totalPages) throw new Error(`Página (${splitPage}) debe ser menor que total (${totalPages}).`);
                partsToCreate.push({ indices: Array.from({ length: splitPage }, (_, i) => i), name: `${baseFileName}_p1-${splitPage}.pdf` });
                partsToCreate.push({ indices: Array.from({ length: totalPages - splitPage }, (_, i) => splitPage + i), name: `${baseFileName}_p${splitPage + 1}-fin.pdf` });
            }
             if (partsToCreate.length === 0) throw new Error("No se definieron partes válidas.");

             let createdCount = 0;
             for (const part of partsToCreate) {
                 if (!part?.indices || part.indices.length === 0) continue;
                 setStatus(`Creando parte: ${part.name}...`, false, false, true); // keepDownloads = true
                 const newPdfDoc = await PDFDocument.create();
                 const copiedPages = await newPdfDoc.copyPages(pdfDoc, part.indices);
                 copiedPages.forEach(page => newPdfDoc.addPage(page));
                 const pdfBytes = await newPdfDoc.save();
                 createDownloadLink(pdfBytes, part.name);
                 createdCount++;
             }
             setStatus(`¡PDF dividido en ${createdCount} parte(s) con éxito!`, false, true); // isSuccess = true

         } catch (error) {
             console.error("Error al dividir PDF:", error);
             let errorMessage = "Error al dividir."; if (error instanceof Error) { errorMessage += ` ${error.message}`; }
             setStatus(errorMessage, true);
         } finally { updateButtonStates(); }
    }

    /** Divide el primer PDF en páginas individuales */
    async function splitIntoSinglePages() {
         if (!pdfLibLoaded) { setStatus("Funcionalidad PDF no disponible.", true); return; }
         if (uploadedFiles.length === 0) { setStatus('Necesitas seleccionar al menos un archivo PDF.', true); return; }
         const fileToSplit = uploadedFiles[0];
         const baseFileName = fileToSplit.name.replace(/\.pdf$/i, '');

         setStatus(`Dividiendo "${fileToSplit.name}"...`);
         mergeBtn.disabled = true; splitBtn.disabled = true; splitAllBtn.disabled = true;
         clearDownloadArea();

         try {
             const arrayBuffer = await readFileAsArrayBuffer(fileToSplit);
             const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
             const totalPages = pdfDoc.getPageCount();
             if (totalPages <= 1) { setStatus('El PDF seleccionado solo tiene una página.', false); updateButtonStates(); return; }

             const pageCreationPromises = [];
             const numDigits = String(totalPages).length;
             setStatus(`Preparando ${totalPages} páginas...`, false, false, true); // keepDownloads = true

             for (let i = 0; i < totalPages; i++) {
                 const pageIndex = i; const pageNumber = i + 1;
                 const promise = (async () => {
                     const newPdfDoc = await PDFDocument.create();
                     const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageIndex]);
                     newPdfDoc.addPage(copiedPage);
                     const pdfBytes = await newPdfDoc.save();
                     const pageNumStr = String(pageNumber).padStart(numDigits, '0');
                     const filename = `${baseFileName}_pag_${pageNumStr}.pdf`;
                     return { pdfBytes, filename };
                 })();
                 pageCreationPromises.push(promise);
                 if (pageNumber % 10 === 0 || pageNumber === totalPages || totalPages < 10) {
                     setStatus(`Procesando página ${pageNumber}/${totalPages}...`, false, false, true); // keepDownloads = true
                 }
             }

             setStatus(`Generando archivos PDF individuales...`, false, false, true); // keepDownloads = true
             const createdPages = await Promise.all(pageCreationPromises);

             if (createdPages.length !== totalPages) throw new Error(`Inconsistencia: ${totalPages} vs ${createdPages.length}.`);

             let downloadCount = 0;
             createdPages.forEach(pageData => {
                 if (pageData?.pdfBytes && pageData?.filename) {
                     createDownloadLink(pageData.pdfBytes, pageData.filename);
                     downloadCount++;
                 } else console.warn("Promesa de página sin datos válidos.");
             });

             setStatus(`¡PDF dividido en ${downloadCount} páginas individuales con éxito!`, false, true); // isSuccess = true

         } catch (error) {
             console.error("Error al dividir todas las páginas:", error);
             let errorMessage = "Error al dividir todas las páginas."; if (error instanceof Error) { errorMessage += ` ${error.message}`; }
             setStatus(errorMessage, true);
         } finally { updateButtonStates(); }
    }

    // --- Event Listeners ---
    if(dropZone) {
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
        dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('drag-over'); });
        dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); if (e.dataTransfer?.files.length) handleFiles(e.dataTransfer.files); });
        dropZone.addEventListener('click', () => { if(fileInput) fileInput.click(); });
    } else { console.error("Drop zone element not found"); }
    if (selectFilesBtn) { selectFilesBtn.addEventListener('click', () => { if(fileInput) fileInput.click(); }); }
    else { console.error("Select files button not found"); }
    if (fileInput) {
        fileInput.addEventListener('change', (e) => { if (e.target?.files?.length) handleFiles(e.target.files); e.target.value = null; });
    } else { console.error("File input element not found"); }
    if (mergeBtn) mergeBtn.addEventListener('click', mergePdfs);
    if (splitBtn) splitBtn.addEventListener('click', splitPdf);
    if (splitAllBtn) splitAllBtn.addEventListener('click', splitIntoSinglePages);
    if (clearBtn) clearBtn.addEventListener('click', clearFileList);

    // --- Inicialización Final ---
    renderFileList(); // Estado inicial correcto

});