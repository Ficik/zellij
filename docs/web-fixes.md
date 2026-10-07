# Ficik web-fixes branch

Based on upstream `v0.45.1` (`efd8fd5a89a20c07a111d248ad7fce53848d2c18`).
The upstream remote is `https://github.com/zellij-org/zellij.git`; the fork is
`git@github.com:Ficik/zellij.git`.

## Changes

- [#5190](https://github.com/zellij-org/zellij/issues/5190): preserve the raw
  bytes of Escape when the web input parser finalizes it after its 50 ms idle
  timeout. Retain bytes across fragmented sequences, attribute each decoded
  key its own bytes, and clear the fallback parser after a Kitty sequence.
- Add a **Capture keyboard** button to enter page fullscreen and request all
  available keys through the Keyboard Lock API, including Ctrl+T and Ctrl+N.
  Allow the browser permission prompt. A short Esc is sent to the terminal;
  hold Esc or click **Exit fullscreen** to leave. Exiting fullscreen releases
  capture. Denied requests can be retried; browsers without Keyboard Lock
  offer fullscreen without claiming to capture reserved shortcuts.
- [#5491](https://github.com/zellij-org/zellij/issues/5491): allow `--token-name`
  with either `--create-token` or `--create-read-only-token`, while rejecting
  contradictory operations and a token name without token creation.

Chrome only enables Keyboard Lock in page-initiated fullscreen; it cannot
capture reserved browser shortcuts in a normal tab. See the
[Chrome Keyboard Lock documentation](https://developer.chrome.com/docs/capabilities/web-apis/keyboard-lock).
The Escape server fix also applies without Keyboard Lock, including Firefox.

## Build and test

Use the Rust version in `rust-toolchain.toml` and Node.js 22 or newer.

```sh
cargo xtask assets
cargo fmt --all -- --check
cargo xtask assets --check
node --test zellij-client/tests/*.test.mjs
cargo test --locked -p zellij-utils --lib cli::tests
cargo test --locked -p zellij-client --features web_server_capability --lib web_client::message_handlers::tests
cargo build --locked --release --no-default-features --features web_server_capability
```

This build uses the checked-in upstream plugin assets and produces
`target/release/zellij` with web support. The **Web fixes** GitHub Actions
workflow runs these checks and uploads a Linux x86_64 binary on pushes to
`web-fixes`. The artifact targets Ubuntu 24.04; it is not a static musl build.

```sh
./target/release/zellij web --create-token --token-name Test
./target/release/zellij web --create-read-only-token --token-name Watcher
```

For a manual browser check, attach to a session, click **Capture keyboard**,
allow capture, and check Ctrl+T / Ctrl+N against your configured bindings.
In Vim, enter insert mode, type, and press Esc: subsequent keys should act in
normal mode. Repeat outside fullscreen. Also verify that holding Esc exits
fullscreen and that capture can be enabled again.

When updating the upstream base, rebase these commits onto the new release,
regenerate assets, and rerun the checks above. Changes to frontend source
modules require `cargo xtask assets` to refresh `app.js`, HTML integrity
attributes, and `integrity.json` together.
