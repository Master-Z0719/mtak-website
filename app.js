document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if (page === "catalog") {
    initCatalogPage();
  }
  if (page === "admin") {
    initAdminPage();
  }
});

async function initCatalogPage() {
  const seriesFilter = document.getElementById("seriesFilter");
  const collabFilter = document.getElementById("collabFilter");
  const collabSearch = document.getElementById("collabSearch");
  const sortFilter = document.getElementById("sortFilter");
  const grid = document.getElementById("productGrid");
  const count = document.getElementById("productCount");
  const emptyState = document.getElementById("emptyState");
  const dialog = document.getElementById("productDialog");
  const closeDialog = document.getElementById("closeDialog");

  let products = [];

  const render = () => {
    const series = uniqueCleanList(products.map((item) => item.series));
    const options = ["全部系列", ...series];
    const currentSeries = seriesFilter.value || "全部系列";
    seriesFilter.innerHTML = options.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
    seriesFilter.value = options.includes(currentSeries) ? currentSeries : "全部系列";

    const keyword = collabSearch.value.trim().toLowerCase();
    const filtered = products
      .filter((item) => seriesFilter.value === "全部系列" || item.series === seriesFilter.value)
      .filter((item) => {
        if (collabFilter.value === "collab") {
          return item.isCollab;
        }
        if (collabFilter.value === "regular") {
          return !item.isCollab;
        }
        return true;
      })
      .filter((item) => {
        if (!keyword) {
          return true;
        }
        return item.isCollab && item.collabBrand.toLowerCase().includes(keyword);
      })
      .sort(sortProducts(sortFilter.value));

    count.textContent = `${filtered.length} products`;
    emptyState.hidden = filtered.length > 0;
    grid.innerHTML = filtered.map(renderProductCard).join("");

    grid.querySelectorAll("[data-view-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const product = products.find((item) => item.id === button.dataset.viewId);
        if (product) {
          openDialog(dialog, product);
        }
      });
    });
  };

  seriesFilter.addEventListener("change", render);
  collabFilter.addEventListener("change", render);
  collabSearch.addEventListener("input", render);
  sortFilter.addEventListener("change", render);
  closeDialog.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    const outside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;
    if (outside) {
      dialog.close();
    }
  });

  products = await fetchProducts();
  render();
}

