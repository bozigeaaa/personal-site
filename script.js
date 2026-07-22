const buttons = [...document.querySelectorAll("[data-tab]")];
const panels = [...document.querySelectorAll(".tab-panel")];
const tabTargets = [...document.querySelectorAll("[data-tab-target]")];
const contactOpen = document.querySelector("[data-contact-open]");
const contactOverlay = document.querySelector("[data-contact-overlay]");
const copyButtons = [...document.querySelectorAll("[data-copy-value]")];
const questButtons = [...document.querySelectorAll("[data-quest-open]")];
const externalLinkButtons = [...document.querySelectorAll("[data-external-url]")];
const questOverlay = document.querySelector("[data-quest-overlay]");
const questTitle = document.querySelector("[data-quest-title]");
const questBody = document.querySelector("[data-quest-body]");
const foodPlaceInput = document.querySelector("[data-food-place]");
const foodPlaceSuggestions = document.querySelector("[data-place-suggestions]");
const foodLocateButton = document.querySelector("[data-food-locate]");
const foodResolveButton = document.querySelector("[data-food-resolve]");
const foodCategoryGroup = document.querySelector("[data-food-category]");
const foodDistanceGroup = document.querySelector("[data-food-distance]");
const foodSearchButton = document.querySelector("[data-food-search]");
const foodRandomButton = document.querySelector("[data-food-random]");
const foodRandomAgainButton = document.querySelector("[data-food-random-again]");
const foodResults = document.querySelector("[data-food-results]");
const foodCount = document.querySelector("[data-food-count]");
const foodOverlay = document.querySelector("[data-food-overlay]");
const foodPicked = document.querySelector("[data-food-picked]");
const foodFloat = document.querySelector("[data-food-float]");
const foodFloatingRandomButton = document.querySelector("[data-food-floating-random]");
const foodBackTopButton = document.querySelector("[data-food-back-top]");
const modalCloseButtons = [...document.querySelectorAll("[data-overlay-close]")];

const copyLabel = "\u590d\u5236";
const copiedLabel = "\u5df2\u590d\u5236";
const failedLabel = "\u5931\u8d25";
const maxFoodResults = 50;
const maxFoodCandidates = 500;
const maxFoodPagesPerKeyword = 3;
const maxFoodKeywordBatchSize = 3;
const foodSeenStorageKey = "xujiajie-food-seen-counts-v1";
const maxSeenHistoryItems = 1800;
const maxPlaceSuggestions = 7;
const amapConfig = {
  key: "5fef069c3b4e5fc3cfb5a0a641c1ea30",
  securityJsCode: "2ea560f754583f60e6eac1f291ad2899",
};
const foodState = {
  category: "all",
  distance: "nearby",
  merchants: [],
  candidateCount: 0,
  resolvedCenter: null,
  resolvedInputValue: "",
  shouldKeepResolveButton: false,
  userLocation: null,
  placeSuggestions: [],
  placeSuggestionTimer: null,
  lastSearchKey: "",
};
const questTitles = {
  venture: "2024.05-2026.3 | 创业：移民 & 美区TK & 抖音",
  qianyudao: "2023.12-2024.04 | 深圳市乾有道文旅数字投资有限公司",
  lisen: "2022-08 ~ 2023-12 | 深圳市李森科技有限公司",
  college: "2022.06 | 广东岭南职业技术学院",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHttpUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : "#";
  } catch {
    return "#";
  }
}

