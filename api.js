const FALLBACK_TOURS = [
  {
    id: "t1",
    active: true,
    sort: 1,
    title: "Турция, Анталья — 5★",
    subtitle: "Прямой перелёт · трансфер · страховка",
    rating: "4.97",
    nights: "7 ночей",
    tag: "Всё включено",
    price: 89000,
    image: "images/tour-turkey.jpg",
    badge: "Хит продаж",
    badgeDark: false,
    destination: "Турция",
  },
  {
    id: "t2",
    active: true,
    sort: 2,
    title: "ОАЭ, Дубай — Marina",
    subtitle: "Отель у залива · сафари в пустыне",
    rating: "4.95",
    nights: "5 ночей",
    tag: "Завтраки",
    price: 124000,
    image: "images/tour-uae.jpg",
    badge: "Премиум",
    badgeDark: true,
    destination: "ОАЭ",
  },
  {
    id: "t3",
    active: true,
    sort: 3,
    title: "Таиланд, Пхукет",
    subtitle: "Пляжный отдых + экскурсия на Пхи-Пхи",
    rating: "4.92",
    nights: "10 ночей",
    tag: "Острова",
    price: 98000,
    image: "images/tour-thailand.jpg",
    badge: "",
    badgeDark: false,
    destination: "Таиланд",
  },
  {
    id: "t4",
    active: true,
    sort: 4,
    title: "Италия, Рим и Тоскана",
    subtitle: "Музеи · гастрономия · трансферы",
    rating: "4.98",
    nights: "8 ночей",
    tag: "Экскурсии",
    price: 156000,
    image: "images/tour-italy.jpg",
    badge: "Культура",
    badgeDark: false,
    destination: "Италия",
  },
  {
    id: "t5",
    active: true,
    sort: 5,
    title: "Грузия, Тбилиси + Кахетия",
    subtitle: "Вино · горы · гастротуры",
    rating: "4.94",
    nights: "6 ночей",
    tag: "Без визы",
    price: 52000,
    image: "images/tour-georgia.jpg",
    badge: "",
    badgeDark: false,
    destination: "Грузия",
  },
];

function getApiUrl() {
  const url =
    (typeof HORIZON_CONFIG !== "undefined" && HORIZON_CONFIG.API_URL) || "";
  return String(url).trim();
}

function formatPrice(price) {
  return new Intl.NumberFormat("ru-RU").format(price) + " ₽";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function parseApiResponse(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    throw new Error("Пустой ответ сервера");
  }
  if (trimmed.startsWith("<")) {
    throw new Error(
      "Сервер вернул страницу вместо данных. Проверьте URL в config.js (должен заканчиваться на /exec) и что развёртывание Apps Script доступно всем."
    );
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error("Не удалось прочитать ответ сервера: " + trimmed.slice(0, 120));
  }
}

/** POST к Google Apps Script (учитывает редирект 302) */
async function apiRequest(payload) {
  const base = getApiUrl();
  if (!base) {
    throw new Error("API не настроен — укажите API_URL в config.js");
  }

  const body = JSON.stringify(payload);

  async function readResponse(response) {
    const text = await response.text();
    const data = parseApiResponse(text);
    if (!data.ok) {
      throw new Error(data.error || "Ошибка сервера");
    }
    return data;
  }

  // 1) Следуем редиректам автоматически (работает в большинстве браузеров)
  try {
    const response = await fetch(base, {
      method: "POST",
      redirect: "follow",
      body,
    });
    return await readResponse(response);
  } catch (firstError) {
    // 2) Ручной переход по Location (если браузер не отдал тело после редиректа)
    const manual = await fetch(base, {
      method: "POST",
      redirect: "manual",
      body,
    });

    if (manual.status === 302 || manual.status === 301) {
      const location = manual.headers.get("Location");
      if (location) {
        const follow = await fetch(location, { method: "GET", redirect: "follow" });
        return await readResponse(follow);
      }
    }

    if (manual.ok) {
      return await readResponse(manual);
    }

    throw firstError;
  }
}

async function fetchTours() {
  const base = getApiUrl();
  if (!base) {
    return { tours: FALLBACK_TOURS, fromCache: true, error: "no_api" };
  }

  try {
    const url =
      base +
      (base.includes("?") ? "&" : "?") +
      "action=tours&_=" +
      Date.now();
    const response = await fetch(url, { cache: "no-store" });
    const text = await response.text();
    const data = parseApiResponse(text);
    if (data.ok && Array.isArray(data.tours)) {
      return { tours: data.tours, fromCache: false };
    }
  } catch (err) {
    console.warn("Не удалось загрузить туры:", err);
    return { tours: FALLBACK_TOURS, fromCache: true, error: err.message };
  }

  return { tours: FALLBACK_TOURS, fromCache: true, error: "bad_response" };
}

const DEST_IMAGES = {
  Турция: "images/dest-turkey.jpg",
  "ОАЭ": "images/dest-uae.jpg",
  Таиланд: "images/dest-thailand.jpg",
  Италия: "images/dest-italy.jpg",
  Грузия: "images/dest-georgia.jpg",
  Исландия: "images/dest-iceland.jpg",
};

const DEST_SUBTITLES = {
  Турция: "Анталья · Бодрум · Стамбул",
  "ОАЭ": "Дубай · Абу-Даби",
  Таиланд: "Пхукет · Паттайя",
  Италия: "Рим · Тоскана",
  Грузия: "Тбилиси · Кахетия",
  Исландия: "Север · ледники",
};

function formatPriceFrom(minPrice) {
  return "от " + formatPrice(minPrice);
}

