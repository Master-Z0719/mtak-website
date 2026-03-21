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
  const heroCarouselImage = document.getElementById("heroCarouselImage");
  const heroCarouselTitle = document.getElementById("heroCarouselTitle");
  const heroCarouselMeta = document.getElementById("heroCarouselMeta");
  const seriesFilter = document.getElementById("seriesFilter");
  const collabFilter = document.getElementById("collabFilter");
  const collabSearch = document.getElementById("collabSearch");
  const sortFilter = document.getElementById("sortFilter");
  const resetArchiveButton = document.getElementById("resetArchiveButton");
  const statusResetButton = document.getElementById("statusResetButton");
  const archiveRailSummary = document.getElementById("archiveRailSummary");
  const statusMode = document.getElementById("statusMode");
  const statusLens = document.getElementById("statusLens");
  const statusCount = document.getElementById("statusCount");
  const signalViewButton = document.getElementById("signalViewButton");
  const gridViewButton = document.getElementById("gridViewButton");
  const signalArchiveSection = document.getElementById("signalArchiveSection");
  const gridSection = document.getElementById("gridSection");
  const archiveStage = document.getElementById("archiveStage");
  const archiveLensStatus = document.getElementById("archiveLensStatus");
  const recordPanel = document.getElementById("recordPanel");
  const recordPanelEmpty = document.getElementById("recordPanelEmpty");
  const recordPanelContent = document.getElementById("recordPanelContent");
  const recordPanelImage = document.getElementById("recordPanelImage");
  const recordPanelSeries = document.getElementById("recordPanelSeries");
  const recordPanelName = document.getElementById("recordPanelName");
  const recordPanelArchiveId = document.getElementById("recordPanelArchiveId");
  const recordPanelSpecs = document.getElementById("recordPanelSpecs");
  const recordPanelIntro = document.getElementById("recordPanelIntro");
  const recordPanelRelations = document.getElementById("recordPanelRelations");
  const recordOpenDialog = document.getElementById("recordOpenDialog");
  const grid = document.getElementById("productGrid");
  const count = document.getElementById("productCount");
  const emptyState = document.getElementById("emptyState");
  const dialog = document.getElementById("productDialog");
  const closeDialog = document.getElementById("closeDialog");

  let products = [];
  let filteredProducts = [];
  let archiveGroups = [];
  let activeRecordId = "";
  let currentView = "signal";
  let archivePageState = {};
  let heroCarouselIndex = 0;
  let heroCarouselTimer = 0;
  let currentFilters = {
    series: "All series",
    collab: "all",
    keyword: "",
    sort: "release-desc"
  };

  const setView = (view) => {
    currentView = view;
    const signalActive = view === "signal";
    signalViewButton.classList.toggle("is-active", signalActive);
    gridViewButton.classList.toggle("is-active", !signalActive);
    signalViewButton.setAttribute("aria-selected", String(signalActive));
    gridViewButton.setAttribute("aria-selected", String(!signalActive));
    signalArchiveSection.hidden = !signalActive;
    gridSection.hidden = signalActive;
    statusMode.textContent = signalActive ? "Signal View" : "Grid View";
  };

  const render = () => {
    const series = uniqueCleanList(products.map((item) => item.series));
    const options = ["All series", ...series];
    const currentSeries = seriesFilter.value || "All series";
    seriesFilter.innerHTML = options.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
    seriesFilter.value = options.includes(currentSeries) ? currentSeries : "All series";

    currentFilters = {
      series: seriesFilter.value,
      collab: collabFilter.value,
      keyword: collabSearch.value.trim().toLowerCase(),
      sort: sortFilter.value
    };
    filteredProducts = getFilteredProducts(products, currentFilters).sort(sortProducts(currentFilters.sort));
    const filteredIds = new Set(filteredProducts.map((item) => item.id));

    if (!filteredIds.has(activeRecordId)) {
      activeRecordId = filteredProducts[0]?.id || "";
    }

    archiveGroups = buildArchiveGroups(filteredProducts, currentFilters);
    archiveGroups.forEach((group) => {
      const maxPage = Math.max(Math.ceil(group.items.length / 6) - 1, 0);
      archivePageState[group.key] = Math.min(archivePageState[group.key] || 0, maxPage);
    });
    count.textContent = `${filteredProducts.length} ${filteredProducts.length === 1 ? "record" : "records"}`;
    emptyState.hidden = filteredProducts.length > 0;
    grid.innerHTML = filteredProducts.map(renderProductCard).join("");
    archiveLensStatus.textContent = buildLensStatus(filteredProducts.length, products.length, currentFilters);
    archiveRailSummary.textContent = `${archiveGroups.length} ${archiveGroups.length === 1 ? "active rail" : "active rails"}`;
    statusLens.textContent = buildStatusLens(currentFilters);
    statusCount.textContent = String(filteredProducts.length);
    renderArchiveRails(currentFilters);
    renderRecordPanel();

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
  signalViewButton.addEventListener("click", () => setView("signal"));
  gridViewButton.addEventListener("click", () => setView("grid"));
  resetArchiveButton.addEventListener("click", () => {
    resetArchiveFilters();
    render();
  });
  statusResetButton.addEventListener("click", () => {
    resetArchiveFilters();
    render();
  });
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
  recordOpenDialog.addEventListener("click", () => {
    const record = filteredProducts.find((item) => item.id === activeRecordId);
    if (record) {
      openDialog(dialog, record);
    }
  });

  products = await fetchProducts();
  activeRecordId = products[0]?.id || "";
  startHeroCarousel();
  setView("signal");
  render();

  function resetArchiveFilters() {
    seriesFilter.value = "All series";
    collabFilter.value = "all";
    collabSearch.value = "";
    sortFilter.value = "release-desc";
  }

  function renderArchiveRails(filters) {
    if (!filteredProducts.length) {
      archiveStage.innerHTML = `
        <div class="archive-empty">
          <h3>No archived records</h3>
          <p>Adjust the active lens or add products from the admin panel to populate the archive rails.</p>
        </div>
      `;
      return;
    }

    const selectedRelations = getRelatedSignals(getActiveRecord() || filteredProducts[0], filteredProducts, new Set(filteredProducts.map((item) => item.id)))
      .slice(0, 3)
      .map((item) => item.id);
    const relatedIds = new Set(selectedRelations);

    archiveStage.innerHTML = archiveGroups
      .map((group) => renderArchiveRail(group, activeRecordId, relatedIds, archivePageState[group.key] || 0))
      .join("");

    archiveStage.querySelectorAll("[data-record-id]").forEach((button) => {
      const product = filteredProducts.find((item) => item.id === button.dataset.recordId);
      if (!product) {
        return;
      }

      button.addEventListener("mouseenter", () => {
        activeRecordId = product.id;
        renderArchiveRails(filters);
        renderRecordPanel();
      });
      button.addEventListener("focus", () => {
        activeRecordId = product.id;
        renderArchiveRails(filters);
        renderRecordPanel();
      });
      button.addEventListener("click", () => {
        activeRecordId = product.id;
        renderArchiveRails(currentFilters);
        renderRecordPanel();
      });
    });

    archiveStage.querySelectorAll("[data-rail-page]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.railKey;
        const direction = Number(button.dataset.railPage || 0);
        const group = archiveGroups.find((item) => item.key === key);
        if (!group) {
          return;
        }
        const maxPage = Math.max(Math.ceil(group.items.length / 6) - 1, 0);
        const nextPage = Math.min(Math.max((archivePageState[key] || 0) + direction, 0), maxPage);
        archivePageState[key] = nextPage;
        renderArchiveRails(currentFilters);
      });
    });
  }

  function renderRecordPanel() {
    const product = getActiveRecord();
    recordPanel.classList.toggle("has-record", Boolean(product));
    recordPanelEmpty.hidden = Boolean(product);
    recordPanelContent.hidden = !product;

    if (!product) {
      return;
    }

    const related = getRelatedSignals(product, filteredProducts, new Set(filteredProducts.map((item) => item.id))).slice(0, 3);
    recordPanelImage.src = product.image;
    recordPanelImage.alt = product.name;
    recordPanelSeries.textContent = product.series || "Archived Product";
    recordPanelName.textContent = product.name;
    recordPanelArchiveId.textContent = buildArchiveId(product);
    recordPanelIntro.textContent = product.intro || "No archive note recorded. Core metadata remains available for this product.";
    recordPanelSpecs.innerHTML = `
      <span class="spec-chip">${getTypeLabel(product)}</span>
      <span class="spec-chip">${formatDate(product.releaseDate)}</span>
      <span class="spec-chip">${escapeHtml(normalizeMethodLabel(product.method))}</span>
      <span class="spec-chip">${getPriceDisplay(product)}</span>
      <span class="spec-chip">Qty ${product.quantity}</span>
      ${product.isCollab ? `<span class="spec-chip spec-chip--accent">Collab · ${escapeHtml(product.collabBrand || "Special Project")}</span>` : ""}
    `;
    recordPanelRelations.innerHTML = `
      <p class="record-relations__title">Related Signals</p>
      <div class="record-relations__list">
        ${
          related.length
            ? related
                .map(
                  (item) => `
                    <button class="record-link" type="button" data-related-id="${item.id}">
                      <span>${escapeHtml(item.name)}</span>
                      <small>${escapeHtml(item.reason)}</small>
                    </button>
                  `
                )
                .join("")
            : `<p class="muted">No strong related signals detected from the current metadata lens.</p>`
        }
      </div>
    `;
    recordPanelRelations.querySelectorAll("[data-related-id]").forEach((button) => {
      button.addEventListener("click", () => {
        activeRecordId = button.dataset.relatedId;
        renderArchiveRails(currentFilters);
        renderRecordPanel();
      });
    });
  }

  function getActiveRecord() {
    return filteredProducts.find((item) => item.id === activeRecordId) || filteredProducts[0] || null;
  }

  function startHeroCarousel() {
    if (!products.length) {
      return;
    }
    updateHeroCarousel();
    if (heroCarouselTimer) {
      clearInterval(heroCarouselTimer);
    }
    heroCarouselTimer = window.setInterval(() => {
      heroCarouselIndex = (heroCarouselIndex + 1) % products.length;
      updateHeroCarousel();
    }, 3600);
  }

  function updateHeroCarousel() {
    const product = products[heroCarouselIndex];
    if (!product) {
      return;
    }
    heroCarouselImage.classList.remove("is-visible");
    window.setTimeout(() => {
      heroCarouselImage.src = product.image;
      heroCarouselImage.alt = product.name;
      heroCarouselTitle.textContent = product.name;
      heroCarouselMeta.textContent = `${product.series || "Archive"} / ${formatArchiveDate(product.releaseDate)} / ${getShortTypeLabel(product)}`;
      heroCarouselImage.classList.add("is-visible");
    }, 180);
  }
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
  const priceInput = document.getElementById("priceInput");
  const priceHelp = document.getElementById("priceHelp");
  const introInput = document.getElementById("introInput");
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

  function syncMethodState() {
    const hiddenAuction = isHiddenAuction(methodInput.value);
    priceInput.required = !hiddenAuction;
    priceInput.disabled = hiddenAuction;
    priceInput.closest(".field").classList.toggle("field--disabled", hiddenAuction);
    priceHelp.textContent = hiddenAuction
      ? "Hidden Auction selected. Price is not required and will display as Unknown."
      : "Required for standard release methods.";
    if (hiddenAuction) {
      priceInput.value = "";
    }
  }

  function renderOptions() {
    seriesOptions.innerHTML = optionState.series.map((item) => `<option value="${escapeHtml(item)}"></option>`).join("");
    methodOptions.innerHTML = optionState.methods.map((item) => `<option value="${escapeHtml(item)}"></option>`).join("");

    seriesChips.innerHTML = optionState.series.length
      ? optionState.series.map((item) => renderChip(item, "series")).join("")
      : `<p class="muted">No series yet. Add your first one here.</p>`;

    methodChips.innerHTML = optionState.methods.length
      ? optionState.methods.map((item) => renderChip(item, "method")).join("")
      : `<p class="muted">No release methods yet. Add your first one here.</p>`;

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
          <h3>No products saved</h3>
          <p>Add the first product and it will appear here.</p>
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
    formTitle.textContent = `Edit Product: ${product.name}`;
    document.getElementById("productId").value = product.id;
    document.getElementById("nameInput").value = product.name;
    seriesInput.value = product.series;
    methodInput.value = normalizeMethodLabel(product.method);
    priceInput.value = isHiddenAuction(product.method) ? "" : product.price;
    document.getElementById("quantityInput").value = product.quantity;
    document.getElementById("releaseDateInput").value = product.releaseDate;
    introInput.value = product.intro || "";
    isCollab = Boolean(product.isCollab);
    collabBrandInput.value = product.collabBrand || "";
    draftImage = "";
    syncCollabState();
    syncMethodState();
    setImagePreview(product.image);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    form.reset();
    formTitle.textContent = "Add Product";
    document.getElementById("productId").value = "";
    draftImage = "";
    isCollab = false;
    syncCollabState();
    syncMethodState();
    const imagePreview = document.getElementById("imagePreview");
    imagePreview.className = "image-preview image-preview--empty";
    imagePreview.innerHTML = "<span>Image preview will appear here after upload.</span>";
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
    syncMethodState();
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

  methodInput.addEventListener("input", syncMethodState);
  methodInput.addEventListener("change", syncMethodState);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const hiddenAuction = isHiddenAuction(methodInput.value);
    const formData = new FormData();
    formData.append("name", document.getElementById("nameInput").value.trim());
    formData.append("series", seriesInput.value.trim());
    formData.append("method", methodInput.value.trim());
    formData.append("price", hiddenAuction ? "" : priceInput.value);
    formData.append("quantity", document.getElementById("quantityInput").value);
    formData.append("releaseDate", document.getElementById("releaseDateInput").value);
    formData.append("intro", introInput.value.trim());
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
      alert("Please enter a new admin password.");
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
  syncMethodState();
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
  const data = await response.json().catch(() => ({ ok: false, message: "The server returned an invalid response." }));
  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "Request failed.");
  }
  return data;
}

