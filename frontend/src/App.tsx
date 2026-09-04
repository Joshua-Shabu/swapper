import { useState } from "react";
import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
import { TOKEN_A_ADDRESS, TOKEN_B_ADDRESS, PAIR_ADDRESS, ERC20_ABI, PAIR_ABI } from "./contracts";
import "./App.css";

declare global {
  interface Window {
    ethereum?: any;
  }
}

type Direction = "AtoB" | "BtoA";
type Tab = "swap" | "liquidity";

function getAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  const amountInWithFee = amountIn * 997n;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 1000n + amountInWithFee;
  return numerator / denominator;
}

function truncate(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function fmt(value: string) {
  if (!value) return "0";
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function TokenDot({ symbol }: { symbol: "MTA" | "MTB" }) {
  return <span className={`token-dot ${symbol === "MTA" ? "a" : "b"}`}>{symbol === "MTA" ? "A" : "B"}</span>;
}

function SwapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M7 10L12 5L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 14L12 19L17 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [ethBalance, setEthBalance] = useState("");
  const [balances, setBalances] = useState({ a: "", b: "" });
  const [lpBalance, setLpBalance] = useState("");
  const [reserves, setReserves] = useState<{ a: bigint; b: bigint }>({ a: 0n, b: 0n });
  const [token0IsA, setToken0IsA] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState<Tab>("swap");

  // --- Swap state ---
  const [direction, setDirection] = useState<Direction>("AtoB");
  const [swapAmountIn, setSwapAmountIn] = useState("");

  // --- Add liquidity state ---
  const [liqAmountA, setLiqAmountA] = useState("");
  const [liqAmountB, setLiqAmountB] = useState("");

  async function refresh(address: string) {
    const provider = new BrowserProvider(window.ethereum);

    const balanceWei = await provider.getBalance(address);
    setEthBalance(formatUnits(balanceWei, 18));

    const tokenA = new Contract(TOKEN_A_ADDRESS, ERC20_ABI, provider);
    const tokenB = new Contract(TOKEN_B_ADDRESS, ERC20_ABI, provider);
    const [balA, balB] = await Promise.all([tokenA.balanceOf(address), tokenB.balanceOf(address)]);
    setBalances({ a: formatUnits(balA, 18), b: formatUnits(balB, 18) });

    const pair = new Contract(PAIR_ADDRESS, PAIR_ABI, provider);
    const [token0, reserveData, lpBal] = await Promise.all([
      pair.token0(),
      pair.getReserves(),
      pair.balanceOf(address),
    ]);
    const isAToken0 = token0.toLowerCase() === TOKEN_A_ADDRESS.toLowerCase();
    setToken0IsA(isAToken0);
    setLpBalance(formatUnits(lpBal, 18));

    const [reserve0, reserve1] = reserveData;
    setReserves(isAToken0 ? { a: reserve0, b: reserve1 } : { a: reserve1, b: reserve0 });
  }

  async function connect() {
    setError("");
    if (!window.ethereum) {
      setError("No wallet found — install MetaMask.");
      return;
    }
    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const address = accounts[0];
      setAccount(address);
      await refresh(address);
    } catch (err: any) {
      setError(err.message ?? String(err));
    }
  }

  // --- Swap ---
  const sellSymbol = direction === "AtoB" ? "MTA" : "MTB";
  const buySymbol = direction === "AtoB" ? "MTB" : "MTA";
  const sellBalance = direction === "AtoB" ? balances.a : balances.b;

  let estimatedOut: bigint | null = null;
  try {
    if (swapAmountIn && reserves.a > 0n) {
      const amountInWei = parseUnits(swapAmountIn, 18);
      const [reserveIn, reserveOut] = direction === "AtoB" ? [reserves.a, reserves.b] : [reserves.b, reserves.a];
      estimatedOut = getAmountOut(amountInWei, reserveIn, reserveOut);
    }
  } catch {
    estimatedOut = null;
  }

  function flipDirection() {
    setDirection((d) => (d === "AtoB" ? "BtoA" : "AtoB"));
    setSwapAmountIn("");
  }

  async function handleSwap() {
    if (!account) return;
    setError("");
    setStatus("");
    try {
      const amountInWei = parseUnits(swapAmountIn, 18);
      const [reserveIn, reserveOut] = direction === "AtoB" ? [reserves.a, reserves.b] : [reserves.b, reserves.a];
      const amountOutWei = getAmountOut(amountInWei, reserveIn, reserveOut);
      if (amountOutWei <= 0n) throw new Error("Amount too small");

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const tokenInAddress = direction === "AtoB" ? TOKEN_A_ADDRESS : TOKEN_B_ADDRESS;
      const tokenIn = new Contract(tokenInAddress, ERC20_ABI, signer);
      const pair = new Contract(PAIR_ADDRESS, PAIR_ABI, signer);

      setStatus("Sending tokens to the pool... (check MetaMask)");
      const tx1 = await tokenIn.transfer(PAIR_ADDRESS, amountInWei);
      await tx1.wait();

      const outIsToken0 = direction === "AtoB" ? !token0IsA : token0IsA;
      const amount0Out = outIsToken0 ? amountOutWei : 0n;
      const amount1Out = outIsToken0 ? 0n : amountOutWei;

      setStatus("Swapping... (check MetaMask)");
      const tx2 = await pair.swap(amount0Out, amount1Out, account);
      await tx2.wait();

      setStatus("Swap complete!");
      setSwapAmountIn("");
      await refresh(account);
    } catch (err: any) {
      setError(err.message ?? String(err));
      setStatus("");
    }
  }

  // --- Add liquidity ---
  function handleAmountAChange(value: string) {
    setLiqAmountA(value);
    if (reserves.a > 0n && value) {
      try {
        const amountAWei = parseUnits(value, 18);
        const suggestedB = (amountAWei * reserves.b) / reserves.a;
        setLiqAmountB(formatUnits(suggestedB, 18));
      } catch {
        // ignore invalid partial input while typing
      }
    }
  }

  async function handleAddLiquidity() {
    if (!account) return;
    setError("");
    setStatus("");
    try {
      const amountAWei = parseUnits(liqAmountA, 18);
      const amountBWei = parseUnits(liqAmountB, 18);
      if (amountAWei <= 0n || amountBWei <= 0n) throw new Error("Enter both amounts");

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const tokenA = new Contract(TOKEN_A_ADDRESS, ERC20_ABI, signer);
      const tokenB = new Contract(TOKEN_B_ADDRESS, ERC20_ABI, signer);
      const pair = new Contract(PAIR_ADDRESS, PAIR_ABI, signer);

      setStatus("Sending Token A to the pool... (check MetaMask)");
      const tx1 = await tokenA.transfer(PAIR_ADDRESS, amountAWei);
      await tx1.wait();

      setStatus("Sending Token B to the pool... (check MetaMask)");
      const tx2 = await tokenB.transfer(PAIR_ADDRESS, amountBWei);
      await tx2.wait();

      setStatus("Minting LP tokens... (check MetaMask)");
      const tx3 = await pair.mint(account);
      await tx3.wait();

      setStatus("Liquidity added!");
      setLiqAmountA("");
      setLiqAmountB("");
      await refresh(account);
    } catch (err: any) {
      setError(err.message ?? String(err));
      setStatus("");
    }
  }

  return (
    <div className="page">
      <div className="navbar">
        <div className="brand">
          <span className="brand-mark" />
          SWAPPER
        </div>
        {account && (
          <div className="account-pill">
            <span className="account-dot" />
            <span>{fmt(ethBalance)} ETH</span>
            <span className="account-address">{truncate(account)}</span>
          </div>
        )}
      </div>

      {!account ? (
        <div className="hero">
          <h1>Trade tokens, no order book required</h1>
          <p>A tiny constant-product AMM, built from scratch — connect a wallet to swap or provide liquidity.</p>
          <button className="btn-primary" onClick={connect}>
            Connect Wallet
          </button>
          {error && <div className="error-banner">{error}</div>}
        </div>
      ) : (
        <>
          <div className="wallet-summary">
            <span className="chip">
              MTA <b>{fmt(balances.a)}</b>
            </span>
            <span className="chip">
              MTB <b>{fmt(balances.b)}</b>
            </span>
            <span className="chip">
              LP <b>{fmt(lpBalance)}</b>
            </span>
          </div>

          <div className="card">
            <div className="tabs">
              <button className={`tab ${tab === "swap" ? "active" : ""}`} onClick={() => setTab("swap")}>
                Swap
              </button>
              <button className={`tab ${tab === "liquidity" ? "active" : ""}`} onClick={() => setTab("liquidity")}>
                Add Liquidity
              </button>
            </div>

            {tab === "swap" ? (
              <div>
                <div className="field">
                  <div className="field-label">You pay</div>
                  <div className="field-row">
                    <input
                      type="text"
                      placeholder="0.0"
                      value={swapAmountIn}
                      onChange={(e) => setSwapAmountIn(e.target.value)}
                    />
                    <span className="token-badge">
                      <TokenDot symbol={sellSymbol} />
                      {sellSymbol}
                    </span>
                  </div>
                  <div className="field-sub">
                    <span>Balance: {fmt(sellBalance)}</span>
                    <button className="max-btn" onClick={() => setSwapAmountIn(sellBalance)}>
                      MAX
                    </button>
                  </div>
                </div>

                <div className="swap-flip-row">
                  <button className="swap-flip-btn" onClick={flipDirection} aria-label="Flip direction">
                    <SwapIcon />
                  </button>
                </div>

                <div className="field field-gap">
                  <div className="field-label">You receive (estimated)</div>
                  <div className="field-row">
                    <input
                      className="readonly"
                      type="text"
                      placeholder="0.0"
                      value={estimatedOut !== null ? formatUnits(estimatedOut, 18) : ""}
                      readOnly
                    />
                    <span className="token-badge">
                      <TokenDot symbol={buySymbol} />
                      {buySymbol}
                    </span>
                  </div>
                </div>

                <button className="btn-primary submit-btn" onClick={handleSwap} disabled={!swapAmountIn}>
                  Swap
                </button>
              </div>
            ) : (
              <div>
                <div className="field">
                  <div className="field-label">Token A</div>
                  <div className="field-row">
                    <input
                      type="text"
                      placeholder="0.0"
                      value={liqAmountA}
                      onChange={(e) => handleAmountAChange(e.target.value)}
                    />
                    <span className="token-badge">
                      <TokenDot symbol="MTA" />
                      MTA
                    </span>
                  </div>
                  <div className="field-sub">
                    <span>Balance: {fmt(balances.a)}</span>
                  </div>
                </div>

                <div className="field field-gap">
                  <div className="field-label">Token B</div>
                  <div className="field-row">
                    <input
                      type="text"
                      placeholder="0.0"
                      value={liqAmountB}
                      onChange={(e) => setLiqAmountB(e.target.value)}
                    />
                    <span className="token-badge">
                      <TokenDot symbol="MTB" />
                      MTB
                    </span>
                  </div>
                  <div className="field-sub">
                    <span>Balance: {fmt(balances.b)}</span>
                  </div>
                </div>

                <p className="hint">
                  Token B auto-fills to match the pool's current ratio. You can edit it, but an imbalanced deposit
                  only earns LP credit for the smaller side.
                </p>

                <button
                  className="btn-primary submit-btn"
                  onClick={handleAddLiquidity}
                  disabled={!liqAmountA || !liqAmountB}
                >
                  Add Liquidity
                </button>
              </div>
            )}

            {status && <div className="status-banner">{status}</div>}
            {error && <div className="error-banner">{error}</div>}
          </div>

          <div className="pool-stats">
            <div className="stat-box">
              <div className="stat-label">Pool — MTA</div>
              <div className="stat-value">{fmt(formatUnits(reserves.a, 18))}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Pool — MTB</div>
              <div className="stat-value">{fmt(formatUnits(reserves.b, 18))}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