function shuffleItems(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

function loadFoodSeenCounts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(foodSeenStorageKey) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveFoodSeenCounts(seenCounts) {
  try {
    const entries = Object.entries(seenCounts)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, maxSeenHistoryItems);
    localStorage.setItem(foodSeenStorageKey, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Browsers can block localStorage in strict modes; random selection should still work.
  }
}

function getMerchantMemoryKey(merchant) {
  return String(merchant.id || `${merchant.name || ""}|${merchant.address || ""}`).trim();
}

function pickWeightedMerchants(merchants, count, shouldRemember = false) {
  const selected = [];
  const pool = shuffleItems(merchants);
  const seenCounts = loadFoodSeenCounts();

  while (pool.length && selected.length < count) {
    const weightedPool = pool.map((merchant) => {
      const seenCount = Number(seenCounts[getMerchantMemoryKey(merchant)] || 0);
      const freshBoost = seenCount === 0 ? 1.35 : 1;
      const weight = freshBoost / Math.pow(seenCount + 1, 1.75);

      return {
        merchant,
        weight: weight * (0.72 + Math.random() * 0.56),
      };
    });
    const totalWeight = weightedPool.reduce((sum, item) => sum + item.weight, 0);
    let cursor = Math.random() * totalWeight;
    let pickedIndex = 0;

    for (let index = 0; index < weightedPool.length; index += 1) {
      cursor -= weightedPool[index].weight;
      if (cursor <= 0) {
        pickedIndex = index;
        break;
      }
    }

    const [picked] = pool.splice(pickedIndex, 1);
    selected.push(picked);
  }

  if (shouldRemember) {
    selected.forEach((merchant) => {
      const key = getMerchantMemoryKey(merchant);
      seenCounts[key] = Number(seenCounts[key] || 0) + 1;
    });
    saveFoodSeenCounts(seenCounts);
  }

  return selected;
}

function readLngLat(location) {
  if (Array.isArray(location)) {
    return [Number(location[0]), Number(location[1])];
  }

  return [
    Number(location?.lng ?? location?.getLng?.()),
    Number(location?.lat ?? location?.getLat?.()),
  ];
}

function normalizeAmapCenter(AMap, location) {
  const [lng, lat] = readLngLat(location);

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return location;
  }

  if (typeof AMap.LngLat === "function") {
    return new AMap.LngLat(lng, lat);
  }

  return [lng, lat];
}

function setSelected(group, value) {
  group?.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.value === value);
  });
}

function getFoodSearchKey() {
  const resolvedCenterKey = foodState.resolvedCenter
    ? foodState.resolvedCenter.map((value) => Number(value).toFixed(6)).join(",")
    : "";

  return [
    foodPlaceInput?.value.trim() || "",
    resolvedCenterKey,
    foodState.category,
    foodState.distance,
  ].join("|");
}

function updateFoodSearchButtonLabel() {
  if (!foodSearchButton) return;

  const currentKey = getFoodSearchKey();
  const label = foodState.lastSearchKey && currentKey === foodState.lastSearchKey
    ? "重新刷新附近美食"
    : "搜索附近美食";
  const labelNode = foodSearchButton.querySelector("[data-food-search-label]");

  if (labelNode) {
    labelNode.textContent = label;
  } else {
    foodSearchButton.textContent = label;
  }
}

function renderFoodMessage(title, text) {
  if (!foodResults || !foodCount || !foodRandomButton) return;

  foodState.merchants = [];
  foodResults.innerHTML = `
    <article class="food-empty-card">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(text)}</p>
    </article>
  `;
  foodCount.textContent = "还没有可随机的商家";
  setFoodRandomDisabled(true);
}

function createDianpingSearchUrl(merchant) {
  const dianpingCityIds = {
    上海: 1,
    北京: 2,
    杭州: 3,
    广州: 4,
    南京: 5,
    苏州: 6,
    深圳: 7,
    成都: 8,
    重庆: 9,
    天津: 10,
    武汉: 16,
    西安: 17,
  };
  const cityName = String(merchant.cityname || "").replace("市", "");
  const cityId = dianpingCityIds[cityName] || 7;
  const keyword = encodeURIComponent(String(merchant.name || "").trim());
  return `https://www.dianping.com/search/keyword/${cityId}/0_${keyword}`;
}

function createAmapNavigationUrl(merchant) {
  const location = merchant.location;
  const [lng, lat] = readLngLat(location);

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return `https://uri.amap.com/search?keyword=${encodeURIComponent(merchant.name || "")}&callnative=1`;
  }

  return `https://uri.amap.com/navigation?to=${lng},${lat},${encodeURIComponent(merchant.name || "")}&mode=walk&src=xujiajie-site&coordinate=gaode&callnative=1`;
}

