/* Hello Kaffi - landing page interactions (index.html). Separate from script.js, which runs the ordering app. */
(function () {
  var $ = function (s) {
    return document.querySelector(s);
  };
  var hero = $(".hero"),
    nav = $("#nav"),
    bar = $("#progress"),
    toTop = $("#toTop");
  var v = $("#vid"),
    vb = $("#vidBlur"),
    snd = $("#snd"),
    root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var saveData = navigator.connection && navigator.connection.saveData;

  /* ----- video: muted autoplay, sound toggle ----- */
  if (reduce || saveData) {
    [v, vb].forEach(function (x) {
      x.removeAttribute("autoplay");
      x.pause();
    });
  } else {
    // The blurred backdrop is a second copy of the video: keep it in step, and skip it on phones where it is hidden.
    var phone = window.matchMedia("(max-width:860px)");
    var backdrop = function () {
      if (phone.matches) vb.pause();
      else vb.play().catch(function () {});
    };
    phone.addEventListener("change", backdrop);
    backdrop();
    setInterval(function () {
      if (!vb.paused && Math.abs(vb.currentTime - v.currentTime) > 0.35)
        vb.currentTime = v.currentTime;
    }, 1500);
  }
  snd.addEventListener("click", function () {
    v.muted = !v.muted;
    snd.classList.toggle("on", !v.muted);
    snd.setAttribute("aria-pressed", String(!v.muted));
    snd.setAttribute(
      "aria-label",
      v.muted ? "Turn sound on" : "Turn sound off",
    );
    if (v.paused) v.play().catch(function () {});
  });

  /* ----- not signed in? menu links go through the login page first ----- */
  var signedIn = false;
  try {
    signedIn = !!localStorage.getItem("hk_customer");
  } catch (e) {}
  if (!signedIn) {
    document.querySelectorAll('a[href^="menu.html"]').forEach(function (a) {
      a.setAttribute(
        "href",
        "Login.html?next=" + encodeURIComponent(a.getAttribute("href")),
      );
    });
  }

  /* ----- page fade when entering the ordering app ----- */
  document.querySelectorAll("a[data-go]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      document.body.classList.add("leaving");
      setTimeout(function () {
        location.href = a.getAttribute("href");
      }, 260);
    });
  });
  /* Staff shortcut: Alt + A (Option + A on Mac) opens the staff sign-in. */
  document.addEventListener("keydown", function (e) {
    if (
      e.altKey &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.shiftKey &&
      e.code === "KeyA"
    ) {
      e.preventDefault();
      document.body.classList.add("leaving");
      setTimeout(function () {
        location.href = "/pos/login.html";
      }, 200);
    }
  });
  window.addEventListener("pageshow", function () {
    document.body.classList.remove("leaving");
  });

  /* ----- scroll reveals: heading words + tiles ----- */
  var targets = [];
  document.querySelectorAll("[data-words]").forEach(function (h) {
    var text = h.textContent.trim(),
      words = text.split(/\s+/);
    h.setAttribute("aria-label", text);
    h.textContent = "";
    words.forEach(function (w, i) {
      var o = document.createElement("span"),
        n = document.createElement("span");
      o.className = "w";
      o.setAttribute("aria-hidden", "true");
      n.className = "wi";
      n.textContent = w;
      n.style.setProperty("--d", i * 0.08 + "s");
      o.appendChild(n);
      h.appendChild(o);
      if (i < words.length - 1) h.appendChild(document.createTextNode(" "));
    });
    targets.push(h);
  });
  document.querySelectorAll("[data-reveal]").forEach(function (el, i) {
    if (el.classList.contains("tile"))
      el.style.setProperty("--d", (i % 3) * 0.1 + "s");
    targets.push(el);
  });
  if (reduce || !("IntersectionObserver" in window)) {
    targets.forEach(function (t) {
      t.classList.add("in");
    });
  } else {
    root.classList.add("js");
    var io = new IntersectionObserver(
      function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    targets.forEach(function (t) {
      io.observe(t);
    });
  }

  /* ----- tiles tilt toward the pointer (mouse only) ----- */
  if (!reduce && window.matchMedia("(hover:hover)").matches) {
    document.querySelectorAll(".tile").forEach(function (t) {
      t.addEventListener("pointermove", function (e) {
        var r = t.getBoundingClientRect(),
          x = (e.clientX - r.left) / r.width - 0.5,
          y = (e.clientY - r.top) / r.height - 0.5;
        t.style.transform =
          "perspective(700px) rotateX(" +
          -y * 7 +
          "deg) rotateY(" +
          x * 9 +
          "deg) translateY(-4px)";
      });
      t.addEventListener("pointerleave", function () {
        t.style.transform = "";
      });
    });
  }

  /* ----- back to top ----- */
  toTop.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  });

  /* ----- one animation loop: progress bar, nav, hero parallax, back-to-top ----- */
  var tx = 0,
    ty = 0,
    mx = 0,
    my = 0,
    raf = 0;
  function frame() {
    raf = 0;
    var y = window.scrollY,
      doc = root.scrollHeight - innerHeight;
    root.style.setProperty(
      "--sp",
      doc > 0 ? Math.min(1, y / doc).toFixed(4) : 0,
    );
    nav.classList.toggle("scrolled", y > 24);
    toTop.classList.toggle("show", y > innerHeight * 0.8);
    if (!reduce) {
      var p = Math.min(1, Math.max(0, y / Math.max(1, hero.offsetHeight)));
      mx += (tx - mx) * 0.08;
      my += (ty - my) * 0.08;
      hero.style.setProperty("--p", p.toFixed(3));
      hero.style.setProperty("--mx", mx.toFixed(3));
      hero.style.setProperty("--my", my.toFixed(3));
      if (Math.abs(tx - mx) > 0.002 || Math.abs(ty - my) > 0.002) kick();
    }
  }
  function kick() {
    if (!raf) raf = requestAnimationFrame(frame);
  }
  addEventListener("scroll", kick, { passive: true });
  addEventListener("resize", kick);
  addEventListener("pointermove", function (e) {
    if (reduce || e.pointerType === "touch") return;
    tx = (e.clientX / innerWidth - 0.5) * 2;
    ty = (e.clientY / innerHeight - 0.5) * 2;
    kick();
  });
  frame();
  5;
})();
