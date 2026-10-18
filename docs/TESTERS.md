# Goblin Grocery playtest: install guide

Paste or attach this with the download link. Build files come from `npm run release` (in `release/`).

---

Thanks for testing **Goblin Grocery**, a shopping-cart roguelite. Push your cart through 7 aisles, build item combos in the shop between waves, and beat the Store Manager.

## Which file?

| Computer | File |
|---|---|
| Mac with Apple chip (M1 or newer) | `Goblin Grocery-<version>-mac-arm64.zip` |
| Mac with Intel chip | `Goblin Grocery-<version>-mac-x64.zip` |
| Windows 10/11 (64-bit) | `Goblin Grocery-<version>-win-x64.zip` |

Not sure which Mac you have? Apple menu → About This Mac → "Chip" (Apple M…) or "Processor" (Intel).

## Mac

The game isn't signed with an Apple developer certificate yet, so macOS blocks it the first time.

1. Double-click the zip to unpack it and drag **Goblin Grocery** into Applications.
2. Double-click it. macOS shows a warning that it can't verify the app. Click **Done** (or **Cancel**).
3. Open **System Settings → Privacy & Security**, scroll down to the message about Goblin Grocery, and click **Open Anyway**. Confirm with your password.
4. From then on it opens normally.

If macOS says the app **"is damaged and can't be opened"**, open Terminal and run the command below, then try again:

```
xattr -dr com.apple.quarantine "/Applications/Goblin Grocery.app"
```

## Windows

1. Right-click the zip → **Extract All…** → Extract. Don't run the game from inside the zip.
2. In the extracted folder, double-click **Goblin Grocery.exe**.
3. If "Windows protected your PC" appears, click **More info → Run anyway**. The game is just unsigned.

## Controls

- **WASD / arrow keys:** push the cart. Weapons fire automatically.
- **Space:** cart shove (dash and knock back, 3 s cooldown).
- **Tab:** look at your cart (pauses).
- **Esc:** pause and settings.
- **Shop:** drag items with the mouse, **R** rotates the held item, click to inspect.
- Gamepads work too: plug one in and press a button.

Keys can be rebound under Settings → Controls.

## What we'd love to hear

Send feedback to: **<fill in: form link, Discord channel or email>**

- Where you got stuck, confused, or bored.
- Anything that felt unfair or too easy.
- Bugs: what you were doing, which aisle, and a screenshot of the end-of-run receipt if you have one.
- Your computer (Mac/Windows, model) if something ran slowly or looked wrong.

Your progress is saved on your computer. If an update is sent out, just replace the old app.
