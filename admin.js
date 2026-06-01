const TOKEN_KEY = "horizon_admin_token";

const loginScreen = document.getElementById("login-screen");
const panelScreen = document.getElementById("panel-screen");
const configBanner = document.getElementById("config-banner");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const loginStatus = document.getElementById("login-status");
const panelError = document.getElementById("panel-error");
const panelSuccess = document.getElementById("panel-success");
const toursTbody = document.getElementById("tours-tbody");
const tourForm = document.getElementById("tour-form");
const formTitle = document.getElementById("form-title");
const btnDelete = document.getElementById("btn-delete");
const btnSave = document.getElementById("btn-save");
const imagePreview = document.getElementById("image-preview");
const imagePreviewEmpty = document.getElementById("image-preview-empty");
const imageFileInput = document.getElementById("image-file");
const uploadStatus = document.getElementById("upload-status");

let toursCache = [];

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

function showMsg(el, text) {
  if (!el) return;
  if (text) {
    el.textContent = text;
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}

function checkConfig() {
  const ok = Boolean(getApiUrl());
  if (configBanner) configBanner.hidden = ok;
  return ok;
}

checkConfig();

function showPanel() {
  if (!checkConfig()) {
    showMsg(loginError, "Сначала укажите API_URL в config.js");
    return;
  }
  showPanelView();
  loadTours();
}

function showLogin(reason) {
  setToken(null);
  panelScreen.classList.add("is-hidden");
  loginScreen.classList.remove("is-hidden");
  tourForm.hidden = true;
  if (reason) {
    showMsg(loginError, reason);
  }
}

function showPanelView() {
  loginScreen.classList.add("is-hidden");
  panelScreen.classList.remove("is-hidden");
}

// Не открываем панель автоматически — только после успешного входа

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showMsg(loginError, "");
  showMsg(loginStatus, "");

  if (!checkConfig()) {
    showMsg(loginError, "Укажите API_URL в config.js");
    return;
  }

  const passwordInput = loginForm.querySelector('[name="password"]');
  const password = passwordInput?.value || "";
  const submitBtn = loginForm.querySelector('button[type="submit"]');
  const btnLabel = submitBtn?.textContent || "Войти";

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Проверка…";
  }

  try {
    showMsg(loginStatus, "Подключение к серверу…");

    const data = await apiRequest({
      action: "admin_login",
      password,
    });

    if (!data.token) {
      throw new Error(
        "Сервер не выдал токен. В Apps Script обновите код и сделайте «Новое развертывание»."
      );
    }

    setToken(data.token);
    showMsg(loginStatus, "Вход выполнен. Загрузка туров…");

    showPanelView();
    await loadTours({ fromLogin: true });

    loginForm.reset();
    showMsg(loginStatus, "");
    showMsg(loginError, "");
  } catch (err) {
    setToken(null);
    showLogin();

    let message = err.message || "Не удалось войти";

    if (/неверный пароль/i.test(message)) {
      message =
        "Неверный пароль. По умолчанию: horizon2026 (если не меняли в setupHorizonSecrets в Apps Script).";
    } else if (/failed to fetch|network/i.test(message)) {
      message =
        "Нет связи с сервером. Откройте http://localhost:8080/admin.html (команда: python3 -m http.server 8080).";
    } else if (/авториза/i.test(message)) {
      message =
        "Пароль принят, но туры не загрузились. Обновите код в Apps Script и нажмите «Новое развертывание» (доступ: Все).";
    }

    showMsg(loginError, message);
    showMsg(loginStatus, "");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = btnLabel;
    }
  }
});

document.getElementById("btn-logout")?.addEventListener("click", showLogin);

document.getElementById("btn-clear-session")?.addEventListener("click", () => {
  setToken(null);
  showLogin("Сессия сброшена. Введите пароль снова.");
  showMsg(loginStatus, "");
});
document.getElementById("btn-refresh")?.addEventListener("click", () => loadTours());

async function loadTours(options = {}) {
  toursTbody.innerHTML = '<tr><td colspan="6">Загрузка…</td></tr>';
  showMsg(panelError, "");
  showMsg(panelSuccess, "");

  try {
    const data = await apiRequest({
      action: "admin_tours",
      token: getToken(),
    });
    toursCache = data.tours || [];
    renderToursTable(toursCache);
  } catch (err) {
    toursTbody.innerHTML = '<tr><td colspan="6">Ошибка загрузки</td></tr>';

    if (options.fromLogin) {
      throw err;
    }

    showMsg(panelError, err.message);
    if (/авториза/i.test(err.message)) {
      showLogin(
        "Сессия истекла или неверный токен. Войдите снова. Если повторяется — сделайте новое развёртывание Apps Script."
      );
    }
  }
}

function thumbSrc(image) {
  if (!image) return "";
  if (image.startsWith("http") || image.startsWith("images/")) return image;
  return image;
}

function renderToursTable(tours) {
  if (!tours.length) {
    toursTbody.innerHTML =
      '<tr><td colspan="6">Туров нет. Нажмите «+ Новый тур».</td></tr>';
    return;
  }

  const sorted = [...tours].sort((a, b) => a.sort - b.sort);
  toursTbody.innerHTML = sorted
    .map((t) => {
      const img = thumbSrc(t.image);
      const thumb = img
        ? `<img class="admin-table__thumb" src="${escapeHtml(img)}" alt="" loading="lazy" />`
        : '<span class="admin-table__no-thumb">—</span>';
      return `
    <tr>
      <td>${thumb}</td>
      <td>${t.sort}</td>
      <td>${escapeHtml(t.title)}</td>
      <td>${formatPrice(t.price)}</td>
      <td>${t.active ? '<span class="admin-badge admin-badge--on">Да</span>' : '<span class="admin-badge">Нет</span>'}</td>
      <td class="admin-table__actions">
        <button type="button" class="admin-link" data-edit="${escapeHtml(t.id)}">Изменить</button>
        <button type="button" class="admin-link admin-link--danger" data-delete="${escapeHtml(t.id)}">Удалить</button>
      </td>
    </tr>`;
    })
    .join("");

  toursTbody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tour = toursCache.find((t) => t.id === btn.dataset.edit);
      if (tour) openTourForm(tour);
    });
  });

  toursTbody.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => deleteTourById(btn.dataset.delete));
  });
}