function renderFoodCard(merchant, picked = false) {
  const articleClass = picked ? "picked-food-card" : "food-card";
  const contentClass = picked ? "picked-food-card-content" : "food-card-content";
  const image = merchant.image || "./assets/food-placeholder.svg";
  const distance = merchant.distance ? `距离你 ${escapeHtml(merchant.distance)} 米` : "距离你未知";
  const url = safeHttpUrl(merchant.url || createDianpingSearchUrl(merchant));
  const mapUrl = safeHttpUrl(createAmapNavigationUrl(merchant));

  return `
    <article class="${articleClass}">
      <img src="${safeHttpUrl(image) === "#" ? "./assets/food-placeholder.svg" : safeHttpUrl(image)}" alt="${escapeHtml(merchant.name)}" />
      <div class="${contentClass}">
        <h3>${escapeHtml(merchant.name)}</h3>
        <p>${escapeHtml(merchant.summary || "接入真实数据后，这里会展示商家的简易评价。")}</p>
        <div class="food-meta">
          <span>${distance}</span>
        </div>
        <div class="food-link-row">
          <a href="${url}" target="_blank" rel="noreferrer">大众点评搜店名</a>
          <a href="${mapUrl}" target="_blank" rel="noreferrer">查看定位</a>
        </div>
      </div>
    </article>
  `;
}

function openRandomFood() {
  if (!foodState.merchants.length || !foodOverlay || !foodPicked) return;

  const picked = foodState.merchants[Math.floor(Math.random() * foodState.merchants.length)];
  foodPicked.innerHTML = renderFoodCard(picked, true);
  foodOverlay.hidden = false;
}

function getFoodRadius() {
  if (foodState.distance === "nearby") return 2000;
  return Number(foodState.distance) || 2000;
}

function getFoodKeywords() {
  const keywords = {
    all: ["餐饮服务", "餐厅", "美食", "小吃", "中餐厅", "火锅", "烧烤", "快餐", "咖啡", "奶茶", "饮品"],
    meal: ["餐饮服务", "餐厅", "中餐厅", "火锅", "烧烤", "快餐", "小吃", "茶餐厅", "粤菜"],
    drink: ["奶茶", "咖啡", "饮品", "茶饮", "咖啡厅"],
  };

  return shuffleItems(keywords[foodState.category] || keywords.all);
}

