    (function () {
      const params = new URLSearchParams(window.location.search);
      const room = String(params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!room) {
        document.body.innerHTML = '<p class="qr-popout-error">세션 코드가 없습니다.</p>';
        return;
      }
      const game = String(params.get('game') || 'bingsoo').toLowerCase();
      const playByGame = {
        bingsoo: '../bingsoo/index.html',
        bingsoo2: '../bingsoo2/index.html',
        'prism-tycoon': '../prism-tycoon/index.html',
        tycoon: '../prism-tycoon/index.html'
      };
      const playFile = playByGame[game] || playByGame.bingsoo;
      const playHref = new URL(`${playFile}?live=1&room=${encodeURIComponent(room)}`, window.location.href).href;
      document.getElementById('qr-code').textContent = room;
      document.getElementById('qr-img').src = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&ecc=M&data=${encodeURIComponent(playHref)}`;
      document.title = `QR · ${room}`;

      const imgWrapper = document.getElementById('qr-img-wrapper');
      const slider = document.getElementById('zoom-slider');
      const sizeChips = document.getElementById('size-chips');
      const btnOut = document.getElementById('btn-zoom-out');
      const btnIn = document.getElementById('btn-zoom-in');

      const sizes = [
        { id: 'sm', label: '소 (220px)', px: 220 },
        { id: 'md', label: '중 (280px)', px: 280 },
        { id: 'lg', label: '대 (360px)', px: 360 },
        { id: 'auto', label: '자동 (최대)', px: 'auto' }
      ];

      let currentMode = 'auto';

      function applySize(val) {
        if (val === 'auto') {
          currentMode = 'auto';
          const maxW = Math.max(160, document.documentElement.clientWidth - 40);
          const maxH = Math.max(160, document.documentElement.clientHeight - 110);
          const size = Math.min(maxW, maxH);
          imgWrapper.style.width = `${size}px`;
          imgWrapper.style.height = `${size}px`;
          slider.value = String(Math.round(size));
        } else {
          currentMode = 'fixed';
          const num = Math.min(600, Math.max(160, Number(val)));
          imgWrapper.style.width = `${num}px`;
          imgWrapper.style.height = `${num}px`;
          slider.value = String(num);
        }
        sizeChips.querySelectorAll('.size-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.size === (currentMode === 'auto' ? 'auto' : val));
        });
      }

      sizes.forEach(s => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'size-btn' + (s.id === 'auto' ? ' active' : '');
        btn.dataset.size = s.id;
        btn.textContent = s.id.toUpperCase();
        btn.title = s.label;
        btn.addEventListener('click', () => {
          if (s.id === 'auto') {
            applySize('auto');
          } else {
            applySize(s.px);
          }
        });
        sizeChips.appendChild(btn);
      });

      slider.addEventListener('input', () => {
        applySize(slider.value);
      });

      btnOut.addEventListener('click', () => {
        const next = Math.max(160, parseInt(slider.value, 10) - 30);
        applySize(next);
      });

      btnIn.addEventListener('click', () => {
        const next = Math.min(600, parseInt(slider.value, 10) + 30);
        applySize(next);
      });

      window.addEventListener('resize', () => {
        if (currentMode === 'auto') {
          applySize('auto');
        }
      });

      setTimeout(() => {
        applySize('auto');
      }, 50);
    }());
  