import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Coins, Sparkles, Wallet, Twitter, Github, Mail, ExternalLink, Shield, ChevronRight, Copy, CheckCircle2 } from "lucide-react";

/**
 * FIATCOIN — Tribute to XRP + Presale Site (React SPA)
 * -----------------------------------------------------------
 * ✅ Hero + XRP Tribute (David Schwartz, Brad Garlinghouse, Ripple history)
 * ✅ Flipper Index (NFT meme gallery scaffold)
 * ✅ Presale section with XNS name + fallback r‑address + progress meter
 * ✅ How to Buy (pre‑listing / post‑listing copy)
 * ✅ Explorer links (XRPSCAN, Bithomp, XPMarket)
 * ✅ Contact block
 * ✅ Wallet "Connect" without external SDKs (manual address entry)
 * ✅ Lightweight XRPL balance fetcher using native WebSocket (no external xrpl pkg)
 * ✅ Built‑in diagnostics + test cases (see <Tests />)
 * ✅ Uses TailwindCSS (add @tailwind base/components/utilities to your index.css)
 *
 * Logo & icons:
 *  - Put your logo at /public/fiatcoin.png (hero+nav uses it) OR pass ?logo=https://...
 *  - Favicon: /public/favicon.ico and /public/apple-touch-icon.png
 *
 * Deploy: Vercel / Netlify / Cloudflare Pages. Domain: fiatcoin.app.
 */

// ▶▶ Configure token + presale
const FIATCOIN_ISSUER = "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"; // XRPL issuer (replace)
const FIATCOIN_CURRENCY = "FIAT"; // your currency code

const PRESALE_XNS = "fiatcoin.xrp"; // Your XNS name for presale (preferred human‑readable address)
const PRESALE_ADDRESS = "rsvjkcy91roaSeEdokijvmCbFBLoDFoXRP"; // Fallback XRPL classic address (replace with your real r‑address)
const PRESALE_TARGET_XRP = 250000; // total goal in XRP (edit)
let PRESALE_RAISED_XRP_DEFAULT = 0; // manually update as you raise funds (wire API later)

const XRPL_WS = "wss://xrplcluster.com"; // Public XRPL WebSocket cluster

// ──────────────────────────────────────────────────────────────────────────────
// Minimal XRPL client (no external deps). Works in browser using WebSocket.
class XRPLClientLite {
  url: string;
  ws: WebSocket | null;
  id: number;
  pending: Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>;
  openPromise: Promise<void> | null;
  constructor(url: string) {
    this.url = url;
    this.ws = null;
    this.id = 0;
    this.pending = new Map();
    this.openPromise = null;
  }
  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.openPromise) return this.openPromise;
    this.ws = new WebSocket(this.url);
    this.openPromise = new Promise((resolve, reject) => {
      this.ws!.addEventListener("open", () => resolve(), { once: true });
      this.ws!.addEventListener("error", (e) => reject(e), { once: true });
      this.ws!.addEventListener("message", (ev) => {
        try {
          const msg = JSON.parse(ev.data as any);
          if ((msg as any)?.id && this.pending.has((msg as any).id)) {
            const { resolve, reject } = this.pending.get((msg as any).id)!;
            this.pending.delete((msg as any).id);
            if ((msg as any).status === "error") reject(msg);
            else resolve(msg);
          }
        } catch {}
      });
    });
    return this.openPromise;
  }
  request(obj: Record<string, unknown>) {
    const id = ++this.id;
    const payload = JSON.stringify({ id, ...obj });
    return new Promise(async (resolve, reject) => {
      try {
        await this.connect();
        this.pending.set(id, { resolve, reject });
        this.ws!.send(payload);
        setTimeout(() => {
          if (this.pending.has(id)) {
            this.pending.delete(id);
            reject(new Error("XRPL request timeout"));
          }
        }, 15000);
      } catch (e) {
        reject(e);
      }
    });
  }
  async disconnect() {
    try { this.ws?.close(); } catch {}
    this.ws = null;
    this.openPromise = null;
  }
}
// ──────────────────────────────────────────────────────────────────────────────

