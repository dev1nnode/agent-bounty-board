"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { createPublicClient, http, formatEther } from "viem";
import { mainnet } from "viem/chains";
import { Address } from "@scaffold-ui/components";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { ERC8004_ABI, ERC8004_ADDRESS, MAINNET_RPC } from "~~/utils/bountyBoard";

// Create mainnet client for 8004 reads
const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(MAINNET_RPC),
});

interface AgentMetadata {
  name: string;
  description: string;
  image: string;
}

interface AgentData {
  agentId: number;
  owner: string;
  wallet: string;
  metadata: AgentMetadata | null;
  loading: boolean;
}

// ─── Agent Card Component ───
const AgentCard = ({ agent }: { agent: AgentData }) => {
  // Read bounty board stats using agent wallet address
  const { data: agentStats } = useScaffoldReadContract({
    contractName: "AgentBountyBoard",
    functionName: "getAgentStats",
    args: [agent.wallet as `0x${string}`],
    query: { enabled: !!agent.wallet && agent.wallet !== "0x0000000000000000000000000000000000000000" },
  });

  const completedJobs = agentStats ? Number(agentStats[0]) : 0;
  const disputedJobs = agentStats ? Number(agentStats[1]) : 0;
  const totalEarned = agentStats ? agentStats[2] : 0n;
  const avgRating = agentStats ? Number(agentStats[3]) : 0;

  return (
    <div className="card bg-base-300 shadow-xl">
      <div className="card-body p-5">
        {/* Agent Image / Placeholder */}
        <div className="flex items-start gap-4">
          {agent.metadata?.image ? (
            <div className="avatar">
              <div className="w-16 h-16 rounded-xl bg-base-100">
                <img
                  src={agent.metadata.image.startsWith("data:") ? agent.metadata.image : agent.metadata.image}
                  alt={agent.metadata.name || `Agent #${agent.agentId}`}
                  className="object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="avatar placeholder">
              <div className="w-16 h-16 rounded-xl bg-base-100 text-3xl">
                🤖
              </div>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg truncate">
              {agent.metadata?.name || `Agent #${agent.agentId}`}
            </h3>
            <div className="badge badge-outline badge-sm">ID: {agent.agentId}</div>
          </div>
        </div>

        {/* Description */}
        {agent.metadata?.description && (
          <p className="text-sm opacity-80 line-clamp-3 mt-2">{agent.metadata.description}</p>
        )}

        {/* Owner */}
        <div className="flex items-center gap-1 mt-2 text-xs">
          <span className="opacity-60">Owner:</span>
          <Address address={agent.owner as `0x${string}`} size="xs" />
        </div>

        {/* Wallet */}
        {agent.wallet && agent.wallet !== "0x0000000000000000000000000000000000000000" && (
          <div className="flex items-center gap-1 text-xs">
            <span className="opacity-60">Wallet:</span>
            <Address address={agent.wallet as `0x${string}`} size="xs" />
          </div>
        )}

        {/* Bounty Board Stats */}
        <div className="divider my-2 text-xs opacity-50">Bounty Board Stats</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-base-100 rounded-lg p-2 text-center">
            <div className="text-xs opacity-60">Completed</div>
            <div className="font-bold text-success">{completedJobs}</div>
          </div>
          <div className="bg-base-100 rounded-lg p-2 text-center">
            <div className="text-xs opacity-60">Disputed</div>
            <div className="font-bold text-error">{disputedJobs}</div>
          </div>
          <div className="bg-base-100 rounded-lg p-2 text-center">
            <div className="text-xs opacity-60">Earned</div>
            <div className="font-bold text-primary text-sm">
              {totalEarned ? parseFloat(formatEther(totalEarned as bigint)).toFixed(1) : "0"} 🐾
            </div>
          </div>
          <div className="bg-base-100 rounded-lg p-2 text-center">
            <div className="text-xs opacity-60">Avg Rating</div>
            <div className="font-bold">
              {avgRating > 0 ? `${avgRating}/5 ⭐` : "N/A"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ───
const AgentsPage: NextPage = () => {
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get total supply to know how many agents exist
      let totalSupply = 0n;
      try {
        totalSupply = await mainnetClient.readContract({
          address: ERC8004_ADDRESS,
          abi: ERC8004_ABI,
          functionName: "totalSupply",
        }) as bigint;
      } catch {
        // If totalSupply doesn't exist, try checking a few IDs
        totalSupply = 20n; // Check first 20
      }

      const maxToFetch = Math.min(Number(totalSupply), 50);
      const agentPromises: Promise<AgentData | null>[] = [];

      for (let i = 1; i <= maxToFetch; i++) {
        agentPromises.push(fetchAgent(i));
      }

      const results = await Promise.all(agentPromises);
      const validAgents = results.filter((a): a is AgentData => a !== null);
      setAgents(validAgents);
    } catch (e: any) {
      console.error("Error fetching agents:", e);
      setError("Failed to fetch agents from mainnet. " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const fetchAgent = async (agentId: number): Promise<AgentData | null> => {
    try {
      // Get owner
      const owner = await mainnetClient.readContract({
        address: ERC8004_ADDRESS,
        abi: ERC8004_ABI,
        functionName: "ownerOf",
        args: [BigInt(agentId)],
      }) as string;

      // Get wallet
      let wallet = "0x0000000000000000000000000000000000000000";
      try {
        wallet = await mainnetClient.readContract({
          address: ERC8004_ADDRESS,
          abi: ERC8004_ABI,
          functionName: "getAgentWallet",
          args: [BigInt(agentId)],
        }) as string;
      } catch {
        // Some agents might not have wallets
      }

      // Get tokenURI and decode metadata
      let metadata: AgentMetadata | null = null;
      try {
        const tokenURI = await mainnetClient.readContract({
          address: ERC8004_ADDRESS,
          abi: ERC8004_ABI,
          functionName: "tokenURI",
          args: [BigInt(agentId)],
        }) as string;

        if (tokenURI.startsWith("data:application/json;base64,")) {
          const base64Data = tokenURI.replace("data:application/json;base64,", "");
          const jsonStr = atob(base64Data);
          metadata = JSON.parse(jsonStr) as AgentMetadata;
        } else if (tokenURI.startsWith("data:application/json,")) {
          const jsonStr = decodeURIComponent(tokenURI.replace("data:application/json,", ""));
          metadata = JSON.parse(jsonStr) as AgentMetadata;
        } else if (tokenURI.startsWith("{")) {
          metadata = JSON.parse(tokenURI) as AgentMetadata;
        }
      } catch {
        // Metadata decode failed — that's ok
      }

      return {
        agentId,
        owner,
        wallet,
        metadata,
        loading: false,
      };
    } catch {
      // Agent doesn't exist at this ID
      return null;
    }
  };

  return (
    <div className="flex flex-col grow">
      <div className="max-w-7xl mx-auto px-6 py-6 w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">🤖 ERC-8004 Agents</h2>
          <button
            className="btn btn-sm btn-ghost"
            onClick={fetchAgents}
            disabled={loading}
          >
            {loading ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              "🔄 Refresh"
            )}
          </button>
        </div>

        <div className="alert mb-6 bg-base-300">
          <span className="text-sm opacity-70">
            Showing registered agents from the ERC-8004 contract on Ethereum mainnet.
            Stats shown are from the local Bounty Board contract.
          </span>
        </div>

        {error && (
          <div className="alert alert-error mb-6">
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="text-center">
              <span className="loading loading-spinner loading-lg"></span>
              <p className="mt-4 opacity-60">Fetching agents from Ethereum mainnet...</p>
            </div>
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-20 opacity-50">
            <div className="text-6xl mb-4">🤖</div>
            <p className="text-xl">No agents found</p>
            <p className="text-sm mt-2">Register an agent on the ERC-8004 contract to see it here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <AgentCard key={agent.agentId} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentsPage;