function normalizeProduct(product) {
  return {
    ...product,
    isCollab: Boolean(product.isCollab),
    collabBrand: product.collabBrand || "",
    intro: product.intro || "",
    method: normalizeMethodLabel(product.method || "")
  };
}

function getFilteredProducts(products, filters) {
  return products
    .filter((item) => filters.series === "All series" || item.series === filters.series)
    .filter((item) => {
      if (filters.collab === "collab") {
        return item.isCollab;
      }
      if (filters.collab === "regular") {
        return !item.isCollab;
      }
      return true;
    })
    .filter((item) => {
      if (!filters.keyword) {
        return true;
      }
      return item.isCollab && item.collabBrand.toLowerCase().includes(filters.keyword);
    });
}

function buildArchiveGroups(products, filters) {
  const groups = new Map();
  products.forEach((product) => {
    const group = getArchiveGroup(product, filters);
    if (!groups.has(group.key)) {
      groups.set(group.key, {
        key: group.key,
        title: group.title,
        note: group.note,
        items: []
      });
    }
    groups.get(group.key).items.push(product);
  });

  return [...groups.values()];
}

function getArchiveGroup(product, filters) {
  if (filters.series !== "All series") {
    const year = (product.releaseDate || "").slice(0, 4) || "Undated";
    return {
      key: `year-${year}`,
      title: `${year} Release Index`,
      note: `Series focus / ${product.series || "Unclassified"}`
    };
  }

  if (filters.collab === "collab") {
    const brand = product.collabBrand || "Collab Signals";
    return {
      key: `brand-${brand}`,
      title: brand,
      note: "Collaboration archive rail"
    };
  }

  if (filters.collab === "regular") {
    return {
      key: `series-${product.series || "Core"}`,
      title: product.series || "Core Releases",
      note: "Core release archive rail"
    };
  }

  return {
    key: `series-${product.series || "Archive"}`,
    title: product.series || "Archive",
    note: product.isCollab ? "Includes collaboration signals" : "Core release sequence"
  };
}