function loadAmap() {
  if (!amapConfig.key) {
    return Promise.reject(new Error("missing amap key"));
  }

  if (window.AMap) {
    return Promise.resolve(window.AMap);
  }

  window._AMapSecurityConfig = {
    securityJsCode: amapConfig.securityJsCode,
  };

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(amapConfig.key)}&plugin=AMap.Geocoder,AMap.PlaceSearch`;
    script.async = true;
    script.onload = () => {
      if (window.AMap) {
        resolve(window.AMap);
      } else {
        reject(new Error("amap script loaded without AMap"));
      }
    };
    script.onerror = () => reject(new Error("amap load failed"));
    document.head.append(script);
  });
}

function searchPlaceLocation(AMap, place) {
  return new Promise((resolve, reject) => {
    const searcher = new AMap.PlaceSearch({
      pageSize: 1,
      pageIndex: 1,
      extensions: "base",
    });

    searcher.search(place, (status, result) => {
      const location = result?.poiList?.pois?.[0]?.location;
      if (status === "complete" && location) {
        resolve(location);
      } else {
        reject(new Error(`poi place not found: ${status}`));
      }
    });
  });
}

function searchPlaceSuggestions(AMap, query) {
  return new Promise((resolve) => {
    const searcher = new AMap.PlaceSearch({
      pageSize: maxPlaceSuggestions,
      pageIndex: 1,
      citylimit: false,
      extensions: "base",
    });

    searcher.search(query, (status, result) => {
      if (status === "complete") {
        resolve(result?.poiList?.pois || []);
      } else {
        resolve([]);
      }
    });
  });
}

function getPlaceSuggestionLabel(poi) {
  const city = String(poi.cityname || poi.pname || "").replace("市", "");
  const district = String(poi.adname || "");
  const address = String(poi.address || "");

  return [city, district, address]
    .filter(Boolean)
    .join(" · ");
}

function getSelectedPlaceDisplay(poi) {
  const name = String(poi?.name || "").trim();
  const label = getPlaceSuggestionLabel(poi);

  return [name, label].filter(Boolean).join("｜");
}

function hidePlaceSuggestions() {
  foodState.placeSuggestions = [];
  if (foodPlaceSuggestions) {
    foodPlaceSuggestions.hidden = true;
    foodPlaceSuggestions.innerHTML = "";
  }
}

function renderPlaceSuggestions(suggestions, note = "") {
  if (!foodPlaceSuggestions) return;

  foodState.placeSuggestions = suggestions;

  if (!suggestions.length) {
    foodPlaceSuggestions.hidden = false;
    foodPlaceSuggestions.innerHTML = `
      <div class="place-suggestion-empty">${escapeHtml(note || "暂时没有找到可选地址，可以加上城市名再试。")}</div>
    `;
    return;
  }

  const referenceLocation = foodState.userLocation || foodState.resolvedCenter;
  const sortedSuggestions = referenceLocation
    ? [...suggestions].sort((a, b) => {
        const distanceA = getDistanceMeters(referenceLocation, a.location) ?? Number.POSITIVE_INFINITY;
        const distanceB = getDistanceMeters(referenceLocation, b.location) ?? Number.POSITIVE_INFINITY;
        return distanceA - distanceB;
      })
    : suggestions;

  foodState.placeSuggestions = sortedSuggestions;
  foodPlaceSuggestions.hidden = false;
  foodPlaceSuggestions.innerHTML = sortedSuggestions.map((poi, index) => {
    const distance = referenceLocation ? getDistanceMeters(referenceLocation, poi.location) : null;
    const distanceLabel = formatDistanceLabel(distance);
    const meta = getPlaceSuggestionLabel(poi);

    return `
      <button class="place-suggestion-item" type="button" data-place-suggestion-index="${index}">
        <span>
          <strong>${escapeHtml(poi.name || "未命名地点")}</strong>
          <small>${escapeHtml(meta || "点击选择这个地点")}</small>
        </span>
        ${distanceLabel ? `<em>约 ${escapeHtml(distanceLabel)}</em>` : "<em>选择</em>"}
      </button>
    `;
  }).join("");
}

async function refreshPlaceSuggestions(query, shouldShowEmpty = false) {
  if (!query || query.length < 2 || /^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/.test(query)) {
    hidePlaceSuggestions();
    return [];
  }

  try {
    const AMap = await loadAmap();
    const suggestions = await searchPlaceSuggestions(AMap, query);
    renderPlaceSuggestions(suggestions, shouldShowEmpty ? "没有找到同名地点，可以加上城市或区名再试。" : "");
    return suggestions;
  } catch {
    if (shouldShowEmpty) {
      renderPlaceSuggestions([], "地点候选加载失败，请检查高德 Key、网络或白名单。");
    }
    return [];
  }
}

async function choosePlaceSuggestion(index) {
  const poi = foodState.placeSuggestions[index];
  if (!poi?.location) return;

  const displayName = getSelectedPlaceDisplay(poi) || poi.name;
  setResolvedFoodPlace(displayName, poi.location, { keepResolveButton: true });
  hidePlaceSuggestions();
  updateFoodResolveButton();
  updateFoodSearchButtonLabel();
  renderFoodMessage("定位已确认", `已经选择“${displayName}”，现在可以点击“搜索附近美食”。`);
}

async function geocodePlace(AMap, place) {
  const coordinateMatch = place.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (coordinateMatch) {
    return [Number(coordinateMatch[1]), Number(coordinateMatch[2])];
  }

  if (isSpecificPlaceName(place)) {
    try {
      return await searchPlaceLocation(AMap, place);
    } catch {
      // Continue with geocoder fallback below.
    }
  }

  try {
    return await new Promise((resolve, reject) => {
      const geocoder = new AMap.Geocoder();
      geocoder.getLocation(place, (status, result) => {
        const location = result?.geocodes?.[0]?.location;
        if (status === "complete" && location) {
          resolve(location);
        } else {
          reject(new Error(`place not found: ${status}`));
        }
      });
    });
  } catch {
    return searchPlaceLocation(AMap, place);
  }
}

function formatLocation(location) {
  const [lng, lat] = readLngLat(location);

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return "";
  }

  return `${lng.toFixed(6)},${lat.toFixed(6)}`;
}

function getLocationArray(location) {
  const [lng, lat] = readLngLat(location);

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }

  return [lng, lat];
}

function getDistanceMeters(from, to) {
  const fromLocation = getLocationArray(from);
  const toLocation = getLocationArray(to);

  if (!fromLocation || !toLocation) return null;

  const [fromLng, fromLat] = fromLocation;
  const [toLng, toLat] = toLocation;
  const toRad = (value) => value * Math.PI / 180;
  const earthRadius = 6371000;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLng / 2) ** 2;

  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatDistanceLabel(distance) {
  if (!Number.isFinite(distance)) return "";
  if (distance >= 1000) return `${(distance / 1000).toFixed(distance >= 10000 ? 0 : 1)}km`;
  return `${Math.round(distance)}m`;
}

function formatReadableAddress(regeocode, fallback = "") {
  const component = regeocode?.addressComponent || {};
  const district = typeof component.district === "string" ? component.district : "";
  const township = typeof component.township === "string" ? component.township : "";
  const neighborhood = typeof component.neighborhood?.name === "string" ? component.neighborhood.name : "";
  const building = typeof component.building?.name === "string" ? component.building.name : "";
  const street = typeof component.streetNumber?.street === "string" ? component.streetNumber.street : "";
  const streetNumber = typeof component.streetNumber?.number === "string" ? component.streetNumber.number : "";
  const shortAddress = [district, neighborhood || township, building, `${street}${streetNumber}`]
    .filter(Boolean)
    .join("");

  return shortAddress || regeocode?.formattedAddress || fallback;
}

function reverseGeocodeLocation(AMap, location, fallback = "") {
  const center = normalizeAmapCenter(AMap, location);

  return new Promise((resolve) => {
    const geocoder = new AMap.Geocoder();
    geocoder.getAddress(center, (status, result) => {
      if (status === "complete" && result?.regeocode) {
        resolve(formatReadableAddress(result.regeocode, fallback));
      } else {
        resolve(fallback || formatLocation(location));
      }
    });
  });
}

function setResolvedFoodPlace(label, location, options = {}) {
  const locationArray = getLocationArray(location);
  const displayLabel = label || formatLocation(location);

  foodState.resolvedCenter = locationArray;
  foodState.resolvedInputValue = displayLabel;
  foodState.shouldKeepResolveButton = Boolean(options.keepResolveButton);

  if (foodPlaceInput) {
    foodPlaceInput.value = displayLabel;
  }
}

function getFoodSearchTarget() {
  const typedPlace = foodPlaceInput?.value.trim() || "";

  if (foodState.resolvedCenter && typedPlace === foodState.resolvedInputValue) {
    return foodState.resolvedCenter;
  }

  return typedPlace;
}

function updateFoodResolveButton() {
  if (!foodResolveButton || !foodPlaceInput) return;

  const hasTypedPlace = foodPlaceInput.value.trim().length > 0;
  const isCoordinate = /^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/.test(foodPlaceInput.value);
  const isResolvedPlace = foodState.resolvedCenter && foodPlaceInput.value.trim() === foodState.resolvedInputValue;
  foodResolveButton.hidden = !hasTypedPlace || isCoordinate || (isResolvedPlace && !foodState.shouldKeepResolveButton);
}

function isSpecificPlaceName(place) {
  return /地铁|站|小区|花园|大厦|广场|商场|中心|科技园|公园|酒店|学校|医院|写字楼|商铺|市场|城/.test(place);
}

function compareFoodMerchants(a, b) {
  return (Number(a.distance) || 999999) - (Number(b.distance) || 999999);
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("browser geolocation unavailable"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 60000,
    });
  });
}

function searchNearbyPage(AMap, center, keyword, radius, pageIndex) {
  return new Promise((resolve) => {
    const searcher = new AMap.PlaceSearch({
      pageSize: 25,
      pageIndex,
      extensions: "all",
    });

    searcher.searchNearBy(keyword, center, radius, (status, result) => {
      if (status === "complete") {
        resolve(result?.poiList?.pois || []);
      } else if (status === "no_data") {
        resolve([]);
      } else {
        resolve([]);
      }
    });
  });
}

async function searchFoodMerchants(place) {
  const AMap = await loadAmap();
  const rawCenter = getLocationArray(place) || await geocodePlace(AMap, place);
  const center = normalizeAmapCenter(AMap, rawCenter);
  const keywords = getFoodKeywords().slice(0, foodState.category === "all" ? 8 : 6);
  const radius = getFoodRadius();
  const merchants = [];
  const seen = new Set();

  for (let pageIndex = 1; pageIndex <= maxFoodPagesPerKeyword; pageIndex += 1) {
    const pages = [];

    for (let index = 0; index < keywords.length; index += maxFoodKeywordBatchSize) {
      const keywordBatch = keywords.slice(index, index + maxFoodKeywordBatchSize);
      const batchPages = await Promise.all(keywordBatch.map(async (keyword) => {
        const pois = await searchNearbyPage(AMap, center, keyword, radius, pageIndex);
        return { keyword, pois };
      }));

      pages.push(...batchPages);
    }

    const hasMore = pages.some((page) => page.pois.length > 0);
    if (!hasMore) break;

    pages.forEach((page) => {
      page.pois.forEach((poi) => {
        const id = poi.id || `${poi.name}-${poi.address}`;
        if (seen.has(id)) return;

        seen.add(id);
        merchants.push({
          id,
          name: poi.name,
          address: poi.address,
          distance: poi.distance,
          cityname: poi.cityname,
          location: poi.location,
          image: poi.photos?.[0]?.url,
          summary: [poi.type, poi.address].filter(Boolean).join(" · "),
          url: createDianpingSearchUrl({ name: poi.name, cityname: poi.cityname }),
        });
      });
    });
  }

  const randomCandidatePool = pickWeightedMerchants(
    merchants,
    Math.min(maxFoodCandidates, merchants.length),
    false
  );
  foodState.candidateCount = randomCandidatePool.length;

  return pickWeightedMerchants(randomCandidatePool, maxFoodResults, true)
    .sort(compareFoodMerchants);
}

function setFoodRandomDisabled(disabled) {
  if (foodRandomButton) {
    foodRandomButton.disabled = disabled;
  }
  if (foodFloatingRandomButton) {
    foodFloatingRandomButton.disabled = disabled;
  }
}

function updateFoodFloat() {
  if (!foodFloat) return;

  const isToolsActive = document.querySelector("#tools")?.classList.contains("is-active");
  foodFloat.hidden = !(isToolsActive && window.scrollY > 520);
}

function renderFoodResults(merchants) {
  if (!foodResults || !foodCount || !foodRandomButton) return;

  foodState.merchants = merchants;
  foodCount.textContent = merchants.length
    ? `已从随机${foodState.candidateCount}家候选门店里抽出${merchants.length}家展示，再次搜索会重新随机抓取`
    : "还没有可随机的商家";
  setFoodRandomDisabled(merchants.length === 0);
  foodResults.innerHTML = merchants.length
    ? merchants.map((merchant) => renderFoodCard(merchant)).join("")
    : `<article class="food-empty-card"><strong>没有找到结果</strong><p>当前地点和筛选范围没有返回商家。可以切到“全部”、扩大到 2km，或者换一个更明确的地点再试。</p></article>`;
}

function showTab(tabName, shouldScroll = true) {
  buttons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === tabName);
  });

  panels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === tabName);
  });

  if (shouldScroll) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  history.replaceState(null, "", `#${tabName}`);
  window.setTimeout(updateFoodFloat, 180);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("copy failed");
  }
}