async function initAdminPage() {
  const authGate = document.getElementById("authGate");
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");
  const logoutButton = document.getElementById("logoutButton");
  const credentialHint = document.getElementById("credentialHint");

  const form = document.getElementById("productForm");
  const formTitle = document.getElementById("formTitle");
  const adminList = document.getElementById("adminList");
  const adminCount = document.getElementById("adminCount");
  const cancelEditButton = document.getElementById("cancelEditButton");
  const imageInput = document.getElementById("imageInput");
  const seriesOptions = document.getElementById("seriesOptions");
  const methodOptions = document.getElementById("methodOptions");
  const seriesInput = document.getElementById("seriesInput");
  const methodInput = document.getElementById("methodInput");
  const newSeriesInput = document.getElementById("newSeriesInput");
  const newMethodInput = document.getElementById("newMethodInput");
  const addSeriesButton = document.getElementById("addSeriesButton");
  const addMethodButton = document.getElementById("addMethodButton");
  const seriesChips = document.getElementById("seriesChips");
  const methodChips = document.getElementById("methodChips");
  const isCollabInput = document.getElementById("isCollabInput");
  const collabBrandField = document.getElementById("collabBrandField");
  const collabBrandInput = document.getElementById("collabBrandInput");
  const credentialForm = document.getElementById("credentialForm");
  const adminUserInput = document.getElementById("adminUserInput");
  const adminPasswordInput = document.getElementById("adminPasswordInput");

  let draftImage = "";
  let isCollab = false;
  let products = [];
  let optionState = { series: [], methods: [] };

  function renderAuthState(isAuthenticated) {
    authGate.hidden = false;
    authGate.classList.toggle("is-hidden", isAuthenticated);
    authGate.setAttribute("aria-hidden", String(isAuthenticated));
    document.body.classList.toggle("is-locked", !isAuthenticated);
  }

  function syncCollabState() {
    isCollabInput.setAttribute("aria-checked", String(isCollab));
    isCollabInput.classList.toggle("is-on", isCollab);
    collabBrandField.hidden = !isCollab;
    collabBrandInput.required = isCollab;
    if (!isCollab) {
      collabBrandInput.value = "";
    }
  }

  function renderOptions() {
    seriesOptions.innerHTML = optionState.series.map((item) => `<option value="${escapeHtml(item)}"></option>`).join("");
    methodOptions.innerHTML = optionState.methods.map((item) => `<option value="${escapeHtml(item)}"></option>`).join("");

    seriesChips.innerHTML = optionState.series.length
      ? optionState.series.map((item) => renderChip(item, "series")).join("")
      : `<p class="muted">还没有系列，先在这里添加。</p>`;

    methodChips.innerHTML = optionState.methods.length
      ? optionState.methods.map((item) => renderChip(item, "method")).join("")
      : `<p class="muted">还没有发售方式，先在这里添加。</p>`;

    seriesChips.querySelectorAll("[data-remove-series]").forEach((button) => {
      button.addEventListener("click", async () => {
        optionState.series = await deleteOption("series", button.dataset.removeSeries);
        renderOptions();
      });
    });

    methodChips.querySelectorAll("[data-remove-method]").forEach((button) => {
      button.addEventListener("click", async () => {
        optionState.methods = await deleteOption("methods", button.dataset.removeMethod);
        renderOptions();
      });
    });
  }

  function renderProducts() {
    const sorted = [...products].sort(sortProducts("release-desc"));
    adminCount.textContent = `${sorted.length} items`;
    adminList.innerHTML = sorted.length
      ? sorted.map(renderAdminItem).join("")
      : `
        <div class="empty-state empty-state--dark">
          <img class="empty-state__logo" src="微信图片_2026-03-20_220011_165.jpg" alt="MTAK logo">
          <h3>产品库为空</h3>
          <p>添加第一款产品后，这里会显示所有条目。</p>
        </div>
      `;

    adminList.querySelectorAll("[data-edit-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const product = products.find((item) => item.id === button.dataset.editId);
        if (product) {
          fillForm(product);
        }
      });
    });

    adminList.querySelectorAll("[data-delete-id]").forEach((button) => {
      button.addEventListener("click", async () => {
        await apiFetch(`/api/products/${button.dataset.deleteId}`, { method: "DELETE" });
        await reloadData();
      });
    });
  }

  function fillForm(product) {
    formTitle.textContent = `编辑产品: ${product.name}`;
    document.getElementById("productId").value = product.id;
    document.getElementById("nameInput").value = product.name;
    seriesInput.value = product.series;
    methodInput.value = product.method;
    document.getElementById("priceInput").value = product.price;
    document.getElementById("quantityInput").value = product.quantity;
    document.getElementById("releaseDateInput").value = product.releaseDate;
    document.getElementById("introInput").value = product.intro;
    isCollab = Boolean(product.isCollab);
    collabBrandInput.value = product.collabBrand || "";
    draftImage = "";
    syncCollabState();
    setImagePreview(product.image);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    form.reset();
    formTitle.textContent = "新增产品";
    document.getElementById("productId").value = "";
    draftImage = "";
    isCollab = false;
    syncCollabState();
    const imagePreview = document.getElementById("imagePreview");
    imagePreview.className = "image-preview image-preview--empty";
    imagePreview.innerHTML = "<span>上传后将在这里预览</span>";
  }

  async function reloadData() {
    const [sessionData, productsData, settingsData] = await Promise.all([
      apiFetch("/api/session"),
      apiFetch("/api/products"),
      apiFetch("/api/settings")
    ]);

    renderAuthState(sessionData.authenticated);
    credentialHint.textContent = settingsData.username;
    adminUserInput.value = settingsData.username;
    adminPasswordInput.value = "";
    products = productsData.products.map(normalizeProduct);
    optionState = {
      series: settingsData.series || [],
      methods: settingsData.methods || []
    };
    renderOptions();
    renderProducts();
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await apiFetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: document.getElementById("loginUsername").value.trim(),
          password: document.getElementById("loginPassword").value
        })
      });
      loginError.hidden = true;
      loginForm.reset();
      await reloadData();
    } catch (error) {
      loginError.hidden = false;
      loginError.textContent = error.message;
    }
  });

  logoutButton.addEventListener("click", async () => {
    await apiFetch("/api/logout", { method: "POST" });
    renderAuthState(false);
  });

  addSeriesButton.addEventListener("click", async () => {
    const name = newSeriesInput.value.trim();
    if (!name) {
      return;
    }
    optionState.series = await addOption("series", name);
    seriesInput.value = name;
    newSeriesInput.value = "";
    renderOptions();
  });

  addMethodButton.addEventListener("click", async () => {
    const name = newMethodInput.value.trim();
    if (!name) {
      return;
    }
    optionState.methods = await addOption("methods", name);
    methodInput.value = name;
    newMethodInput.value = "";
    renderOptions();
  });

  imageInput.addEventListener("change", async () => {
    const [file] = imageInput.files;
    if (!file) {
      return;
    }
    draftImage = file;
    setImagePreview(await fileToDataUrl(file));
  });

  isCollabInput.addEventListener("click", () => {
    isCollab = !isCollab;
    syncCollabState();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData();
    formData.append("name", document.getElementById("nameInput").value.trim());
    formData.append("series", seriesInput.value.trim());
    formData.append("method", methodInput.value.trim());
    formData.append("price", document.getElementById("priceInput").value);
    formData.append("quantity", document.getElementById("quantityInput").value);
    formData.append("releaseDate", document.getElementById("releaseDateInput").value);
    formData.append("intro", document.getElementById("introInput").value.trim());
    formData.append("isCollab", String(isCollab));
    formData.append("collabBrand", collabBrandInput.value.trim());
    if (draftImage) {
      formData.append("image", draftImage);
    }

    const productId = document.getElementById("productId").value;
    const url = productId ? `/api/products/${productId}` : "/api/products";
    const method = productId ? "PUT" : "POST";
    await apiFetch(url, { method, body: formData });
    resetForm();
    await reloadData();
  });

  cancelEditButton.addEventListener("click", resetForm);

  credentialForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = adminPasswordInput.value.trim();
    if (!password) {
      alert("请输入新的管理员密码。");
      return;
    }
      const response = await apiFetch("/api/settings/admin", {
        method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: adminUserInput.value.trim(),
        password
      })
    });
    credentialHint.textContent = response.username;
    adminPasswordInput.value = "";
  });

  syncCollabState();
  await reloadData();
}

