/**
 * contact.html — saves to Supabase `inquiries` (see supabase/schema.sql).
 */
(function () {
  var form = document.getElementById("inquiry-form");
  var feedback = document.getElementById("inquiry-feedback");
  if (!form) return;

  function setMsg(text, kind) {
    if (!feedback) return;
    feedback.textContent = text || "";
    feedback.className = "inquiry-feedback" + (kind ? " inquiry-feedback--" + kind : "");
    feedback.hidden = !text;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    setMsg("");

    var name = (form.querySelector('[name="inquiry-name"]') || {}).value;
    var email = (form.querySelector('[name="inquiry-email"]') || {}).value;
    var phone = (form.querySelector('[name="inquiry-phone"]') || {}).value;
    var message = (form.querySelector('[name="inquiry-message"]') || {}).value;

    var row = {
      full_name: String(name || "").trim(),
      email: String(email || "").trim(),
      phone: String(phone || "").trim() || null,
      message: String(message || "").trim(),
      source: "website",
    };

    if (!row.full_name || !row.email || !row.message) {
      setMsg("Please fill in your name, email, and message.", "error");
      return;
    }

    var sb = window.nadjaeSupabaseClient;
    var btn = form.querySelector('button[type="submit"]');

    if (!sb) {
      setMsg(
        "Thanks — cloud save is off until Supabase is configured in js/supabase-config.local.js. Email queengaelle492@gmail.com directly.",
        "error",
      );
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.dataset.orig = btn.textContent;
      btn.textContent = "Sending…";
    }

    try {
      var res = await sb.from("inquiries").insert(row).select("id").single();
      if (res.error) throw res.error;
      var newId = res.data && res.data.id;
      if (newId) {
        sb.functions.invoke("notify-salon", { body: { inquiry_id: newId } }).then(function (inv) {
          if (inv.error) console.warn("notify-salon:", inv.error);
        });
      }
      form.reset();
      setMsg("Thank you — your message was sent. We will get back to you soon.", "success");
    } catch (err) {
      var m = err && err.message ? String(err.message) : String(err || "Could not send.");
      setMsg("Could not send: " + m + " Confirm the `inquiries` table exists (run supabase/schema.sql).", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.dataset.orig || "Send message";
      }
    }
  });
})();