buttons.forEach((button) => {
  button.addEventListener("click", () => showTab(button.dataset.tab));
});

tabTargets.forEach((target) => {
  target.addEventListener("click", () => showTab(target.dataset.tabTarget));
});

externalLinkButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const url = button.dataset.externalUrl;
    const opened = window.open(url, "_blank", "noopener,noreferrer");

    if (!opened) {
      window.location.href = url;
    }
  });
});

foodCategoryGroup?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-value]");
  if (!button) return;

  foodState.category = button.dataset.value;
  setSelected(foodCategoryGroup, foodState.category);
  updateFoodSearchButtonLabel();
});

foodDistanceGroup?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-value]");
  if (!button) return;

  foodState.distance = button.dataset.value;
  setSelected(foodDistanceGroup, foodState.distance);
  updateFoodSearchButtonLabel();
});

foodPlaceInput?.addEventListener("input", () => {
  if (foodPlaceInput.value.trim() !== foodState.resolvedInputValue) {
    foodState.resolvedCenter = null;
    foodState.resolvedInputValue = "";
    foodState.shouldKeepResolveButton = false;
  }

  updateFoodResolveButton();
  updateFoodSearchButtonLabel();

  window.clearTimeout(foodState.placeSuggestionTimer);
  foodState.placeSuggestionTimer = window.setTimeout(() => {
    refreshPlaceSuggestions(foodPlaceInput.value.trim());
  }, 360);
});