async function fetchProducts() {
  const response = await apiFetch("/api/products");
  return response.products.map(normalizeProduct);
}

async function addOption(type, name) {
  const response = await apiFetch(`/api/options/${type}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  return response.items || [];
}

async function deleteOption(type, name) {
  const response = await apiFetch(`/api/options/${type}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  return response.items || [];
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options
  });
  const data = await response.json().catch(() => ({ ok: false, message: "服务器返回异常" }));
  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "请求失败");
  }
  return data;
}

function normalizeProduct(product) {
  return {
    ...product,
    isCollab: Boolean(product.isCollab),
    collabBrand: product.collabBrand || ""
  };
}

function renderProductCard(product) {
  const collabBadge = product.isCollab
    ? `<span class="pill pill--accent">联名 · ${escapeHtml(product.collabBrand || "特别合作")}</span>`
    : "";

  return `
    <article class="product-card">
      <div class="product-card__image">
        <img src="${product.image}" alt="${escapeHtml(product.name)}">
      </div>
      <div class="product-card__body">
        <p class="eyebrow">${escapeHtml(product.series)}</p>
        <div class="product-card__header">
          <div>
            <h3>${escapeHtml(product.name)}</h3>
          </div>
          <span class="price-tag">¥${formatPrice(product.price)}</span>
        </div>
        <div class="pill-row">
          <span class="pill">限量 ${product.quantity}</span>
          <span class="pill">${escapeHtml(product.method)}</span>
          ${collabBadge}
        </div>
        <p class="muted">${formatDate(product.releaseDate)}</p>
        <div class="product-card__footer">
          <span class="muted">${releaseStatus(product.releaseDate)}</span>
          <button class="link-button" type="button" data-view-id="${product.id}">查看详情</button>
        </div>
      </div>
    </article>
  `;
}