function renderArchiveRail(group, activeRecordId, relatedIds, page) {
  const pageSize = 6;
  const maxPage = Math.max(Math.ceil(group.items.length / pageSize) - 1, 0);
  const currentPage = Math.min(page, maxPage);
  const start = currentPage * pageSize;
  const visibleItems = group.items.slice(start, start + pageSize);
  return `
    <section class="archive-rail">
      <div class="archive-rail__meta">
        <div>
          <h3>${escapeHtml(group.title)}</h3>
          <p>${escapeHtml(group.note)}</p>
        </div>
        <div class="archive-rail__controls">
          <span class="archive-rail__count">${group.items.length} ${group.items.length === 1 ? "record" : "records"}</span>
          ${
            maxPage > 0
              ? `
                <div class="archive-rail__pager">
                  <button class="archive-rail__pager-button" type="button" data-rail-key="${escapeHtml(group.key)}" data-rail-page="-1" ${currentPage === 0 ? "disabled" : ""}>Prev</button>
                  <span class="archive-rail__page">${currentPage + 1}/${maxPage + 1}</span>
                  <button class="archive-rail__pager-button" type="button" data-rail-key="${escapeHtml(group.key)}" data-rail-page="1" ${currentPage >= maxPage ? "disabled" : ""}>Next</button>
                </div>
              `
              : ""
          }
        </div>
      </div>
      <div class="archive-rail__track">
        ${visibleItems.map((product) => renderArchiveCapsule(product, product.id === activeRecordId, relatedIds.has(product.id))).join("")}
      </div>
    </section>
  `;
}

