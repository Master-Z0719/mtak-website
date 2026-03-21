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
  const signalViewButton = document.getElementById("signalViewButton");
  const gridViewButton = document.getElementById("gridViewButton");
  const signalArchiveSection = document.getElementById("signalArchiveSection");
  const gridSection = document.getElementById("gridSection");
  const archiveStage = document.getElementById("archiveStage");
  const archiveConnections = document.getElementById("archiveConnections");
  const archiveHovercard = document.getElementById("archiveHovercard");
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
  let archiveRecords = [];
  let activeRecordId = "";

  const setView = (view) => {
    const signalActive = view === "signal";
    signalViewButton.classList.toggle("is-active", signalActive);
    gridViewButton.classList.toggle("is-active", !signalActive);
    signalViewButton.setAttribute("aria-selected", String(signalActive));
    gridViewButton.setAttribute("aria-selected", String(!signalActive));
    signalArchiveSection.hidden = !signalActive;
    gridSection.hidden = signalActive;
    hideArchiveHovercard();
  };

  const render = () => {
    const series = uniqueCleanList(products.map((item) => item.series));
    const options = ["All series", ...series];
    const currentSeries = seriesFilter.value || "All series";
    seriesFilter.innerHTML = options.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
    seriesFilter.value = options.includes(currentSeries) ? currentSeries : "All series";

    const filters = {
      series: seriesFilter.value,
      collab: collabFilter.value,
      keyword: collabSearch.value.trim().toLowerCase(),
      sort: sortFilter.value
    };
    const filtered = getFilteredProducts(products, filters).sort(sortProducts(filters.sort));
    const filteredIds = new Set(filtered.map((item) => item.id));

    if (!filteredIds.has(activeRecordId)) {
      activeRecordId = filtered[0]?.id || "";
    }

    archiveRecords = buildArchiveRecords(products, filteredIds, filters);
    count.textContent = `${filtered.length} ${filtered.length === 1 ? "record" : "records"}`;
    emptyState.hidden = filtered.length > 0;
    grid.innerHTML = filtered.map(renderProductCard).join("");
    archiveLensStatus.textContent = buildLensStatus(filtered.length, products.length, filters);
    renderArchiveField();
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
    const record = archiveRecords.find((item) => item.id === activeRecordId);
    if (record) {
      openDialog(dialog, record.product);
    }
  });

  products = await fetchProducts();
  activeRecordId = products[0]?.id || "";
  setView("signal");
  render();

  function renderArchiveField() {
    if (!archiveRecords.length) {
      archiveStage.innerHTML = `
        <div class="archive-empty">
          <h3>No active signals</h3>
          <p>The archive field will populate automatically when products are added.</p>
        </div>
      `;
      archiveConnections.innerHTML = "";
      archiveStage.style.removeProperty("--stage-height");
      hideArchiveHovercard();
      return;
    }

    const selectedRecord = archiveRecords.find((item) => item.id === activeRecordId) || null;
    const relatedIds = new Set(selectedRecord ? selectedRecord.related.map((item) => item.id) : []);
    const stageHeight = Math.max(460, archiveRecords.reduce((max, item) => Math.max(max, item.y * 5.1 + 96), 0));
    archiveStage.style.setProperty("--stage-height", `${stageHeight}px`);
    archiveStage.innerHTML = archiveRecords
      .map((record) => renderArchiveNode(record, record.id === activeRecordId, relatedIds.has(record.id)))
      .join("");

    const buttons = archiveStage.querySelectorAll("[data-record-id]");
    buttons.forEach((button) => {
      const record = archiveRecords.find((item) => item.id === button.dataset.recordId);
      if (!record) {
        return;
      }

      button.addEventListener("mouseenter", () => showArchiveHovercard(record, button));
      button.addEventListener("mousemove", () => positionArchiveHovercard(button));
      button.addEventListener("mouseleave", hideArchiveHovercard);
      button.addEventListener("focus", () => showArchiveHovercard(record, button));
      button.addEventListener("blur", hideArchiveHovercard);
      button.addEventListener("click", () => {
        activeRecordId = record.id;
        renderArchiveField();
        renderRecordPanel();
      });
    });

    archiveConnections.setAttribute("viewBox", "0 0 100 100");
    archiveConnections.innerHTML = selectedRecord
      ? selectedRecord.related
          .map((related) => {
            const dimmedClass = related.isMatch ? "" : ' class="is-dim"';
            return `<line${dimmedClass} x1="${selectedRecord.x}" y1="${selectedRecord.y}" x2="${related.x}" y2="${related.y}"></line>`;
          })
          .join("")
      : "";
  }

  function renderRecordPanel() {
    const record = archiveRecords.find((item) => item.id === activeRecordId);
    recordPanel.classList.toggle("has-record", Boolean(record));
    recordPanelEmpty.hidden = Boolean(record);
    recordPanelContent.hidden = !record;

    if (!record) {
      return;
    }

    const product = record.product;
    recordPanelImage.src = product.image;
    recordPanelImage.alt = product.name;
    recordPanelSeries.textContent = product.series || "Archived Product";
    recordPanelName.textContent = product.name;
    recordPanelArchiveId.textContent = record.archiveId;
    recordPanelIntro.textContent = product.intro || "No archive note recorded. Core metadata remains available for this product.";
    recordPanelSpecs.innerHTML = `
      <span class="spec-chip">${record.typeLabel}</span>
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
          record.related.length
            ? record.related
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
        renderArchiveField();
        renderRecordPanel();
      });
    });
  }

  function showArchiveHovercard(record, anchor) {
    archiveHovercard.hidden = false;
    archiveHovercard.innerHTML = renderArchiveHovercard(record);
    positionArchiveHovercard(anchor);
  }

  function positionArchiveHovercard(anchor) {
    if (archiveHovercard.hidden) {
      return;
    }
    const stageRect = archiveStage.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const offsetX = anchorRect.left - stageRect.left + anchorRect.width / 2;
    const offsetY = anchorRect.top - stageRect.top;
    const cardWidth = 250;
    const x = clamp(offsetX - cardWidth / 2, 12, stageRect.width - cardWidth - 12);
    const y = Math.max(offsetY - 148, 12);
    archiveHovercard.style.left = `${x}px`;
    archiveHovercard.style.top = `${y}px`;
  }

  function hideArchiveHovercard() {
    archiveHovercard.hidden = true;
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

function buildArchiveRecords(products, filteredIds, filters) {
  const sorted = [...products].sort(sortProducts("release-desc"));
  const groupKeys = uniqueCleanList(sorted.map((item) => getArchiveGroupKey(item, filters)));
  const groupTrackers = new Map();
  const columns = Math.min(Math.max(groupKeys.length, 1), 3);

  const records = sorted.map((product, index) => {
    const groupKey = getArchiveGroupKey(product, filters);
    const groupIndex = Math.max(groupKeys.indexOf(groupKey), 0);
    const positionIndex = groupTrackers.get(groupKey) || 0;
    groupTrackers.set(groupKey, positionIndex + 1);

    const column = groupIndex % columns;
    const rowBand = Math.floor(groupIndex / columns);
    const baseX = columns === 1 ? 50 : 18 + column * (64 / (columns - 1));
    const baseY = 18 + rowBand * 30 + positionIndex * 14.5;
    const jitterSeed = hashString(`${product.id}-${groupKey}`);
    const x = clamp(baseX + ((jitterSeed % 9) - 4), 8, 92);
    const y = clamp(baseY + ((Math.floor(jitterSeed / 10) % 7) - 3), 12, 90);
    const archiveId = buildArchiveId(product);
    const related = getRelatedSignals(product, sorted, filteredIds)
      .slice(0, 4)
      .map((item) => ({
        ...item,
        x: 0,
        y: 0
      }));

    return {
      id: product.id,
      product,
      archiveId,
      typeLabel: getTypeLabel(product),
      groupKey,
      isMatch: filteredIds.has(product.id),
      x,
      y,
      size: 1 + (index % 3) * 0.18,
      related
    };
  });

  const recordMap = new Map(records.map((item) => [item.id, item]));
  records.forEach((record) => {
    record.related = record.related.map((item) => {
      const relatedRecord = recordMap.get(item.id);
      return {
        ...item,
        x: relatedRecord?.x || 0,
        y: relatedRecord?.y || 0
      };
    });
  });

  return records;
}

function renderArchiveNode(record, isSelected, isRelated) {
  const classes = [
    "signal-node",
    record.isMatch ? "is-match" : "is-dim",
    isSelected ? "is-selected" : "",
    isRelated ? "is-related" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <button
      class="${classes}"
      type="button"
      data-record-id="${record.id}"
      style="--x:${record.x}%; --y:${record.y}%; --size:${record.size};"
      aria-label="${escapeHtml(record.product.name)}"
    >
      <span class="signal-node__core"></span>
      <span class="signal-node__ring"></span>
      <span class="signal-node__label">${escapeHtml(record.archiveId)}</span>
    </button>
  `;
}

function renderArchiveHovercard(record) {
  return `
    <div class="archive-hovercard__media">
      <img src="${record.product.image}" alt="${escapeHtml(record.product.name)}">
    </div>
    <div class="archive-hovercard__body">
      <p class="eyebrow">${escapeHtml(record.product.series || "Signal Record")}</p>
      <h3>${escapeHtml(record.product.name)}</h3>
      <p class="archive-hovercard__id">${escapeHtml(record.archiveId)}</p>
      <div class="archive-hovercard__meta">
        <span>${escapeHtml(record.typeLabel)}</span>
        <span>${escapeHtml(normalizeMethodLabel(record.product.method))}</span>
        <span>${formatArchiveDate(record.product.releaseDate)}</span>
      </div>
    </div>
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
    ? `${parts.join(" · ")} · ${matchCount}/${totalCount} records active`
    : `All records online · ${totalCount} signals available`;
}

function getArchiveGroupKey(product, filters) {
  if (filters.series !== "All series") {
    return product.series || "Series";
  }
  if (filters.collab === "collab" || filters.collab === "regular") {
    return getTypeLabel(product);
  }
  return product.series || getTypeLabel(product);
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

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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
