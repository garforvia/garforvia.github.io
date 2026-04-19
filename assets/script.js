(function () {
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const statusHTML = (status) => {
    const value = String(status || '').toLowerCase();
    let cls = '';
    if (value.includes('pending') || value.includes('review')) cls = 'warn';
    if (value.includes('declined') || value.includes('rejected')) cls = 'danger';
    return `<span class="status-pill ${cls}">${status}</span>`;
  };

  async function api(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || 'Request failed.');
    }
    return data;
  }

  function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showMessage(target, type, html) {
    if (!target) return;
    target.innerHTML = `<div class="message ${type}">${html}</div>`;
  }

  function renderNewsMarkup(items) {
    if (!items || !items.length) {
      return `
        <article class="news-item">
          <div class="news-meta">No published notices</div>
          <h3>No news items have been published yet</h3>
          <p>The newsroom will populate here once items are added from the admin dashboard.</p>
        </article>`;
    }
    return items.map(item => `
      <article class="news-item">
        <div class="news-meta">${escapeHTML(item.published_date)} · ${escapeHTML(item.department)}</div>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.body)}</p>
      </article>`).join('');
  }

  async function renderPublicSiteContent() {
    try {
      const data = await api('/api/site/content?limit=4');
      qsa('.public-notice-text').forEach(el => {
        el.textContent = data.public_notice || '';
      });
      const homeList = qs('#homepage-news-list');
      if (homeList) homeList.innerHTML = renderNewsMarkup((data.news || []).slice(0, 3));
      const newsroomList = qs('#newsroom-list');
      if (newsroomList) newsroomList.innerHTML = renderNewsMarkup(data.news || []);
    } catch (_) {
      // Leave static fallback in place if site-content fetch fails.
    }
  }

  const citizenForm = qs('#citizenship-form');
  if (citizenForm) {
    citizenForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const resultBox = qs('#citizenship-result');
      try {
        const data = await api('/api/citizenship/apply', { method: 'POST', body: new FormData(citizenForm) });
        showMessage(resultBox, 'success', `<strong>Application received.</strong><br>Reference: <code class="inline-ref">${data.reference}</code><br>Status: ${data.status}`);
        citizenForm.reset();
      } catch (err) {
        showMessage(resultBox, 'error', err.message);
      }
    });
  }

  const citizenTrackForm = qs('#citizenship-track-form');
  if (citizenTrackForm) {
    citizenTrackForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ref = new FormData(citizenTrackForm).get('reference');
      const box = qs('#citizenship-track-result');
      try {
        const data = await api(`/api/citizenship/track?reference=${encodeURIComponent(ref)}`);
        const r = data.record;
        showMessage(box, 'info', `
          <strong>${r.full_name}</strong><br>
          Reference: <code class="inline-ref">${r.reference}</code><br>
          Submitted: ${r.submitted_date}<br>
          Region: ${r.region}<br>
          Status: ${statusHTML(r.status)}<br>
          ${r.citizen_number ? `Citizen number: <code class="inline-ref">${r.citizen_number}</code><br>` : ''}
          ${r.status_note ? `Note: ${r.status_note}` : ''}
        `);
      } catch (err) {
        showMessage(box, 'error', err.message);
      }
    });
  }

  const passportForm = qs('#passport-form');
  if (passportForm) {
    passportForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const box = qs('#passport-result');
      try {
        const data = await api('/api/passport/apply', { method: 'POST', body: new FormData(passportForm) });
        showMessage(box, 'success', `<strong>Passport request received.</strong><br>Reference: <code class="inline-ref">${data.reference}</code><br>Status: ${data.status}`);
        passportForm.reset();
      } catch (err) {
        showMessage(box, 'error', err.message);
      }
    });
  }

  const passportTrackForm = qs('#passport-track-form');
  if (passportTrackForm) {
    passportTrackForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ref = new FormData(passportTrackForm).get('reference');
      const box = qs('#passport-track-result');
      try {
        const data = await api(`/api/passport/track?reference=${encodeURIComponent(ref)}`);
        const r = data.record;
        showMessage(box, 'info', `
          <strong>${r.full_name}</strong><br>
          Reference: <code class="inline-ref">${r.reference}</code><br>
          Submitted: ${r.submitted_date}<br>
          Passport type: ${r.passport_type}<br>
          Citizenship ID: <code class="inline-ref">${r.citizenship_id}</code><br>
          Status: ${statusHTML(r.status)}<br>
          ${r.passport_number ? `Passport number: <code class="inline-ref">${r.passport_number}</code><br>` : ''}
          ${r.status_note ? `Note: ${r.status_note}` : ''}
        `);
      } catch (err) {
        showMessage(box, 'error', err.message);
      }
    });
  }

  const ballotForm = qs('#ballot-form');
  if (ballotForm) {
    ballotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const party = new FormData(ballotForm).get('party');
      const box = qs('#vote-result');
      try {
        await api('/api/election/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ party })
        });
        showMessage(box, 'success', `Public opinion vote recorded for <strong>${party}</strong>.`);
        ballotForm.reset();
        await renderVoteBoard();
      } catch (err) {
        showMessage(box, 'error', err.message);
      }
    });
  }

  async function renderVoteBoard() {
    const board = qs('#vote-board');
    if (!board) return;
    try {
      const data = await api('/api/election/results');
      const votes = data.results;
      const total = Object.values(votes).reduce((a, b) => a + b, 0) || 1;
      const map = [
        { key: 'Green', label: 'Green Party', color: 'green' },
        { key: 'SDP', label: 'Social Democratic Party', color: 'purple' },
        { key: 'Conservative', label: 'Conservative Party', color: 'blue' }
      ];
      board.innerHTML = map.map(item => {
        const count = votes[item.key] || 0;
        const pct = Math.round((count / total) * 100);
        return `
          <div class="mini-item">
            <div class="party-chip"><span class="party-dot ${item.color}"></span>${item.label}</div>
            <div class="record-meta">${count} public opinion votes</div>
            <div class="progress" aria-hidden="true"><span style="width:${pct}%"></span></div>
          </div>`;
      }).join('');
    } catch (err) {
      board.innerHTML = `<div class="message error">${err.message}</div>`;
    }
  }

  const adminLoginForm = qs('#admin-login-form');
  const adminLoginShell = qs('#admin-login-shell');
  const adminDashboardShell = qs('#admin-dashboard-shell');
  const adminSiteShell = qs('#admin-site-shell');
  const adminNewsShell = qs('#admin-news-shell');
  const adminRecordShell = qs('#admin-record-shell');

  if (adminLoginForm || adminDashboardShell) {
    const check = async () => {
      try {
        const info = await api('/api/admin/me');
        if (info.authenticated) {
          adminLoginShell && adminLoginShell.classList.add('hidden');
          adminDashboardShell && adminDashboardShell.classList.remove('hidden');
          adminSiteShell && adminSiteShell.classList.remove('hidden');
          adminNewsShell && adminNewsShell.classList.remove('hidden');
          adminRecordShell && adminRecordShell.classList.remove('hidden');
          await renderAdminDashboard();
        } else {
          adminLoginShell && adminLoginShell.classList.remove('hidden');
          adminDashboardShell && adminDashboardShell.classList.add('hidden');
          adminSiteShell && adminSiteShell.classList.add('hidden');
          adminNewsShell && adminNewsShell.classList.add('hidden');
          adminRecordShell && adminRecordShell.classList.add('hidden');
        }
      } catch (_) {}
    };

    adminLoginForm && adminLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(adminLoginForm);
      const box = qs('#admin-login-result');
      try {
        await api('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: fd.get('username'), password: fd.get('password') })
        });
        showMessage(box, 'success', 'Administrator signed in.');
        adminLoginForm.reset();
        await check();
      } catch (err) {
        showMessage(box, 'error', err.message);
      }
    });

    qs('#admin-logout')?.addEventListener('click', async () => {
      await api('/api/admin/logout', { method: 'POST' });
      await check();
    });

    async function renderAdminDashboard() {
      const summary = await api('/api/admin/summary');
      qs('#stat-citizens').textContent = summary.citizens;
      qs('#stat-passports').textContent = summary.passports;

      const citizens = await api('/api/admin/citizens');
      const passports = await api('/api/admin/passports');
      const site = await api('/api/admin/site');
      const citizenBox = qs('#citizen-records');
      const passportBox = qs('#passport-records');
      const noticeInput = qs('#public-notice-input');
      const newsList = qs('#admin-news-records');
      if (noticeInput) noticeInput.value = site.public_notice || '';

      if (citizenBox) {
        citizenBox.innerHTML = citizens.records.map(item => `
          <div class="record" data-record-type="citizen" data-record-id="${item.id}">
            <h4>${escapeHTML(item.full_name)}</h4>
            <div class="meta-grid">
              <div><strong>Reference</strong><br>${escapeHTML(item.reference)}</div>
              <div><strong>Citizen number</strong><br>${escapeHTML(item.citizen_number || 'Not issued')}</div>
              <div><strong>Region</strong><br>${escapeHTML(item.region)}</div>
              <div><strong>Email</strong><br>${escapeHTML(item.email)}</div>
              <div><strong>Submitted</strong><br>${escapeHTML(item.submitted_date)}</div>
              <div><strong>Status</strong><br>${statusHTML(item.status)}</div>
            </div>
            <div class="record-meta">Reason: ${escapeHTML(item.reason)}</div>
            <p>${escapeHTML(item.statement)}</p>
            <div class="download-links">
              ${item.has_portrait ? `<a href="/api/admin/download/citizenship/${item.id}/portrait_path">Download portrait</a>` : ''}
              ${item.has_identity_document ? `<a href="/api/admin/download/citizenship/${item.id}/identity_document_path">Download identity document</a>` : ''}
            </div>
            <form class="record-form citizen-update-form">
              <input type="hidden" name="id" value="${item.id}">
              <div>
                <label>Status</label>
                <select name="status">
                  ${['Pending review', 'Approved', 'Verified', 'Pending further information', 'Declined'].map(s => `<option ${item.status===s?'selected':''}>${s}</option>`).join('')}
                </select>
              </div>
              <div>
                <label>Status note</label>
                <textarea name="status_note">${escapeHTML(item.status_note || '')}</textarea>
              </div>
              <div class="inline-actions"><button type="submit">Save decision</button></div>
            </form>
          </div>
        `).join('');
      }

      if (passportBox) {
        passportBox.innerHTML = passports.records.map(item => `
          <div class="record" data-record-type="passport" data-record-id="${item.id}">
            <h4>${escapeHTML(item.full_name)}</h4>
            <div class="meta-grid">
              <div><strong>Reference</strong><br>${escapeHTML(item.reference)}</div>
              <div><strong>Passport number</strong><br>${escapeHTML(item.passport_number || 'Not issued')}</div>
              <div><strong>Citizen ID</strong><br>${escapeHTML(item.citizenship_id)}</div>
              <div><strong>Type</strong><br>${escapeHTML(item.passport_type)}</div>
              <div><strong>Submitted</strong><br>${escapeHTML(item.submitted_date)}</div>
              <div><strong>Status</strong><br>${statusHTML(item.status)}</div>
            </div>
            <div class="record-meta">Address: ${escapeHTML(item.address)}</div>
            ${item.notes ? `<p>${escapeHTML(item.notes)}</p>` : ''}
            <div class="download-links">
              ${item.has_portrait ? `<a href="/api/admin/download/passport/${item.id}/portrait_path">Download portrait</a>` : ''}
            </div>
            <form class="record-form passport-update-form">
              <input type="hidden" name="id" value="${item.id}">
              <div>
                <label>Status</label>
                <select name="status">
                  ${['Under review', 'Approved for issue', 'Issued', 'Pending further information', 'Declined'].map(s => `<option ${item.status===s?'selected':''}>${s}</option>`).join('')}
                </select>
              </div>
              <div>
                <label>Status note</label>
                <textarea name="status_note">${escapeHTML(item.status_note || '')}</textarea>
              </div>
              <div class="inline-actions"><button type="submit">Save decision</button></div>
            </form>
          </div>
        `).join('');
      }

      if (newsList) {
        newsList.innerHTML = (site.news || []).map(item => `
          <div class="news-admin-item">
            <h4>${escapeHTML(item.title)}</h4>
            <div class="news-meta">${escapeHTML(item.published_date)} · ${escapeHTML(item.department)} · ${item.is_published ? 'Published' : 'Hidden'}</div>
            <form class="record-form news-update-form">
              <input type="hidden" name="id" value="${item.id}">
              <div>
                <label>Headline</label>
                <input name="title" value="${escapeHTML(item.title)}" required>
              </div>
              <div class="form-row">
                <div>
                  <label>Office / department</label>
                  <input name="department" value="${escapeHTML(item.department)}" required>
                </div>
                <div>
                  <label>Published date</label>
                  <input name="published_date" type="date" value="${escapeHTML(item.published_date)}" required>
                </div>
              </div>
              <div>
                <label>Body</label>
                <textarea name="body" rows="6" required>${escapeHTML(item.body)}</textarea>
              </div>
              <div class="checkbox-row">
                <label><input type="checkbox" name="is_published" ${item.is_published ? 'checked' : ''}> Published</label>
              </div>
              <div class="inline-actions">
                <button type="submit">Save item</button>
                <button type="button" class="button secondary text-link-button news-delete-button" data-id="${item.id}">Delete</button>
              </div>
            </form>
          </div>
        `).join('') || '<div class="message info">No news items have been created yet.</div>';
      }
    }

    document.addEventListener('submit', async (e) => {
      const form = e.target;

      if (form.id === 'public-notice-form') {
        e.preventDefault();
        const fd = new FormData(form);
        const box = qs('#public-notice-result');
        try {
          await api('/api/admin/site/notice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ public_notice: fd.get('public_notice') })
          });
          showMessage(box, 'success', 'Public notice updated across the website.');
          await renderAdminDashboard();
          await renderPublicSiteContent();
        } catch (err) {
          showMessage(box, 'error', err.message);
        }
        return;
      }

      if (form.id === 'news-create-form') {
        e.preventDefault();
        const fd = new FormData(form);
        const box = qs('#news-create-result');
        try {
          await api('/api/admin/news', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: fd.get('title'),
              department: fd.get('department'),
              published_date: fd.get('published_date'),
              body: fd.get('body'),
              is_published: fd.get('is_published') === 'on'
            })
          });
          showMessage(box, 'success', 'News item added to the newsroom.');
          form.reset();
          const dateInput = qs('#news-date');
          if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
          await renderAdminDashboard();
          await renderPublicSiteContent();
        } catch (err) {
          showMessage(box, 'error', err.message);
        }
        return;
      }

      if (form.classList.contains('news-update-form')) {
        e.preventDefault();
        const fd = new FormData(form);
        const id = fd.get('id');
        try {
          await api(`/api/admin/news/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: fd.get('title'),
              department: fd.get('department'),
              published_date: fd.get('published_date'),
              body: fd.get('body'),
              is_published: fd.get('is_published') === 'on'
            })
          });
          await renderAdminDashboard();
          await renderPublicSiteContent();
        } catch (err) {
          alert(err.message);
        }
        return;
      }

      if (!form.classList.contains('citizen-update-form') && !form.classList.contains('passport-update-form')) return;
      e.preventDefault();
      const fd = new FormData(form);
      const id = fd.get('id');
      const isCitizen = form.classList.contains('citizen-update-form');
      const endpoint = isCitizen ? `/api/admin/citizens/${id}` : `/api/admin/passports/${id}`;
      try {
        await api(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: fd.get('status'), status_note: fd.get('status_note') })
        });
        await renderAdminDashboard();
      } catch (err) {
        alert(err.message);
      }
    });

    document.addEventListener('click', async (e) => {
      const button = e.target.closest('.news-delete-button');
      if (!button) return;
      const id = button.getAttribute('data-id');
      if (!window.confirm('Delete this news item? This cannot be undone.')) return;
      try {
        await api(`/api/admin/news/${id}`, { method: 'DELETE' });
        await renderAdminDashboard();
        await renderPublicSiteContent();
      } catch (err) {
        alert(err.message);
      }
    });

    const dateInput = qs('#news-date');
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().slice(0, 10);
    }

    check();
  }

  renderPublicSiteContent();
  renderVoteBoard();
})();