foodResolveButton?.addEventListener("click", async () => {
  const place = foodPlaceInput?.value.trim();
  if (!place) {
    renderFoodMessage("先输入地点", "请输入一个地铁站、小区、花园或大厦名称，再点击“搜索定位”。");
    foodPlaceInput?.focus();
    return;
  }

  foodResolveButton.disabled = true;
  foodResolveButton.textContent = "搜索中";
  renderFoodMessage("正在搜索定位", "正在查找同名地点。如果出现多个候选，请先选择你想看的地址。");

  try {
    const AMap = await loadAmap();
    const suggestions = await refreshPlaceSuggestions(place, true);

    if (suggestions.length > 1) {
      renderFoodMessage("请选择地址", "下面列出了几个同名或相似地点，优先显示离你更近的地址。");
      return;
    }

    if (suggestions.length === 1) {
      await choosePlaceSuggestion(0);
      return;
    }

    const location = await geocodePlace(AMap, place);
    const formattedLocation = formatLocation(location);

    if (!formattedLocation) {
      throw new Error("location parse failed");
    }

    const readableAddress = await reverseGeocodeLocation(AMap, location, place);
    setResolvedFoodPlace(readableAddress, location);
    updateFoodResolveButton();
    updateFoodSearchButtonLabel();
    renderFoodMessage("定位已确认", `已经识别到“${readableAddress}”，现在可以点击“搜索附近美食”。`);
  } catch {
    renderFoodMessage("搜索定位失败", "这个地点没有识别成功。可以试试加上城市名，例如：深圳 后海地铁站、深圳 某某花园。");
  } finally {
    foodResolveButton.disabled = false;
    foodResolveButton.textContent = "搜索定位";
  }
});

