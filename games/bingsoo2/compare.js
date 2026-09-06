    // Device Configurations
    const DEVICE_CONFIGS = {
      'tab-landscape': { width: 880, height: 560, isCompact: false, label: '태블릿 가로 (iPad)' },
      'tab-portrait': { width: 680, height: 560, isCompact: false, label: '태블릿 세로 (iPad)' },
      'desktop': { width: 940, height: 580, isCompact: false, label: '데스크톱 / 대화면' },
      'phone-portrait': { width: 375, height: 420, isCompact: true, label: '스마트폰 세로' },
      'phone-landscape': { width: 700, height: 320, isCompact: true, label: '스마트폰 가로' }
    };

    let currentDevice = 'tab-landscape';
    let currentRoundType = 'acute';

    const deviceSelect = document.getElementById('device-select');
    const roundSelect = document.getElementById('round-select');
    const btnRegen = document.getElementById('btn-regen');
    const btnToggleLayout = document.getElementById('btn-toggle-layout');
    const compareGrid = document.getElementById('compare-grid');

    const frameBefore = document.getElementById('frame-before');
    const frameAfter = document.getElementById('frame-after');
    const boardBefore = document.getElementById('board-before');
    const boardAfter = document.getElementById('board-after');
    const svgBefore = document.getElementById('svg-before');
    const svgAfter = document.getElementById('svg-after');
    const elementsBefore = document.getElementById('elements-before');
    const elementsAfter = document.getElementById('elements-after');
    const dpadBefore = document.getElementById('dpad-before');
    const dpadAfter = document.getElementById('dpad-after');

    function randomRange(min, max) {
      return min + Math.random() * (max - min);
    }

    function isPointInside(pt, width, height, pad) {
      return pt.x >= pad && pt.x <= width - pad && pt.y >= pad && pt.y <= height - pad;
    }

    // -----------------------------------------------------------
    // BEFORE ALGORITHM GENERATOR
    // -----------------------------------------------------------
    function generateBeforeLayout(width, height, isCompact, roundType) {
      const padding = isCompact ? Math.max(36, Math.round(Math.min(width, height) * 0.1)) : 65;
      let valid = false;
      let attempts = 0;
      let target, R, A, B, C;

      while (!valid && attempts < 350) {
        attempts++;
        if (roundType === 'acute') {
          target = {
            x: randomRange(padding + 60, width - padding - 60),
            y: randomRange(padding + 60, height - padding - 60)
          };
          R = randomRange(110, Math.min(width, height) * 0.38);
          const a1 = randomRange(0, Math.PI * 2);
          const a2 = a1 + randomRange(Math.PI * 0.55, Math.PI * 0.80);
          const a3 = a2 + randomRange(Math.PI * 0.55, Math.PI * 0.80);
          A = { x: target.x + R * Math.cos(a1), y: target.y + R * Math.sin(a1) };
          B = { x: target.x + R * Math.cos(a2), y: target.y + R * Math.sin(a2) };
          C = { x: target.x + R * Math.cos(a3), y: target.y + R * Math.sin(a3) };
        } else if (roundType === 'right') {
          target = {
            x: randomRange(padding + 70, width - padding - 70),
            y: randomRange(padding + 70, height - padding - 70)
          };
          R = randomRange(120, Math.min(width, height) * 0.40);
          const a1 = randomRange(0, Math.PI * 2);
          const a2 = a1 + Math.PI;
          const a3 = a1 + randomRange(Math.PI * 0.35, Math.PI * 0.65);
          A = { x: target.x + R * Math.cos(a1), y: target.y + R * Math.sin(a1) };
          B = { x: target.x + R * Math.cos(a2), y: target.y + R * Math.sin(a2) };
          C = { x: target.x + R * Math.cos(a3), y: target.y + R * Math.sin(a3) };
        } else {
          // Obtuse
          target = {
            x: randomRange(padding + 70, width - padding - 70),
            y: randomRange(padding + 70, height - padding - 70)
          };
          R = randomRange(125, Math.min(width, height) * 0.43);
          const a1 = randomRange(0, Math.PI * 2);
          const a2 = a1 + randomRange(Math.PI * 0.30, Math.PI * 0.42);
          const a3 = a2 + randomRange(Math.PI * 0.30, Math.PI * 0.42);
          A = { x: target.x + R * Math.cos(a1), y: target.y + R * Math.sin(a1) };
          B = { x: target.x + R * Math.cos(a2), y: target.y + R * Math.sin(a2) };
          C = { x: target.x + R * Math.cos(a3), y: target.y + R * Math.sin(a3) };
        }

        if (isPointInside(A, width, height, padding) &&
            isPointInside(B, width, height, padding) &&
            isPointInside(C, width, height, padding)) {
          valid = true;
        }
      }

      if (!valid) {
        target = { x: width / 2, y: height / 2 };
        R = 130;
        A = { x: width / 2 - 100, y: height / 2 - 70 };
        B = { x: width / 2 + 100, y: height / 2 - 70 };
        C = { x: width / 2, y: height / 2 + 100 };
      }

      return { target, R, vertices: [A, B, C], padding };
    }

    // -----------------------------------------------------------
    // AFTER ALGORITHM GENERATOR
    // -----------------------------------------------------------
    function generateAfterLayout(width, height, isCompact, roundType) {
      const padding = isCompact ? Math.max(36, Math.round(Math.min(width, height) * 0.1)) : 48;
      const minDim = Math.min(width, height);
      let valid = false;
      let attempts = 0;
      let target, R, A, B, C;

      const minR = isCompact
        ? (roundType === 'acute' ? 105 : (roundType === 'right' ? 115 : 120))
        : (roundType === 'acute' ? Math.max(150, Math.round(minDim * 0.32)) : (roundType === 'right' ? Math.max(155, Math.round(minDim * 0.33)) : Math.max(165, Math.round(minDim * 0.35))));

      const maxR = Math.round(minDim * (isCompact
        ? (roundType === 'acute' ? 0.38 : (roundType === 'right' ? 0.40 : 0.43))
        : (roundType === 'acute' ? 0.44 : (roundType === 'right' ? 0.45 : 0.47))));

      while (!valid && attempts < 350) {
        attempts++;
        if (roundType === 'acute') {
          target = {
            x: randomRange(padding + (isCompact ? 60 : 50), width - padding - (isCompact ? 60 : 50)),
            y: randomRange(padding + (isCompact ? 60 : 50), height - padding - (isCompact ? 60 : 50))
          };
          R = randomRange(minR, maxR);
          const a1 = randomRange(0, Math.PI * 2);
          const a2 = a1 + randomRange(Math.PI * 0.55, Math.PI * 0.80);
          const a3 = a2 + randomRange(Math.PI * 0.55, Math.PI * 0.80);
          A = { x: target.x + R * Math.cos(a1), y: target.y + R * Math.sin(a1) };
          B = { x: target.x + R * Math.cos(a2), y: target.y + R * Math.sin(a2) };
          C = { x: target.x + R * Math.cos(a3), y: target.y + R * Math.sin(a3) };
        } else if (roundType === 'right') {
          target = {
            x: randomRange(padding + (isCompact ? 70 : 55), width - padding - (isCompact ? 70 : 55)),
            y: randomRange(padding + (isCompact ? 70 : 55), height - padding - (isCompact ? 70 : 55))
          };
          R = randomRange(minR, maxR);
          const a1 = randomRange(0, Math.PI * 2);
          const a2 = a1 + Math.PI;
          const a3 = a1 + randomRange(Math.PI * 0.35, Math.PI * 0.65);
          A = { x: target.x + R * Math.cos(a1), y: target.y + R * Math.sin(a1) };
          B = { x: target.x + R * Math.cos(a2), y: target.y + R * Math.sin(a2) };
          C = { x: target.x + R * Math.cos(a3), y: target.y + R * Math.sin(a3) };
        } else {
          // Obtuse
          target = {
            x: randomRange(padding + (isCompact ? 70 : 55), width - padding - (isCompact ? 70 : 55)),
            y: randomRange(padding + (isCompact ? 70 : 55), height - padding - (isCompact ? 70 : 55))
          };
          R = randomRange(minR, maxR);
          const a1 = randomRange(0, Math.PI * 2);
          const a2 = a1 + randomRange(Math.PI * 0.32, Math.PI * 0.44);
          const a3 = a2 + randomRange(Math.PI * 0.32, Math.PI * 0.44);
          A = { x: target.x + R * Math.cos(a1), y: target.y + R * Math.sin(a1) };
          B = { x: target.x + R * Math.cos(a2), y: target.y + R * Math.sin(a2) };
          C = { x: target.x + R * Math.cos(a3), y: target.y + R * Math.sin(a3) };

          const distAB = Math.hypot(A.x - B.x, A.y - B.y);
          const distBC = Math.hypot(B.x - C.x, B.y - C.y);
          const distCA = Math.hypot(C.x - A.x, C.y - A.y);
          const minSideLen = isCompact ? 70 : 100;
          if (distAB < minSideLen || distBC < minSideLen || distCA < minSideLen) {
            continue;
          }
        }

        if (isPointInside(A, width, height, padding) &&
            isPointInside(B, width, height, padding) &&
            isPointInside(C, width, height, padding)) {
          valid = true;
        }
      }

      if (!valid) {
        const fallbackR = isCompact ? 120 : Math.round(minDim * 0.36);
        target = { x: width / 2, y: height / 2 };
        R = fallbackR;
        A = { x: width / 2 - Math.round(fallbackR * 0.8), y: height / 2 - Math.round(fallbackR * 0.55) };
        B = { x: width / 2 + Math.round(fallbackR * 0.8), y: height / 2 - Math.round(fallbackR * 0.55) };
        C = { x: width / 2, y: height / 2 + Math.round(fallbackR * 0.8) };
      }

      return { target, R, vertices: [A, B, C], padding };
    }

    // Render SVG and DOM elements
    function renderSimView(svgEl, elementsEl, data, isAfter) {
      const { target, R, vertices, padding } = data;
      const [A, B, C] = vertices;

      const strokeColor = isAfter ? '#059669' : '#dc2626';
      const fillColor = isAfter ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)';

      svgEl.innerHTML = `
        <!-- Circumcircle Guide -->
        <circle cx="${target.x}" cy="${target.y}" r="${R}" fill="none" stroke="${isAfter ? '#10b981' : '#f87171'}" stroke-width="1.8" stroke-dasharray="5,5" opacity="0.65" />
        <!-- Triangle Body -->
        <polygon points="${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="3" stroke-linejoin="round" />
      `;

      elementsEl.innerHTML = `
        <!-- Circumcenter Target -->
        <div class="sim-circumcenter-pin" style="left:${target.x}px; top:${target.y}px;">
          <span>🎯</span> 외심
        </div>
        <!-- Students -->
        <div class="sim-student-pin" style="left:${A.x}px; top:${A.y}px;"><div class="sim-student-box">👦</div></div>
        <div class="sim-student-pin" style="left:${B.x}px; top:${B.y}px;"><div class="sim-student-box">👧</div></div>
        <div class="sim-student-pin" style="left:${C.x}px; top:${C.y}px;"><div class="sim-student-box">🧑</div></div>
      `;
    }

    function updateMetrics(prefix, data, width) {
      const { R, vertices } = data;
      const [A, B, C] = vertices;
      const dAB = Math.round(Math.hypot(A.x - B.x, A.y - B.y));
      const dBC = Math.round(Math.hypot(B.x - C.x, B.y - C.y));
      const dCA = Math.round(Math.hypot(C.x - A.x, C.y - A.y));
      const minEdge = Math.min(dAB, dBC, dCA);

      document.getElementById(`metric-r-${prefix}`).textContent = `${Math.round(R)}px`;
      document.getElementById(`metric-d-${prefix}`).textContent = `${Math.round(R * 2)}px`;
      document.getElementById(`metric-wratio-${prefix}`).textContent = `${Math.round((R * 2 / width) * 100)}%`;
      document.getElementById(`metric-minedge-${prefix}`).textContent = `${minEdge}px`;
    }

    function renderAll() {
      const cfg = DEVICE_CONFIGS[currentDevice];
      
      // Update viewport sizes
      frameBefore.style.width = `${cfg.width}px`;
      frameBefore.style.height = `${cfg.height}px`;
      frameAfter.style.width = `${cfg.width}px`;
      frameAfter.style.height = `${cfg.height}px`;

      const dataBefore = generateBeforeLayout(cfg.width, cfg.height, cfg.isCompact, currentRoundType);
      const dataAfter = generateAfterLayout(cfg.width, cfg.height, cfg.isCompact, currentRoundType);

      renderSimView(svgBefore, elementsBefore, dataBefore, false);
      renderSimView(svgAfter, elementsAfter, dataAfter, true);

      updateMetrics('before', dataBefore, cfg.width);
      updateMetrics('after', dataAfter, cfg.width);
    }

    // -----------------------------------------------------------
    // D-PAD CLICK-THROUGH SIMULATION
    // -----------------------------------------------------------
    // Before simulation: clicking anywhere on board places pin (even on dpad!)
    boardBefore.addEventListener('mousedown', (e) => {
      // Old logic: only ignored .set-square-container etc, did NOT ignore dpad!
      const isDpad = !!e.target.closest('.sim-dpad');
      const rect = boardBefore.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      let pin = document.getElementById('user-pin-before');
      if (!pin) {
        pin = document.createElement('div');
        pin.id = 'user-pin-before';
        pin.className = 'sim-bingsoo-pin';
        pin.textContent = '🍨';
        elementsBefore.appendChild(pin);
      }
      pin.style.left = `${x}px`;
      pin.style.top = `${y}px`;

      const status = document.getElementById('status-dpad-before');
      if (isDpad) {
        status.innerHTML = `세부조정창 패널 클릭 테스트: <span class="dpad-status-tag dpad-status-err">⚠️ 오작동! 팥빙수가 세부조정창 위치 (${Math.round(x)}, ${Math.round(y)})로 튀어버림</span>`;
      } else {
        status.innerHTML = `세부조정창 패널 클릭 테스트: <span class="dpad-status-tag" style="background:#334155;">일반 보드 클릭 (${Math.round(x)}, ${Math.round(y)})</span>`;
      }
    });

    // After simulation: checks e.target.closest('.dpad-controller') and prevents placement
    boardAfter.addEventListener('mousedown', (e) => {
      const isDpad = !!e.target.closest('.sim-dpad');
      const status = document.getElementById('status-dpad-after');

      if (isDpad) {
        // Ignored!
        status.innerHTML = `세부조정창 패널 클릭 테스트: <span class="dpad-status-tag dpad-status-ok">🛡️ 정상 차단! 세부조정창 클릭이 무시되어 팥빙수가 튀지 않음</span>`;
        return;
      }

      const rect = boardAfter.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      let pin = document.getElementById('user-pin-after');
      if (!pin) {
        pin = document.createElement('div');
        pin.id = 'user-pin-after';
        pin.className = 'sim-bingsoo-pin';
        pin.textContent = '🍨';
        elementsAfter.appendChild(pin);
      }
      pin.style.left = `${x}px`;
      pin.style.top = `${y}px`;

      status.innerHTML = `세부조정창 패널 클릭 테스트: <span class="dpad-status-tag" style="background:#334155;">일반 보드 클릭 (${Math.round(x)}, ${Math.round(y)})</span>`;
    });

    // Event Listeners
    deviceSelect.addEventListener('change', (e) => {
      currentDevice = e.target.value;
      renderAll();
    });

    roundSelect.addEventListener('change', (e) => {
      currentRoundType = e.target.value;
      renderAll();
    });

    btnRegen.addEventListener('click', () => {
      renderAll();
    });

    btnToggleLayout.addEventListener('click', () => {
      compareGrid.classList.toggle('is-stacked');
    });

    // Initial render
    renderAll();
  