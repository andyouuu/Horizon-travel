// Мобильное меню
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".nav");

navToggle?.addEventListener("click", () => {
  const isOpen = navToggle.getAttribute("aria-expanded") === "true";
  navToggle.setAttribute("aria-expanded", String(!isOpen));
  nav?.classList.toggle("nav--open", !isOpen);
});

nav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navToggle?.setAttribute("aria-expanded", "false");
    nav?.classList.remove("nav--open");
  });
});

// Шапка при скролле
const header = document.querySelector(".header");
const hero = document.querySelector(".hero");

function updateHeader() {
  const heroBottom = hero?.offsetHeight ?? 0;
  const scrolled = window.scrollY > 16;
  const pastHero = window.scrollY > heroBottom - 100;
  header?.classList.toggle("header--scrolled", scrolled);
  header?.classList.toggle("header--hero", !pastHero);
}

window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();

// Параллакс hero (только фото)
const heroImg = document.querySelector(".hero__img");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (heroImg && !reducedMotion) {
  window.addEventListener(
    "scroll",
    () => {
      const y = window.scrollY;
      if (y < window.innerHeight * 1.2) {
        heroImg.style.transform = `scale(1.05) translateY(${y * 0.2}px)`;
      }
    },
    { passive: true }
  );
}

// Появление при скролле
const revealElements = document.querySelectorAll(".reveal");

if (revealElements.length && !reducedMotion) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -24px 0px" }
  );
  revealElements.forEach((el) => observer.observe(el));
} else {
  revealElements.forEach((el) => el.classList.add("is-visible"));
}

// Туры с Google Таблицы
loadAndRenderTours();

// Синхронизация быстрого поиска с формой
const quickDest = document.querySelector('[name="quick-destination"]');
const bookingDest = document.querySelector('#booking-form [name="destination"]');

quickDest?.addEventListener("change", () => {
  if (bookingDest) bookingDest.value = quickDest.value;
});

// Форма заявки
const form = document.getElementById("booking-form");
const formFields = document.getElementById("form-fields");
const successMessage = document.getElementById("form-success");

const formError = document.getElementById("form-error");
const submitBtn = form?.querySelector('button[type="submit"]');

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const nameInput = form.querySelector('[name="name"]');
  const phoneInput = form.querySelector('[name="phone"]');
  const destInput = form.querySelector('[name="destination"]');

  const fields = [nameInput, phoneInput, destInput];
  let isValid = true;
  fields.forEach((field) => {
    field?.classList.remove("error");
    if (field && !field.value.trim()) {
      field.classList.add("error");
      isValid = false;
    }
  });

  if (!isValid) return;

  formError.hidden = true;
  submitBtn.disabled = true;
  submitBtn.textContent = "Отправка…";

  try {
    await submitLead({
      name: nameInput.value.trim(),
      phone: phoneInput.value.trim(),
      destination: destInput.value.trim(),
    });
    formFields.hidden = true;
    successMessage.hidden = false;
    form.reset();
  } catch (err) {
    formError.textContent = err.message || "Не удалось отправить заявку. Попробуйте позже.";
    formError.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Отправить заявку";
  }
});