foodLocateButton?.addEventListener("click", async () => {
  foodLocateButton.disabled = true;
  foodLocateButton.textContent = "定位中";
  renderFoodMessage("正在实时定位", "请在浏览器弹窗里允许定位权限。定位成功后会自动填入当前位置。");

  try {
    const position = await getCurrentPosition();
    const { longitude, latitude } = position.coords;
    const location = [longitude, latitude];
    const AMap = await loadAmap();
    foodState.userLocation = location;
    const readableAddress = await reverseGeocodeLocation(AMap, location, "当前位置");
    setResolvedFoodPlace(readableAddress, location);
    hidePlaceSuggestions();
    updateFoodResolveButton();
    updateFoodSearchButtonLabel();
    renderFoodMessage("定位成功", `已经定位到“${readableAddress}”，可以直接点击“搜索附近美食”。`);
  } catch {
    renderFoodMessage("定位失败", "没有成功获取当前位置。请确认浏览器允许定位，并尽量在线上 HTTPS 网址中使用。");
  } finally {
    foodLocateButton.disabled = false;
    foodLocateButton.textContent = "实时定位";
  }
});

foodPlaceSuggestions?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-place-suggestion-index]");
  if (!button) return;

  choosePlaceSuggestion(Number(button.dataset.placeSuggestionIndex));
});