function renderArchiveCapsule(product, isSelected, isRelated) {
  const classes = [
    "record-capsule",
    isSelected ? "is-selected" : "",
    isRelated ? "is-related" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <button class="${classes}" type="button" data-record-id="${product.id}">
      <div class="record-capsule__media">
        <img src="${product.image}" alt="${escapeHtml(product.name)}">
      </div>
      <div class="record-capsule__body">
        <p class="record-capsule__id">${escapeHtml(buildArchiveId(product))}</p>
        <h4>${escapeHtml(product.name)}</h4>
        <div class="record-capsule__meta">
          <span>${escapeHtml(product.series || "Archive")}</span>
          <span>${formatArchiveDate(product.releaseDate)}</span>
        </div>
        <div class="record-capsule__footer">
          <span class="record-capsule__type">${escapeHtml(getShortTypeLabel(product))}</span>
          <span class="record-capsule__method">${escapeHtml(normalizeMethodLabel(product.method))}</span>
        </div>
      </div>
    </button>
  `;
}

function buildLensStatus(matchCount, totalCount, filters) {
  const parts = [];
  if (filters.series !== "All series") {
    parts.push(`Series lens: ${filters.series}`);
  }
  if (filters.collab === "collab") {
    parts.push("Type lens: Collaboration");
  }
  if (filters.collab === "regular") {
    parts.push("Type lens: Standard");
  }
  if (filters.keyword) {
    parts.push(`Brand lens: ${filters.keyword}`);
  }
  return parts.length
    ? `${parts.join(" / ")} / ${matchCount}/${totalCount} records active`
    : `All records online / ${totalCount} signals available`;
}

function buildStatusLens(filters) {
  const parts = [];
  if (filters.series !== "All series") {
    parts.push(filters.series);
  }
  if (filters.collab === "collab") {
    parts.push("Collab");
  }
  if (filters.collab === "regular") {
    parts.push("Regular");
  }
  if (filters.keyword) {
    parts.push(filters.keyword);
  }
  return parts.length ? parts.join(" / ") : "All Records";
}

function buildArchiveId(product) {
  const year = (product.releaseDate || "").slice(0, 4) || "0000";
  const seriesCode = getInitials(product.series || "SIG").slice(0, 3).padEnd(3, "X");
  const token = String(product.id || "").slice(0, 4).toUpperCase();
  return `MTAK-${year}-${seriesCode}-${token}`;
}

function getTypeLabel(product) {
  return product.isCollab ? "Collaboration Signal" : "Core Release Signal";
}

function getShortTypeLabel(product) {
  return product.isCollab ? "Collab" : "Core";
}

function getRelatedSignals(product, products, filteredIds) {
  return products
    .filter((item) => item.id !== product.id)
    .map((item) => {
      let score = 0;
      let reason = "Temporal adjacency";

      if (product.series && item.series === product.series) {
        score += 4;
        reason = `Shared series: ${product.series}`;
      }
      if (product.isCollab && item.isCollab && product.collabBrand && item.collabBrand === product.collabBrand) {
        score += 3;
        reason = `Shared collab brand: ${product.collabBrand}`;
      }
      if (normalizeMethodLabel(product.method) === normalizeMethodLabel(item.method)) {
        score += 2;
        reason = `Shared release method: ${normalizeMethodLabel(product.method)}`;
      }
      if (getTypeLabel(product) === getTypeLabel(item)) {
        score += 1;
      }

      const daysApart = Math.abs(new Date(product.releaseDate) - new Date(item.releaseDate)) / (1000 * 60 * 60 * 24);
      if (daysApart <= 180) {
        score += 1;
      }

      return {
        id: item.id,
        name: item.name,
        score,
        reason,
        isMatch: filteredIds.has(item.id)
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function formatArchiveDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short"
  }).format(date);
}

function getInitials(value) {
  return String(value)
    .split(/\s+/)
    .map((item) => item[0] || "")
    .join("")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();
}

function renderProductCard(product) {
  const collabBadge = product.isCollab
    ? `<span class="pill pill--accent">Collab · ${escapeHtml(product.collabBrand || "Special Project")}</span>`
    : "";
  const methodClass = isHiddenAuction(product.method) ? "pill pill--alert" : "pill";

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
          <span class="price-tag">${getPriceDisplay(product)}</span>
        </div>
        <div class="pill-row">
          <span class="pill">Qty ${product.quantity}</span>
          <span class="${methodClass}">${escapeHtml(normalizeMethodLabel(product.method))}</span>
          ${collabBadge}
        </div>
        <p class="muted">${formatDate(product.releaseDate)}</p>
        <div class="product-card__footer">
          <span class="muted">${releaseStatus(product.releaseDate)}</span>
          <button class="link-button" type="button" data-view-id="${product.id}">View Details</button>
        </div>
      </div>
    </article>
  `;
}

function renderAdminItem(product) {
  const collabMeta = product.isCollab
    ? `<span class="spec-chip spec-chip--accent">Collab · ${escapeHtml(product.collabBrand || "Special Project")}</span>`
    : "";
  const methodClass = isHiddenAuction(product.method) ? "spec-chip spec-chip--alert" : "spec-chip";

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
          <strong class="price-tag">${getPriceDisplay(product)}</strong>
        </div>
        <p class="muted">${formatDate(product.releaseDate)} · ${escapeHtml(normalizeMethodLabel(product.method))}</p>
        <div class="admin-item__footer">
          <div class="spec-grid">
            <span class="spec-chip">Qty ${product.quantity}</span>
            <span class="${methodClass}">${escapeHtml(normalizeMethodLabel(product.method))}</span>
            <span class="spec-chip">${releaseStatus(product.releaseDate)}</span>
            ${collabMeta}
          </div>
          <div class="admin-item__actions">
            <button class="text-button" type="button" data-edit-id="${product.id}">Edit</button>
            <button class="text-button text-button--danger" type="button" data-delete-id="${product.id}">Delete</button>
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
    ? `<span class="spec-chip spec-chip--accent">Collab · ${escapeHtml(product.collabBrand || "Special Project")}</span>`
    : "";
  const methodClass = isHiddenAuction(product.method) ? "spec-chip spec-chip--alert" : "spec-chip";

  document.getElementById("dialogImage").src = product.image;
  document.getElementById("dialogImage").alt = product.name;
  document.getElementById("dialogSeries").textContent = product.series;
  document.getElementById("dialogName").textContent = product.name;
  document.getElementById("dialogIntro").textContent = product.intro || "No product notes available.";
  document.getElementById("dialogSpecs").innerHTML = `
    <span class="spec-chip">${getPriceDisplay(product)}</span>
    <span class="spec-chip">Qty ${product.quantity}</span>
    <span class="${methodClass}">${escapeHtml(normalizeMethodLabel(product.method))}</span>
    ${collabChip}
    <span class="spec-chip">${formatDate(product.releaseDate)}</span>
    <span class="spec-chip">${releaseStatus(product.releaseDate)}</span>
  `;
  dialog.showModal();
}

function setImagePreview(src) {
  const imagePreview = document.getElementById("imagePreview");
  imagePreview.className = "image-preview";
  imagePreview.innerHTML = `<img src="${src}" alt="Product image preview">`;
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
        return hiddenAuctionSortValue(b) - hiddenAuctionSortValue(a);
      case "price-asc":
        return hiddenAuctionSortValue(a) - hiddenAuctionSortValue(b);
      case "release-desc":
      default:
        return new Date(b.releaseDate) - new Date(a.releaseDate);
    }
  };
}

function hiddenAuctionSortValue(product) {
  return isHiddenAuction(product.method) ? Number.POSITIVE_INFINITY : Number(product.price || 0);
}

function releaseStatus(dateString) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateString);
  return date >= today ? "Upcoming" : "Released";
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

function formatPrice(value) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value);
}

function isHiddenAuction(method) {
  const normalized = String(method || "").trim().toLowerCase();
  return normalized === "暗拍" || normalized === "hidden auction";
}

function normalizeMethodLabel(method) {
  return isHiddenAuction(method) ? "Hidden Auction" : String(method || "").trim();
}

function getPriceDisplay(product) {
  if (isHiddenAuction(product.method)) {
    return "Unknown";
  }
  return `¥${formatPrice(product.price)}`;
}

function uniqueCleanList(values) {
  return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))];
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
