document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const previewContainer = document.getElementById('preview-container');
    const buttons = document.querySelectorAll('.action-btn');
    const loadingIndicator = document.getElementById('loading-indicator');

    // 모달 관련 요소
    const cropModal = document.getElementById('crop-modal');
    const cropImage = document.getElementById('crop-image');
    const btnCropCancel = document.getElementById('btn-crop-cancel');
    const btnCropApply = document.getElementById('btn-crop-apply');

    let selectedFiles = [];
    let cropper = null;
    let currentCropIndex = -1;

    // 파일 선택/드래그앤드롭 이벤트 리스너 설정
    dropZone.addEventListener('click', () => fileInput.click());
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#3b82f6';
        dropZone.style.background = 'rgba(59,130,246,0.05)';
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '';
        dropZone.style.background = '';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '';
        dropZone.style.background = '';
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    function handleFiles(files) {
        // 이미지 파일만 필터링
        const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (validFiles.length === 0) {
            alert('이미지 파일(JPG, PNG, WebP)만 업로드 가능합니다.');
            return;
        }
        selectedFiles = [...selectedFiles, ...validFiles];
        renderPreview();
    }

    function renderPreview() {
        previewContainer.innerHTML = '';
        if (selectedFiles.length > 0) {
            previewContainer.classList.remove('hidden');
            selectedFiles.forEach((file, index) => {
                const div = document.createElement('div');
                div.className = 'preview-item';
                // 파일명이 너무 길 경우 대비해 잘라내기
                const displayName = file.name.length > 25 ? file.name.substring(0, 22) + '...' : file.name;
                div.innerHTML = `
                    <span class="file-name">${displayName}</span>
                    <div class="preview-actions">
                        <button type="button" data-index="${index}" class="crop-btn" title="자유 자르기">✂️ 자유 자르기</button>
                        <button type="button" data-index="${index}" class="remove-btn" title="삭제">✕ 삭제</button>
                    </div>
                `;
                previewContainer.appendChild(div);
            });

            // 개별 파일 삭제 이벤트 바인딩
            document.querySelectorAll('.remove-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(e.target.dataset.index);
                    selectedFiles.splice(idx, 1);
                    renderPreview();
                });
            });

            // 자르기 버튼 이벤트 바인딩
            document.querySelectorAll('.crop-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(e.target.dataset.index);
                    openCropModal(idx);
                });
            });
        } else {
            previewContainer.classList.add('hidden');
        }
    }

    // 크롭 모달 열기
    function openCropModal(index) {
        currentCropIndex = index;
        const file = selectedFiles[index];
        const url = URL.createObjectURL(file);
        
        cropImage.src = url;
        cropModal.classList.remove('hidden');
        
        if (cropper) {
            cropper.destroy();
        }
        
        // Cropper 초기화 (이미지가 로드된 후 실행되도록)
        cropImage.onload = () => {
            cropper = new Cropper(cropImage, {
                viewMode: 1, // 크롭 박스가 캔버스를 벗어나지 않도록 설정
                dragMode: 'crop',
                autoCropArea: 0.8,
                restore: false,
                guides: true,
                center: true,
                highlight: false,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
            });
        };
    }

    // 크롭 취소
    btnCropCancel.addEventListener('click', () => {
        cropModal.classList.add('hidden');
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
    });

    // 크롭 적용
    btnCropApply.addEventListener('click', () => {
        if (!cropper) return;
        
        const canvas = cropper.getCroppedCanvas();
        if (!canvas) return;
        
        const originalFile = selectedFiles[currentCropIndex];
        const fileType = originalFile.type || 'image/jpeg';
        
        // 크롭된 캔버스를 Blob으로 변환 후 File 객체로 다시 저장
        canvas.toBlob((blob) => {
            const croppedFile = new File([blob], `cropped_${originalFile.name}`, {
                type: fileType,
                lastModified: Date.now()
            });
            
            // 기존 파일을 크롭된 파일로 교체
            selectedFiles[currentCropIndex] = croppedFile;
            renderPreview();
            
            cropModal.classList.add('hidden');
            cropper.destroy();
            cropper = null;
        }, fileType, 0.95);
    });

    // 각 플랫폼별 변환 버튼 클릭 이벤트 처리
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (selectedFiles.length === 0) {
                alert('먼저 변환할 이미지를 업로드해주세요.');
                return;
            }
            processImages(btn.dataset.type);
        });
    });

    async function processImages(type) {
        // UI 로딩 상태 변경 및 중복 클릭 방지
        loadingIndicator.classList.remove('hidden');
        buttons.forEach(btn => btn.style.pointerEvents = 'none');
        
        try {
            const zip = new JSZip(); // JSZip 인스턴스 생성
            
            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                const img = await loadImage(file);
                await applyProcessing(img, file.name, type, zip);
            }
            
            // 모든 처리가 끝나면 ZIP 파일 생성 및 브라우저 다운로드 트리거
            const content = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, '');
            link.download = `SellerCut_${type}_${dateStr}.zip`;
            link.click();
            
            // 메모리 확보
            URL.revokeObjectURL(link.href);
            
        } catch (error) {
            console.error('Processing Error:', error);
            alert('이미지 처리 중 오류가 발생했습니다. 브라우저 버전이 낮거나 이미지 크기가 너무 클 수 있습니다.');
        } finally {
            // UI 상태 복구
            loadingIndicator.classList.add('hidden');
            buttons.forEach(btn => btn.style.pointerEvents = 'auto');
        }
    }

    // File 객체를 HTML Image 객체로 변환
    function loadImage(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url); // 메모리 해제
                resolve(img);
            };
            img.onerror = reject;
            img.src = url;
        });
    }

    // 워터마크 그리기 함수
    function drawWatermark(ctx, text, width, height) {
        if (!text) return;
        ctx.save();
        ctx.font = 'bold 24px "Noto Sans KR", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.shadowBlur = 4;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        // 우측 하단 여백 20px
        ctx.fillText(text, width - 20, height - 20);
        ctx.restore();
    }

    // 캔버스 기반 핵심 이미지 리사이즈 및 분할 로직
    async function applyProcessing(img, originalName, type, zip) {
        // 원본 파일명에서 확장자 제거
        const nameParts = originalName.split('.');
        nameParts.pop(); 
        const nameWithoutExt = nameParts.join('.') || originalName;
        
        const watermarkText = document.getElementById('watermark-text').value.trim();
        
        // --- 기능 1: 썸네일 (꽉 차게 자르기 또는 여백 추가) ---
        if (type === 'thumbnail' || type === 'thumbnail-pad') {
            const size = 1000;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            if (type === 'thumbnail') {
                const minSide = Math.min(img.width, img.height);
                const sx = (img.width - minSide) / 2;
                const sy = (img.height - minSide) / 2;
                ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
            } else {
                // thumbnail-pad (여백 추가)
                ctx.fillStyle = '#ffffff'; // 흰색 배경
                ctx.fillRect(0, 0, size, size);
                
                const scale = Math.min(size / img.width, size / img.height);
                const drawWidth = img.width * scale;
                const drawHeight = img.height * scale;
                const dx = (size - drawWidth) / 2;
                const dy = (size - drawHeight) / 2;
                ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, drawWidth, drawHeight);
            }
            
            drawWatermark(ctx, watermarkText, size, size);
            
            const suffix = type === 'thumbnail' ? '_thumb.jpg' : '_thumb_pad.jpg';
            const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
            zip.file(`${nameWithoutExt}${suffix}`, dataUrl.split(',')[1], {base64: true});
            return;
        }
        
        // --- 기능 2: 상세페이지 가로 리사이즈 및 세로 분할 ---
        let targetWidth, splitHeight, format, quality;
        
        switch(type) {
            case 'smartstore': 
                targetWidth = 860; splitHeight = 4000; format = 'image/jpeg'; quality = 0.95; break;
            case 'coupang': 
                targetWidth = 780; splitHeight = 3000; format = 'image/jpeg'; quality = 0.95; break;
            case '11st': 
                targetWidth = 860; splitHeight = 3000; format = 'image/jpeg'; quality = 0.75; break; // 11번가는 타이트한 압축률 적용
            case 'musinsa': 
                targetWidth = 850; splitHeight = 4000; format = 'image/jpeg'; quality = 0.95; break;
            case 'kakao': 
                targetWidth = 750; splitHeight = 3000; format = 'image/jpeg'; quality = 0.95; break;
            case 'webp': 
                targetWidth = 860; splitHeight = 4000; format = 'image/webp'; quality = 0.85; break; // WebP 고압축 포맷
            default: return;
        }
        
        // 리사이즈 후의 총 예상 높이 계산 (비율 유지)
        const newHeight = img.height * (targetWidth / img.width);
        const totalParts = Math.ceil(newHeight / splitHeight);
        
        for (let i = 0; i < totalParts; i++) {
            // 각 조각의 높이 계산 (마지막 조각은 덜려질 수 있으므로)
            const partHeight = Math.min(splitHeight, newHeight - i * splitHeight);
            
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = Math.round(partHeight);
            const ctx = canvas.getContext('2d');
            
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // 원본 이미지 대비 비율
            const scale = img.width / targetWidth;
            const sy = i * splitHeight * scale;
            const sHeight = partHeight * scale;
            
            // 캔버스에 해당 영역만 그리기
            ctx.drawImage(img, 0, sy, img.width, sHeight, 0, 0, targetWidth, Math.round(partHeight));
            
            // 워터마크 그리기
            drawWatermark(ctx, watermarkText, targetWidth, Math.round(partHeight));
            
            // 이미지 데이터 인코딩
            const dataUrl = canvas.toDataURL(format, quality);
            const ext = format === 'image/webp' ? 'webp' : 'jpg'; 
            
            // 01, 02 등 두자리 넘버링
            const partNum = String(i + 1).padStart(2, '0');
            zip.file(`${nameWithoutExt}_${partNum}.${ext}`, dataUrl.split(',')[1], {base64: true});
        }
    }
});
