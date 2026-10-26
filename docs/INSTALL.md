# Install ORBIT on your watch

ORBIT is not in the Zepp app store yet. Every version is on the
**[Releases page](https://github.com/fat-toni/ORBIT-Watchface/releases)**, and there are two ways to get it onto your watch:

| | You use | You need |
|---|---|---|
| **[A. Zepp app](#a-with-the-zepp-app)** | the official Zepp app on your phone | a computer (Windows, macOS or Linux) and a Zepp account |
| **[B. Gadgetbridge](#b-with-gadgetbridge)** | [Gadgetbridge](https://gadgetbridge.org) instead of the Zepp app | an Android phone with Gadgetbridge already set up |

## A. With the Zepp app

You install the watchface from your computer with the [Zeus CLI](https://docs.zepp.com/docs/guides/tools/cli/), Zepp's developer tool.

**1. Install Node.js** (once)

| System  | Command |
|---------|---------|
| Windows | `winget install OpenJS.NodeJS.LTS` (then open a new terminal) |
| macOS   | `brew install node` ([Homebrew](https://brew.sh)) |
| Linux   | `sudo apt install nodejs npm` (Debian/Ubuntu) or your distro's package manager |

You can also download it from [nodejs.org](https://nodejs.org).

**2. Download ORBIT**

On the [Releases page](https://github.com/fat-toni/ORBIT-Watchface/releases), open the newest version and download
**Source code (zip)** under *Assets*. Unzip it and open a terminal in the unzipped folder (`ORBIT-Watchface-…`).

<details>
<summary>Or with Git</summary>

```bash
git clone https://github.com/fat-toni/ORBIT-Watchface.git
cd ORBIT-Watchface
```

</details>

**3. Start the preview**

```bash
npm install -g @zeppos/zeus-cli
npm install
zeus preview
```

The first time, `zeus preview` opens your browser to log in with your Zepp account.
Then choose **Amazfit Bip 6** and a QR code appears.

On Windows, if PowerShell says that `zeus.ps1` cannot be loaded, run
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or use the Command Prompt (`cmd`) instead.
On Linux and macOS, if `npm install -g` fails with a permission error, see
[npm's guide](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally).

**4. Scan the QR code with your phone**

1. In the Zepp app, open **Profile → Settings → About** and tap the Zepp icon 7 times in a row until a pop-up appears. This turns on developer mode.
2. Open the new **Developer Mode** entry in the Zepp app, go to the **Watch Face** part and tap **Scan**.
   (Scanning in the app part instead ends with “Fail to unzip the package”.)
3. Scan the QR code. ORBIT is installed and shows up in the watchface list of your watch.

When you are done, run `zeus logout` and turn developer mode off again.

## B. With Gadgetbridge

**What is Gadgetbridge?** [Gadgetbridge](https://gadgetbridge.org) is a free, open-source Android app that talks to
your watch over Bluetooth **instead of the Zepp app**: no Zepp account, no cloud. It supports the Bip 6 and can install
Zepp OS watchfaces straight from a file, without a computer.

**Is this the right way for you?**

- ✅ You already use Gadgetbridge with your watch: this is the easiest way, just follow the two steps below.
- ❌ You use the Zepp app: take [way A](#a-with-the-zepp-app). Gadgetbridge replaces the Zepp app, it does not run
  next to it, so you would set up your watch anew.
- ❌ You have an iPhone: Gadgetbridge is Android only, take [way A](#a-with-the-zepp-app).

Setting up Gadgetbridge for the first time takes a little effort: the Bip 6 only pairs with a secret key, which you
get once from your Zepp account. Gadgetbridge explains it in its
[pairing guide](https://gadgetbridge.org/basics/pairing/huami-xiaomi-server/).

**The `.zab` file** is the finished package: the whole of ORBIT in one file. With Gadgetbridge set up:

1. On your phone, open the [Releases page](https://github.com/fat-toni/ORBIT-Watchface/releases) and download
   **ORBIT-<version>.zab** (under *Assets* of the newest version).
2. Tap the downloaded file and open it with Gadgetbridge (or share it to Gadgetbridge), then confirm the install.
   ORBIT appears in the watchface list of your watch.

> [!NOTE]
> This way has not been tried with ORBIT yet. If it works for you (or not), please open an issue.

## Make it yours

Long-press the watchface and tap the **pencil** to open the editor. Tap the time for the accent color, a ring for its
content, the date for its style and the row under the time for the weekday, your location or nothing. Your choice stays until
you change it again.

← [Back to the README](../README.md)
