(() => {
  const carousel = document.querySelector("[data-carousel]");
  if (!carousel) return;

  const slides = [...carousel.querySelectorAll(".carousel-slide")];
  const dots = [...carousel.querySelectorAll("[data-slide-to]")];
  const previous = carousel.querySelector(".carousel-arrow--prev");
  const next = carousel.querySelector(".carousel-arrow--next");
  const count = carousel.querySelector(".carousel-count");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const delay = 7000;
  let activeIndex = 0;
  let timer;

  const render = (index) => {
    activeIndex = (index + slides.length) % slides.length;

    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === activeIndex;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", String(!active));
    });

    dots.forEach((dot, dotIndex) => {
      const active = dotIndex === activeIndex;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-selected", String(active));
    });

  };

  const stop = () => {
    window.clearInterval(timer);
  };

  const start = () => {
    stop();
    if (reduceMotion.matches) return;
    timer = window.setInterval(() => render(activeIndex + 1), delay);
  };

  const goTo = (index) => {
    render(index);
    start();
  };

  previous?.addEventListener("click", () => goTo(activeIndex - 1));
  next?.addEventListener("click", () => goTo(activeIndex + 1));
  dots.forEach((dot) => {
    dot.addEventListener("click", () => goTo(Number(dot.dataset.slideTo)));
  });

  carousel.addEventListener("mouseenter", stop);
  carousel.addEventListener("mouseleave", start);
  carousel.addEventListener("focusin", stop);
  carousel.addEventListener("focusout", (event) => {
    if (!carousel.contains(event.relatedTarget)) start();
  });

  carousel.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") goTo(activeIndex - 1);
    if (event.key === "ArrowRight") goTo(activeIndex + 1);
  });

  reduceMotion.addEventListener?.("change", start);
  render(0);
  start();
})();

document.querySelectorAll("[data-shelf]").forEach((shelf) => {

  const track = shelf.querySelector(".product-track");
  const previous = shelf.querySelector(".shelf-arrow--prev");
  const next = shelf.querySelector(".shelf-arrow--next");

  const step = () => track.firstElementChild.offsetWidth + parseFloat(getComputedStyle(track).columnGap);

  const update = () => {
    previous.disabled = track.scrollLeft <= 1;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 1;
  };

  previous.addEventListener("click", () => track.scrollBy({ left: -step() }));
  next.addEventListener("click", () => track.scrollBy({ left: step() }));
  track.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
});

(() => {
  const reels = document.querySelector("[data-reels]");
  if (!reels) return;

  const track = reels.querySelector(".reels-track");
  const originals = [...track.children];
  const count = originals.length;

  // A copy of the cards on each side keeps videos on both edges and lets the row loop.
  const copy = () => originals.map((card) => {
    const clone = card.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    clone.inert = true;
    return clone;
  });
  track.prepend(...copy());
  track.append(...copy());
  const cards = [...track.children];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const maxPlay = 8000;
  let active = -1;
  let timer;
  let hovering = false;
  let visible = false;

  const goTo = (index, behavior) => {
    const card = cards[Math.max(0, Math.min(index, cards.length - 1))];
    track.scrollTo({ left: card.offsetLeft + card.offsetWidth / 2 - track.clientWidth / 2, behavior });
  };

  // Once scrolling stops on a copy, jump to the same card in the middle set without a visible change.
  const recentre = () => {
    if (active < 0 || (active >= count && active < count * 2)) return;
    const from = cards[active];
    const to = cards[count + (active % count)];
    const fromVideo = from.querySelector("video");
    const toVideo = to.querySelector("video");
    to.classList.add("is-active");
    from.classList.remove("is-active");
    toVideo.currentTime = fromVideo.currentTime;
    fromVideo.pause();
    if (visible && !reduceMotion.matches) toVideo.play().catch(() => {});
    active = cards.indexOf(to);
    goTo(active, "instant");
  };

  const schedule = () => {
    window.clearTimeout(timer);
    if (reduceMotion.matches || hovering || !visible) return;
    timer = window.setTimeout(() => goTo(active + 1), maxPlay);
  };

  // Only the card in the middle grows and plays.
  const setActive = (index) => {
    if (index === active) return;
    active = index;
    cards.forEach((card, i) => {
      const video = card.querySelector("video");
      card.classList.toggle("is-active", i === index);
      if (i === index && visible && !reduceMotion.matches) {
        video.currentTime = 0;
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
    schedule();
  };

  let dragStart = null;
  let dragged = false;

  const centred = () => {
    const middle = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    cards.forEach((card, i) => {
      const distance = Math.abs(card.offsetLeft + card.offsetWidth / 2 - middle);
      const bestDistance = Math.abs(cards[best].offsetLeft + cards[best].offsetWidth / 2 - middle);
      if (distance < bestDistance) best = i;
    });
    return best;
  };

  let frame;
  let settle;
  track.addEventListener("scroll", () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => setActive(centred()));
    window.clearTimeout(settle);
    settle = window.setTimeout(() => { if (!dragStart) recentre(); }, 150);
  }, { passive: true });

  cards.forEach((card) => {
    card.querySelector("video").addEventListener("ended", () => goTo(active + 1));
  });

  reels.querySelector(".reels-arrow--prev").addEventListener("click", () => goTo(active - 1));
  reels.querySelector(".reels-arrow--next").addEventListener("click", () => goTo(active + 1));

  reels.addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "mouse") return;
    hovering = true;
    window.clearTimeout(timer);
  });
  reels.addEventListener("pointerleave", () => {
    hovering = false;
    schedule();
  });

  // Mouse drag. Touch already scrolls natively.
  track.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse") return;
    dragStart = { x: event.clientX, left: track.scrollLeft };
    dragged = false;
  });
  window.addEventListener("pointermove", (event) => {
    if (!dragStart) return;
    const dx = event.clientX - dragStart.x;
    if (Math.abs(dx) > 5) {
      dragged = true;
      track.classList.add("is-dragging");
    }
    track.scrollLeft = dragStart.left - dx;
  });
  window.addEventListener("pointerup", () => {
    if (!dragStart) return;
    dragStart = null;
    track.classList.remove("is-dragging");
    goTo(centred());
  });
  track.addEventListener("click", (event) => {
    if (dragged) event.preventDefault();
    dragged = false;
  }, true);

  // Keep the timer off while the section is off screen.
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (entry.isIntersecting) {
      const index = active;
      active = -1;
      setActive(index < 0 ? count : index);
    } else {
      window.clearTimeout(timer);
      cards[active]?.querySelector("video").pause();
    }
  }, { threshold: 0.3 }).observe(track);

  goTo(count, "instant");
})();

document.querySelectorAll(".ba input").forEach((input) => {
  input.addEventListener("input", () => input.parentElement.style.setProperty("--pos", `${input.value}%`));
});
