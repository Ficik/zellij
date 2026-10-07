// Browser-reserved shortcuts require page-initiated fullscreen and Keyboard Lock.
// Lock all keys: locking only Escape leaves Ctrl+T, Ctrl+N, etc. with the browser.
export function installKeyboardCapture(term) {
    if (!document.fullscreenEnabled || !document.documentElement.requestFullscreen) {
        return;
    }
    const keyboard = navigator.keyboard;
    const canLock = typeof keyboard?.lock === "function";
    const controls = document.createElement("div");
    controls.id = "zj-keyboard-capture";
    const button = document.createElement("button");
    button.type = "button";
    const status = document.createElement("span");
    status.setAttribute("role", "status");
    controls.append(button, status);
    document.body.appendChild(controls);

    let captured = false;
    let pending = false;
    let generation = 0;
    const update = () => {
        button.disabled = pending;
        button.textContent = captured || (document.fullscreenElement && !canLock)
            ? "Exit fullscreen"
            : canLock ? "Capture keyboard" : "Fullscreen";
        button.setAttribute("aria-pressed", String(captured || !!document.fullscreenElement));
        button.title = captured
            ? "Keyboard captured. Hold Esc to exit fullscreen."
            : canLock
                ? "Enter fullscreen and allow keyboard capture to use Ctrl+T, Ctrl+N and other terminal shortcuts."
                : "This browser does not support keyboard capture; some shortcuts remain reserved by the browser.";
    };
    const unlock = () => {
        if (canLock) keyboard.unlock();
        captured = false;
    };
    document.addEventListener("fullscreenchange", () => {
        if (!document.fullscreenElement) {
            generation++;
            pending = false;
            unlock();
            status.textContent = "";
            term.focus();
        }
        update();
    });
    window.addEventListener("pagehide", () => {
        generation++;
        unlock();
    });
    button.addEventListener("click", async () => {
        if (pending) return;
        const request = ++generation;
        pending = true;
        status.textContent = "";
        update();
        try {
            if (document.fullscreenElement && (captured || !canLock)) {
                await document.exitFullscreen();
            } else {
                if (!document.fullscreenElement) {
                    await document.documentElement.requestFullscreen();
                }
                if (request !== generation || !document.fullscreenElement) return;
                if (canLock) {
                    await keyboard.lock();
                    // The user may have left fullscreen while the permission prompt was open.
                    if (request !== generation || !document.fullscreenElement) {
                        // Do not cancel a newer capture request.
                        if (!pending) unlock();
                        return;
                    }
                    captured = true;
                }
            }
        } catch (error) {
            if (request === generation) {
                unlock();
                status.textContent = "Keyboard capture unavailable. Browser shortcuts may still apply; click to retry.";
            }
        } finally {
            if (request === generation) {
                pending = false;
                update();
                term.focus();
            }
        }
    });
    update();
}
