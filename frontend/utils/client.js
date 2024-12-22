import { createPublicClient, http } from "viem";
import { sepolia, hardhat } from 'viem/chains';
const RPC = process.env.NEXT_PUBLIC_ALCHEMY_RPC || "";

export const publicClient = createPublicClient({
    chain: hardhat,
    transport: http(),
    // transport: http(RPC),
})