// Helpers
const fmt = (n: number | string, opts: Intl.NumberFormatOptions = {}) => {
  try {
    const num = typeof n === "string" ? Number(n) : n;
    if (Number.isNaN(num)) return String(n);
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 6, ...opts }).format(num);
  } catch {
    return String(n);
  }
};
const clampPct = (raised: number, target: number) => {
  if (!target || target <= 0) return 0;
  const pct = (raised / target) * 100;
  return Math.max(0, Math.min(100, pct));
};
const isXrpClassicAddress = (s: string) => /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(String(s || "").trim());

// ──────────────────────────────────────────────────────────────────────────────
// Logo handling with fallbacks & query param (?logo=)
const PLACEHOLDER_DATA = (() => {
  const svg = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512'>`
    + `<rect width='100%' height='100%' fill='white'/>`
    + `<text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle'`
    + ` font-family='system-ui,Segoe UI,Inter,sans-serif' font-size='240' fill='black'>$</text>`
    + `</svg>`
  );
  return `data:image/svg+xml;charset=UTF-8,${svg}`;
})();
function buildLogoSources() {
  try {
    const url = new URL(window.location.href);
    const qp = url.searchParams.get("logo");
    const list: string[] = [];
    if (qp) list.push(qp);
    list.push("/fiatcoin.png", "/logo.png", "/favicon.ico", "/apple-touch-icon.png", PLACEHOLDER_DATA);
    return list;
  } catch {
    return ["/fiatcoin.png", "/logo.png", PLACEHOLDER_DATA];
  }
}
function LogoImage({ className = "", alt = "Logo" }: { className?: string; alt?: string }) {
  const [sources] = useState(buildLogoSources());
  const [idx, setIdx] = useState(0);
  const src = sources[idx] || PLACEHOLDER_DATA;
  return (
    <img src={src} alt={alt} className={className} onError={() => {
      if (idx < sources.length - 1) setIdx(idx + 1);
    }} />
  );
}
// ──────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState("");
  const [fiatBalance, setFiatBalance] = useState<number | null>(null);
  const [xrpBalance, setXrpBalance] = useState<number | null>(null);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedXns, setCopiedXns] = useState(false);
  const [raised, setRaised] = useState(PRESALE_RAISED_XRP_DEFAULT);
  const [showConnect, setShowConnect] = useState(false);

  const xrplLite = useMemo(() => new XRPLClientLite(XRPL_WS), []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const qAddr = url.searchParams.get("account") || url.searchParams.get("address");
    if (isXrpClassicAddress(qAddr || "")) {
      handleConnected(qAddr!);
    }
  }, []);

  async function fetchBalances(acct: string) {
    try {
      await xrplLite.connect();
      const ai: any = await xrplLite.request({ command: "account_info", account: acct, ledger_index: "validated" });
      const xrp = (Number(ai?.result?.account_data?.Balance) || 0) / 1_000_000;
      setXrpBalance(xrp);
      const lines: any = await xrplLite.request({ command: "account_lines", account: acct, ledger_index: "validated" });
      const line = (lines?.result?.lines || []).find(
        (l: any) => (l.currency?.toUpperCase?.() === FIATCOIN_CURRENCY.toUpperCase()) && (l.account === FIATCOIN_ISSUER)
      );
      setFiatBalance(line ? Number(line.balance) : 0);
    } catch (e) {
      console.warn("XRPL fetch error", e);
    }
  }

  function handleConnected(acct: string) {
    setConnected(true);
    setAddress(acct);
    fetchBalances(acct);
    setShowConnect(false);
  }

  const disconnect = async () => {
    setConnected(false);
    setAddress("");
    setFiatBalance(null);
    setXrpBalance(null);
    try { await xrplLite.disconnect(); } catch {}
  };

  const percent = clampPct(raised, PRESALE_TARGET_XRP);

  const copyAddr = async () => {
    try {
      await navigator.clipboard.writeText(PRESALE_ADDRESS);
      setCopiedAddr(true);
      setTimeout(() => setCopiedAddr(false), 1500);
    } catch {}
  };

  const copyXns = async () => {
    try {
      await navigator.clipboard.writeText(PRESALE_XNS);
      setCopiedXns(true);
      setTimeout(() => setCopiedXns(false), 1500);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader connected={connected} address={address} onConnect={() => setShowConnect(true)} onDisconnect={disconnect} />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Hero />
        <Presale
          xns={PRESALE_XNS}
          onCopyXns={copyXns}
          copiedXns={copiedXns}
          address={PRESALE_ADDRESS}
          target={PRESALE_TARGET_XRP}
          raised={raised}
          percent={percent}
          onCopyAddr={copyAddr}
          copiedAddr={copiedAddr}
        />
        <XrpTribute />
        <FlipperIndex />
        <HowToBuy />
        <ExplorerLinks />
        <Disclaimers />
        <Contact />
        <Diagnostics xrplLite={xrplLite} />
        <Tests />
      </main>
      <SiteFooter />
      <WalletBar
        connected={connected}
        address={address}
        fiatBalance={fiatBalance}
        xrpBalance={xrpBalance}
        onConnect={() => setShowConnect(true)}
        onDisconnect={disconnect}
      />
      {showConnect && (
        <ConnectModal
          onClose={() => setShowConnect(false)}
          onConnectAddress={(acct) => handleConnected(acct)}
        />
      )}
    </div>
  );
}

