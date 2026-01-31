"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { NextPage } from "next";
import { parseEther, formatEther } from "viem";
import { useAccount, useReadContract, useWriteContract, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { foundry } from "viem/chains";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { ERC20_ABI, CLAWD_TOKEN_ADDRESS } from "~~/utils/bountyBoard";

const PostJobPage: NextPage = () => {
  const router = useRouter();
  const { address: connectedAddress, chain: accountChain } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  // Form state
  const [description, setDescription] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [auctionDuration, setAuctionDuration] = useState("3600");
  const [workDeadline, setWorkDeadline] = useState("86400");

  // Loading states
  const [isSwitching, setIsSwitching] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  // Get CLAWD token address from contract
  const { data: clawdAddress } = useScaffoldReadContract({
    contractName: "AgentBountyBoard",
    functionName: "clawd",
  });

  const tokenAddr = clawdAddress || CLAWD_TOKEN_ADDRESS;

  // Get bounty board contract address
  const boardAddress = "0x25d23b63f166ec74b87b40cbcc5548d29576c56c" as const;

  // Read allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddr as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: connectedAddress ? [connectedAddress, boardAddress] : undefined,
    query: { enabled: !!connectedAddress },
  });

  // Read balance
  const { data: balance } = useReadContract({
    address: tokenAddr as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: connectedAddress ? [connectedAddress] : undefined,
    query: { enabled: !!connectedAddress },
  });

  // Approve CLAWD
  const { writeContractAsync: approveAsync } = useWriteContract();

  // Post job
  const { writeContractAsync: writeBoard, isMining } = useScaffoldWriteContract({
    contractName: "AgentBountyBoard",
  });

  const maxPriceWei = maxPrice ? parseEther(maxPrice) : 0n;
  const needsApproval = !allowance || (allowance as bigint) < maxPriceWei;
  const isWrongNetwork = accountChain?.id !== foundry.id;
  const isFormValid = description.trim() && minPrice && maxPrice && auctionDuration && workDeadline &&
    parseFloat(minPrice) > 0 && parseFloat(maxPrice) > parseFloat(minPrice);

  const handleSwitchNetwork = async () => {
    setIsSwitching(true);
    try {
      await switchChainAsync({ chainId: foundry.id });
    } catch (e) {
      console.error("Switch network failed:", e);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await approveAsync({
        address: tokenAddr as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [boardAddress, maxPriceWei],
      });
      // Wait a moment then refetch
      setTimeout(() => refetchAllowance(), 2000);
    } catch (e) {
      console.error("Approve failed:", e);
    } finally {
      setIsApproving(false);
    }
  };

  const handlePostJob = async () => {
    setIsPosting(true);
    try {
      await writeBoard({
        functionName: "postJob",
        args: [
          description,
          parseEther(minPrice),
          parseEther(maxPrice),
          BigInt(auctionDuration),
          BigInt(workDeadline),
        ],
      });
      // Redirect to home after posting
      router.push("/");
    } catch (e) {
      console.error("Post job failed:", e);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="flex flex-col grow items-center px-4 py-8">
      <div className="w-full max-w-2xl">
        <h2 className="text-3xl font-bold mb-6">📝 Post a New Job</h2>

        <div className="card bg-base-300 shadow-xl">
          <div className="card-body">
            {/* Description */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Job Description</span>
              </label>
              <textarea
                className="textarea textarea-bordered h-32 bg-base-100"
                placeholder="Describe the work you need done..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Price fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Min Price (CLAWD)</span>
                </label>
                <input
                  type="number"
                  className="input input-bordered bg-base-100"
                  placeholder="10"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  min="0"
                  step="any"
                />
                <label className="label">
                  <span className="label-text-alt opacity-60">Final auction price</span>
                </label>
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Max Price (CLAWD)</span>
                </label>
                <input
                  type="number"
                  className="input input-bordered bg-base-100"
                  placeholder="100"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  min="0"
                  step="any"
                />
                <label className="label">
                  <span className="label-text-alt opacity-60">Starting auction price (escrowed)</span>
                </label>
              </div>
            </div>

            {/* Duration fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Auction Duration (seconds)</span>
                </label>
                <input
                  type="number"
                  className="input input-bordered bg-base-100"
                  placeholder="3600"
                  value={auctionDuration}
                  onChange={(e) => setAuctionDuration(e.target.value)}
                  min="60"
                />
                <label className="label">
                  <span className="label-text-alt opacity-60">
                    {auctionDuration ? `≈ ${(parseInt(auctionDuration) / 3600).toFixed(1)} hours` : ""}
                  </span>
                </label>
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Work Deadline (seconds)</span>
                </label>
                <input
                  type="number"
                  className="input input-bordered bg-base-100"
                  placeholder="86400"
                  value={workDeadline}
                  onChange={(e) => setWorkDeadline(e.target.value)}
                  min="60"
                />
                <label className="label">
                  <span className="label-text-alt opacity-60">
                    {workDeadline ? `≈ ${(parseInt(workDeadline) / 3600).toFixed(1)} hours after claim` : ""}
                  </span>
                </label>
              </div>
            </div>

            {/* Estimated cost box */}
            {maxPrice && (
              <div className="alert mt-4">
                <div>
                  <span className="font-semibold">💰 Estimated Escrow:</span>{" "}
                  <span className="text-primary font-bold">{maxPrice} CLAWD</span>
                  <span className="text-xs block opacity-60 mt-1">
                    Max price will be escrowed. Unused amount refunded on completion.
                  </span>
                </div>
              </div>
            )}

            {/* Balance info */}
            {connectedAddress && balance !== undefined && (
              <div className="text-sm opacity-60 mt-2">
                Your balance: {parseFloat(formatEther(balance as bigint)).toFixed(2)} CLAWD
              </div>
            )}

            {/* Three-button flow: Switch → Approve → Post */}
            <div className="mt-6">
              {!connectedAddress ? (
                <div className="alert alert-warning">
                  <span>Please connect your wallet to post a job</span>
                </div>
              ) : isWrongNetwork ? (
                <button
                  className="btn btn-primary w-full"
                  onClick={handleSwitchNetwork}
                  disabled={isSwitching}
                >
                  {isSwitching ? (
                    <><span className="loading loading-spinner loading-sm"></span> Switching Network...</>
                  ) : (
                    "🔗 Switch to Local Network"
                  )}
                </button>
              ) : needsApproval && isFormValid ? (
                <button
                  className="btn btn-warning w-full"
                  onClick={handleApprove}
                  disabled={isApproving || !isFormValid}
                >
                  {isApproving ? (
                    <><span className="loading loading-spinner loading-sm"></span> Approving CLAWD...</>
                  ) : (
                    `✅ Approve ${maxPrice} CLAWD`
                  )}
                </button>
              ) : (
                <button
                  className="btn btn-primary w-full"
                  onClick={handlePostJob}
                  disabled={isPosting || isMining || !isFormValid}
                >
                  {isPosting || isMining ? (
                    <><span className="loading loading-spinner loading-sm"></span> Posting Job...</>
                  ) : (
                    "🚀 Post Job"
                  )}
                </button>
              )}
            </div>

            {!isFormValid && description && (
              <div className="text-sm text-error mt-2">
                Please fill in all fields. Max price must be greater than min price.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostJobPage;
