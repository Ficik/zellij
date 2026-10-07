import assert from "node:assert/strict";
import { test } from "node:test";
import { installKeyboardCapture } from "../assets/keyboard-lock.js";

function setup({ supported = true, fullscreen = true, lock, requestFullscreen } = {}) {
    const calls = { locks: [], unlocks: 0, focuses: 0, fullscreen: 0 };
    class Element extends EventTarget {
        children = [];
        attributes = {};
        textContent = "";
        append(...children) { this.children.push(...children); }
        appendChild(child) { this.children.push(child); }
        setAttribute(name, value) { this.attributes[name] = value; }
    }
    const document = new EventTarget();
    document.body = new Element();
    document.createElement = () => new Element();
    document.fullscreenEnabled = fullscreen;
    document.fullscreenElement = null;
    document.documentElement = {
        requestFullscreen: async () => {
            calls.fullscreen++;
            if (requestFullscreen) await requestFullscreen();
            document.fullscreenElement = document.documentElement;
            document.dispatchEvent(new Event("fullscreenchange"));
        },
    };
    document.exitFullscreen = async () => {
        document.fullscreenElement = null;
        document.dispatchEvent(new Event("fullscreenchange"));
    };
    const keyboard = supported ? {
        lock: async (...keys) => {
            assert.ok(document.fullscreenElement, "capture must be requested in fullscreen");
            calls.locks.push(keys);
            if (lock) await lock();
        },
        unlock: () => { calls.unlocks++; },
    } : undefined;
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { keyboard } });
    globalThis.document = document;
    globalThis.window = new EventTarget();
    installKeyboardCapture({ focus() { calls.focuses++; } });
    const [button, status] = document.body.children[0]?.children || [];
    const settle = () => new Promise(resolve => setImmediate(resolve));
    const click = async () => { button.dispatchEvent(new Event("click")); await settle(); };
    return { calls, document, button, status, click, settle };
}

test("capture enters fullscreen, locks all shortcuts, restores terminal focus and exits", async () => {
    const { calls, document, button, click } = setup();
    assert.equal(button.textContent, "Capture keyboard");
    await click();
    assert.equal(calls.fullscreen, 1);
    assert.deepEqual(calls.locks, [[]], "an omitted key list captures every available key");
    assert.equal(button.textContent, "Exit fullscreen");
    assert.equal(calls.focuses, 1);
    await click();
    assert.equal(document.fullscreenElement, null);
    assert.equal(calls.unlocks, 1);
    assert.equal(button.textContent, "Capture keyboard");
});

test("leaving fullscreen releases the lock and allows capture again", async () => {
    const { calls, document, button, click } = setup();
    await click();
    await document.exitFullscreen();
    assert.equal(button.attributes["aria-pressed"], "false");
    await click();
    assert.equal(calls.locks.length, 2);
    window.dispatchEvent(new Event("pagehide"));
    assert.equal(calls.unlocks, 2);
});

test("denied capture remains usable and can be retried without reentering fullscreen", async () => {
    let denied = true;
    const { calls, button, status, click } = setup({ lock: async () => {
        if (denied) throw new Error("permission denied");
    } });
    await click();
    assert.match(status.textContent, /unavailable/);
    assert.equal(button.disabled, false);
    assert.equal(button.textContent, "Capture keyboard");
    denied = false;
    await click();
    assert.equal(status.textContent, "");
    assert.equal(button.textContent, "Exit fullscreen");
    assert.equal(calls.fullscreen, 1);
});

test("failed fullscreen does not request a keyboard lock", async () => {
    const { calls, button, status, click } = setup({ requestFullscreen: async () => {
        throw new Error("fullscreen denied");
    } });
    await click();
    assert.equal(calls.locks.length, 0);
    assert.equal(button.disabled, false);
    assert.match(status.textContent, /unavailable/);
});

test("unsupported keyboard lock offers fullscreen without claiming capture", async () => {
    const { button, calls, click } = setup({ supported: false });
    assert.equal(button.textContent, "Fullscreen");
    assert.match(button.title, /does not support keyboard capture/);
    await click();
    assert.equal(calls.locks.length, 0);
    assert.equal(button.textContent, "Exit fullscreen");
    await click();
    assert.equal(button.textContent, "Fullscreen");
});

test("no fullscreen support leaves terminal setup intact", () => {
    const { document } = setup({ fullscreen: false });
    assert.equal(document.body.children.length, 0);
});

test("a pending permission request cannot claim capture after leaving fullscreen", async () => {
    let resolve;
    const { calls, document, button, click, settle } = setup({ lock: () => new Promise(r => { resolve = r; }) });
    await click();
    assert.equal(button.disabled, true);
    await document.exitFullscreen();
    resolve();
    await settle();
    assert.equal(button.textContent, "Capture keyboard");
    assert.equal(button.disabled, false);
    assert.equal(calls.unlocks, 2);
});