async function deleteTourById(id) {
  if (!id || !confirm("Удалить этот тур из таблицы?")) return;

  showMsg(panelError, "");
  showMsg(panelSuccess, "");

  try {
    await apiRequest({
      action: "admin_delete_tour",
      token: getToken(),
      id,
    });
    showMsg(panelSuccess, "Тур удалён из Google Таблицы.");
    if (formField("id").value === id) tourForm.hidden = true;
    await loadTours();
  } catch (err) {
    showMsg(panelError, err.message);
    if (/авториза/i.test(err.message)) showLogin();
  }
}

function formField(name) {
  return tourForm.querySelector(`[name="${name}"]`);
}

function updateImagePreview(url) {
  const src = (url || "").trim();
  if (!src) {
    imagePreview.hidden = true;
    imagePreview.removeAttribute("src");
    imagePreviewEmpty.hidden = false;
    return;
  }
  imagePreview.src = src;
  imagePreview.hidden = false;
  imagePreviewEmpty.hidden = true;
  imagePreview.onerror = () => {
    imagePreview.hidden = true;
    imagePreviewEmpty.textContent = "Не удалось загрузить превью";
    imagePreviewEmpty.hidden = false;
  };
}

formField("image")?.addEventListener("input", (e) => {
  updateImagePreview(e.target.value);
});

async function compressImageFile(file) {
  const maxWidth = 1200;
  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = objectUrl;
    });

    let width = img.width;
    let height = img.height;
    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(img, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    return dataUrl.split(",")[1];
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

imageFileInput?.addEventListener("change", async () => {
  const file = imageFileInput.files?.[0];
  if (!file) return;

  showMsg(uploadStatus, "Загрузка фото…");
  uploadStatus.hidden = false;

  try {
    const base64 = await compressImageFile(file);
    const data = await apiRequest({
      action: "admin_upload_image",
      token: getToken(),
      filename: file.name,
      data: base64,
    });
    formField("image").value = data.url;
    updateImagePreview(data.url);
    showMsg(uploadStatus, "Фото загружено в Google Диск.");
  } catch (err) {
    showMsg(panelError, err.message);
    showMsg(uploadStatus, "");
  }

  imageFileInput.value = "";
});

function openTourForm(tour) {
  tourForm.hidden = false;
  formTitle.textContent = tour?.id ? "Редактировать тур" : "Новый тур";
  btnDelete.hidden = !tour?.id;

  formField("id").value = tour?.id || "";
  formField("active").checked = tour?.active !== false;
  formField("sort").value = tour?.sort ?? 1;
  formField("price").value = tour?.price ?? "";
  formField("title").value = tour?.title || "";
  formField("subtitle").value = tour?.subtitle || "";
  formField("rating").value = tour?.rating || "4.95";
  formField("nights").value = tour?.nights || "";
  formField("tag").value = tour?.tag || "";
  formField("destination").value = tour?.destination || "";
  formField("image").value = tour?.image || "";
  formField("badge").value = tour?.badge || "";
  formField("badgeDark").checked = !!tour?.badgeDark;

  updateImagePreview(tour?.image || "");
  showMsg(uploadStatus, "");
  tourForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function tourFromForm() {
  return {
    id: formField("id").value,
    active: formField("active").checked,
    sort: Number(formField("sort").value) || 1,
    price: Number(formField("price").value) || 0,
    title: formField("title").value.trim(),
    subtitle: formField("subtitle").value.trim(),
    rating: formField("rating").value.trim(),
    nights: formField("nights").value.trim(),
    tag: formField("tag").value.trim(),
    destination: formField("destination").value.trim(),
    image: formField("image").value.trim() || "images/tour-turkey.jpg",
    badge: formField("badge").value.trim(),
    badgeDark: formField("badgeDark").checked,
  };
}

document.getElementById("btn-new-tour")?.addEventListener("click", () => {
  openTourForm({ active: true, sort: (toursCache.length || 0) + 1 });
});

document.getElementById("btn-cancel")?.addEventListener("click", () => {
  tourForm.hidden = true;
});

tourForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showMsg(panelError, "");
  showMsg(panelSuccess, "");

  const saveLabel = btnSave.textContent;
  btnSave.disabled = true;
  btnSave.textContent = "Сохранение…";

  try {
    const data = await apiRequest({
      action: "admin_save_tour",
      token: getToken(),
      tour: tourFromForm(),
    });
    if (data.id) formField("id").value = data.id;
    showMsg(
      panelSuccess,
      "Сохранено в Google Таблицу (лист «Туры»). Обновите главную страницу сайта."
    );
    await loadTours();
    tourForm.hidden = true;
  } catch (err) {
    showMsg(panelError, err.message);
    if (/авториза/i.test(err.message)) showLogin();
  } finally {
    btnSave.disabled = false;
    btnSave.textContent = saveLabel;
  }
});

btnDelete?.addEventListener("click", () => {
  deleteTourById(formField("id").value);
});