function SiteHeader({ connected, address, onConnect, onDisconnect }: { connected: boolean; address: string; onConnect: () => void; onDisconnect: () => void }) {
  return (
    <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-black/60 bg-black/70 border-b border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Logo — place /public/fiatcoin.png or pass ?logo= */}
          <LogoImage className="h-9 w-9 rounded-full ring-1 ring-white/10 object-cover" alt="FIATCOIN" />
          <span className="font-bold tracking-wide">FIATCOIN</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <a href="#presale" className="hover:text-zinc-300">Presale</a>
          <a href="#tribute" className="hover:text-zinc-300">XRP Tribute</a>
          <a href="#flipper" className="hover:text-zinc-300">Flipper Index</a>
          <a href="#howto" className="hover:text-zinc-300">How to Buy</a>
          <a href="#contact" className="hover:text-zinc-300">Contact</a>
        </nav>
        <div className="flex items-center gap-3">
          {connected ? (
            <button onClick={onDisconnect} className="px-3 py-1.5 rounded-xl bg-white text-black text-sm font-semibold">Disconnect</button>
          ) : (
            <button onClick={onConnect} className="px-3 py-1.5 rounded-xl bg-white text-black text-sm font-semibold flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Connect Wallet
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="pt-14 pb-10">
      <div className="grid lg:grid-cols-2 items-center gap-10">
        <div className="space-y-6">
          <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-4xl md:text-6xl font-extrabold leading-tight">
            The Most Ironic <span className="text-white/70">Meme</span> is the One Backed by <span className="underline decoration-white/30">Reality</span>
          </motion.h1>
          <p className="text-white/70 max-w-prose">
            <strong>FIATCOIN</strong> is a playful tribute to the builders and believers in XRP. We meme the past, celebrate the present, and ship for the future—
            with a nod to the legends who helped bring utility to crypto.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="#presale" className="inline-flex items-center gap-2 rounded-2xl bg-white text-black px-4 py-2 font-semibold">
              Join Presale <ArrowRight className="h-4 w-4" />
            </a>
            <a href="#flipper" className="inline-flex items-center gap-2 rounded-2xl ring-1 ring-white/20 px-4 py-2">
              Explore Flipper Index <ChevronRight className="h-4 w-4" />
            </a>
          </div>
          <p className="text-xs text-white/50">Disclaimer: FIATCOIN is a meme project. Nothing here is financial advice.</p>
        </div>
        <div className="aspect-[1/1] rounded-3xl bg-gradient-to-br from-white/5 to-white/0 ring-1 ring-white/10 flex items-center justify-center p-6">
          {/* Hero logo with fallbacks */}
          <LogoImage alt="FIATCOIN" className="max-h-full object-contain" />
        </div>
      </div>
    </section>
  );
}

function Presale({ address, target, raised, percent, onCopyAddr, copiedAddr, xns, onCopyXns, copiedXns }: { address: string; target: number; raised: number; percent: number; onCopyAddr: () => void; copiedAddr: boolean; xns: string; onCopyXns: () => void; copiedXns: boolean; }) {
  return (
    <section id="presale" className="py-16 border-t border-white/10">
      <div className="mb-6">
        <h2 className="text-3xl md:text-4xl font-bold">Presale</h2>
        <p className="text-white/70 mt-2 max-w-3xl">
          Preferred: send <strong>XRP</strong> to our <strong>XNS name</strong> <code className="px-1 rounded bg-white/10">{xns}</code>. If your wallet doesn’t support XNS, use the fallback XRPL classic address below.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* XNS Name (preferred) */}
        <div className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10">
          <div className="text-sm text-white/60 mb-1">Contribution (XNS name)</div>
          <div className="flex items-center justify-between gap-3">
            <code className="text-sm break-all">{xns}</code>
            <button onClick={onCopyXns} className="shrink-0 inline-flex items-center gap-1 rounded-xl px-3 py-1.5 ring-1 ring-white/20 hover:bg-white/10">
              {copiedXns ? (<><CheckCircle2 className="h-4 w-4"/> Copied</>) : (<><Copy className="h-4 w-4"/> Copy</>)}
            </button>
          </div>
          <ol className="mt-3 list-decimal list-inside space-y-1 text-sm text-white/80">
            <li>Open Xaman (XUMM) → <em>Send</em>.</li>
            <li>In the recipient field, type <code className="px-1 rounded bg-white/10">{xns}</code>.</li>
            <li>Confirm the resolved address matches our fallback r‑address below.</li>
            <li>Enter amount, verify network = XRPL Mainnet, then sign.</li>
          </ol>
        </div>

        {/* Fallback r-address */}
        <div className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10">
          <div className="text-sm text-white/60 mb-1">Fallback XRPL Classic Address</div>
          <div className="flex items-center justify-between gap-3">
            <code className="text-sm break-all">{address}</code>
            <button onClick={onCopyAddr} className="shrink-0 inline-flex items-center gap-1 rounded-xl px-3 py-1.5 ring-1 ring-white/20 hover:bg-white/10">
              {copiedAddr ? (<><CheckCircle2 className="h-4 w-4"/> Copied</>) : (<><Copy className="h-4 w-4"/> Copy</>)}
            </button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-white/50">Target</div>
              <div className="font-semibold">{fmt(target)} XRP</div>
            </div>
            <div>
              <div className="text-white/50">Raised</div>
              <div className="font-semibold">{fmt(raised)} XRP</div>
            </div>
            <div>
              <div className="text-white/50">Progress</div>
              <div className="font-semibold">{fmt(percent, { maximumFractionDigits: 2 })}%</div>
            </div>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-white/10">
            <div className="h-2 rounded-full bg-white" style={{ width: `${percent}%` }} />
          </div>
          <div className="mt-4 text-xs text-white/50">Note: Keep your transaction hash. Token distribution/claim details will follow.</div>
        </div>
      </div>

      {/* XNS caveats */}
      <div className="mt-6 text-xs text-white/50">
        Some wallets don’t resolve XNS yet. If yours can’t, paste the fallback r‑address. Always verify the resolved address before sending.
      </div>
    </section>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-2 rounded-full bg-white/5 ring-1 ring-white/10 px-3 py-1 text-xs">{children}</span>;
}

function XrpTribute() {
  return (
    <section id="tribute" className="py-16 border-t border-white/10">
      <div className="mb-10">
        <h2 className="text-3xl md:text-4xl font-bold">XRP Tribute</h2>
        <p className="text-white/70 mt-2 max-w-3xl">
          A short, respectful nod to the builders, the company, and the community: <strong>David Schwartz</strong> (CTO & distributed systems wizard), <strong>Brad Garlinghouse</strong> (CEO),
          and the <strong>Ripple</strong> team that helped push real-world payments, liquidity, and compliance conversations forward.
        </p>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        <Card title="David Schwartz" subtitle="CTO, Ripple">
          <p className="text-white/70">Often called "JoelKatz" online, David’s work on distributed systems and the XRP Ledger helped pioneer fast, low‑cost settlement. Much respect.</p>
        </Card>
        <Card title="Brad Garlinghouse" subtitle="CEO, Ripple">
          <p className="text-white/70">A steady hand through storms—Brad steered major partnerships and regulatory clarity efforts, advocating utility over hype.</p>
        </Card>
        <Card title="Ripple & XRPL" subtitle="History, Builders, Community">
          <p className="text-white/70">From early interbank settlement ideas to on‑chain AMM and hooks research, the XRPL community keeps shipping. FIATCOIN salutes the ethos.</p>
        </Card>
      </div>
      <div className="mt-8 flex flex-wrap gap-2">
        <Pill><Shield className="h-3.5 w-3.5"/> Low‑fee, fast finality</Pill>
        <Pill><Sparkles className="h-3.5 w-3.5"/> Builder energy</Pill>
        <Pill><Coins className="h-3.5 w-3.5"/> Utility over noise</Pill>
      </div>
    </section>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10">
      <div className="font-semibold">{title}</div>
      {subtitle && <div className="text-xs text-white/50 mb-2">{subtitle}</div>}
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function FlipperIndex() {
  const people = [
    { name: "Donald Trump", handle: "@realDonaldTrump", blurb: "From skeptic to builder‑friendly rhetoric.", id: "trump" },
    { name: "Mark Cuban", handle: "@mcuban", blurb: "Once harsh, now an active investor in crypto infra.", id: "cuban" },
    { name: "Jamie Dimon", handle: "JPM exec", blurb: "Public criticisms vs. institutional adoption.", id: "dimon" },
    { name: "Larry Fink", handle: "BlackRock", blurb: "‘Tokenization is the future of markets.’", id: "fink" },
  ];
  return (
    <section id="flipper" className="py-16 border-t border-white/10">
      <div className="mb-6">
        <h2 className="text-3xl md:text-4xl font-bold">The Flipper Index (NFT Collection)</h2>
        <p className="text-white/70 mt-2 max-w-3xl">
          A satirical hall of fame for the loudest crypto skeptics turned adopters. We meme the original takes, mint the flip, and immortalize the irony. Each card references a public quote or tweet, then pairs it with the updated stance. Minting details soon.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {people.map((p) => (
          <div key={p.id} className="rounded-2xl p-4 bg-white/5 ring-1 ring-white/10">
            <div className="text-lg font-semibold">{p.name}</div>
            <div className="text-xs text-white/50">{p.handle}</div>
            <div className="text-sm mt-3 text-white/70">{p.blurb}</div>
            <button className="mt-4 text-sm inline-flex items-center gap-1 rounded-xl px-3 py-1.5 ring-1 ring-white/20 hover:bg-white/10">
              View Meme <ExternalLink className="h-3.5 w-3.5"/>
            </button>
          </div>
        ))}
      </div>
      <div className="mt-6 text-sm text-white/50">Have a nomination? <a href="#contact" className="underline">Submit it via contact</a>.</div>
    </section>
  );
}

function HowToBuy() {
  return (
    <section id="howto" className="py-16 border-t border-white/10">
      <div className="mb-6">
        <h2 className="text-3xl md:text-4xl font-bold">How to Buy FIATCOIN</h2>
      </div>
      <ol className="space-y-3 text-white/80">
        <li className="flex items-start gap-3"><span className="mt-1 h-6 w-6 flex items-center justify-center rounded-full bg-white text-black text-sm font-bold">1</span><div>
          Install <a className="underline" href="https://xaman.app/" target="_blank" rel="noreferrer">Xaman (XUMM)</a> on mobile and create/backup your wallet.
        </div></li>
        <li className="flex items-start gap-3"><span className="mt-1 h-6 w-6 flex items-center justify-center rounded-full bg-white text-black text-sm font-bold">2</span><div>
          Create a trust line to <code className="px-1 rounded bg-white/10">{FIATCOIN_CURRENCY}</code> from issuer <code className="px-1 rounded bg-white/10">{FIATCOIN_ISSUER}</code> (we’ll publish a deep‑link later).
        </div></li>
        <li className="flex items-start gap-3"><span className="mt-1 h-6 w-6 flex items-center justify-center rounded-full bg-white text-black text-sm font-bold">3</span><div>
          During presale, send XRP to <code className="px-1 rounded bg-white/10">{PRESALE_XNS}</code>. If your wallet can’t resolve XNS, use the fallback r‑address shown above.
        </div></li>
        <li className="flex items-start gap-3"><span className="mt-1 h-6 w-6 flex items-center justify-center rounded-full bg-white text-black text-sm font-bold">4</span><div>
          Press <strong>Connect Wallet</strong> to enter your XRPL address and view balances here.
        </div></li>
      </ol>
      <div className="mt-6 text-xs text-white/50">Always verify the issuer and addresses from our official channels. This is a meme project; not financial advice.</div>
    </section>
  );
}

function ExplorerLinks() {
  return (
    <section className="py-16 border-t border-white/10">
      <h3 className="text-2xl font-semibold mb-4">Explorers & References</h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <LinkTile title="XRPScan" href="https://xrpscan.com/" />
        <LinkTile title="Bithomp" href="https://bithomp.com/" />
        <LinkTile title="XPMarket (Pairs)" href="https://xpmarket.com/" />
        <LinkTile title="Ripple (Company)" href="https://ripple.com/" />
        <LinkTile title="XRPL Docs" href="https://xrpl.org/" />
        <LinkTile title="Xaman (XUMM)" href="https://xaman.app/" />
      </div>
      <div className="mt-3 text-xs text-white/50">Tip: If your wallet supports XNS, you can send directly to <code className="px-1 rounded bg-white/10">{PRESALE_XNS}</code>. Otherwise, use the fallback r‑address above.</div>
    </section>
  );
}

function LinkTile({ title, href }: { title: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="rounded-2xl p-4 bg-white/5 ring-1 ring-white/10 flex items-center justify-between hover:bg-white/10">
      <div className="font-medium">{title}</div>
      <ExternalLink className="h-4 w-4" />
    </a>
  );
}

function Contact() {
  return (
    <section id="contact" className="py-16 border-t border-white/10">
      <h3 className="text-2xl font-semibold mb-4">Contact</h3>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10">
          <div className="text-sm text-white/70">Press / collabs / submissions for the Flipper Index.</div>
          <form className="mt-4 grid gap-3" onSubmit={(e) => e.preventDefault()}>
            <input className="bg-transparent ring-1 ring-white/15 rounded-xl px-3 py-2 outline-none" placeholder="Your email" />
            <textarea className="bg-transparent ring-1 ring-white/15 rounded-xl px-3 py-2 outline-none min-h-[120px]" placeholder="Message" />
            <button className="justify-self-start inline-flex items-center gap-2 rounded-2xl bg-white text-black px-4 py-2 font-semibold">
              Send <Mail className="h-4 w-4" />
            </button>
          </form>
        </div>
        <div className="rounded-2xl p-5 bg-white/5 ring-1 ring-white/10">
          <div className="text-sm text-white/70">Follow & repos</div>
          <div className="mt-3 grid gap-2">
            <a className="inline-flex items-center gap-2 hover:underline" href="#" target="_blank" rel="noreferrer"><Twitter className="h-4 w-4" /> X / Twitter</a>
            <a className="inline-flex items-center gap-2 hover:underline" href="#" target="_blank" rel="noreferrer"><Github className="h-4 w-4" /> GitHub</a>
            <a className="inline-flex items-center gap-2 hover:underline" href="mailto:hello@fiatcoin.app"><Mail className="h-4 w-4" /> hello@fiatcoin.app</a>
          </div>
        </div>
      </div>
      <div className="text-xs text-white/50 mt-6">Parody / satire for commentary. Not affiliated with Ripple. Not investment advice.</div>
    </section>
  );
}

function WalletBar({ connected, address, fiatBalance, xrpBalance, onConnect, onDisconnect }: { connected: boolean; address: string; fiatBalance: number | null; xrpBalance: number | null; onConnect: () => void; onDisconnect: () => void; }) {
  return (
    <div className="fixed bottom-4 inset-x-0 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white text-black shadow-xl">
        <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-black text-white flex items-center justify-center"><Wallet className="h-4 w-4" /></div>
            <div>
              <div className="text-sm font-semibold">Wallet</div>
              <div className="text-xs text-black/60">
                {connected ? (
                  <span className="break-all">{address}</span>
                ) : (
                  "Not connected"
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-black/60">XRP</div>
              <div className="font-semibold">{xrpBalance != null ? fmt(xrpBalance) : "—"}</div>
            </div>
            <div>
              <div className="text-black/60">{FIATCOIN_CURRENCY}</div>
              <div className="font-semibold">{fiatBalance != null ? fmt(fiatBalance) : "—"}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {connected ? (
              <button onClick={onDisconnect} className="px-3 py-1.5 rounded-xl ring-1 ring-black/10">Disconnect</button>
            ) : (
              <button onClick={onConnect} className="px-3 py-1.5 rounded-xl bg-black text-white">Connect Wallet</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-20 py-10 border-t border-white/10 text-center text-xs text-white/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        © {new Date().getFullYear()} FIATCOIN — A tribute/meme project for the XRP community.
      </div>
    </footer>
  );
}

function Disclaimers() {
  const lines = [
    "This is satire. If you mistype your address, the blockchain will maintain a respectful silence.",
    "Keys not backed up? That’s a feature request for Past‑You, who is ignoring support tickets.",
    "If a meme pumps your bags, it’s still not monetary policy (however tempting).",
    "Latency is fast; regulatory clarity is slow; neither cares about your bedtime.",
    "If the code behaves as documented, it’s a miracle. If it behaves as intended, buy a lottery ticket.",
    "Schrödinger’s Faucet: funds are simultaneously pending and confirmed until you refresh.",
    "Never send funds you can’t afford to forget existed in a parallel timeline.",
    "Trustlines are like friendships: easy to add, awkward to explain at tax time.",
    "The ledger is deterministic; human behavior is not. Plan accordingly.",
    "NFA/NGMI/LOL: Choose two, preferably the first one.",
  ];
  return (
    <section className="py-16 border-t border-white/10">
      <h3 className="text-2xl font-semibold mb-2">Quasi‑JoelKatz‑Style Disclaimers (Parody)</h3>
      <div className="text-white/60 text-sm max-w-3xl">
        <p className="mb-3">In the spirit of dry humor and distributed systems pedantry, please enjoy the following disclaimers. They are <em>not</em> written by JoelKatz, but the vibe tries hard.</p>
        <ul className="list-disc list-inside space-y-1">
          {lines.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </div>
    </section>
  );
}

function ConnectModal({ onClose, onConnectAddress }: { onClose: () => void; onConnectAddress: (a: string) => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isXrpClassicAddress(input)) {
      setError("Please enter a valid XRPL classic address (starts with 'r').");
      return;
    }
    onConnectAddress(input.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-lg rounded-2xl bg-zinc-900 ring-1 ring-white/10 p-5">
        <div className="text-lg font-semibold">Connect Wallet</div>
        <div className="text-sm text-white/60 mt-1">Paste your XRPL classic address (r...). We’ll fetch XRP and {FIATCOIN_CURRENCY} balances read‑only.</div>
        <form onSubmit={submit} className="mt-4 grid gap-3">
          <input value={input} onChange={(e)=>setInput(e.target.value)} className="bg-transparent ring-1 ring-white/15 rounded-xl px-3 py-2 outline-none" placeholder="r..." />
          {error && <div className="text-red-300 text-xs">{error}</div>}
          <div className="flex items-center gap-2">
            <button type="submit" className="px-3 py-1.5 rounded-xl bg-white text-black font-semibold">Connect</button>
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-xl ring-1 ring-white/15">Cancel</button>
          </div>
        </form>
        <div className="text-xs text-white/40 mt-3">
          Tip: In production you can replace this modal with a Xaman (XUMM) OAuth or payload deep‑link flow.
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Diagnostics (basic connectivity test)
function Diagnostics({ xrplLite }: { xrplLite: XRPLClientLite }) {
  const [status, setStatus] = useState("idle");
  const [ledger, setLedger] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setStatus("running");
    setError(null);
    try {
      await xrplLite.connect();
      const res: any = await xrplLite.request({ command: "ledger", ledger_index: "validated" });
      setLedger(res?.result?.ledger?.ledger_index || res?.result?.ledger_index || null);
      setStatus("ok");
    } catch (e: any) {
      setError(String(e?.message || e));
      setStatus("error");
    }
  };

  return (
    <section className="py-10">
      <div className="rounded-2xl p-4 bg-white/5 ring-1 ring-white/10">
        <div className="flex items-center justify-between">
          <div className="text-sm">Diagnostics: XRPL connectivity self‑test</div>
          <button onClick={run} className="text-sm rounded-xl px-3 py-1.5 ring-1 ring-white/20 hover:bg-white/10">Run</button>
        </div>
        <div className="mt-2 text-xs text-white/60">
          Status: {status} {ledger && `• validated ledger ${ledger}`}
          {error && <div className="text-red-300 mt-1">{error}</div>}
        </div>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Simple Test Cases — run in-browser to validate helpers & regressions
function Tests() {
  const [results, setResults] = useState<{ name: string; pass: boolean }[]>([]);

  function assert(name: string, condition: boolean) {
    return { name, pass: Boolean(condition) };
  }

  const run = () => {
    const cases: { name: string; pass: boolean }[] = [];
    // fmt
    cases.push(assert("fmt formats number", fmt(12345.678) === new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(12345.678)));
    cases.push(assert("fmt handles string", fmt("1000") === new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(1000)));
    // clampPct
    cases.push(assert("clampPct basic", clampPct(50, 100) === 50));
    cases.push(assert("clampPct clamps >100", clampPct(150, 100) === 100));
    cases.push(assert("clampPct clamps <0", clampPct(-10, 100) === 0));
    cases.push(assert("clampPct zero target", clampPct(10, 0) === 0));
    // address validator
    cases.push(assert("valid XRPL address", isXrpClassicAddress("rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv")));
    cases.push(assert("invalid XRPL address", !isXrpClassicAddress("abc123")));
    // logo source builder includes placeholder as last fallback
    const sources = buildLogoSources();
    cases.push(assert("logo builder has placeholder fallback", sources.length > 0 && sources[sources.length-1].startsWith("data:image/svg+xml")));

    setResults(cases);
  };

  return (
    <section className="py-6">
      <div className="rounded-2xl p-4 bg-white/5 ring-1 ring-white/10">
        <div className="flex items-center justify-between">
          <div className="text-sm">Unit tests (helpers)</div>
          <button onClick={run} className="text-sm rounded-xl px-3 py-1.5 ring-1 ring-white/20 hover:bg-white/10">Run tests</button>
        </div>
        <ul className="mt-3 space-y-1 text-xs">
          {results.map((r, i) => (
            <li key={i} className={r.pass ? "text-emerald-300" : "text-red-300"}>
              {r.pass ? "✓" : "✗"} {r.name}
            </li>
          ))}
          {results.length === 0 && <li className="text-white/50">(No results yet)</li>}
        </ul>
      </div>
    </section>
  );
}


