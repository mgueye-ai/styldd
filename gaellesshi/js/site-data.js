/**
 * Supabase `hairbynadjae_site` — all admin-managed site content stored here.
 *
 * | record_type        | record_key              | data                          | Admin tab    |
 * |--------------------|-------------------------|-------------------------------|--------------|
 * | site_setting       | style_price_overrides   | { value: { styleId: price } } | Prices       |
 * | site_setting       | booking_hours           | { value: { slot times… } }    | Schedule     |
 * | style_cover_image  | style id                | { storage_path }              | Style photos |
 * | blocked_interval   | null                    | { starts_at, ends_at, note }  | Schedule     |
 *
 * Bookings, photos, inquiries: separate tables (`bookings`, storage, `inquiries`).
 */
(function () {
  var TABLE = "hairbynadjae_site";

  var RECORD_TYPE = {
    SITE_SETTING: "site_setting",
    STYLE_COVER: "style_cover_image",
    BLOCKED_INTERVAL: "blocked_interval",
  };

  var SETTING_KEY = {
    STYLE_PRICE_OVERRIDES: "style_price_overrides",
    BOOKING_HOURS: "booking_hours",
  };

  function supabaseRestConfig() {
    var c = window.__NADJAE_SUPABASE;
    if (!c || !c.url || !c.anonKey) return null;
    return { url: String(c.url).replace(/\/$/, ""), anonKey: c.anonKey };
  }

  function restHeaders(cfg) {
    return {
      apikey: cfg.anonKey,
      Authorization: "Bearer " + cfg.anonKey,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  function restGet(query) {
    var cfg = supabaseRestConfig();
    if (!cfg) return Promise.resolve([]);
    return fetch(cfg.url + "/rest/v1/" + TABLE + "?" + query, {
      headers: restHeaders(cfg),
    })
      .then(function (r) {
        return r.ok ? r.json() : [];
      })
      .catch(function () {
        return [];
      });
  }

  function fetchSiteSettingValue(recordKey) {
    return restGet(
      "record_type=eq." +
        encodeURIComponent(RECORD_TYPE.SITE_SETTING) +
        "&record_key=eq." +
        encodeURIComponent(recordKey) +
        "&select=data&limit=1",
    ).then(function (rows) {
      if (!Array.isArray(rows) || !rows.length) return null;
      var data = rows[0].data;
      if (!data || typeof data !== "object") return null;
      return data.value != null ? data.value : data;
    });
  }

  /** @returns {Promise<Record<string, number>>} */
  function fetchStylePriceOverrideMap() {
    return fetchSiteSettingValue(SETTING_KEY.STYLE_PRICE_OVERRIDES).then(function (val) {
      if (!val || typeof val !== "object" || Array.isArray(val)) return {};
      return val;
    });
  }

  /** @returns {Promise<object|null>} */
  function fetchBookingHours() {
    return fetchSiteSettingValue(SETTING_KEY.BOOKING_HOURS);
  }

  /** @returns {Promise<Record<string, { style_id: string, storage_path: string, updated_at?: string }>>} */
  function fetchStyleCoverMapViaClient(sb) {
    if (!sb) return Promise.resolve({});
    return sb
      .from(TABLE)
      .select("record_key, data, updated_at")
      .eq("record_type", RECORD_TYPE.STYLE_COVER)
      .then(function (res) {
        if (res.error || !res.data) return {};
        var m = {};
        res.data.forEach(function (row) {
          var sid = row.record_key;
          var path = row.data && row.data.storage_path;
          if (sid && path) {
            m[sid] = { style_id: sid, storage_path: path, updated_at: row.updated_at };
          }
        });
        return m;
      })
      .catch(function () {
        return {};
      });
  }

  /** @returns {Promise<Record<string, { style_id: string, storage_path: string, updated_at?: string }>>} */
  function fetchStyleCoverMapRest() {
    return restGet(
      "record_type=eq." +
        encodeURIComponent(RECORD_TYPE.STYLE_COVER) +
        "&select=record_key,data,updated_at",
    ).then(function (rows) {
      var m = {};
      if (!Array.isArray(rows)) return m;
      rows.forEach(function (row) {
        var sid = row.record_key;
        var path = row.data && row.data.storage_path;
        if (sid && path) {
          m[sid] = { style_id: sid, storage_path: path, updated_at: row.updated_at };
        }
      });
      return m;
    });
  }

  function fetchStyleCoverMap(sb) {
    if (sb) return fetchStyleCoverMapViaClient(sb);
    return fetchStyleCoverMapRest();
  }

  /** @returns {Promise<{ id: string, starts_at: string, ends_at: string, note: string|null }[]>} */
  function fetchBlockedIntervalsViaClient(sb) {
    if (!sb) return Promise.resolve([]);
    return sb
      .from(TABLE)
      .select("id, data, created_at")
      .eq("record_type", RECORD_TYPE.BLOCKED_INTERVAL)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(function (res) {
        if (res.error || !res.data) return [];
        return res.data
          .map(function (row) {
            var d = row.data || {};
            return {
              id: row.id,
              starts_at: d.starts_at || null,
              ends_at: d.ends_at || null,
              note: d.note != null ? d.note : null,
            };
          })
          .filter(function (r) {
            return r.starts_at && r.ends_at;
          });
      })
      .catch(function () {
        return [];
      });
  }

  window.__NADJAE_SITE_DATA = {
    table: TABLE,
    recordType: RECORD_TYPE,
    settingKey: SETTING_KEY,
    fetchSiteSettingValue: fetchSiteSettingValue,
    fetchStylePriceOverrideMap: fetchStylePriceOverrideMap,
    fetchBookingHours: fetchBookingHours,
    fetchStyleCoverMap: fetchStyleCoverMap,
    fetchStyleCoverMapRest: fetchStyleCoverMapRest,
    fetchBlockedIntervalsViaClient: fetchBlockedIntervalsViaClient,
  };
})();