foodSearchButton?.addEventListener("click", async () => {
  const place = foodPlaceInput?.value.trim();

  if (!place) {
    renderFoodMessage("先输入地点", "默认不自动搜索。请输入一个地点，比如：深圳南山区、广州天河城、上海静安寺。");
    foodPlaceInput?.focus();
    return;
  }

  if (!amapConfig.key) {
    foodState.merchants = [];
    renderFoodMessage(
      "等待配置高德 Key",
      `已记录地点：${place}。下一步配置高德 JS API Key 后，会按当前分类和距离抓取真实周边美食。`
    );
    return;
  }

  renderFoodMessage("正在搜索", "正在根据地点、分类和距离抓取周边美食。通常需要 5-20 秒，商家较多时可能接近 30 秒。");

  try {
    const merchants = await searchFoodMerchants(getFoodSearchTarget());
    foodState.lastSearchKey = getFoodSearchKey();
    renderFoodResults(merchants);
    updateFoodSearchButtonLabel();
  } catch (error) {
    foodState.merchants = [];
    const reason = error?.message || "unknown error";
    renderFoodMessage(
      "搜索失败",
      `没有成功获取商家数据。原因：${reason}。如果你在本地 file 页面测试，请上传到 Netlify 后，并在高德后台把 Netlify 域名加入 JS API Key 的安全白名单。`
    );
  }
});

foodRandomButton?.addEventListener("click", openRandomFood);
foodRandomAgainButton?.addEventListener("click", openRandomFood);
foodFloatingRandomButton?.addEventListener("click", openRandomFood);

foodBackTopButton?.addEventListener("click", () => {
  document.querySelector("#tools")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

window.addEventListener("scroll", updateFoodFloat, { passive: true });

foodOverlay?.addEventListener("click", (event) => {
  if (event.target === foodOverlay) {
    foodOverlay.hidden = true;
  }
});

modalCloseButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const overlay = button.closest(".contact-overlay, .quest-overlay, .food-overlay");
    if (overlay) {
      overlay.hidden = true;
    }
  });
});

contactOpen?.addEventListener("click", (event) => {
  event.stopPropagation();
  copyButtons.forEach((button) => {
    button.textContent = copyLabel;
  });
  contactOverlay.hidden = false;
});

contactOverlay?.addEventListener("click", (event) => {
  if (event.target === contactOverlay) {
    contactOverlay.hidden = true;
  }
});

questButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const questId = button.dataset.questOpen;
    const template = document.querySelector(`#quest-template-${questId}`);

    if (!template || !questOverlay || !questTitle || !questBody) {
      return;
    }

    questTitle.textContent = questTitles[questId] || "";
    questBody.innerHTML = "";
    questBody.append(template.content.cloneNode(true));
    questOverlay.hidden = false;
  });
});

questOverlay?.addEventListener("click", (event) => {
  if (event.target === questOverlay) {
    questOverlay.hidden = true;
  }
});

copyButtons.forEach((button) => {
  button.addEventListener("click", async (event) => {
    event.stopPropagation();
    const value = button.dataset.copyValue;

    try {
      await copyText(value);
      button.textContent = copiedLabel;
      window.setTimeout(() => {
        button.textContent = copyLabel;
      }, 1400);
    } catch {
      button.textContent = failedLabel;
      window.prompt("\u8bf7\u624b\u52a8\u590d\u5236", value);
    }
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && contactOverlay && !contactOverlay.hidden) {
    contactOverlay.hidden = true;
  }
  if (event.key === "Escape" && questOverlay && !questOverlay.hidden) {
    questOverlay.hidden = true;
  }
  if (event.key === "Escape" && foodOverlay && !foodOverlay.hidden) {
    foodOverlay.hidden = true;
  }
});

const initialTab = location.hash.replace("#", "");
if (buttons.some((button) => button.dataset.tab === initialTab)) {
  showTab(initialTab, false);
} else if (initialTab === "resume") {
  showTab("home", false);
} else if (initialTab) {
  showTab("home", false);
}

updateFoodResolveButton();
updateFoodSearchButtonLabel();
updateFoodFloat();