function renderAdminItem(product) {
  const collabMeta = product.isCollab
    ? `<span class="spec-chip spec-chip--accent">联名 · ${escapeHtml(product.collabBrand || "未填写品牌")}</span>`
    : "";

  return `
    <article class="admin-item">
      <div class="admin-item__thumb">
        <img src="${product.image}" alt="${escapeHtml(product.name)}">
      </div>
      <div class="admin-item__body">
        <div class="admin-item__header">
          <div>
            <p class="eyebrow">${escapeHtml(product.series)}</p>
            <h3>${escapeHtml(product.name)}</h3>
          </div>
          <strong class="price-tag">¥${formatPrice(product.price)}</strong>
        </div>
        <p class="muted">${formatDate(product.releaseDate)} · ${escapeHtml(product.method)}</p>
        <div class="admin-item__footer">
          <div class="spec-grid">
            <span class="spec-chip">限量 ${product.quantity}</span>
            <span class="spec-chip">${releaseStatus(product.releaseDate)}</span>
            ${collabMeta}
          </div>
          <div class="admin-item__actions">
            <button class="text-button" type="button" data-edit-id="${product.id}">编辑</button>
            <button class="text-button text-button--danger" type="button" data-delete-id="${product.id}">删除</button>
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderChip(label, type) {
  const attr = type === "series" ? "data-remove-series" : "data-remove-method";
  return `
    <span class="manage-chip">
      <span>${escapeHtml(label)}</span>
      <button type="button" ${attr}="${escapeHtml(label)}">×</button>
    </span>
  `;
}

function openDialog(dialog, product) {
  const collabChip = product.isCollab
    ? `<span class="spec-chip spec-chip--accent">联名 · ${escapeHtml(product.collabBrand || "特别合作")}</span>`
    : "";
  document.getElementById("dialogImage").src = product.image;
  document.getElementById("dialogImage").alt = product.name;
  document.getElementById("dialogSeries").textContent = product.series;
  document.getElementById("dialogName").textContent = product.name;
  document.getElementById("dialogIntro").textContent = product.intro;
  document.getElementById("dialogSpecs").innerHTML = `
    <span class="spec-chip">¥${formatPrice(product.price)}</span>
    <span class="spec-chip">限量 ${product.quantity}</span>
    <span class="spec-chip">${escapeHtml(product.method)}</span>
    ${collabChip}
    <span class="spec-chip">${formatDate(product.releaseDate)}</span>
    <span class="spec-chip">${releaseStatus(product.releaseDate)}</span>
  `;
  dialog.showModal();
}

function setImagePreview(src) {
  const imagePreview = document.getElementById("imagePreview");
  imagePreview.className = "image-preview";
  imagePreview.innerHTML = `<img src="${src}" alt="产品图片预览">`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function sortProducts(mode) {
  return (a, b) => {
    switch (mode) {
      case "release-asc":
        return new Date(a.releaseDate) - new Date(b.releaseDate);
      case "price-desc":
        return b.price - a.price;
      case "price-asc":
        return a.price - b.price;
      case "release-desc":
      default:
        return new Date(b.releaseDate) - new Date(a.releaseDate);
    }
  };
}

function releaseStatus(dateString) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateString);
  return date >= today ? "即将发售" : "已发售";
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

function formatPrice(value) {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value);
}

function uniqueCleanList(values) {
  return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))];
}

function createPlaceholder(title) {
  const safeTitle = escapeXml(title || "MTAK");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200">
      <rect width="1200" height="1200" fill="#070707"/>
      <rect x="64" y="60" width="400" height="72" rx="36" fill="#020203" stroke="#3f95ff" stroke-opacity="0.5"/>
      <path d="M120 79L144 121H130L120 100L110 121H96L120 79Z" fill="#3f95ff"/>
      <text x="88" y="220" fill="white" font-family="Arial, sans-serif" font-size="42" letter-spacing="10">MTAK</text>
      <text x="88" y="320" fill="white" font-family="Arial, sans-serif" font-size="88" font-weight="700">${safeTitle}</text>
      <text x="88" y="1110" fill="#3f95ff" font-family="Arial, sans-serif" font-size="28" letter-spacing="6">MORE THAN A KNUCKLE</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeXml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