function destImageFor(destination, tour) {
  if (DEST_IMAGES[destination]) return DEST_IMAGES[destination];
  if (tour?.image?.startsWith("images/dest-")) return tour.image;
  if (tour?.image) return tour.image;
  return "images/hero.jpg";
}

function renderDestinations(tours) {
  const grid = document.getElementById("destinations-grid");
  if (!grid) return;

  const active = tours.filter((t) => t.active !== false);
  if (!active.length) {
    grid.innerHTML = '<p class="tours-loading">Направления скоро появятся.</p>';
    return;
  }

  const byDest = new Map();
  active.forEach((t) => {
    const dest = t.destination || "Другое";
    const prev = byDest.get(dest);
    if (!prev || t.price < prev.minPrice) {
      byDest.set(dest, { minPrice: t.price, tour: t });
    }
  });

  const sorted = [...byDest.entries()].sort(
    (a, b) => (a[1].tour.sort || 99) - (b[1].tour.sort || 99)
  );

  grid.innerHTML = sorted
    .map(([dest, { minPrice, tour }], index) => {
      const img = destImageFor(dest, tour);
      const subtitle = DEST_SUBTITLES[dest] || tour.subtitle || "";
      const lg = index === 0 ? " dest-card--lg" : "";
      const priceLabel = formatPriceFrom(minPrice);

      return `
        <a href="#booking" class="dest-card${lg}">
          <img src="${escapeHtml(img)}" alt="${escapeHtml(dest)}" loading="lazy" width="600" height="500" />
          <div class="dest-card__overlay">
            ${index === 0 ? `<span class="dest-card__tag">${escapeHtml(priceLabel)}</span>` : ""}
            <h3>${escapeHtml(dest)}</h3>
            <p>${escapeHtml(index === 0 ? subtitle : priceLabel)}</p>
          </div>
        </a>`;
    })
    .join("");
}

async function submitLead({ name, phone, destination }) {
  const base = getApiUrl();
  if (!base) {
    throw new Error(
      "Укажите API_URL в config.js — см. NASTROYKA.md"
    );
  }

  return apiRequest({
    action: "lead",
    name,
    phone,
    destination,
  });
}

function renderTourCard(tour) {
  const badgeClass = tour.badgeDark ? " tour-card__badge--dark" : "";
  const badgeHtml = tour.badge
    ? `<span class="tour-card__badge${badgeClass}">${escapeHtml(tour.badge)}</span>`
    : "";

  return `
    <article class="tour-card" data-tour-id="${escapeHtml(tour.id)}">
      <a href="#booking" class="tour-card__media">
        <img src="${escapeHtml(tour.image)}" alt="${escapeHtml(tour.title)}" loading="lazy" width="800" height="600" />
        ${badgeHtml}
        <button type="button" class="tour-card__fav" aria-label="В избранное">♡</button>
      </a>
      <div class="tour-card__body">
        <div class="tour-card__meta">
          <span class="tour-card__rating">★ ${escapeHtml(tour.rating)}</span>
          <span>·</span>
          <span>${escapeHtml(tour.nights)}</span>
          <span>·</span>
          <span>${escapeHtml(tour.tag)}</span>
        </div>
        <h3 class="tour-card__title">${escapeHtml(tour.title)}</h3>
        <p class="tour-card__sub">${escapeHtml(tour.subtitle)}</p>
        <p class="tour-card__price"><strong>${formatPrice(tour.price)}</strong> <span>/ чел.</span></p>
      </div>
    </article>
  `;
}

function fillDestinationSelects(tours) {
  const destinations = [
    ...new Set(
      tours
        .map((t) => t.destination)
        .filter(Boolean)
    ),
    "Другое",
  ];

  const selects = [
    document.querySelector('[name="destination"]'),
    document.querySelector('[name="quick-destination"]'),
  ];

  selects.forEach((select) => {
    if (!select) return;
    const current = select.value;
    select.innerHTML = "";

    if (select.name === "destination") {
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.disabled = true;
      placeholder.selected = true;
      placeholder.textContent = "Выберите направление";
      select.appendChild(placeholder);
    }

    destinations.forEach((dest) => {
      const opt = document.createElement("option");
      opt.value = dest;
      opt.textContent = dest;
      select.appendChild(opt);
    });

    if (current && destinations.includes(current)) {
      select.value = current;
    }
  });
}

async function loadAndRenderTours() {
  const track = document.getElementById("tours-track");
  if (!track) return;

  track.innerHTML = '<p class="tours-loading">Загрузка туров…</p>';

  const { tours, fromCache, error } = await fetchTours();

  if (!tours.length) {
    track.innerHTML = '<p class="tours-loading">Туры скоро появятся.</p>';
    return;
  }

  track.innerHTML = tours.map(renderTourCard).join("");
  renderDestinations(tours);
  fillDestinationSelects(tours);

  document.querySelectorAll(".tours-hint").forEach((el) => el.remove());

  if (fromCache) {
    const hint = document.createElement("p");
    hint.className = "tours-hint";
    hint.textContent = getApiUrl()
      ? "Не удалось загрузить туры из таблицы — показаны старые данные. Обновите страницу (Cmd+Shift+R) или откройте через localhost:8080."
      : "Показаны демо-туры. Подключите Google Таблицу — см. NASTROYKA.md";
    track.parentElement?.appendChild(hint);
    if (error) console.warn("fetchTours:", error);
  }

  document.querySelectorAll(".tour-card__fav").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const active = btn.textContent === "♥";
      btn.textContent = active ? "♡" : "♥";
      btn.style.color = active ? "" : "var(--accent)";
    });
  });
}
