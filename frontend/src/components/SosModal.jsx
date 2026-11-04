import { useAuthStore } from "../store/useAuthStore";
import { useSosStore } from "../store/useSosStore";

const mapsLink = (loc) => `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;

function SosModal() {
  const authUser = useAuthStore((state) => state.authUser);
  const {
    sos,
    starting,
    incoming,
    setupOpen,
    users,
    selected,
    loadingContacts,
    savingContacts,
    trigger,
    cancel,
    ack,
    openSetup,
    closeSetup,
    toggleContact,
    saveContacts,
  } = useSosStore();

  if (!authUser) return null;

  const incomingAlert = incoming[0];

  return (
    <>
      {/* ---------- floating SOS button ---------- */}
      {!sos && !setupOpen && (
        <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2">
          <button
            type="button"
            onClick={trigger}
            disabled={starting}
            aria-label="Send SOS to my emergency contacts"
            className="rounded-full bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-3 shadow-lg shadow-red-500/30 disabled:opacity-60 transition-colors"
          >
            {starting ? "Sending..." : "🚨 SOS"}
          </button>
          <button
            type="button"
            onClick={openSetup}
            aria-label="Choose emergency contacts"
            title="Emergency contacts"
            className="size-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            ⚙️
          </button>
        </div>
      )}

      {/* ---------- choose emergency contacts ---------- */}
      {setupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Emergency contacts
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              They get your location and an alert when you press SOS.{" "}
              <b>{selected.length}/5</b> picked.
            </p>

            <div className="mt-4 max-h-64 overflow-y-auto space-y-1">
              {loadingContacts && (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
                  Loading...
                </p>
              )}
              {!loadingContacts && users.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
                  No other users yet.
                </p>
              )}
              {users.map((u) => (
                <label
                  key={u._id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50"
                >
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={selected.includes(u._id)}
                    onChange={() => toggleContact(u._id)}
                  />
                  <img
                    src={u.profilePic || "/avatar.png"}
                    alt={u.username}
                    className="size-8 rounded-full object-cover"
                  />
                  <span className="text-slate-800 dark:text-slate-100 truncate">
                    {u.username}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={closeSetup}
                className="flex-1 rounded-lg py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={saveContacts}
                disabled={savingContacts || loadingContacts}
                className="flex-1 rounded-lg py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-medium hover:from-cyan-600 hover:to-cyan-700 disabled:opacity-60"
              >
                {savingContacts ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- my SOS is running ---------- */}
      {sos && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div
            className={`w-full max-w-sm rounded-xl bg-white dark:bg-slate-800 border-2 p-6 text-center ${
              sos.status === "acknowledged" ? "border-green-500" : "border-red-500"
            }`}
          >
            <p className={`text-5xl mb-2 ${sos.status === "active" ? "animate-pulse" : ""}`}>
              {sos.status === "acknowledged" ? "✅" : "🚨"}
            </p>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {sos.status === "acknowledged"
                ? `${sos.ackBy?.name || "Someone"} is responding`
                : "SOS sent"}
            </h2>

            <div className="text-sm text-slate-600 dark:text-slate-300 mt-3 space-y-1">
              <p>
                Notified {sos.contactCount} contact{sos.contactCount === 1 ? "" : "s"} (
                {sos.onlineCount} online right now)
              </p>
              <p>
                {sos.hasLocation
                  ? "📍 Your location is being shared"
                  : "📍 No location. Allow location access in your browser"}
              </p>
              {sos.status === "active" && (
                <p>
                  Alerting again every 30 seconds until someone replies. Alerts sent:{" "}
                  {sos.nags + 1}
                </p>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
              If you are in danger, also call your local emergency number.
            </p>

            <button
              onClick={cancel}
              className={`mt-5 w-full rounded-lg py-2 font-medium ${
                sos.status === "acknowledged"
                  ? "bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              I'm safe
            </button>
          </div>
        </div>
      )}

      {/* ---------- someone else's SOS (sits on top of everything) ---------- */}
      {incomingAlert && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-red-900/80 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-800 border-2 border-red-500 p-6 text-center">
            <p className="text-5xl mb-2 animate-pulse">🚨</p>
            <h2 className="text-xl font-bold text-red-600 dark:text-red-400">
              {incomingAlert.name} needs help!
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
              {incomingAlert.nags > 0
                ? `No one has replied yet. Alert #${incomingAlert.nags + 1}`
                : "They sent an SOS to their emergency contacts."}
            </p>

            {incomingAlert.location ? (
              <a
                href={mapsLink(incomingAlert.location)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block rounded-lg px-4 py-2 bg-slate-100 dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 font-medium hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                📍 Open their location
              </a>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">
                📍 Location unavailable
              </p>
            )}

            <button
              onClick={() => ack(incomingAlert.id)}
              className="mt-5 w-full rounded-lg py-3 bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              I'm on it
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              This tells {incomingAlert.name} help is coming and stops the alerts.
              {incoming.length > 1 ? ` (${incoming.length - 1} more SOS waiting)` : ""}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default SosModal;